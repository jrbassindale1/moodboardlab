import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_TEXT_URL =
  process.env.GEMINI_TEXT_ENDPOINT ||
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PRIMARY_OPENAI_IMAGE_MODEL = (process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5").trim();
const FALLBACK_OPENAI_IMAGE_MODEL = (process.env.OPENAI_IMAGE_FALLBACK_MODEL || "gpt-image-1").trim();
const OPENAI_IMAGE_GENERATION_URL =
  process.env.OPENAI_IMAGE_GENERATION_URL || "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGE_EDIT_URL = process.env.OPENAI_IMAGE_EDIT_URL || "https://api.openai.com/v1/images/edits";

type GeminiProxyRequest = {
  mode?: "text" | "image";
  payload?: unknown;
  prompt?: string;
  systemPrompt?: string;
};

type ImageGenerationPayload = {
  prompt: string;
  aspectRatio?: string;
  numberOfImages?: number;
  imageSize?: string;
  quality?: "low" | "medium" | "high" | "auto";
  inlineImages?: InlineImageInput[];
};

type ImageRequestResult<T> = {
  result: T;
  fallbackUsed: boolean;
  modelUsed: string;
};

type InlineImageInput = {
  data: string;
  mimeType: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const buildPromptPayload = (prompt?: string, systemPrompt?: string) => {
  if (!prompt?.trim()) return null;
  const parts = [];
  if (systemPrompt?.trim()) {
    parts.push({ text: systemPrompt.trim() });
  }
  parts.push({ text: prompt.trim() });

  return {
    contents: [
      {
        parts
      }
    ]
  };
};

const normalizeDataUri = (data?: string | null, mimeType = "image/png") => {
  if (!data) return null;
  if (data.startsWith("data:")) return data;
  return `data:${mimeType};base64,${data}`;
};

const extractImagesFromOpenAIResponse = async (
  response: any,
  ctx: InvocationContext
): Promise<string[]> => {
  const images: string[] = [];
  const outputFormat = typeof response?.output_format === "string" ? response.output_format : "png";
  const defaultMimeType =
    outputFormat === "jpeg" ? "image/jpeg" : outputFormat === "webp" ? "image/webp" : "image/png";

  const results = Array.isArray(response?.data) ? response.data : [];
  for (const item of results) {
    if (typeof item?.b64_json === "string" && item.b64_json.trim()) {
      images.push(`data:${defaultMimeType};base64,${item.b64_json}`);
      continue;
    }
    if (typeof item?.url === "string" && item.url.trim()) {
      try {
        const upstreamResponse = await fetch(item.url);
        if (!upstreamResponse.ok) continue;
        const mimeType = upstreamResponse.headers.get("content-type")?.split(";")[0] || defaultMimeType;
        const bytes = await upstreamResponse.arrayBuffer();
        images.push(`data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`);
      } catch (error) {
        ctx.warn("Failed to download URL-based image result from OpenAI", error);
      }
    }
  }

  return images;
};

const clampImageCount = (value: unknown, fallback = 1): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(10, Math.trunc(parsed)));
};

const resolveOpenAIImageModel = (): string =>
  (PRIMARY_OPENAI_IMAGE_MODEL || "gpt-image-1.5").trim() || "gpt-image-1.5";

const resolveOpenAISize = (
  aspectRatio?: string
): "1024x1024" | "1536x1024" | "1024x1536" => {
  const ratio = (aspectRatio || "").trim();
  if (!ratio) return "1024x1024";

  const match = ratio.match(/^([0-9]+(?:\.[0-9]+)?)\s*:\s*([0-9]+(?:\.[0-9]+)?)$/);
  if (!match) return "1024x1024";

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) return "1024x1024";

  const numericRatio = width / height;
  if (numericRatio > 1.12) return "1536x1024";
  if (numericRatio < 0.88) return "1024x1536";
  return "1024x1024";
};

const normalizeOpenAIQuality = (
  value?: string
): "low" | "medium" | "high" | "auto" | null => {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "low") return "low";
  if (normalized === "medium") return "medium";
  if (normalized === "high") return "high";
  if (normalized === "auto") return "auto";
  return null;
};

const resolveOpenAIQuality = (
  imageSize?: string,
  requestedQuality?: string
): "low" | "medium" | "high" | "auto" => {
  const explicitQuality = normalizeOpenAIQuality(requestedQuality);
  if (explicitQuality) return explicitQuality;
  if (imageSize?.toUpperCase() === "4K") return "high";
  // Default to medium quality to keep output cost lower than high quality renders.
  return "medium";
};

const extractTextAndInlineImages = (payload: any) => {
  const contents = Array.isArray(payload?.contents) ? payload.contents : [];
  const textParts: string[] = [];
  const inlineImages: InlineImageInput[] = [];

  for (const content of contents) {
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    for (const part of parts) {
      if (typeof part?.text === "string" && part.text.trim()) {
        textParts.push(part.text.trim());
      }

      const inlineData = part?.inlineData || part?.inline_data;
      if (typeof inlineData?.data === "string" && inlineData.data.trim()) {
        inlineImages.push({
          data: inlineData.data.trim(),
          mimeType: inlineData?.mimeType || inlineData?.mime_type || "image/png"
        });
      }
    }
  }

  return {
    prompt: textParts.join("\n\n").trim(),
    inlineImages
  };
};

const isOpenAIImageError = (error: unknown): boolean => {
  if (!error) return false;
  if (typeof error === "string") return /openai/i.test(error);
  if (!(error instanceof Error)) return false;
  return /openai/i.test(error.message);
};

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const isQuotaOrRateLimitError = (error: unknown): boolean => {
  const message = extractErrorMessage(error);

  return [
    /\b429\b/i,
    /too many requests/i,
    /quota exceeded/i,
    /rate[- ]?limit/i,
    /insufficient[_-]?quota/i,
    /resource[_-]?exhausted/i
  ].some((pattern) => pattern.test(message));
};

const isModelAvailabilityError = (error: unknown): boolean => {
  const message = extractErrorMessage(error);
  return [
    /model.*not found/i,
    /does not exist/i,
    /do not have access to model/i,
    /model_not_found/i
  ].some((pattern) => pattern.test(message));
};

const shouldRetryWithFallbackModel = (error: unknown, currentModel: string): boolean => {
  if (!currentModel?.trim()) return false;
  if (!FALLBACK_OPENAI_IMAGE_MODEL.trim()) return false;
  if (currentModel.trim().toLowerCase() === FALLBACK_OPENAI_IMAGE_MODEL.toLowerCase()) return false;
  return isQuotaOrRateLimitError(error) || isModelAvailabilityError(error);
};

async function runImageRequestWithFallback<T>(
  imageModel: string,
  ctx: InvocationContext,
  runner: (modelName: string) => Promise<T>
): Promise<ImageRequestResult<T>> {
  try {
    const result = await runner(imageModel);
    return {
      result,
      fallbackUsed: false,
      modelUsed: imageModel
    };
  } catch (error) {
    if (!shouldRetryWithFallbackModel(error, imageModel)) {
      throw error;
    }

    const fallbackModel = FALLBACK_OPENAI_IMAGE_MODEL.trim();
    if (!fallbackModel) {
      throw error;
    }
    ctx.warn(`Image model ${imageModel} failed. Retrying once with ${fallbackModel}.`);
    const result = await runner(fallbackModel);
    return {
      result,
      fallbackUsed: true,
      modelUsed: fallbackModel
    };
  }
}

const buildOpenAIImageError = (
  responseStatus: number,
  rawBody: string,
  parsedBody: any
): Error => {
  const message =
    parsedBody?.error?.message ||
    parsedBody?.message ||
    (rawBody?.trim() ? rawBody.trim() : `OpenAI image API error (status ${responseStatus}).`);
  const code = parsedBody?.error?.code ? ` [${parsedBody.error.code}]` : "";
  return new Error(`${message}${code}`.trim());
};

const buildOpenAIImageRequestPayload = (
  payload: ImageGenerationPayload,
  modelName: string
): Record<string, unknown> => {
  const hasInlineImages = Array.isArray(payload.inlineImages) && payload.inlineImages.length > 0;
  const size = hasInlineImages ? "auto" : resolveOpenAISize(payload.aspectRatio);
  const quality = resolveOpenAIQuality(payload.imageSize, payload.quality);
  const imageCount = clampImageCount(payload.numberOfImages ?? 1, 1);

  const request: Record<string, unknown> = {
    model: modelName,
    prompt: payload.prompt,
    n: imageCount,
    size,
    quality,
    output_format: "png"
  };

  if (hasInlineImages) {
    request.images = payload.inlineImages.slice(0, 16).map((image) => ({
      image_url: normalizeDataUri(image.data, image.mimeType || "image/png")
    }));
    // Keep turn-by-turn/image-edit generations as close as possible to source.
    request.input_fidelity = "high";
  }

  return request;
};

async function callOpenAIImageApi(
  imageModel: string,
  payload: ImageGenerationPayload,
  ctx: InvocationContext
): Promise<string[]> {
  if (!OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is not set in Function App configuration.");
  }
  const hasInlineImages = Array.isArray(payload.inlineImages) && payload.inlineImages.length > 0;
  const endpoint = hasInlineImages ? OPENAI_IMAGE_EDIT_URL : OPENAI_IMAGE_GENERATION_URL;
  const requestPayload = buildOpenAIImageRequestPayload(payload, imageModel);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestPayload)
  });

  const rawBody = await response.text();
  let parsedBody: any = null;
  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    throw buildOpenAIImageError(response.status, rawBody, parsedBody);
  }

  const images = await extractImagesFromOpenAIResponse(parsedBody, ctx);
  if (!images.length) {
    ctx.log("OpenAI image generation returned no images", parsedBody);
    throw new Error("No images returned from OpenAI");
  }
  return images;
}

async function generateImageWithOpenAI(payload: ImageGenerationPayload, ctx: InvocationContext) {
  const imageModel = resolveOpenAIImageModel();

  const runWithModel = async (modelName: string) => callOpenAIImageApi(modelName, payload, ctx);

  return runImageRequestWithFallback(imageModel, ctx, runWithModel);
}

export async function generateMoodboardHandler(
  req: HttpRequest,
  ctx: InvocationContext
): Promise<HttpResponseInit> {
  if (req.method === "OPTIONS") {
    return {
      status: 204,
      headers: corsHeaders
    };
  }

  let body: GeminiProxyRequest;
  try {
    body = (await req.json()) as GeminiProxyRequest;
  } catch (err) {
    ctx.log("Invalid JSON body", err);
    return {
      status: 400,
      body: "Invalid JSON body",
      headers: corsHeaders
    };
  }

  const mode = body.mode || "text";
  if (mode !== "text" && mode !== "image") {
    return {
      status: 400,
      body: "mode must be either 'text' or 'image'",
      headers: corsHeaders
    };
  }

  try {
    if (mode === "image") {
      const rawPayload = (body.payload ?? {}) as any;

      // Check if this is a simple icon generation request (just prompt string)
      const isSimpleIconRequest = typeof rawPayload.prompt === "string" && !rawPayload.contents;

      if (isSimpleIconRequest) {
        // Simple icon generation (for material icons)
        const prompt = (rawPayload?.prompt || body.prompt || "").trim();
        if (!prompt?.trim()) {
          return {
            status: 400,
            body: "prompt is required for image generation",
            headers: corsHeaders
          };
        }

        const imageResult = await generateImageWithOpenAI(
          {
            prompt,
            aspectRatio: rawPayload.aspectRatio || "1:1",
            numberOfImages: clampImageCount(rawPayload.numberOfImages || 1, 1),
            imageSize: rawPayload.imageSize || "1K",
            quality: normalizeOpenAIQuality(rawPayload.quality) || "medium"
          },
          ctx
        );

        return {
          status: 200,
          jsonBody: {
            images: imageResult.result,
            imageFallbackUsed: imageResult.fallbackUsed,
            imageModelUsed: imageResult.modelUsed
          },
          headers: corsHeaders
        };
      } else {
        const extracted = extractTextAndInlineImages(rawPayload);
        const prompt = extracted.prompt || String(rawPayload?.prompt || body?.prompt || "").trim();
        if (!prompt) {
          return {
            status: 400,
            body: "prompt is required for image generation",
            headers: corsHeaders
          };
        }

        // Extract imageConfig if provided
        const imageConfig = rawPayload.imageConfig || {};
        const finalAspectRatio = imageConfig.aspectRatio || "1:1";
        const finalImageSize = imageConfig.imageSize || "1K";
        const finalQuality =
          normalizeOpenAIQuality(imageConfig.quality) ||
          normalizeOpenAIQuality(rawPayload.quality) ||
          "medium";

        const imageResult = await generateImageWithOpenAI(
          {
            prompt,
            aspectRatio: finalAspectRatio,
            imageSize: finalImageSize,
            quality: finalQuality,
            numberOfImages: clampImageCount(rawPayload?.generationConfig?.candidateCount ?? 1, 1),
            inlineImages: extracted.inlineImages
          },
          ctx
        );

        return {
          status: 200,
          jsonBody: {
            imageFallbackUsed: imageResult.fallbackUsed,
            imageModelUsed: imageResult.modelUsed,
            candidates: [{
              content: {
                parts: imageResult.result.map(img => ({
                  inlineData: {
                    data: img.split(",")[1],
                    mimeType: img.split(";")[0].replace("data:", "")
                  }
                }))
              }
            }]
          },
          headers: corsHeaders
        };
      }
    }

    const payload = body.payload ?? buildPromptPayload(body.prompt, body.systemPrompt);
    if (!payload) {
      return {
        status: 400,
        body: "payload or prompt is required",
        headers: corsHeaders
      };
    }
    if (!GEMINI_API_KEY?.trim()) {
      return {
        status: 500,
        body: "GEMINI_API_KEY is not set in Function App configuration.",
        headers: corsHeaders
      };
    }

    const targetUrl = GEMINI_TEXT_URL + `?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const geminiResponse = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      ctx.log("Gemini API error", geminiResponse.status, errorText);

      return {
        status: geminiResponse.status,
        body: errorText || "Gemini API error",
        headers: corsHeaders
      };
    }

    const data = await geminiResponse.json();

    return {
      status: 200,
      jsonBody: data,
      headers: corsHeaders
    };
  } catch (err: any) {
    const backendLabel = isOpenAIImageError(err) ? "OpenAI image backend" : "backend";
    ctx.log(`Error calling ${backendLabel}`, err?.message ?? err);
    return {
      status: 500,
      jsonBody: {
        error: {
          message: err?.message || `Failed to call ${backendLabel}`,
          details: err?.toString()
        }
      },
      headers: corsHeaders
    };
  }
}

app.http("generateMoodboard", {
  route: "generate-moodboard",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: generateMoodboardHandler
});
