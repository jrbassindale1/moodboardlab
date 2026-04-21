const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OPENAI_MATERIAL_TRANSLATION_MODEL || "gpt-4.1-mini";

type OpenAIResponsesRequest = {
  systemPrompt: string;
  userPrompt: string;
  imageUrl: string;
  jsonSchemaName: string;
  jsonSchema: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const extractTextFromOutput = (response: Record<string, unknown>): string => {
  const outputText = response.output_text;
  if (typeof outputText === "string" && outputText.trim()) return outputText.trim();

  const output = Array.isArray(response.output) ? response.output : [];
  const textParts: string[] = [];
  for (const item of output) {
    const outputItem = asRecord(item);
    if (!outputItem) continue;
    const content = Array.isArray(outputItem.content) ? outputItem.content : [];
    for (const contentPart of content) {
      const part = asRecord(contentPart);
      if (!part) continue;
      if (part.type === "output_text" && typeof part.text === "string" && part.text.trim()) {
        textParts.push(part.text.trim());
        continue;
      }
      if (part.type === "output_json" && part.json && typeof part.json === "object") {
        textParts.push(JSON.stringify(part.json));
      }
    }
  }
  return textParts.join("\n").trim();
};

const parseResponseJson = (text: string): Record<string, unknown> => {
  if (!text) {
    throw new Error("OpenAI returned an empty response.");
  }
  try {
    const parsed = JSON.parse(text);
    if (!asRecord(parsed)) {
      throw new Error("OpenAI structured output was not a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to parse OpenAI structured output: ${error.message}`
        : "Failed to parse OpenAI structured output."
    );
  }
};

export async function createStructuredVisionResponse(
  request: OpenAIResponsesRequest
): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY (or OPENAI_KEY) is not configured.");
  }

  const response = await fetch(`${OPENAI_BASE_URL.replace(/\/+$/, "")}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: request.systemPrompt }],
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: request.userPrompt },
            { type: "input_image", image_url: request.imageUrl },
          ],
        },
      ],
      temperature: request.temperature ?? 0.25,
      max_output_tokens: request.maxOutputTokens ?? 2600,
      text: {
        format: {
          type: "json_schema",
          name: request.jsonSchemaName,
          schema: request.jsonSchema,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `OpenAI request failed with status ${response.status}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  return parseResponseJson(extractTextFromOutput(json));
}
