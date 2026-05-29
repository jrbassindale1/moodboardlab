import type { MaterialOption } from './types';
import {
  FREE_CREDITS_BLOCKED_FOR_NETWORK_CODE,
  FREE_CREDITS_BLOCKED_FOR_DEVICE_CODE,
  FREE_CREDITS_THROTTLED_NETWORK_RISK_CODE,
  getFreeCreditsBlockedMessage,
  getFreeCreditsNetworkRiskMessage,
  isFreeCreditsBlockedForNetwork,
  SUPPORT_EMAIL,
} from './utils/freeCreditSupport';
import type {
  MaterialTranslationContext,
  MaterialTranslationResult,
} from './types/materialTranslation';


// ============================================
// Precedent Search Types
// ============================================

export interface PrecedentResult {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  source: 'archdaily' | 'dezeen' | 'architizer' | 'designboom' | 'divisare' | 'other';
  sourceName: string;
  status?: 'pending' | 'viewed' | 'completed';
}

export interface SavedPrecedentCollection {
  id: string;
  userId: string;
  title?: string;
  description?: string;
  precedents: PrecedentResult[];
  materials: Array<{
    id: string;
    name: string;
    category?: string;
    keywords?: string[];
    finish?: string;
    materialType?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface SearchPrecedentsResponse {
  results: PrecedentResult[];
  query: string;
  totalFound: number;
}

// ============================================
// Project Management Types
// ============================================

export type ProjectType = 'Residential' | 'Commercial' | 'Education' | 'Mixed-Use' | 'Cultural' | 'Landscape';
export type ProjectStage = 'Concept' | 'Scheme' | 'Detailed' | 'Planning';
export type ProjectEntryRoute = 'materials' | 'sketch' | 'place' | 'mood';

export interface Project {
  id: string;
  userId?: string;
  name: string;
  type?: ProjectType | null;
  location?: string | null;
  stage?: ProjectStage | null;
  brief?: string | null;
  entryRoute?: ProjectEntryRoute | null;
  settings?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectsResponse {
  items: Project[];
}

export interface CreateProjectPayload {
  name: string;
  type?: ProjectType | null;
  location?: string | null;
  stage?: ProjectStage | null;
  brief?: string | null;
  entryRoute?: ProjectEntryRoute | null;
  settings?: Record<string, unknown> | null;
}

export interface UpdateProjectPayload extends Partial<CreateProjectPayload> {
  name: string;
}

// Prod host is the deployed Function App; adjust if you rename the app.
// Support both Vite (import.meta.env) and Node.js (process.env) environments
type RequestOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

const DEVICE_ID_STORAGE_KEY = 'moodboard_device_id_v1';
const DEVICE_ID_HEADER = 'X-Moodboard-Device-Id';

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const randomSuffix = Math.random().toString(36).slice(2);
    const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `mbd_${crypto.randomUUID()}`
      : `mbd_${Date.now()}_${randomSuffix}`;
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return '';
  }
}

function getDeviceIdHeader(): Record<string, string> {
  const deviceId = getOrCreateDeviceId();
  if (!deviceId) {
    return {};
  }
  return { [DEVICE_ID_HEADER]: deviceId };
}

export type GenerationType =
  | 'moodboard'
  | 'applyMaterials'
  | 'upscale'
  | 'materialIcon'
  | 'materialDetection'
  | 'sustainabilityBriefing'
  | 'precedentSearch';

export interface UsageData {
  moodboard: number;
  applyMaterials: number;
  upscale: number;
  materialIcon: number;
  materialDetection: number;
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
  metadata?: Record<string, unknown>;
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
  freeRemaining?: number;
  purchasedCredits?: number;
  isAdmin?: boolean;
  freeCreditsBlocked?: boolean;
  freeCreditsBlockReason?: string;
}

/**
 * Credit package definitions (must match backend)
 * "Credits start at £0.20 each, with better value on larger bundles."
 */
export const CREDIT_PACKAGES = [
  { id: 'starter', name: 'Starter', credits: 25, pricePence: 500, priceDisplay: '£5' },
  { id: 'standard', name: 'Standard', credits: 50, pricePence: 1000, priceDisplay: '£10' },
  { id: 'pro', name: 'Pro', credits: 150, pricePence: 2500, priceDisplay: '£25' },
] as const;

export type CreditPackageId = typeof CREDIT_PACKAGES[number]['id'];

/**
 * Credit costs for different generation modes
 */
export const CREDIT_COSTS = {
  /** Generate a new moodboard image */
  MOODBOARD_GENERATION: 1,
  /** Generate or refine a render */
  RENDER_GENERATION: 2,
  /** Turn-by-turn / iterative image generation */
  ITERATIVE_GENERATION: 2,
  /** 4K image generation (paid users only) */
  FOUR_K_GENERATION: 5,
} as const;

export type GenerationMode = 'standard' | 'iterative' | '4k';

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface ConfirmCheckoutSessionResponse {
  success: boolean;
  processed: boolean;
  alreadyProcessed: boolean;
}

export interface MaterialsResponse {
  items: MaterialOption[];
  count?: number;
}

function getApiBase() {
  // To use local backend, set VITE_USE_LOCAL_API=true in .env.local.
  // In Vite dev, use a same-origin proxy path to avoid CORS failures.
  const useLocalApi = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LOCAL_API === 'true';
  if (useLocalApi) {
    return "http://localhost:7071";
  }
  const isViteDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  if (isViteDev) {
    return "/__api_proxy__";
  }
  const apiUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL;
  if (apiUrl) {
    return apiUrl;
  }
  return "https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net";
}

function getSaveUrl() {
  return `${getApiBase()}/api/save-generation`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal) {
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 0;
  if (!timeout && !signal && typeof AbortController === 'undefined') {
    return fetch(url, init);
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;

  // Set up timeout abort
  if (timeout) {
    timer = setTimeout(() => controller.abort(), timeout);
  }

  // Listen for external signal abort
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', () => controller.abort());
    }
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      if (signal?.aborted) {
        throw new Error('Request cancelled');
      }
      const seconds = Math.max(1, Math.round(timeout / 1000));
      throw new Error(`Request timed out after ${seconds}s`);
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
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
  }, timeoutMs, options?.signal);

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

/**
 * Call OpenAI's image generation API via backend proxy
 * Generates images using GPT Image 2 model
 * API key is stored securely on the backend
 */
export async function callOpenAIImage(
  prompt: string,
  baseImageDataUrl?: string,
  options?: RequestOptions & {
    size?: string;
    quality?: 'auto' | 'low' | 'medium' | 'high';
    accessToken?: string | null;
    generationType?: GenerationType;
    generationMode?: GenerationMode;
  }
): Promise<{ candidates: Array<{ content: { parts: Array<{ inlineData: { data: string; mimeType: string } }> } }>; imageModelUsed?: string }> {
  const API_BASE = getApiBase();
  const timeoutMs = options?.timeoutMs ?? 120000;
  const imageSize = options?.size ?? '1024x1024';
  const imageQuality = options?.quality ?? 'medium';

  console.log(`[OpenAI Image Generation] Calling backend proxy (${imageSize}, ${imageQuality} quality)${baseImageDataUrl ? ' with base image' : ''}`);

  const res = await fetchWithTimeout(
    `${API_BASE}/api/generate-openai-image`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      },
      body: JSON.stringify({
        prompt,
        baseImageDataUrl,
        size: imageSize,
        quality: imageQuality,
        generationType: options?.generationType,
        generationMode: options?.generationMode,
      })
    },
    timeoutMs,
    options?.signal
  );

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('auth_required');
    }
    let message: string;
    try {
      const body = await res.json();
      message = body?.error?.message || body?.message || JSON.stringify(body);
    } catch {
      message = `OpenAI backend error (status ${res.status})`;
    }
    console.error('[OpenAI Image Generation] Error:', message);
    throw new Error(message);
  }

  const data = await res.json();

  // Validate response format
  const candidates = data?.candidates || [];
  if (!candidates.length || !candidates[0]?.content?.parts?.[0]?.inlineData?.data) {
    console.error('[OpenAI Image Generation] Unexpected response format:', data);
    throw new Error('OpenAI did not return an image payload');
  }

  console.log('[OpenAI Image Generation] Successfully generated image via backend proxy');
  return data;
}

export async function getMaterials(): Promise<MaterialOption[]> {
  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(`${API_BASE}/api/materials`, { method: 'GET' }, 15000);
  if (!res.ok) {
    throw new Error(`Failed to fetch materials (status ${res.status})`);
  }

  const data = (await res.json()) as MaterialsResponse | MaterialOption[];
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data.items)) {
    return data.items;
  }
  return [];
}

export async function updateMaterial(
  accessToken: string | null,
  material: Record<string, unknown>,
  options?: {
    adminKey?: string;
  }
): Promise<MaterialOption> {
  const API_BASE = getApiBase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (options?.adminKey?.trim()) {
    headers['X-Admin-Key'] = options.adminKey.trim();
  }

  const res = await fetchWithTimeout(
    `${API_BASE}/api/materials`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(material),
    },
    30000
  );

  if (!res.ok) {
    let message = `Failed to update material (status ${res.status})`;
    try {
      const data = await res.json() as { error?: string; message?: string };
      message = data.message || data.error || message;
    } catch {
      // ignore json parse errors
    }
    throw new Error(message);
  }

  const data = await res.json() as { item?: MaterialOption } | MaterialOption;
  if ('item' in data && data.item) {
    return data.item;
  }
  return data as MaterialOption;
}

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
 * Save material icon to blob storage as PNG and WebP
 * Requires admin key for authorization
 */
export async function saveMaterialIcon(payload: {
  materialId: string;
  imageBase64: string;
  adminKey: string;
}): Promise<{
  success: boolean;
  materialId: string;
  pngUrl: string;
  webpUrl: string;
}> {
  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(`${API_BASE}/api/save-material-icon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": payload.adminKey,
    },
    body: JSON.stringify({
      materialId: payload.materialId,
      imageBase64: payload.imageBase64,
    })
  }, 60000);

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to save material icon: ${errorText}`);
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

  return callGeminiText(geminiPayload, { timeoutMs: options?.timeoutMs ?? 60000, signal: options?.signal });
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
      ...getDeviceIdHeader(),
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
    generationMode?: GenerationMode;
    credits?: number;
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
        ...getDeviceIdHeader(),
      },
      body: JSON.stringify(payload),
    },
    15000
  );

  if (!res.ok) {
    let message = 'Failed to consume credits';
    let errorCode = '';
    try {
      const data = await res.json() as {
        error?: string;
        message?: string;
        code?: string;
        freeCreditsBlocked?: boolean;
      };
      errorCode = data.code || '';
      message = data.message || data.error || message;

      if (isFreeCreditsBlockedForNetwork({
        code: data.code,
        message,
        freeCreditsBlocked: data.freeCreditsBlocked,
      })) {
        const riskCode = data.code === FREE_CREDITS_THROTTLED_NETWORK_RISK_CODE;
        message = `${riskCode ? getFreeCreditsNetworkRiskMessage() : getFreeCreditsBlockedMessage()} Contact support at ${SUPPORT_EMAIL}.`;
        errorCode = riskCode
          ? FREE_CREDITS_THROTTLED_NETWORK_RISK_CODE
          : (data.code === FREE_CREDITS_BLOCKED_FOR_DEVICE_CODE
            ? FREE_CREDITS_BLOCKED_FOR_DEVICE_CODE
            : FREE_CREDITS_BLOCKED_FOR_NETWORK_CODE);
      }
    } catch {
      // ignore parse errors
    }
    const error = new Error(message) as Error & { code?: string };
    if (errorCode) {
      error.code = errorCode;
    }
    throw error;
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

export async function moveGenerationsToProject(
  accessToken: string,
  generationIds: string[],
  projectId: string
): Promise<{ items: Generation[]; moved: number }> {
  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(
    `${API_BASE}/api/generations/project`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ generationIds, projectId }),
    },
    15000
  );

  if (!res.ok) {
    let message = 'Failed to move generation';
    try {
      const data = await res.json() as { error?: string; message?: string };
      message = data.message || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json() as Promise<{ items: Generation[]; moved: number }>;
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
): Promise<{
  success: boolean;
  blobUrl: string;
  generationId?: string | null;
  userId: string;
}> {
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
  return res.json() as Promise<{
    success: boolean;
    blobUrl: string;
    generationId?: string | null;
    userId: string;
  }>;
}

/**
 * Save PDF with authentication
 */
export async function savePdfAuth(
  payload: {
    pdfDataUri: string;
    pdfType: 'sustainabilityBriefing' | 'materialsSheet' | 'specificationPathways';
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

// ============================================
// Precedent Search
// ============================================

// ============================================
// Credit Purchase Functions
// ============================================

/**
 * Create a Stripe checkout session for purchasing credits
 */
export async function createCheckoutSession(
  accessToken: string,
  packageId: CreditPackageId,
  returnPath?: string
): Promise<CheckoutSessionResponse> {
  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(
    `${API_BASE}/api/create-checkout-session`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(
        returnPath
          ? { packageId, returnPath }
          : { packageId }
      ),
    },
    15000
  );

  if (!res.ok) {
    let message = 'Failed to create checkout session';
    try {
      const data = await res.json() as { error?: string; message?: string };
      message = data.message || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json();
}

export async function confirmCheckoutSession(
  accessToken: string,
  sessionId: string
): Promise<ConfirmCheckoutSessionResponse> {
  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(
    `${API_BASE}/api/confirm-checkout-session`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ sessionId }),
    },
    15000
  );

  if (!res.ok) {
    let message = 'Failed to confirm checkout session';
    try {
      const data = await res.json() as { error?: string; message?: string };
      message = data.message || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json();
}

/**
 * Search for architectural precedents based on selected materials
 */
export async function searchPrecedents(
  materials: MaterialOption[],
  options?: { maxResults?: number; timeoutMs?: number; accessToken?: string | null }
): Promise<SearchPrecedentsResponse> {
  const API_BASE = getApiBase();
  const timeoutMs = options?.timeoutMs ?? 90000; // 90s - precedent search is complex (multiple searches + LLM calls)

  const res = await fetchWithTimeout(
    `${API_BASE}/api/search-precedents`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      },
      body: JSON.stringify({
        materials: materials.map((m) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          keywords: m.keywords,
          finish: m.finish,
          materialType: m.materialType,
        })),
        maxResults: options?.maxResults ?? 12,
      }),
    },
    timeoutMs
  );

  if (!res.ok) {
    let errorData: { error?: string; message?: string } = {};
    try {
      errorData = await res.json();
    } catch {
      // ignore parse errors
    }

    if (res.status === 401) {
      throw new Error('auth_required');
    }
    if (res.status === 429) {
      throw new Error('rate_limit');
    }
    throw new Error(errorData.message || `Search failed (status ${res.status})`);
  }

  return res.json();
}

/**
 * Enrich precedent results with images (lazy-loaded after initial search)
 */
export interface EnrichPrecedentImagesResponse {
  images: Array<{
    url: string;
    imageUrl: string | null;
    cached: boolean;
  }>;
  cacheStats: {
    hits: number;
    misses: number;
  };
}

export async function enrichPrecedentImages(
  urls: string[],
  options?: { timeoutMs?: number; accessToken?: string | null }
): Promise<EnrichPrecedentImagesResponse> {
  const API_BASE = getApiBase();
  const timeoutMs = options?.timeoutMs ?? 30000; // 30s for image enrichment

  const res = await fetchWithTimeout(
    `${API_BASE}/api/enrich-precedent-images`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      },
      body: JSON.stringify({ urls }),
    },
    timeoutMs
  );

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('auth_required');
    }
    let errorData: { error?: string; message?: string } = {};
    try {
      errorData = await res.json();
    } catch {
      // ignore parse errors
    }
    throw new Error(errorData.message || `Image enrichment failed (status ${res.status})`);
  }

  return res.json();
}

export async function translateRenderToProducts(
  payload: {
    imageUrl: string;
    projectId?: string;
    renderId?: string;
    context?: MaterialTranslationContext;
  },
  options?: {
    accessToken?: string | null;
    timeoutMs?: number;
  }
): Promise<{
  result: MaterialTranslationResult;
  status: 'completed' | string;
  createdAt?: string;
  persisted?: boolean;
  renderId?: string | null;
}> {
  const API_BASE = getApiBase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options?.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const res = await fetchWithTimeout(
    `${API_BASE}/api/material-translation`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    },
    options?.timeoutMs ?? 120000
  );

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('auth_required');
    }
    let message = `Material translation failed (status ${res.status})`;
    try {
      const data = await res.json() as { error?: string; message?: string };
      message = data.message || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json();
}

export async function getSavedMaterialTranslation(
  renderId: string,
  accessToken: string
): Promise<{
  result: MaterialTranslationResult;
  status: string;
  createdAt?: string | null;
  renderId: string;
  persisted: boolean;
}> {
  const API_BASE = getApiBase();
  const params = new URLSearchParams({ renderId });
  const res = await fetchWithTimeout(
    `${API_BASE}/api/material-translation?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    30000
  );

  if (!res.ok) {
    let message = `Could not load material translation (status ${res.status})`;
    try {
      const data = await res.json() as { error?: string; message?: string };
      message = data.message || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json();
}

/**
 * Save selected precedents to the user's account
 */
export async function savePrecedents(
  accessToken: string,
  payload: {
    precedents: PrecedentResult[];
    materials: Array<{
      id: string;
      name: string;
      category?: string;
      keywords?: string[];
      finish?: string;
      materialType?: string;
    }>;
    title?: string;
    description?: string;
  }
): Promise<{
  success: boolean;
  precedentId: string;
  createdAt: string;
}> {
  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(
    `${API_BASE}/api/save-precedents`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
    30000
  );

  if (!res.ok) {
    let message = 'Failed to save precedents';
    try {
      const data = await res.json() as { error?: string; message?: string };
      message = data.message || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json();
}

/**
 * Retrieve all saved precedent collections for the current user
 */
export async function getPrecedents(
  accessToken: string
): Promise<{
  success: boolean;
  collections: SavedPrecedentCollection[];
  count: number;
}> {
  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(
    `${API_BASE}/api/get-precedents`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    30000
  );

  if (!res.ok) {
    let message = 'Failed to retrieve precedents';
    try {
      const data = await res.json() as { error?: string; message?: string };
      message = data.message || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json();
}

// ============================================
// Project Management API Functions
// ============================================

/**
 * List all projects for the authenticated user
 */
export async function getProjects(accessToken: string): Promise<Project[]> {
  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(
    `${API_BASE}/api/projects`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    15000
  );

  if (!res.ok) {
    let message = 'Failed to fetch projects';
    try {
      const data = await res.json() as { error?: string; message?: string };
      message = data.message || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  const data = await res.json() as ProjectsResponse;
  return data.items || [];
}

/**
 * Get a single project by ID
 */
export async function getProject(accessToken: string, projectId: string): Promise<Project> {
  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(
    `${API_BASE}/api/projects/${projectId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    15000
  );

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Project not found');
    }
    let message = 'Failed to fetch project';
    try {
      const data = await res.json() as { error?: string; message?: string };
      message = data.message || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json();
}

/**
 * Create a new project
 */
export async function createProjectApi(
  accessToken: string,
  payload: CreateProjectPayload
): Promise<Project> {
  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(
    `${API_BASE}/api/projects`,
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
    let message = 'Failed to create project';
    try {
      const data = await res.json() as { error?: string; message?: string; errors?: string[] };
      message = data.errors?.join(', ') || data.message || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json();
}

/**
 * Update an existing project
 */
export async function updateProjectApi(
  accessToken: string,
  projectId: string,
  payload: UpdateProjectPayload
): Promise<Project> {
  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(
    `${API_BASE}/api/projects/${projectId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
    15000
  );

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Project not found');
    }
    let message = 'Failed to update project';
    try {
      const data = await res.json() as { error?: string; message?: string; errors?: string[] };
      message = data.errors?.join(', ') || data.message || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json();
}

/**
 * Delete (soft delete) a project
 */
export async function deleteProjectApi(
  accessToken: string,
  projectId: string
): Promise<{ success: boolean; message: string }> {
  const API_BASE = getApiBase();
  const res = await fetchWithTimeout(
    `${API_BASE}/api/projects/${projectId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    15000
  );

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Project not found');
    }
    let message = 'Failed to delete project';
    try {
      const data = await res.json() as { error?: string; message?: string };
      message = data.message || data.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json();
}

// ============================================
// Brands
// ============================================

export interface BrandSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  website?: string;
  tagline?: string;
  tier: 'partner' | 'verified' | 'standard';
  contactEmail?: string;
  materialCount?: number;
  isFeatured: boolean;
  featuredOrder?: number;
}

export async function getFeaturedBrands(): Promise<BrandSummary[]> {
  const res = await fetchWithTimeout(
    `${getApiBase()}/api/brands?featured=true`,
    { method: 'GET' },
    10000,
  );
  if (!res.ok) return [];
  const data = await res.json() as { brands: BrandSummary[] };
  return data.brands ?? [];
}

export async function getAllBrands(): Promise<BrandSummary[]> {
  const res = await fetchWithTimeout(
    `${getApiBase()}/api/brands`,
    { method: 'GET' },
    10000,
  );
  if (!res.ok) return [];
  const data = await res.json() as { brands: BrandSummary[] };
  return data.brands ?? [];
}

export async function getBrandBySlug(slug: string): Promise<{ brand: BrandSummary; materials: MaterialOption[] } | null> {
  const res = await fetchWithTimeout(
    `${getApiBase()}/api/brands?slug=${encodeURIComponent(slug)}`,
    { method: 'GET' },
    10000,
  );
  if (!res.ok) return null;
  return res.json();
}

// ============================================
// Sample Requests
// ============================================

export interface SampleRequestPayload {
  brandId: string;
  materialId: string;
  materialName: string;
  brandName: string;
  requesterName: string;
  requesterEmail: string;
  requesterCompany?: string;
  requesterRole?: string;
  message?: string;
  projectType?: string;
}

export async function submitSampleRequest(payload: SampleRequestPayload, accessToken?: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetchWithTimeout(
    `${getApiBase()}/api/sample-requests`,
    { method: 'POST', headers, body: JSON.stringify(payload) },
    10000,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'Failed to submit request');
  }
}

export async function getSampleRequests(accessToken: string, brandId?: string): Promise<any[]> {
  const url = brandId
    ? `${getApiBase()}/api/sample-requests?brandId=${encodeURIComponent(brandId)}`
    : `${getApiBase()}/api/sample-requests`;
  const res = await fetchWithTimeout(
    url,
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
    10000,
  );
  if (!res.ok) return [];
  const data = await res.json() as { requests: any[] };
  return data.requests ?? [];
}

// ============================================
// Material Interaction Tracking
// ============================================

export type InteractionType = 'view' | 'add_to_board' | 'spec_sheet' | 'epd' | 'bim' | 'product_page' | 'sample_request';

let _sessionId: string | null = null;
function getSessionId(): string {
  if (!_sessionId) {
    _sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return _sessionId;
}

export function trackMaterialInteraction(
  mat: { id: string; name: string; brandId?: string; brandName?: string; source?: string },
  interactionType: InteractionType,
  accessToken?: string,
): void {
  if (!mat.brandId || mat.source === 'generic') return;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  fetch(`${getApiBase()}/api/material-interaction`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brandId: mat.brandId,
      materialId: mat.id,
      materialName: mat.name,
      brandName: mat.brandName ?? '',
      interactionType,
      sessionId: getSessionId(),
    }),
  }).catch(() => { /* silently ignore */ });
}

// ============================================
// Brand Analytics (manufacturer dashboard)
// ============================================

export interface BrandAnalytics {
  brandId: string;
  totals: { views: number; addToBoard: number; specSheet: number; epd: number; sampleRequest: number; total: number };
  materials: Array<{ materialId: string; materialName: string; views: number; addToBoard: number; specSheet: number; epd: number; sampleRequest: number; total: number }>;
  trend: Array<{ month: string; count: number }>;
}

export async function getBrandAnalytics(accessToken: string, brandId: string, since?: string): Promise<BrandAnalytics | null> {
  const params = new URLSearchParams({ brandId });
  if (since) params.set('since', since);
  const res = await fetchWithTimeout(
    `${getApiBase()}/api/brand-analytics?${params}`,
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
    10000,
  );
  if (!res.ok) return null;
  return res.json();
}

export async function getMyBrand(accessToken: string): Promise<BrandSummary | null> {
  const res = await fetchWithTimeout(
    `${getApiBase()}/api/brands?mine=true`,
    { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
    10000,
  );
  if (!res.ok) return null;
  const data = await res.json() as { brands: BrandSummary[] };
  return data.brands?.[0] ?? null;
}
