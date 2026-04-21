import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getContainer, GenerationDocument, isCosmosNotFound } from "../shared/cosmosClient";
import { validateToken } from "../shared/validateToken";
import {
  buildMaterialTranslationPrompt,
  MATERIAL_TRANSLATION_JSON_SCHEMA,
  MaterialTranslationPromptContext,
} from "../shared/materialTranslationPrompt";
import { createStructuredVisionResponse } from "../shared/openai";

type Confidence = "low" | "medium" | "high";
type EvidenceStrength = "high" | "medium" | "low";
type AlignmentStrength = "strong" | "partial" | "weak";
type CostBand = "£" | "££" | "£££" | "££££" | "unknown";
type CarbonSignal = "low" | "medium" | "high" | "unknown";
type PaletteRelationship = "direct" | "adjacent" | "contrast" | "unknown";

type ContextMaterial = {
  materialId: string | null;
  name: string;
  category: string;
  finish: string | null;
};

type SupplierLink = {
  name: string;
  url: string;
};

type MaterialAlignmentItem = {
  materialId: string | null;
  name: string;
  category: string | null;
  finish: string | null;
  strength: AlignmentStrength;
  reason: string;
};

type MaterialSystem = {
  id: string;
  category: string;
  evidenceStrength: EvidenceStrength;
  readsAs: string;
  likelyRoute: string;
  alternative: string;
  watchOut: string;
  possibleSuppliers: SupplierLink[];
  costBand: CostBand;
  carbonSignal: CarbonSignal;
  linkedMaterials: string[];
};

type MaterialTranslationResult = {
  summary: {
    overallIntent: string;
    confidence: Confidence;
    disclaimer: string;
  };
  materialAlignment: MaterialAlignmentItem[];
  systems: MaterialSystem[];
  realityCheck: string[];
};

type MaterialTranslationRequestBody = {
  imageUrl?: string;
  projectId?: string;
  renderId?: string;
  context?: {
    projectType?: string;
    location?: string;
    region?: string;
    userMaterials?: Array<{
      id?: string;
      name?: string;
      category?: string;
      finish?: string;
    } | string>;
    selectedMaterialPalette?: string[];
    budgetTier?: string;
    sustainabilityPreference?: string;
  };
};

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const DEFAULT_DISCLAIMER =
  "Early-stage guidance only. Validate all systems through project-specific design development and coordination.";

const DEFAULT_REALITY_CHECKS = [
  "Renders hide fixings, joints, and support strategy.",
  "Fire stopping, drainage, and movement need coordinated detailing.",
  "Interface buildability at edges and openings can change the chosen route.",
];

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => asString(item)).filter(Boolean) : [];

const toEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  const matched = allowed.find((item) => item.toLowerCase() === normalized);
  return matched || fallback;
};

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const splitTokens = (value: string): string[] =>
  normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `system-${Math.random().toString(36).slice(2, 8)}`;

const normalizeMaterialName = (value: string): string => normalizeText(value);

const normalizeMaterialKey = (material: Pick<ContextMaterial, "name" | "category" | "finish">): string => {
  return [normalizeText(material.name), normalizeText(material.category), normalizeText(material.finish || "")].join("|");
};

const alignmentStrengthScore = (strength: AlignmentStrength): number => {
  if (strength === "strong") return 3;
  if (strength === "partial") return 2;
  return 1;
};

const evidenceStrengthScore = (strength: EvidenceStrength): number => {
  if (strength === "high") return 3;
  if (strength === "medium") return 2;
  return 1;
};

const toHomepageUrl = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    if (!parsed.hostname) return "";
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${parsed.hostname}${port}/`;
  } catch {
    return "";
  }
};

const sanitizeSupplierLinks = (value: unknown, enabled: boolean): SupplierLink[] => {
  if (!enabled) return [];

  const source = Array.isArray(value) ? value : [];
  const deduped = new Map<string, SupplierLink>();

  for (const entry of source) {
    const record = asRecord(entry);
    if (!record) continue;

    const name = asString(record.name);
    const url = toHomepageUrl(asString(record.url));
    if (!name || !url) continue;

    const key = `${name.toLowerCase()}|${url.toLowerCase()}`;
    if (!deduped.has(key)) {
      deduped.set(key, { name, url });
    }
  }

  return Array.from(deduped.values()).slice(0, 3);
};

const extractManufacturersFromPathway = (pathway: unknown): SupplierLink[] => {
  const record = asRecord(pathway);
  if (!record) return [];

  const manufacturers = Array.isArray(record.manufacturers) ? record.manufacturers : [];
  const normalized = manufacturers
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      name: asString(entry.name),
      url: toHomepageUrl(asString(entry.url)),
    }))
    .filter((entry) => entry.name && entry.url);

  return normalized.slice(0, 4);
};

const gatherLegacySuppliers = (systemRecord: Record<string, unknown>): SupplierLink[] => {
  const direct = Array.isArray(systemRecord.possibleSuppliers) ? systemRecord.possibleSuppliers : [];
  const suppliers: SupplierLink[] = [];

  suppliers.push(
    ...sanitizeSupplierLinks(direct, true),
    ...extractManufacturersFromPathway(systemRecord.recommendedPathway),
    ...extractManufacturersFromPathway(systemRecord.alternativePathway)
  );

  const buildableOptions = Array.isArray(systemRecord.buildableOptions) ? systemRecord.buildableOptions : [];
  for (const option of buildableOptions.slice(0, 2)) {
    const optionRecord = asRecord(option);
    if (!optionRecord) continue;

    const manufacturers = Array.isArray(optionRecord.manufacturers) ? optionRecord.manufacturers : [];
    for (const manufacturer of manufacturers) {
      const manufacturerRecord = asRecord(manufacturer);
      if (!manufacturerRecord) continue;
      const name = asString(manufacturerRecord.name);
      const url = toHomepageUrl(asString(manufacturerRecord.url));
      if (!name || !url) continue;
      suppliers.push({ name, url });
    }
  }

  const deduped = new Map<string, SupplierLink>();
  for (const supplier of suppliers) {
    const key = `${supplier.name.toLowerCase()}|${supplier.url.toLowerCase()}`;
    if (!deduped.has(key)) {
      deduped.set(key, supplier);
    }
  }

  return Array.from(deduped.values()).slice(0, 3);
};

const toContextMaterials = (contextValue: MaterialTranslationRequestBody["context"]): ContextMaterial[] => {
  const context = contextValue || {};
  const userMaterials = Array.isArray(context.userMaterials) ? context.userMaterials : [];
  const entries: ContextMaterial[] = [];

  for (const item of userMaterials) {
    if (typeof item === "string") {
      const name = item.trim();
      if (!name) continue;
      entries.push({
        materialId: null,
        name,
        category: "unspecified",
        finish: null,
      });
      continue;
    }

    const record = asRecord(item);
    if (!record) continue;

    const name = asString(record.name);
    if (!name) continue;

    entries.push({
      materialId: asString(record.id) || null,
      name,
      category: asString(record.category) || "unspecified",
      finish: asString(record.finish) || null,
    });
  }

  const deduped = new Map<string, ContextMaterial>();
  for (const entry of entries) {
    deduped.set(normalizeMaterialKey(entry), entry);
  }

  return Array.from(deduped.values()).slice(0, 30);
};

const toContextMaterialsFromGeneration = (generation: GenerationDocument): ContextMaterial[] => {
  const materials = asRecord(generation.materials) || {};
  const entries: ContextMaterial[] = [];

  const board = Array.isArray(materials.board) ? materials.board : [];
  for (const item of board) {
    const record = asRecord(item);
    if (!record) continue;

    const name = asString(record.name);
    if (!name) continue;

    entries.push({
      materialId: asString(record.id) || null,
      name,
      category: asString(record.category) || "unspecified",
      finish: asString(record.finish) || null,
    });
  }

  const userMaterials = Array.isArray(materials.userMaterials) ? materials.userMaterials : [];
  for (const item of userMaterials) {
    if (typeof item === "string") {
      const name = item.trim();
      if (!name) continue;

      entries.push({
        materialId: null,
        name,
        category: "unspecified",
        finish: null,
      });
      continue;
    }

    const record = asRecord(item);
    if (!record) continue;

    const name = asString(record.name);
    if (!name) continue;

    entries.push({
      materialId: asString(record.id) || null,
      name,
      category: asString(record.category) || "unspecified",
      finish: asString(record.finish) || null,
    });
  }

  const deduped = new Map<string, ContextMaterial>();
  for (const entry of entries) {
    deduped.set(normalizeMaterialKey(entry), entry);
  }

  return Array.from(deduped.values()).slice(0, 30);
};

const toPromptContext = (
  contextValue: MaterialTranslationRequestBody["context"],
  contextMaterials: ContextMaterial[]
): MaterialTranslationPromptContext => {
  const context = contextValue || {};

  const selectedPalette = Array.isArray(context.selectedMaterialPalette)
    ? context.selectedMaterialPalette.map((entry) => asString(entry)).filter(Boolean)
    : [];

  const selectedMaterials = contextMaterials.map((entry) => ({
    id: entry.materialId || undefined,
    name: entry.name,
    category: entry.category,
    finish: entry.finish,
  }));

  const fallbackPaletteFromSelected = selectedMaterials.map((entry) => {
    const parts = [entry.name];
    if (entry.category) parts.push(`(${entry.category})`);
    return parts.join(" ");
  });

  return {
    projectType: asString(context.projectType),
    region: asString(context.region) || asString(context.location),
    selectedMaterialPalette:
      selectedPalette.length > 0 ? selectedPalette : fallbackPaletteFromSelected.slice(0, 30),
    selectedMaterials,
    budgetTier: asString(context.budgetTier),
    sustainabilityPreference: asString(context.sustainabilityPreference),
  };
};

const sanitizeMaterialAlignmentItem = (value: unknown): MaterialAlignmentItem | null => {
  const record = asRecord(value);
  if (!record) return null;

  const name = asString(record.name);
  if (!name) return null;

  return {
    materialId: asString(record.materialId) || null,
    name,
    category: asString(record.category) || null,
    finish: asString(record.finish) || null,
    strength: toEnum(record.strength, ["strong", "partial", "weak"], "weak"),
    reason:
      asString(record.reason) ||
      "Visual evidence is limited, so treat this alignment as provisional.",
  };
};

const inferAlignmentFromLegacyRelationship = (relationship: PaletteRelationship): AlignmentStrength => {
  if (relationship === "direct") return "strong";
  if (relationship === "adjacent" || relationship === "contrast") return "partial";
  return "weak";
};

const buildLegacyAlignmentFromSystems = (rawSystems: unknown[]): MaterialAlignmentItem[] => {
  const alignment: MaterialAlignmentItem[] = [];

  for (const item of rawSystems) {
    const system = asRecord(item);
    if (!system) continue;

    const paletteReferences = Array.isArray(system.paletteReferences) ? system.paletteReferences : [];
    for (const referenceValue of paletteReferences) {
      const reference = asRecord(referenceValue);
      if (!reference) continue;

      const name = asString(reference.name);
      if (!name) continue;

      const relationship = toEnum(
        reference.relationship,
        ["direct", "adjacent", "contrast", "unknown"],
        "unknown"
      );

      alignment.push({
        materialId: asString(reference.materialId) || null,
        name,
        category: asString(reference.category) || null,
        finish: asString(reference.finish) || null,
        strength: inferAlignmentFromLegacyRelationship(relationship),
        reason:
          asString(reference.note) ||
          "Recovered from earlier saved translation links between selected materials and system intent.",
      });
    }
  }

  return alignment;
};

const ensureMaterialAlignmentCoverage = (
  modelAlignment: MaterialAlignmentItem[],
  contextMaterials: ContextMaterial[],
  rawSystems: unknown[]
): MaterialAlignmentItem[] => {
  const merged = [...modelAlignment];
  if (!merged.length) {
    merged.push(...buildLegacyAlignmentFromSystems(rawSystems));
  }

  const byName = new Map<string, MaterialAlignmentItem>();
  for (const entry of merged) {
    const key = normalizeMaterialName(entry.name);
    if (!key) continue;

    const existing = byName.get(key);
    if (!existing || alignmentStrengthScore(entry.strength) > alignmentStrengthScore(existing.strength)) {
      byName.set(key, entry);
    }
  }

  for (const material of contextMaterials) {
    const key = normalizeMaterialName(material.name);
    if (!key) continue;

    const existing = byName.get(key);
    if (existing) {
      byName.set(key, {
        ...existing,
        materialId: existing.materialId || material.materialId,
        category: existing.category || material.category,
        finish: existing.finish || material.finish,
      });
      continue;
    }

    byName.set(key, {
      materialId: material.materialId,
      name: material.name,
      category: material.category,
      finish: material.finish,
      strength: "weak",
      reason: "Not clearly evidenced in the render.",
    });
  }

  return Array.from(byName.values()).slice(0, 36);
};

const buildAlignmentLookup = (alignment: MaterialAlignmentItem[]): Map<string, AlignmentStrength> => {
  const lookup = new Map<string, AlignmentStrength>();

  for (const item of alignment) {
    const key = normalizeMaterialName(item.name);
    if (!key) continue;

    const existing = lookup.get(key);
    if (!existing || alignmentStrengthScore(item.strength) > alignmentStrengthScore(existing)) {
      lookup.set(key, item.strength);
    }
  }

  return lookup;
};

const inferLinkedMaterialsFromText = (
  text: string,
  alignment: MaterialAlignmentItem[]
): string[] => {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return [];

  const tokens = new Set(splitTokens(normalizedText));

  const strongOrPartial = alignment.filter(
    (item) => item.strength === "strong" || item.strength === "partial"
  );

  const matched = strongOrPartial
    .map((item) => {
      const nameTokens = splitTokens(item.name);
      const matchedTokens = nameTokens.filter((token) => tokens.has(token)).length;
      const directSubstring = normalizeText(item.name) && normalizedText.includes(normalizeText(item.name));

      return {
        name: item.name,
        score: (directSubstring ? 3 : 0) + matchedTokens,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.name)
    .slice(0, 4);

  if (matched.length > 0) {
    return Array.from(new Set(matched));
  }

  return strongOrPartial.map((entry) => entry.name).slice(0, 2);
};

const sanitizeLinkedMaterials = (
  systemRecord: Record<string, unknown>,
  alignment: MaterialAlignmentItem[],
  contextMaterials: ContextMaterial[],
  textBasis: string
): string[] => {
  const direct = asStringArray(systemRecord.linkedMaterials)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (direct.length > 0) {
    return Array.from(new Set(direct));
  }

  const paletteReferences = Array.isArray(systemRecord.paletteReferences)
    ? systemRecord.paletteReferences
    : [];

  const fromPalette = paletteReferences
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => asString(entry.name))
    .filter(Boolean)
    .slice(0, 8);

  if (fromPalette.length > 0) {
    return Array.from(new Set(fromPalette));
  }

  const inferred = inferLinkedMaterialsFromText(textBasis, alignment);
  if (inferred.length > 0) {
    return inferred;
  }

  return contextMaterials.map((entry) => entry.name).slice(0, 2);
};

const pickFirstNonEmpty = (...values: unknown[]): string => {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return "";
};

const sanitizeSystem = (
  value: unknown,
  index: number,
  alignment: MaterialAlignmentItem[],
  contextMaterials: ContextMaterial[],
  summaryConfidence: Confidence
): MaterialSystem | null => {
  const record = asRecord(value);
  if (!record) return null;

  const category = pickFirstNonEmpty(record.category, `System ${index + 1}`);

  const readsAs = pickFirstNonEmpty(
    record.readsAs,
    record.whyThisReadsThisWay,
    record.visualIntent,
    record.likelySystem
  );
  if (!readsAs) return null;

  const recommendedPathway = asRecord(record.recommendedPathway);
  const alternativePathway = asRecord(record.alternativePathway);
  const buildableOptions = Array.isArray(record.buildableOptions) ? record.buildableOptions : [];
  const firstBuildable = asRecord(buildableOptions[0]);
  const secondBuildable = asRecord(buildableOptions[1] || buildableOptions[0]);

  const likelyRoute = pickFirstNonEmpty(
    record.likelyRoute,
    recommendedPathway?.name,
    firstBuildable?.name,
    record.likelySystem,
    "Likely route requires project-specific technical validation."
  );

  const alternative = pickFirstNonEmpty(
    record.alternative,
    alternativePathway?.name,
    secondBuildable?.name,
    "Alternative route to test against programme and buildability priorities."
  );

  const watchOut = pickFirstNonEmpty(
    record.watchOut,
    Array.isArray(record.risks) ? record.risks[0] : "",
    record.designNote,
    record.tradeOff,
    "Coordinate movement, fire stopping, drainage, and interfaces before route selection."
  );

  const evidenceStrength = toEnum(record.evidenceStrength, ["high", "medium", "low"], "medium");

  const textBasis = [category, readsAs, likelyRoute, alternative, watchOut].join(" ");
  const linkedMaterials = sanitizeLinkedMaterials(record, alignment, contextMaterials, textBasis);

  const possibleSuppliersRaw = Array.isArray(record.possibleSuppliers)
    ? record.possibleSuppliers
    : gatherLegacySuppliers(record);

  const suppliersEnabled = summaryConfidence !== "low" && evidenceStrength !== "low";
  const possibleSuppliers = sanitizeSupplierLinks(possibleSuppliersRaw, suppliersEnabled);

  const costBand = toEnum(
    pickFirstNonEmpty(record.costBand, recommendedPathway?.costBand, firstBuildable?.costBand, "unknown"),
    ["£", "££", "£££", "££££", "unknown"],
    "unknown"
  );

  const carbonSignal = toEnum(
    pickFirstNonEmpty(record.carbonSignal, recommendedPathway?.carbonSignal, firstBuildable?.carbonSignal, "unknown"),
    ["low", "medium", "high", "unknown"],
    "unknown"
  );

  return {
    id: asString(record.id) || slugify(category),
    category,
    evidenceStrength,
    readsAs,
    likelyRoute,
    alternative,
    watchOut,
    possibleSuppliers,
    costBand,
    carbonSignal,
    linkedMaterials,
  };
};

const SYSTEM_BUCKETS = {
  PRIMARY_STRUCTURE: "primary-structure",
  MAIN_CLADDING: "main-cladding",
  GLAZING_OPENING: "glazing-opening",
  DOMINANT_EXTERNAL: "dominant-external",
  OTHER: "other",
} as const;

type SystemBucket = (typeof SYSTEM_BUCKETS)[keyof typeof SYSTEM_BUCKETS];

const classifySystemBucket = (system: MaterialSystem): SystemBucket => {
  const text = normalizeText(`${system.category} ${system.readsAs} ${system.likelyRoute}`);

  if (/\b(primary|structure|frame|steel|timber|concrete|load bearing|column|beam|bracing)\b/.test(text)) {
    return SYSTEM_BUCKETS.PRIMARY_STRUCTURE;
  }

  if (/\b(cladding|facade|fa[cç]ade|external wall|rainscreen|cassette|panel|terracotta|fibre cement|envelope skin)\b/.test(text)) {
    return SYSTEM_BUCKETS.MAIN_CLADDING;
  }

  if (/\b(glazing|glass|curtain wall|window wall|opening|window|door|storefront)\b/.test(text)) {
    return SYSTEM_BUCKETS.GLAZING_OPENING;
  }

  if (/\b(landscape|planter|living wall|green wall|roof|canopy|parapet|screen|external feature|public realm)\b/.test(text)) {
    return SYSTEM_BUCKETS.DOMINANT_EXTERNAL;
  }

  return SYSTEM_BUCKETS.OTHER;
};

const isFillerSystem = (system: MaterialSystem): boolean => {
  const text = normalizeText(`${system.category} ${system.readsAs} ${system.likelyRoute}`);
  return /\b(floor|flooring|carpet|internal finish|interior|ceiling|joinery|furniture|decorative trim|wallpaper|countertop|skirting)\b/.test(text);
};

const getBucketPriority = (bucket: SystemBucket): number => {
  switch (bucket) {
    case SYSTEM_BUCKETS.PRIMARY_STRUCTURE:
      return 6;
    case SYSTEM_BUCKETS.MAIN_CLADDING:
      return 5;
    case SYSTEM_BUCKETS.GLAZING_OPENING:
      return 4;
    case SYSTEM_BUCKETS.DOMINANT_EXTERNAL:
      return 3;
    default:
      return 1;
  }
};

const linkedMaterialSignal = (system: MaterialSystem, lookup: Map<string, AlignmentStrength>): number => {
  if (!system.linkedMaterials.length) return 0;

  let best = 0;
  for (const name of system.linkedMaterials) {
    const strength = lookup.get(normalizeMaterialName(name));
    if (!strength) continue;

    if (strength === "strong") best = Math.max(best, 3);
    else if (strength === "partial") best = Math.max(best, 2);
    else best = Math.max(best, 1);
  }

  return best;
};

const hasOnlyWeakLinkedMaterials = (system: MaterialSystem, lookup: Map<string, AlignmentStrength>): boolean => {
  if (!system.linkedMaterials.length) return false;

  return system.linkedMaterials.every((name) => {
    const strength = lookup.get(normalizeMaterialName(name));
    return !strength || strength === "weak";
  });
};

const rankAndFilterMajorSystems = (
  systems: MaterialSystem[],
  alignment: MaterialAlignmentItem[]
): MaterialSystem[] => {
  if (!systems.length) return [];

  const alignmentLookup = buildAlignmentLookup(alignment);

  const scored = systems.map((system) => {
    const bucket = classifySystemBucket(system);
    const weakLinked = hasOnlyWeakLinkedMaterials(system, alignmentLookup);
    const filler = isFillerSystem(system);

    const score =
      getBucketPriority(bucket) * 10 +
      evidenceStrengthScore(system.evidenceStrength) * 2 +
      linkedMaterialSignal(system, alignmentLookup);

    return {
      system,
      bucket,
      weakLinked,
      filler,
      score,
    };
  });

  const preferredPool = scored.filter((entry) => !entry.filler && !entry.weakLinked);
  const noFillerPool = scored.filter((entry) => !entry.filler);
  const workingPool = preferredPool.length > 0 ? preferredPool : noFillerPool.length > 0 ? noFillerPool : scored;

  const sorted = [...workingPool].sort((a, b) => b.score - a.score);
  const selected: MaterialSystem[] = [];
  const selectedIds = new Set<string>();

  const anchorBuckets: SystemBucket[] = [
    SYSTEM_BUCKETS.PRIMARY_STRUCTURE,
    SYSTEM_BUCKETS.MAIN_CLADDING,
    SYSTEM_BUCKETS.GLAZING_OPENING,
  ];

  for (const bucket of anchorBuckets) {
    const candidate = sorted.find((entry) => entry.bucket === bucket && !selectedIds.has(entry.system.id));
    if (!candidate) continue;
    selected.push(candidate.system);
    selectedIds.add(candidate.system.id);
  }

  const dominantCandidate = sorted.find(
    (entry) => entry.bucket === SYSTEM_BUCKETS.DOMINANT_EXTERNAL && !selectedIds.has(entry.system.id)
  );
  if (dominantCandidate && selected.length < 4) {
    selected.push(dominantCandidate.system);
    selectedIds.add(dominantCandidate.system.id);
  }

  for (const entry of sorted) {
    if (selected.length >= 4) break;
    if (selectedIds.has(entry.system.id)) continue;
    selected.push(entry.system);
    selectedIds.add(entry.system.id);
  }

  const targetMin = Math.min(3, sorted.length);
  if (selected.length < targetMin) {
    for (const entry of sorted) {
      if (selected.length >= targetMin) break;
      if (selectedIds.has(entry.system.id)) continue;
      selected.push(entry.system);
      selectedIds.add(entry.system.id);
    }
  }

  return selected.slice(0, 4);
};

const sanitizeRealityCheck = (value: unknown): string[] => {
  const checks = asStringArray(value)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (checks.length > 0) {
    return checks;
  }

  return DEFAULT_REALITY_CHECKS;
};

const sanitizeMaterialTranslationResult = (
  raw: Record<string, unknown>,
  contextMaterials: ContextMaterial[]
): MaterialTranslationResult => {
  const summaryRecord = asRecord(raw.summary) || {};
  const summaryConfidence = toEnum(summaryRecord.confidence, ["low", "medium", "high"], "medium");

  const rawSystems = Array.isArray(raw.systems) ? raw.systems : [];

  const modelAlignment = (Array.isArray(raw.materialAlignment) ? raw.materialAlignment : [])
    .map((entry) => sanitizeMaterialAlignmentItem(entry))
    .filter((entry): entry is MaterialAlignmentItem => Boolean(entry));

  const materialAlignment = ensureMaterialAlignmentCoverage(modelAlignment, contextMaterials, rawSystems);

  const systems = rawSystems
    .map((entry, index) => sanitizeSystem(entry, index, materialAlignment, contextMaterials, summaryConfidence))
    .filter((entry): entry is MaterialSystem => Boolean(entry));

  const filteredSystems = rankAndFilterMajorSystems(systems, materialAlignment);

  const fallbackSystem: MaterialSystem = {
    id: "envelope-route",
    category: "Envelope route",
    evidenceStrength: "low",
    readsAs: "The render suggests an envelope-led concept but technical depth is limited.",
    likelyRoute: "Use a category-level facade route and validate interface strategy during design development.",
    alternative: "Use a simplified robust envelope package to reduce coordination complexity.",
    watchOut: "Movement, fire stopping, drainage, and fixing strategy are not resolved by render evidence alone.",
    possibleSuppliers: [],
    costBand: "unknown",
    carbonSignal: "unknown",
    linkedMaterials: materialAlignment
      .filter((item) => item.strength === "strong" || item.strength === "partial")
      .map((item) => item.name)
      .slice(0, 3),
  };

  return {
    summary: {
      overallIntent:
        asString(summaryRecord.overallIntent) ||
        "Concept-stage material intent inferred from visible external systems.",
      confidence: summaryConfidence,
      disclaimer: asString(summaryRecord.disclaimer) || DEFAULT_DISCLAIMER,
    },
    materialAlignment,
    systems: filteredSystems.length > 0 ? filteredSystems : [fallbackSystem],
    realityCheck: sanitizeRealityCheck(raw.realityCheck),
  };
};

const getSavedMaterialTranslation = (generation: GenerationDocument): {
  result: MaterialTranslationResult | null;
  status: string | null;
  createdAt: string | null;
} => {
  const materials = asRecord(generation.materials) || {};
  const rawTranslation = asRecord(materials.materialTranslation);
  const status = asString(materials.materialTranslationStatus) || null;
  const createdAt = asString(materials.materialTranslationCreatedAt) || null;

  if (!rawTranslation) {
    return { result: null, status, createdAt };
  }

  const contextMaterials = toContextMaterialsFromGeneration(generation);

  return {
    result: sanitizeMaterialTranslationResult(rawTranslation, contextMaterials),
    status,
    createdAt,
  };
};

const persistMaterialTranslation = async (
  userId: string,
  renderId: string,
  result: MaterialTranslationResult,
  createdAt: string
): Promise<boolean> => {
  const generationsContainer = getContainer("generations");
  let resource: GenerationDocument | undefined;

  try {
    const response = await generationsContainer.item(renderId, userId).read<GenerationDocument>();
    resource = response.resource;
  } catch (error) {
    if (isCosmosNotFound(error)) return false;
    throw error;
  }

  if (!resource) return false;

  const existingMaterials = asRecord(resource.materials) || {};
  const nextMaterials = {
    ...existingMaterials,
    materialTranslation: result,
    materialTranslationStatus: "completed",
    materialTranslationCreatedAt: createdAt,
  };

  const nextMetadata = {
    ...(resource.metadata || {}),
    materialTranslationStatus: "completed",
    materialTranslationCreatedAt: createdAt,
  };

  await generationsContainer.item(renderId, userId).replace({
    ...resource,
    materials: nextMaterials,
    metadata: nextMetadata,
  });

  return true;
};

export async function materialTranslation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return { status: 204, headers };
  }

  try {
    if (request.method === "GET") {
      const renderId = asString(request.query.get("renderId"));
      if (!renderId) {
        return {
          status: 400,
          headers,
          body: JSON.stringify({ error: "Missing renderId query parameter." }),
        };
      }

      const user = await validateToken(request);
      if (!user) {
        return {
          status: 401,
          headers,
          body: JSON.stringify({ error: "Unauthorized", message: "Valid authentication required." }),
        };
      }

      const generationsContainer = getContainer("generations");
      let resource: GenerationDocument | undefined;

      try {
        const response = await generationsContainer.item(renderId, user.userId).read<GenerationDocument>();
        resource = response.resource;
      } catch (error) {
        if (isCosmosNotFound(error)) {
          return {
            status: 404,
            headers,
            body: JSON.stringify({ error: "Render not found." }),
          };
        }
        throw error;
      }

      if (!resource) {
        return {
          status: 404,
          headers,
          body: JSON.stringify({ error: "Render not found." }),
        };
      }

      const saved = getSavedMaterialTranslation(resource);
      if (!saved.result) {
        return {
          status: 404,
          headers,
          body: JSON.stringify({ error: "No saved material translation found for this render." }),
        };
      }

      return {
        status: 200,
        headers,
        body: JSON.stringify({
          result: saved.result,
          status: saved.status || "completed",
          createdAt: saved.createdAt,
          renderId,
          persisted: true,
        }),
      };
    }

    const body = (await request.json()) as MaterialTranslationRequestBody;
    const imageUrl = asString(body.imageUrl);
    const renderId = asString(body.renderId);

    if (!imageUrl) {
      return {
        status: 400,
        headers,
        body: JSON.stringify({ error: "Missing imageUrl in request body." }),
      };
    }

    const user = await validateToken(request);
    const contextMaterials = toContextMaterials(body.context);
    const promptContext = toPromptContext(body.context, contextMaterials);
    const prompts = buildMaterialTranslationPrompt(promptContext);

    const rawResult = await createStructuredVisionResponse({
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      imageUrl,
      jsonSchemaName: "material_translation_result",
      jsonSchema: MATERIAL_TRANSLATION_JSON_SCHEMA as unknown as Record<string, unknown>,
      temperature: 0.1,
      maxOutputTokens: 2200,
    });

    const result = sanitizeMaterialTranslationResult(rawResult, contextMaterials);
    const createdAt = new Date().toISOString();
    let persisted = false;

    if (user && renderId) {
      try {
        persisted = await persistMaterialTranslation(user.userId, renderId, result, createdAt);
      } catch (persistError) {
        context.warn(
          `[material-translation] Failed to persist translation for render ${renderId}: ${
            persistError instanceof Error ? persistError.message : String(persistError)
          }`
        );
      }
    }

    return {
      status: 200,
      headers,
      body: JSON.stringify({
        result,
        status: "completed",
        createdAt,
        renderId: renderId || null,
        persisted,
      }),
    };
  } catch (error) {
    context.error("material-translation failed", error);
    return {
      status: 500,
      headers,
      body: JSON.stringify({
        error: "Material translation failed.",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
}

app.http("material-translation", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: materialTranslation,
});
