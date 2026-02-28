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
      `Image model ${imageModel} hit quota/rate limits. Retrying once with ${FALLBACK_GEMINI_IMAGE_MODEL}.`
    );
    const result = await runner(FALLBACK_GEMINI_IMAGE_MODEL);
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

        // Extract imageConfig if provided
        const imageConfig = rawPayload.imageConfig || {};

        // For moodboard generation: always 1:1 and 1K
        // For material application: use provided aspect ratio (from input image) or default to 1:1
        const finalAspectRatio = imageConfig.aspectRatio || "1:1";
        const finalImageSize = imageConfig.imageSize || "1K";

        // Remove imageConfig from root level if present
        const { imageConfig: _, ...payloadWithoutImageConfig } = rawPayload;

        const moodboardPayload = {
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

        const imageResult = await runImageRequestWithFallback(imageModel, ctx, async (modelName) => {
          const model = genAI.getGenerativeModel({
            model: modelName
          });
          const result = await model.generateContent(moodboardPayload);
          const response = await result.response;
          const generatedImages = extractImagesFromResponse(response);

          if (!generatedImages.length) {
            ctx.log("Gemini moodboard generation returned no images", response);
            throw new Error("No images returned from Gemini");
          }

          return generatedImages;
        });

        return {
          status: 200,
          jsonBody: {
            imageFallbackUsed: imageResult.fallbackUsed,
            imageModelUsed: imageResult.modelUsed,
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
