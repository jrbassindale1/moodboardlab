type MaterialTranslationPromptMaterial = {
  id?: string;
  name: string;
  category?: string;
  finish?: string | null;
};

type MaterialTranslationPromptContext = {
  projectType?: string;
  region?: string;
  selectedMaterialPalette?: string[];
  selectedMaterials?: MaterialTranslationPromptMaterial[];
  budgetTier?: string;
  sustainabilityPreference?: string;
};

const SYSTEM_PROMPT = `You are an architectural materials analyst for early-stage decision support.

Analyse one architectural render and return concise, structured guidance.

Rules:
- This is early-stage guidance only, never final specification advice.
- Compare visible image evidence against the selected materials list.
- Classify each selected material as strong, partial, or weak with a short reason.
- Focus only on 3 to 4 main decision-bearing systems:
  - primary structure
  - main cladding / external wall
  - glazing / opening system
  - one dominant external feature (landscape or roof expression) if central
- Do not analyse every visible surface.
- Ignore filler systems (minor flooring/internal finishes) unless clearly central.
- Use cautious wording (likely, plausible, reads as).
- Keep output compact and scannable, not report-like.
- Return JSON only.`;

const USER_PROMPT_BASE = `Analyse this architectural render for concise decision support.

Return JSON with:
1. summary (overallIntent, confidence, disclaimer)
2. materialAlignment (selected materials grouped by strength using strong / partial / weak with short reasons)
3. systems (3 to 4 only), each with:
   - category
   - evidenceStrength
   - readsAs
   - likelyRoute
   - alternative
   - watchOut
   - possibleSuppliers (1 to 3 plausible company homepages only, and only when confidence is medium or high)
   - optional costBand and carbonSignal tags
   - linkedMaterials (names only)
4. realityCheck (2 to 3 concise bullets)

Do not output a long report.`;

const appendContextLine = (label: string, value?: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return `- ${label}: ${trimmed}`;
};

const formatSelectedMaterial = (material: MaterialTranslationPromptMaterial): string => {
  const name = String(material.name || "").trim();
  const category = String(material.category || "").trim();
  const finish = String(material.finish || "").trim();

  if (!name) return "";

  const parts = [name];
  if (category) parts.push(`category: ${category}`);
  if (finish) parts.push(`finish: ${finish}`);
  if (material.id) parts.push(`id: ${material.id}`);

  return `- ${parts.join(" | ")}`;
};

export function buildMaterialTranslationPrompt(context?: MaterialTranslationPromptContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const contextLines: string[] = [];
  const selectedMaterials: MaterialTranslationPromptMaterial[] = Array.isArray(context?.selectedMaterials)
    ? context.selectedMaterials.reduce<MaterialTranslationPromptMaterial[]>((acc, entry) => {
        const name = String(entry?.name || "").trim();
        if (!name) return acc;

        acc.push({
          id: entry?.id ? String(entry.id) : undefined,
          name,
          category: entry?.category ? String(entry.category) : undefined,
          finish: entry?.finish ? String(entry.finish) : undefined,
        });

        return acc;
      }, [])
    : [];

  const palette = Array.isArray(context?.selectedMaterialPalette)
    ? context.selectedMaterialPalette.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];

  const projectTypeLine = appendContextLine("project type", context?.projectType);
  const regionLine = appendContextLine("region", context?.region);
  const budgetTierLine = appendContextLine("budget tier", context?.budgetTier);
  const sustainabilityPreferenceLine = appendContextLine(
    "sustainability preference",
    context?.sustainabilityPreference
  );
  const paletteLine =
    palette.length > 0 ? `- selected material palette: ${palette.slice(0, 24).join(", ")}` : null;

  if (projectTypeLine) contextLines.push(projectTypeLine);
  if (regionLine) contextLines.push(regionLine);
  if (paletteLine) contextLines.push(paletteLine);
  if (budgetTierLine) contextLines.push(budgetTierLine);
  if (sustainabilityPreferenceLine) contextLines.push(sustainabilityPreferenceLine);

  const selectedMaterialLines = selectedMaterials.map((entry) => formatSelectedMaterial(entry)).filter(Boolean);
  const selectedMaterialBlock = selectedMaterialLines.length
    ? `\n\nSelected materials to cross-reference:\n${selectedMaterialLines.join("\n")}`
    : "";

  const userPrompt = contextLines.length
    ? `${USER_PROMPT_BASE}\n\nProject context:\n${contextLines.join("\n")}${selectedMaterialBlock}`
    : `${USER_PROMPT_BASE}${selectedMaterialBlock}`;

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
  };
}

export const MATERIAL_TRANSLATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "materialAlignment", "systems", "realityCheck"],
  properties: {
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["overallIntent", "confidence", "disclaimer"],
      properties: {
        overallIntent: { type: "string" },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        disclaimer: { type: "string" },
      },
    },
    materialAlignment: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["materialId", "name", "category", "finish", "strength", "reason"],
        properties: {
          materialId: { type: ["string", "null"] },
          name: { type: "string" },
          category: { type: ["string", "null"] },
          finish: { type: ["string", "null"] },
          strength: { type: "string", enum: ["strong", "partial", "weak"] },
          reason: { type: "string" },
        },
      },
    },
    systems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "category",
          "evidenceStrength",
          "readsAs",
          "likelyRoute",
          "alternative",
          "watchOut",
          "possibleSuppliers",
          "costBand",
          "carbonSignal",
          "linkedMaterials",
        ],
        properties: {
          id: { type: "string" },
          category: { type: "string" },
          evidenceStrength: { type: "string", enum: ["high", "medium", "low"] },
          readsAs: { type: "string" },
          likelyRoute: { type: "string" },
          alternative: { type: "string" },
          watchOut: { type: "string" },
          possibleSuppliers: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "url"],
              properties: {
                name: { type: "string" },
                url: { type: "string" },
              },
            },
          },
          costBand: { type: "string", enum: ["£", "££", "£££", "££££", "unknown"] },
          carbonSignal: { type: "string", enum: ["low", "medium", "high", "unknown"] },
          linkedMaterials: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    realityCheck: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

export type { MaterialTranslationPromptContext, MaterialTranslationPromptMaterial };
