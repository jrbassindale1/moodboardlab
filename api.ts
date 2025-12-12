// Prod host is the deployed Function App; adjust if you rename the app.
const API_BASE = import.meta.env.PROD
  ? "https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net"
  : "http://localhost:7071";

async function callGeminiBackend(payload: unknown, mode: "text" | "image" = "text") {
  const res = await fetch(`${API_BASE}/api/generate-moodboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, payload })
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Backend error while calling Gemini.");
  }

  return res.json();
}

export const callGeminiText = (payload: unknown) => callGeminiBackend(payload, "text");
export const callGeminiImage = (payload: unknown) => callGeminiBackend(payload, "image");
