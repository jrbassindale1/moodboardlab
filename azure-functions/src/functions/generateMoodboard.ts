import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_TEXT_URL =
  process.env.GEMINI_TEXT_ENDPOINT ||
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";
const PRIMARY_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const FALLBACK_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || PRIMARY_GEMINI_IMAGE_MODEL;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set in Function App configuration.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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
};

type ImageRequestResult<T> = {
  result: T;
  fallbackUsed: boolean;
  modelUsed: string;
};

type ImageValidationSettings = {
  rejectTextLikeArtifacts?: boolean;
  maxAttempts?: number;
};

type TextArtifactDetectionResult = {
  hasTextLikeArtifacts: boolean;
  confidence: "low" | "medium" | "high";
  reason: string;
  detectedText: string[];
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
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

const dataUriToInlineData = (dataUrl: string) => {
  const [meta, content] = dataUrl.split(",");
  const mimeMatch = meta?.match(/data:(.*);base64/);
  return {
    inlineData: {
      mimeType: mimeMatch?.[1] || "image/png",
      data: content || ""
    }
  };
};

const extractImagesFromResponse = (response: any): string[] => {
  const images: string[] = [];

  const directImages = Array.isArray(response?.images) ? response.images : [];
  for (const img of directImages) {
    const normalized = normalizeDataUri(img?.data, img?.mimeType || img?.mime_type || "image/png");
    if (normalized) images.push(normalized);
  }

  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? [];
    for (const part of parts) {
      const inlineData = part?.inlineData || part?.inline_data;
      const normalized = normalizeDataUri(
        inlineData?.data,
        inlineData?.mimeType || inlineData?.mime_type || "image/png"
      );
      if (normalized) images.push(normalized);
    }
  }

  return images;
};

const extractTextFromResponse = (response: any): string => {
  const directText =
    typeof response?.text === "string"
      ? response.text
      : typeof response?.result === "string"
      ? response.result
      : typeof response?.response === "string"
      ? response.response
      : "";

  if (directText.trim()) return directText.trim();

  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  return candidates
    .flatMap((candidate: any) => candidate?.content?.parts ?? candidate?.parts ?? [])
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
};

const parseJsonObject = (raw: string) => {
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) return null;
    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
};

const clampInteger = (value: unknown, min: number, max: number, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  return Math.min(max, Math.max(min, rounded));
};

const appendNoTextRetryInstruction = (payload: any, attempt: number) => {
  if (attempt <= 1) return payload;

  const contents = Array.isArray(payload?.contents) ? payload.contents : [];
  if (!contents.length) return payload;

  const retryInstruction = {
    text:
      "VALIDATION FAILURE: the previous image contained text-like artifacts. Regenerate it with absolutely no text, numbers, labels, logos, symbols, pseudo-text, scribbles, or writing-like marks anywhere. Use only blank, unlabeled material samples and clean architectural context."
  };

  const [firstContent, ...rest] = contents;
  const firstParts = Array.isArray(firstContent?.parts) ? firstContent.parts : [];

  return {
    ...payload,
    contents: [
      {
        ...firstContent,
        parts: [...firstParts, retryInstruction]
      },
      ...rest
    ]
  };
};

async function callGeminiTextApi(payload: unknown, ctx: InvocationContext) {
  const targetUrl = GEMINI_TEXT_URL + `?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const geminiResponse = await fetch(targetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    ctx.log("Gemini API error", geminiResponse.status, errorText);
    throw new Error(errorText || `Gemini API error (${geminiResponse.status})`);
  }

  return geminiResponse.json();
}

async function detectTextArtifactsInImage(
  imageDataUri: string,
  ctx: InvocationContext
): Promise<TextArtifactDetectionResult | null> {
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              'Inspect this image for any text or text-like artifacts. Return ONLY valid JSON with this schema: {"hasTextLikeArtifacts":boolean,"confidence":"low|medium|high","reason":"string","detectedText":["string"]}. Set hasTextLikeArtifacts=true if you see any readable or partially readable words, letters, numbers, labels, captions, logos, watermarks, signatures, stamps, typographic symbols used like writing, pseudo-text, dimension strings, or scribbles/marks that resemble writing. Be conservative: if it looks like writing, return true.'
          },
          dataUriToInlineData(imageDataUri)
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 240
    }
  };

  try {
    const response = await callGeminiTextApi(payload, ctx);
    const rawText = extractTextFromResponse(response);
    const parsed = parseJsonObject(rawText) as Record<string, unknown> | null;
    if (!parsed) {
      ctx.warn("[Moodboard Validation] Could not parse detector response as JSON.");
      return null;
    }

    const detectedTextRaw = Array.isArray(parsed.detectedText) ? parsed.detectedText : [];
    const confidenceRaw = typeof parsed.confidence === "string" ? parsed.confidence.toLowerCase() : "";
    const confidence =
      confidenceRaw === "low" || confidenceRaw === "high" ? confidenceRaw : "medium";
    const reason =
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : "Detector flagged possible text-like marks.";
    const hasTextLikeArtifacts =
      parsed.hasTextLikeArtifacts === true ||
      parsed.containsText === true ||
      parsed.hasText === true ||
      detectedTextRaw.length > 0;

    return {
      hasTextLikeArtifacts,
      confidence,
      reason,
      detectedText: detectedTextRaw
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .slice(0, 6)
    };
  } catch (error) {
    ctx.warn(
      `[Moodboard Validation] Detector request failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

const resolveImageModel = (ctx: InvocationContext): string => {
  const configuredModel = (GEMINI_IMAGE_MODEL || "").trim();
  if (!configuredModel) return PRIMARY_GEMINI_IMAGE_MODEL;
  if (configuredModel.startsWith("imagen-")) {
    ctx.warn(
      `Configured GEMINI_IMAGE_MODEL (${configuredModel}) uses predict-only API. Falling back to ${PRIMARY_GEMINI_IMAGE_MODEL} for generateContent.`
    );
    return PRIMARY_GEMINI_IMAGE_MODEL;
  }
  return configuredModel;
};

const isQuotaOrRateLimitError = (error: unknown): boolean => {
  if (!error) return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : (() => {
          try {
            return JSON.stringify(error);
          } catch {
            return String(error);
          }
        })();

  return [
    /\b429\b/i,
    /too many requests/i,
    /quota exceeded/i,
    /rate[- ]?limit/i,
    /resource_exhausted/i,
    /generate_requests_per_model_per_day/i
  ].some((pattern) => pattern.test(message));
};

const shouldRetryWithFallbackModel = (error: unknown, currentModel: string): boolean => {
  if (!currentModel?.trim()) return false;
  if (currentModel.trim().toLowerCase() === FALLBACK_GEMINI_IMAGE_MODEL.toLowerCase()) return false;
  return isQuotaOrRateLimitError(error);
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

    ctx.warn(
      `[FALLBACK] Primary model ${imageModel} hit quota/rate limits. Switching to fallback: ${FALLBACK_GEMINI_IMAGE_MODEL}`
    );
    const result = await runner(FALLBACK_GEMINI_IMAGE_MODEL);
    ctx.log(`[FALLBACK] Successfully generated image using fallback model: ${FALLBACK_GEMINI_IMAGE_MODEL}`);
    return {
      result,
      fallbackUsed: true,
      modelUsed: FALLBACK_GEMINI_IMAGE_MODEL
    };
  }
}

async function generateImageWithGemini(payload: ImageGenerationPayload, ctx: InvocationContext) {
  const { prompt } = payload;
  const imageModel = resolveImageModel(ctx);
  ctx.log(`[Image Generation] Using model: ${imageModel}`);

  const runWithModel = async (modelName: string) => {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseModalities: ["IMAGE"]
      } as any
    });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    });

    const response = await result.response;
    const images = extractImagesFromResponse(response);

    if (!images.length) {
      ctx.log("Gemini image generation returned no images", response);
      throw new Error("No images returned from Gemini");
    }

    return images;
  };

  return runImageRequestWithFallback(imageModel, ctx, runWithModel);
}

async function generateComplexImageWithGemini(payload: any, ctx: InvocationContext) {
  const imageModel = resolveImageModel(ctx);

  return runImageRequestWithFallback(imageModel, ctx, async (modelName) => {
    const model = genAI.getGenerativeModel({
      model: modelName
    });
    const result = await model.generateContent(payload);
    const response = await result.response;
    const generatedImages = extractImagesFromResponse(response);

    if (!generatedImages.length) {
      ctx.log("Gemini moodboard generation returned no images", response);
      throw new Error("No images returned from Gemini");
    }

    return generatedImages;
  });
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
      const isSimpleIconRequest = typeof rawPayload.prompt === 'string' && !rawPayload.contents;

      if (isSimpleIconRequest) {
        // Simple icon generation (for material icons)
        const prompt = rawPayload?.prompt || body.prompt;
        if (!prompt?.trim()) {
          return {
            status: 400,
            body: "prompt is required for image generation",
            headers: corsHeaders
          };
        }

        const imageResult = await generateImageWithGemini(
          {
            prompt: prompt.trim(),
            aspectRatio: rawPayload.aspectRatio || "1:1",
            numberOfImages: rawPayload.numberOfImages || 1
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
        // Complex generation: moodboard (always 1:1) or material application (preserve input aspect ratio)
        const imageModel = resolveImageModel(ctx);

        // Detect if this is an apply materials request (has input image) or moodboard generation
        const hasInputImage = Array.isArray(rawPayload.contents) &&
          rawPayload.contents.some((c: any) =>
            Array.isArray(c?.parts) && c.parts.some((p: any) => p?.inlineData || p?.inline_data)
          );
        const generationType = hasInputImage ? 'Apply Materials' : 'Moodboard';
        ctx.log(`[${generationType}] Using model: ${imageModel}`);

        // Extract imageConfig if provided
        const imageConfig = rawPayload.imageConfig || {};
        const validation = (rawPayload.validation || {}) as ImageValidationSettings;
        const shouldValidateNoText = validation.rejectTextLikeArtifacts === true;
        const maxValidationAttempts = shouldValidateNoText
          ? clampInteger(validation.maxAttempts, 1, 2, 2)
          : 1;

        // For moodboard generation: always 1:1 and 1K
        // For material application: use provided aspect ratio (from input image) or default to 1:1
        const finalAspectRatio = imageConfig.aspectRatio || "1:1";
        const finalImageSize = imageConfig.imageSize || "1K";

        // Remove imageConfig and validation from root level if present
        const { imageConfig: _, validation: __, ...payloadWithoutImageConfig } = rawPayload;

        const baseGenerationPayload = {
          ...payloadWithoutImageConfig,
          generationConfig: {
            ...rawPayload.generationConfig,
            responseModalities: ["IMAGE"],
            imageConfig: {
              aspectRatio: finalAspectRatio,
              imageSize: finalImageSize
            }
          }
        };

        let imageResult: ImageRequestResult<string[]> | null = null;
        let rejectedAttempts = 0;
        let validationSkipped = false;

        for (let attempt = 1; attempt <= maxValidationAttempts; attempt += 1) {
          const generationPayload = appendNoTextRetryInstruction(baseGenerationPayload, attempt);
          const currentResult = await generateComplexImageWithGemini(generationPayload, ctx);
          imageResult = currentResult;

          if (!shouldValidateNoText) {
            break;
          }

          const firstImage = currentResult.result[0];
          if (!firstImage) {
            break;
          }

          const detection = await detectTextArtifactsInImage(firstImage, ctx);
          if (!detection) {
            validationSkipped = true;
            break;
          }

          if (!detection.hasTextLikeArtifacts) {
            break;
          }

          rejectedAttempts = attempt;
          ctx.warn(
            `[Moodboard Validation] Rejected attempt ${attempt}/${maxValidationAttempts} for text-like artifacts (${detection.confidence}). ${detection.reason}`
          );

          if (attempt === maxValidationAttempts) {
            const reasonSuffix = detection.reason ? ` Detector note: ${detection.reason}` : "";
            return {
              status: 422,
              jsonBody: {
                error: {
                  message: `Generated image contained text-like artifacts after ${maxValidationAttempts} attempt${maxValidationAttempts === 1 ? "" : "s"}. Please retry.${reasonSuffix}`
                }
              },
              headers: corsHeaders
            };
          }
        }

        if (!imageResult) {
          throw new Error("No images returned from Gemini");
        }

        return {
          status: 200,
          jsonBody: {
            imageFallbackUsed: imageResult.fallbackUsed,
            imageModelUsed: imageResult.modelUsed,
            textValidationAttempted: shouldValidateNoText,
            textValidationRejectedAttempts: rejectedAttempts,
            textValidationSkipped: validationSkipped,
            candidates: [{
              content: {
                parts: imageResult.result.map(img => ({
                  inlineData: {
                    data: img.split(',')[1],
                    mimeType: img.split(';')[0].replace('data:', '')
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

    const data = await callGeminiTextApi(payload, ctx);

    return {
      status: 200,
      jsonBody: data,
      headers: corsHeaders
    };
  } catch (err: any) {
    ctx.log("Error calling Gemini", err?.message ?? err);
    return {
      status: 500,
      jsonBody: {
        error: {
          message: err?.message || "Failed to call Gemini backend",
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
