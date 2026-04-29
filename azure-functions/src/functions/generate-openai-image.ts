import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

// GPT Image 2 constraints
const MAX_EDGE = 3840;
const MIN_PIXELS = 655360;
const MAX_PIXELS = 8294400;
const MAX_RATIO = 3;
const DEFAULT_SIZE = "1024x1024";

const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

type OpenAIImageRequest = {
  prompt: string;
  baseImageDataUrl?: string;
  size?: string;
  quality?: "auto" | "low" | "medium" | "high";
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const toMultipleOf16 = (value: number, mode: "up" | "down" = "up"): number => {
  if (!Number.isFinite(value) || value <= 0) return 16;
  if (mode === "down") return Math.max(16, Math.floor(value / 16) * 16);
  return Math.max(16, Math.ceil(value / 16) * 16);
};

const parseSize = (value: string): { width: number; height: number } | null => {
  const match = value.trim().match(/^(\d+)x(\d+)$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
};

const normalizeDimensions = (width: number, height: number): { width: number; height: number } => {
  let w = toMultipleOf16(width, "up");
  let h = toMultipleOf16(height, "up");

  // Keep ratio in the supported <=3:1 envelope
  const ratio = Math.max(w, h) / Math.max(1, Math.min(w, h));
  if (ratio > MAX_RATIO) {
    const longEdge = Math.max(w, h);
    const shortEdge = toMultipleOf16(longEdge / MAX_RATIO, "up");
    if (w >= h) {
      h = shortEdge;
    } else {
      w = shortEdge;
    }
  }

  const applyMaxEdge = () => {
    const currentMaxEdge = Math.max(w, h);
    if (currentMaxEdge <= MAX_EDGE) return;
    const scale = MAX_EDGE / currentMaxEdge;
    w = toMultipleOf16(w * scale, "down");
    h = toMultipleOf16(h * scale, "down");
  };

  const applyMaxPixels = () => {
    const pixels = w * h;
    if (pixels <= MAX_PIXELS) return;
    const scale = Math.sqrt(MAX_PIXELS / pixels);
    w = toMultipleOf16(w * scale, "down");
    h = toMultipleOf16(h * scale, "down");
  };

  const applyMinPixels = () => {
    const pixels = w * h;
    if (pixels >= MIN_PIXELS) return;
    const scale = Math.sqrt(MIN_PIXELS / Math.max(1, pixels));
    w = toMultipleOf16(w * scale, "up");
    h = toMultipleOf16(h * scale, "up");
  };

  applyMaxEdge();
  applyMaxPixels();
  applyMinPixels();
  applyMaxEdge();
  applyMaxPixels();

  // Final guard for ratio
  const finalRatio = Math.max(w, h) / Math.max(1, Math.min(w, h));
  if (finalRatio > MAX_RATIO) {
    const longEdge = Math.max(w, h);
    const shortEdge = toMultipleOf16(longEdge / MAX_RATIO, "up");
    if (w >= h) {
      h = shortEdge;
    } else {
      w = shortEdge;
    }
    applyMaxEdge();
    applyMaxPixels();
    applyMinPixels();
  }

  if (w * h < MIN_PIXELS) {
    return { width: 1024, height: 1024 };
  }

  return { width: w, height: h };
};

const normalizeImageSize = (value?: string): string => {
  const requested = (value || DEFAULT_SIZE).trim();
  if (requested === "auto") return "auto";

  const parsed = parseSize(requested);
  if (!parsed) return DEFAULT_SIZE;

  const normalized = normalizeDimensions(parsed.width, parsed.height);
  return `${normalized.width}x${normalized.height}`;
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("timed out") ||
    message.includes("failed to fetch") ||
    message.includes("network error") ||
    message.includes("networkerror")
  );
};

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  ctx: InvocationContext,
  maxAttempts = 3
): Promise<Response> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok || !RETRYABLE_STATUS.has(response.status) || attempt === maxAttempts) {
        return response;
      }

      const requestId = response.headers.get("x-request-id");
      ctx.warn(
        `[OpenAI Image] Retryable status ${response.status}${requestId ? ` (request ID: ${requestId})` : ""}. Retrying (${attempt}/${maxAttempts - 1})...`
      );
    } catch (error) {
      if (!isRetryableNetworkError(error) || attempt === maxAttempts) {
        throw error;
      }
      ctx.warn(
        `[OpenAI Image] Transient network error. Retrying (${attempt}/${maxAttempts - 1})...`
      );
    }

    const backoffMs = 600 * 2 ** (attempt - 1);
    const jitterMs = Math.round(Math.random() * 250);
    await delay(backoffMs + jitterMs);
  }

  throw new Error("OpenAI request failed after retries.");
}

async function parseErrorMessage(response: Response): Promise<string> {
  const requestId = response.headers.get("x-request-id");
  try {
    const body = (await response.json()) as Record<string, unknown>;
    const errorObj = body?.error as Record<string, unknown> | undefined;
    const rawMessage = errorObj?.message || body?.message || JSON.stringify(body);
    if (requestId && typeof rawMessage === "string" && !rawMessage.includes(requestId)) {
      return `${rawMessage} (request ID: ${requestId})`;
    }
    return String(rawMessage);
  } catch {
    return `OpenAI API error (status ${response.status}${requestId ? `, request ID: ${requestId}` : ""})`;
  }
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const [meta, base64Data] = dataUrl.split(",");
  const mimeMatch = meta?.match(/data:(.*);base64/);
  const mimeType = mimeMatch?.[1] || "image/png";
  const byteCharacters = atob(base64Data || "");
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return { blob: new Blob([byteArray], { type: mimeType }), mimeType };
}

export async function generateOpenAIImageHandler(
  req: HttpRequest,
  ctx: InvocationContext
): Promise<HttpResponseInit> {
  if (req.method === "OPTIONS") {
    return {
      status: 204,
      headers: corsHeaders
    };
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) {
    ctx.error("[OpenAI Image] OPENAI_API_KEY is not configured");
    return {
      status: 500,
      jsonBody: { error: { message: "OpenAI API key is not configured on the server" } },
      headers: corsHeaders
    };
  }

  let body: OpenAIImageRequest;
  try {
    body = (await req.json()) as OpenAIImageRequest;
  } catch (err) {
    ctx.log("Invalid JSON body", err);
    return {
      status: 400,
      jsonBody: { error: { message: "Invalid JSON body" } },
      headers: corsHeaders
    };
  }

  const { prompt, baseImageDataUrl, quality = "medium" } = body;

  if (!prompt?.trim()) {
    return {
      status: 400,
      jsonBody: { error: { message: "prompt is required" } },
      headers: corsHeaders
    };
  }

  const requestedSize = body.size || DEFAULT_SIZE;
  const imageSize = normalizeImageSize(requestedSize);
  if (imageSize !== requestedSize) {
    ctx.log(`[OpenAI Image] Normalized size from "${requestedSize}" to "${imageSize}"`);
  }

  try {
    let responseData: Record<string, unknown>;

    if (baseImageDataUrl) {
      // Image editing mode
      ctx.log(`[OpenAI Image] Using image-guided mode (${imageSize}, ${quality} quality)`);

      const { blob } = dataUrlToBlob(baseImageDataUrl);
      const formData = new FormData();
      formData.append("model", OPENAI_IMAGE_MODEL);
      formData.append("prompt", prompt);
      formData.append("size", imageSize);
      formData.append("quality", quality);
      formData.append("image", blob, "image.png");

      const response = await fetchWithRetry(
        `${OPENAI_BASE_URL.replace(/\/+$/, "")}/images/edits`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`
          },
          body: formData
        },
        ctx
      );

      if (!response.ok) {
        const message = await parseErrorMessage(response);
        ctx.error("[OpenAI Image] Error:", message);
        return {
          status: response.status,
          jsonBody: { error: { message } },
          headers: corsHeaders
        };
      }

      responseData = (await response.json()) as Record<string, unknown>;
    } else {
      // Standard generation mode
      ctx.log(`[OpenAI Image] Using standard mode with model: ${OPENAI_IMAGE_MODEL} (${imageSize}, ${quality} quality)`);

      // Add moodboard-style composition instructions
      const modifiedPrompt = `${prompt}

CRITICAL COMPOSITION STYLE - CREATE A SPATIAL, LAYERED MOODBOARD:
- Arrange materials with DEPTH and SPATIAL DIMENSION - foreground, middle ground, background
- Materials should OVERLAP and be positioned at VARYING DISTANCES from the viewer
- Create visual LAYERING with some materials floating/suspended and others on surfaces
- Use the full 3D space to show how materials interact and complement each other
- Organic, artistic arrangement - NOT a strict grid layout
- Materials should be clearly visible individual samples but arranged in a composed, spatial way
- Include subtle spatial cues (shadows, positioning) that give the composition depth
- DO NOT create a photorealistic interior space or room - keep focus on the materials themselves`;

      const requestBody = {
        model: OPENAI_IMAGE_MODEL,
        prompt: modifiedPrompt,
        size: imageSize,
        quality
      };

      const response = await fetchWithRetry(
        `${OPENAI_BASE_URL.replace(/\/+$/, "")}/images/generations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        },
        ctx
      );

      if (!response.ok) {
        const message = await parseErrorMessage(response);
        ctx.error("[OpenAI Image] Error:", message);
        return {
          status: response.status,
          jsonBody: { error: { message } },
          headers: corsHeaders
        };
      }

      responseData = (await response.json()) as Record<string, unknown>;
    }

    // Extract base64 image from response
    const dataArray = Array.isArray(responseData.data) ? responseData.data : [];
    const firstItem = dataArray[0] as Record<string, unknown> | undefined;
    const b64Json = firstItem?.b64_json;

    if (typeof b64Json !== "string" || !b64Json) {
      ctx.error("[OpenAI Image] Unexpected response format:", responseData);
      return {
        status: 500,
        jsonBody: { error: { message: "OpenAI did not return an image payload" } },
        headers: corsHeaders
      };
    }

    ctx.log("[OpenAI Image] Successfully generated image");

    // Return in Gemini-compatible format for seamless frontend handling
    return {
      status: 200,
      jsonBody: {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: b64Json,
                    mimeType: "image/png"
                  }
                }
              ]
            }
          }
        ],
        imageModelUsed: OPENAI_IMAGE_MODEL
      },
      headers: corsHeaders
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate image";
    ctx.error("[OpenAI Image] Error:", message);
    return {
      status: 500,
      jsonBody: { error: { message } },
      headers: corsHeaders
    };
  }
}

app.http("generateOpenAIImage", {
  route: "generate-openai-image",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: generateOpenAIImageHandler
});
