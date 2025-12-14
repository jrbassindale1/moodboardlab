// Prod host is the deployed Function App; adjust if you rename the app.
const API_BASE = import.meta.env.PROD
  ? "https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net"
  : "http://localhost:7071";

const SAVE_URL = import.meta.env.PROD
  ? "https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net/api/save-generation"
  : "http://localhost:7071/api/save-generation";

async function callGeminiBackend(payload: unknown, mode: "text" | "image" = "text") {
  const res = await fetch(`${API_BASE}/api/generate-moodboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, payload })
  });

  if (!res.ok) {
    let message: string | null = null;
    try {
      const body = await res.json();
      message = body?.error?.message || body?.message || null;
    } catch {
      // Fall back to plain text if JSON parsing fails
      message = await res.text();
    }
    throw new Error(message || "Backend error while calling Gemini.");
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
