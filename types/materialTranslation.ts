export type SupplierLink = {
  name: string;
  url: string;
};

export type MaterialAlignmentStrength = "strong" | "partial" | "weak";

export type MaterialAlignmentItem = {
  materialId?: string | null;
  name: string;
  category?: string | null;
  finish?: string | null;
  strength: MaterialAlignmentStrength;
  reason: string;
};

export type CostBand = "£" | "££" | "£££" | "££££" | "unknown";
export type CarbonSignal = "low" | "medium" | "high" | "unknown";

export type MaterialPathway = {
  name: string;
  description: string;
  suitability: "high" | "medium" | "low";
  costBand: "£" | "££" | "£££" | "££££";
  carbonSignal: CarbonSignal;
  manufacturerCategory: string;
  manufacturers: SupplierLink[];
};

export type LegacyBuildableOption = {
  name: string;
  description: string;
  suitability: "high" | "medium" | "low";
  costBand: "£" | "££" | "£££" | "££££";
  carbonSignal: CarbonSignal;
  manufacturers: SupplierLink[];
};

export type PaletteReference = {
  materialId: string | null;
  name: string;
  category: string;
  finish: string | null;
  relationship: "direct" | "adjacent" | "contrast" | "unknown";
  note: string;
};

export type MaterialSystem = {
  id: string;
  category: string;
  evidenceStrength?: "high" | "medium" | "low";

  // New concise schema
  readsAs?: string;
  likelyRoute?: string;
  alternative?: string;
  watchOut?: string;
  possibleSuppliers?: SupplierLink[];
  costBand?: CostBand;
  carbonSignal?: CarbonSignal;
  linkedMaterials?: string[];

  // Legacy support
  likelySystem?: string;
  whyThisReadsThisWay?: string;
  recommendedPathway?: MaterialPathway;
  alternativePathway?: MaterialPathway;
  tradeOff?: string;
  designNote?: string;
  risks?: string[];
  visualIntent?: string;
  buildableOptions?: LegacyBuildableOption[];
  paletteReferences?: PaletteReference[];
};

export type MaterialTranslationResult = {
  summary: {
    overallIntent: string;
    confidence: "low" | "medium" | "high";
    disclaimer: string;
  };
  materialAlignment?: MaterialAlignmentItem[];
  systems: MaterialSystem[];
  realityCheck: string[];
};

export type MaterialTranslationStatus = "idle" | "loading" | "ready" | "error";

export type MaterialTranslationContext = {
  projectType?: string;
  location?: string;
  region?: string;
  userMaterials?:
    | Array<
        | {
            id?: string;
            name?: string;
            category?: string;
            finish?: string;
          }
        | string
      >;
  selectedMaterialPalette?: string[];
  budgetTier?: string;
  sustainabilityPreference?: string;
};
