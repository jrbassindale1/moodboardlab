// Prod host is the deployed Function App; adjust if you rename the app.
// Support both Vite (import.meta.env) and Node.js (process.env) environments
type RequestOptions = {
  timeoutMs?: number;
};

export type GenerationType =
  | 'moodboard'
  | 'applyMaterials'
  | 'upscale'
  | 'materialIcon'
  | 'sustainabilityBriefing';

export interface UsageData {
  moodboard: number;
  applyMaterials: number;
  upscale: number;
  materialIcon: number;
  sustainabilityBriefing: number;
  total: number;
  yearMonth?: string;
}

export interface Generation {
  id: string;
  type: GenerationType;
  blobUrl?: string;
  createdAt: string;
  prompt: string;
  materials?: unknown;
}

export interface GenerationsResponse {
  items: Generation[];
  hasMore: boolean;
}

export interface QuotaResponse {
  canGenerate: boolean;
  remaining: number;
  limit: number;
  used: number;
}

function getApiBase() {
  // Always use production API - local Azure Functions not typically available
  // To use local backend, set VITE_USE_LOCAL_API=true in .env.local
  const useLocalApi = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LOCAL_API === 'true';
  if (useLocalApi) {
    return "http://localhost:7071";
  }
  return "https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net";
}

function getSaveUrl() {
  return `${getApiBase()}/api/save-generation`;
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
 * Uses the 'text' mode with the system instruction embedded in the prompt
 */
export async function generateSustainabilityBriefing(payload: {
  systemInstruction: string;
  materials: unknown[];
  averageScores: unknown;
  projectName?: string;
}, options?: RequestOptions): Promise<unknown> {
  const prompt = `${payload.systemInstruction}

Analyze these ${(payload.materials as unknown[]).length} materials for a sustainability briefing${payload.projectName ? ` for project "${payload.projectName}"` : ''}:

Materials Data:
${JSON.stringify(payload.materials, null, 2)}

Average Lifecycle Scores (1-5 scale, higher = more impact):
${JSON.stringify(payload.averageScores, null, 2)}

Respond with ONLY valid JSON matching the required structure.`;

  const geminiPayload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      topP: 0.95,
      topK: 40,
    },
  };

  return callGeminiText(geminiPayload, { timeoutMs: options?.timeoutMs ?? 60000 });
}

// ============================================
// Authenticated API functions
// ============================================

/**
 * Get current month's usage for authenticated user
 */
export async function getUsage(accessToken: string): Promise<UsageData> {
  const API_BASE = getApiBase();
  const res = await fetch(`${API_BASE}/api/usage`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch usage');
  }
  return res.json();
}

/**
 * Check if user can generate (quota check)
 */
export async function checkQuota(accessToken: string): Promise<QuotaResponse> {
  const API_BASE = getApiBase();
  const res = await fetch(`${API_BASE}/api/check-quota`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to check quota');
  }
  return res.json();
}

/**
 * Consume usage credits without saving a generation record
 */
export async function consumeCredits(
  accessToken: string,
  payload: {
    generationType: GenerationType;
    credits: number;
    reason?: string;
  }
): Promise<{
  success: boolean;
  remaining: number;
  limit: number;
  used: number;
  yearMonth?: string;
}> {
  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(
    `${API_BASE}/api/consume-credits`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
    15000
  );

  if (!res.ok) {
    throw new Error('Failed to consume credits');
  }
  return res.json();
}

/**
 * Get user's generation history
 */
export async function getGenerations(
  accessToken: string,
  options?: { limit?: number; offset?: number }
): Promise<GenerationsResponse> {
  const API_BASE = getApiBase();
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const res = await fetch(`${API_BASE}/api/generations?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch generations');
  }
  return res.json();
}

/**
 * Call Gemini backend with authentication
 */
export async function callGeminiBackendAuth(
  payload: unknown,
  mode: "text" | "image",
  accessToken: string,
  generationType: GenerationType,
  options?: RequestOptions
) {
  const API_BASE = getApiBase();
  const timeoutMs = options?.timeoutMs ?? (mode === 'image' ? 120000 : 180000);

  const res = await fetchWithTimeout(
    `${API_BASE}/api/generate-moodboard`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ mode, payload, generationType }),
    },
    timeoutMs
  );

  if (!res.ok) {
    let message: string;
    try {
      const body = await res.json();
      // Handle quota exceeded error
      if (res.status === 429) {
        throw new Error('Monthly generation limit reached. Please wait until next month or upgrade your plan.');
      }
      message = body?.error?.message || body?.message || JSON.stringify(body);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Monthly generation limit')) {
        throw err;
      }
      message = `Backend error (status ${res.status})`;
    }
    throw new Error(message);
  }

  return res.json();
}

/**
 * Save generation with authentication
 */
export async function saveGenerationAuth(
  payload: {
    prompt: string;
    imageDataUri: string;
    materials?: unknown;
    generationType: GenerationType;
  },
  accessToken: string
) {
  const SAVE_URL = getSaveUrl();
  const res = await fetchWithTimeout(
    SAVE_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        prompt: payload.prompt,
        imageBase64: payload.imageDataUri,
        mimeType: payload.imageDataUri.split(";")[0].replace("data:", ""),
        materials: payload.materials ?? {},
        generationType: payload.generationType,
      }),
    },
    45000
  );

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Save PDF with authentication
 */
export async function savePdfAuth(
  payload: {
    pdfDataUri: string;
    pdfType: 'sustainabilityBriefing' | 'materialsSheet';
    materials?: unknown;
  },
  accessToken: string
) {
  const normalizePdfBase64 = (value: string): string => {
    if (!value) return value;
    const trimmed = value.trim();
    if (!trimmed.startsWith('data:application/pdf')) return trimmed;
    const marker = 'base64,';
    const markerIndex = trimmed.indexOf(marker);
    if (markerIndex === -1) return trimmed;
    return trimmed.slice(markerIndex + marker.length);
  };

  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(
    `${API_BASE}/api/save-pdf`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        pdfBase64: normalizePdfBase64(payload.pdfDataUri),
        pdfType: payload.pdfType,
        materials: payload.materials ?? {},
      }),
    },
    45000
  );

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
