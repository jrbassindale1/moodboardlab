// Prod host is the deployed Function App; adjust if you rename the app.
// Support both Vite (import.meta.env) and Node.js (process.env) environments
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

async function callGeminiBackend(payload: unknown, mode: "text" | "image" = "text") {
  const API_BASE = getApiBase();
  const res = await fetch(`${API_BASE}/api/generate-moodboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, payload })
  });

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

export const callGeminiText = (payload: unknown) => callGeminiBackend(payload, "text");
export const callGeminiImage = (payload: unknown) => callGeminiBackend(payload, "image");

export async function saveGeneration(payload: {
  prompt: string;
  imageDataUri: string;
  materials?: any;
  userId?: string;
}) {
  const SAVE_URL = getSaveUrl();
  const res = await fetch(SAVE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: payload.prompt,
      imageBase64: payload.imageDataUri,
      mimeType: payload.imageDataUri.split(";")[0].replace("data:", ""),
      materials: payload.materials ?? {},
      userId: payload.userId ?? "anon"
    })
  });

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
  const res = await fetch(`${API_BASE}/api/save-colored-icon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      colorVariantId: payload.colorVariantId,
      imageBase64: payload.imageDataUri,
      mimeType: payload.imageDataUri.split(";")[0].replace("data:", "") || "image/png"
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to save colored icon: ${errorText}`);
  }

  return res.json();
}
