// Prod host is the deployed Function App; adjust if you rename the app.
// Support both Vite (import.meta.env) and Node.js (process.env) environments
type RequestOptions = {
  timeoutMs?: number;
};

function getIsProduction() {
  return (
    (typeof process !== 'undefined' && process.env?.USE_PRODUCTION_API === 'true') ||
    (typeof import.meta !== 'undefined' && import.meta.env?.PROD)
  );
}

function getApiBase() {
  return getIsProduction()
    ? "https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net"
    : "http://localhost:7071";
}

function getSaveUrl() {
  return getIsProduction()
    ? "https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net/api/save-generation"
    : "http://localhost:7071/api/save-generation";
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 0;
  if (!timeout || typeof AbortController === 'undefined') {
    return fetch(url, init);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      const seconds = Math.max(1, Math.round(timeout / 1000));
      throw new Error(`Request timed out after ${seconds}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiBackend(
  payload: unknown,
  mode: "text" | "image" = "text",
  options?: RequestOptions
) {
  const API_BASE = getApiBase();
  const timeoutMs = options?.timeoutMs ?? (mode === 'image' ? 120000 : 180000);
  const res = await fetchWithTimeout(`${API_BASE}/api/generate-moodboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, payload })
  }, timeoutMs);

  if (!res.ok) {
    let message: string;
    try {
      const body = await res.json();
      message = body?.error?.message || body?.message || JSON.stringify(body);
    } catch {
      // If JSON parsing fails, try to get text (but we can't read body twice)
      message = `Backend error (status ${res.status})`;
    }
    throw new Error(message);
  }

  return res.json();
}

export const callGeminiText = (payload: unknown, options?: RequestOptions) =>
  callGeminiBackend(payload, "text", options);
export const callGeminiImage = (payload: unknown, options?: RequestOptions) =>
  callGeminiBackend(payload, "image", options);

export async function saveGeneration(payload: {
  prompt: string;
  imageDataUri: string;
  materials?: any;
  userId?: string;
}) {
  const SAVE_URL = getSaveUrl();
  const res = await fetchWithTimeout(SAVE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: payload.prompt,
      imageBase64: payload.imageDataUri,
      mimeType: payload.imageDataUri.split(";")[0].replace("data:", ""),
      materials: payload.materials ?? {},
      userId: payload.userId ?? "anon"
    })
  }, 45000);

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveColoredIcon(payload: {
  colorVariantId: string;
  imageDataUri: string;
}): Promise<{
  colorVariantId: string;
  blobUrl: string;
  cached: boolean;
  createdAt?: string;
}> {
  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(`${API_BASE}/api/save-colored-icon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      colorVariantId: payload.colorVariantId,
      imageBase64: payload.imageDataUri,
      mimeType: payload.imageDataUri.split(";")[0].replace("data:", "") || "image/png"
    })
  }, 45000);

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to save colored icon: ${errorText}`);
  }

  return res.json();
}

/**
 * Generate a sustainability briefing using Gemini API
 * Uses the 'text' mode with a specialized system instruction
 */
export async function generateSustainabilityBriefing(payload: {
  systemInstruction: string;
  materials: unknown[];
  averageScores: unknown;
  projectName?: string;
}, options?: RequestOptions): Promise<unknown> {
  const prompt = `Analyze these ${(payload.materials as unknown[]).length} materials for a sustainability briefing${payload.projectName ? ` for project "${payload.projectName}"` : ''}:

Materials Data:
${JSON.stringify(payload.materials, null, 2)}

Average Lifecycle Scores (1-5 scale, higher = more impact):
${JSON.stringify(payload.averageScores, null, 2)}

Respond with ONLY valid JSON matching the required structure.`;

  const geminiPayload = {
    systemInstruction: payload.systemInstruction,
    prompt,
    responseType: 'json',
  };

  return callGeminiText(geminiPayload, { timeoutMs: options?.timeoutMs ?? 60000 });
}
