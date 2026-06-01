// Google Analytics gtag global
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export interface ProjectImage {
  id: string;
  url: string; // In a real scenario, this would be the local path to the user's images
  title: string;
  description: string;
  category: 'Render' | 'Plan' | 'Section';
}

export interface SpecSection {
  title: string;
  content: string;
  image: string;
  imageAlt: string;
}

export type MaterialCategory =
  | 'floor'
  | 'structure'
  | 'finish'
  | 'wall-internal'
  | 'external'
  | 'soffit'
  | 'ceiling'
  | 'window'
  | 'roof'
  | 'paint-wall'
  | 'paint-ceiling'
  | 'plaster'
  | 'microcement'
  | 'timber-panel'
  | 'tile'
  | 'wallpaper'
  | 'acoustic-panel'
  | 'timber-slat'
  | 'exposed-structure'
  | 'joinery'
  | 'fixture'
  | 'landscape'
  | 'insulation'
  | 'door'
  | 'balustrade'
  | 'external-ground'
  | 'furniture';

/** Classification of the base material composition */
export type MaterialType =
  | 'metal'
  | 'timber'
  | 'stone'
  | 'ceramic'
  | 'composite'
  | 'glass'
  | 'polymer'
  | 'mineral'
  | 'natural-fibre'
  | 'bio-based'
  | 'concrete'
  | 'textile';

/** Physical form the material takes */
export type MaterialForm =
  | 'board'
  | 'sheet'
  | 'panel'
  | 'plank'
  | 'tile'
  | 'block'
  | 'bar'
  | 'tube'
  | 'beam'
  | 'roll'
  | 'liquid'
  | 'granular'
  | 'membrane';

/** Primary function of the material in the building */
export type MaterialFunction =
  | 'structural'
  | 'surface'
  | 'insulation'
  | 'weatherproofing'
  | 'acoustic'
  | 'decorative';

/** Manufacturing/processing methods used */
export type ManufacturingProcess =
  | 'casting'
  | 'pressing'
  | 'heat-pressing'
  | 'cutting'
  | 'metal-working'
  | 'extrusion'
  | 'lamination'
  | 'kiln-firing'
  | 'weaving'
  | 'moulding'
  | 'machining'
  | 'coating'
  | 'mixing';

/** Finish family/standard used for the material */
export type FinishFamily =
  | 'self-finished'    // Material has no finish options / comes as-is
  | 'ral'              // RAL Classic color standard
  | 'ncs'              // Natural Color System
  | 'pantone'          // Pantone Matching System
  | 'bs'               // British Standard colors
  | 'timber-stain'     // Wood stains
  | 'timber-oil'       // Wood oils (e.g., Osmo, Rubio)
  | 'timber-lacquer'   // Clear/tinted lacquers
  | 'timber-wax'       // Wax finishes
  | 'timber-natural'   // Natural/untreated timber
  | 'metal-powder-coat'// Powder coated metals
  | 'metal-anodised'   // Anodised aluminium
  | 'metal-galvanised' // Galvanised steel
  | 'metal-patina'     // Patinated metals (bronze, copper)
  | 'metal-brushed'    // Brushed metal finishes
  | 'metal-polished'   // Polished/mirror metals
  | 'stone-polished'   // Polished stone
  | 'stone-honed'      // Honed stone
  | 'stone-flamed'     // Flamed/textured stone
  | 'stone-natural'    // Natural cleft stone
  | 'concrete-polished'// Polished concrete
  | 'concrete-exposed' // Exposed aggregate
  | 'concrete-formed'  // Board-formed/textured
  | 'paint-matte'      // Matte paint finishes
  | 'paint-satin'      // Satin/eggshell paint
  | 'paint-gloss'      // Gloss paint finishes
  | 'tile-glazed'      // Glazed ceramic/porcelain
  | 'tile-unglazed'    // Unglazed ceramic/terracotta
  | 'glass-clear'      // Clear glass
  | 'glass-tinted'     // Tinted glass
  | 'glass-frosted'    // Frosted/etched glass
  | 'fabric-natural'   // Natural fabric finishes
  | 'fabric-synthetic' // Synthetic fabric finishes
  | 'leather'          // Leather finishes
  | 'vinyl'            // Vinyl/PVC finishes
  | 'laminate'         // HPL/laminate finishes
  | 'veneer'           // Wood veneer
  | 'custom';          // Custom/other finish family

// ─── Sustainability data model ────────────────────────────────────────────────

/**
 * How confident we are in a given sustainability claim.
 * Drives badge display and disclaimer copy in the UI.
 */
export type EvidenceLevel =
  | 'third-party-verified'   // EPD or cert verified by an independent body
  | 'manufacturer-declared'  // Taken from manufacturer's own literature
  | 'published-source'       // Sourced from a public database or published report
  | 'ai-estimated'           // Estimated by the AI — internal use only
  | 'unknown';

export interface EpdData {
  available: boolean;
  epdUrl?: string;
  /** Programme operator, e.g. 'BRE', 'IBU', 'EPD International', 'MRPI' */
  epdProgramOperator?: string;
  epdNumber?: string;
  /** Usually 'EN 15804+A2' for construction products */
  standard?: string;
  validUntil?: string;        // ISO date
  /** How the product unit is measured, e.g. '1 m²', '1 kg', '1 item' */
  declaredUnit?: string;
  dataSource?: 'manufacturer-supplied' | 'third-party-database' | 'ai-estimated';
  verificationStatus?: 'third-party-verified' | 'self-declared' | 'unverified';
}

/** GWP by EN 15804 life-cycle module — null = not declared for this module */
export interface GwpModules {
  A1A3?: number | null;  // Product stage: raw material extraction + transport + manufacture
  A4?: number | null;    // Transport to site
  A5?: number | null;    // Installation into building
  B1B7?: number | null;  // Use stage (maintenance, repair, replacement, operational energy)
  C1C4?: number | null;  // End of life: deconstruction + transport + waste processing + disposal
  D?: number | null;     // Beyond system boundary: reuse / recovery / recycling potential
}

export interface SustainabilityImpacts {
  gwp?: {
    unit: 'kgCO2e';
    /** Functional/declared unit the values are expressed per, e.g. '1 m²' */
    perDeclaredUnit: string;
    modules: GwpModules;
  };
}

/** Simplified user-facing carbon figure derived from the full impact data */
export interface HeadlineCarbon {
  value: number;
  unit: string;             // e.g. 'kgCO2e/m²', 'kgCO2e/kg'
  basis: string;            // e.g. 'A1–A3', 'A1–A3 + C1–C4'
  confidence: EvidenceLevel;
}

export interface SustainabilityCertification {
  /** Scheme name, e.g. 'FSC', 'PEFC', 'BBA', 'VOC', 'Cradle to Cradle', 'BES 6001' */
  scheme: string;
  /** Specific level or grade, e.g. 'FSC Mix', 'A+', 'Silver', 'BBA Agrément No. 00/0000' */
  value?: string;
  /** Relevant for region-specific schemes, e.g. 'France' for VOC A+ */
  region?: string;
  certificateUrl?: string;
  appliesTo?: 'product' | 'manufacturer' | 'chain-of-custody';
  validUntil?: string;      // ISO date
  verified: boolean;
}

/** Normalised claim used for UI badges and filtering — derived from structured data above */
export interface SustainabilityClaim {
  /** Machine-readable type: 'epd-available', 'recycled-content', 'take-back', 'low-voc', etc. */
  type: string;
  /** Human-readable label, e.g. '62% recycled content', 'EPD available' */
  label: string;
  value?: number;
  unit?: string;
  evidence?: string;
  confidence: EvidenceLevel;
}

// Category-specific sustainability attributes ─────────────────────────────────

export interface TextileSustainabilityAttrs {
  recycledContentPct?: number;
  takeBackScheme?: boolean;
  backingType?: string;      // e.g. 'bitumen-free', 'PVC-free', 'polyolefin'
  yarnType?: string;         // e.g. 'solution-dyed nylon', 'recycled PET'
  lowVoc?: boolean;
}

export interface TimberSustainabilityAttrs {
  certifiedSource?: boolean;
  chainOfCustody?: 'FSC' | 'PEFC' | string;
  species?: string;
  countryOfOrigin?: string;
  /** Formaldehyde emission class: 'E0', 'E1', 'CARB P2', 'NAF' (No Added Formaldehyde) */
  formaldehydeClass?: string;
}

export interface InsulationSustainabilityAttrs {
  recycledContentPct?: number;
  ozoneDepletionPotential?: number;
  globalWarmingPotentialBlowingAgent?: 'none' | 'low' | 'medium' | 'high';
}

export interface PaintSustainabilityAttrs {
  vocContent?: 'zero' | 'low' | 'medium' | 'high';
  /** VOC content in grams per litre */
  vocGramsPerLitre?: number;
  waterBased?: boolean;
  /** French/EU emissions class: 'A+', 'A', 'B', 'C' */
  emissionsClass?: string;
}

export interface StoneSustainabilityAttrs {
  countryOfOrigin?: string;
  quarryRegion?: string;
  recycledContentPct?: number;
}

export interface MetalSustainabilityAttrs {
  recycledContentPct?: number;
  recycledAtEol?: boolean;
  coatingType?: string;      // e.g. 'powder-coat', 'anodised', 'hot-dip galvanised'
}

export interface TileSustainabilityAttrs {
  recycledContentPct?: number;
  waterAbsorption?: string;  // e.g. 'BIa (<0.5%)', 'BIIa (0.5–3%)'
  countryOfOrigin?: string;
}

/** Keyed by material category — only populate the key relevant to the product */
export interface CategorySustainabilityAttributes {
  textile?: TextileSustainabilityAttrs;
  timber?: TimberSustainabilityAttrs;
  insulation?: InsulationSustainabilityAttrs;
  paint?: PaintSustainabilityAttrs;
  stone?: StoneSustainabilityAttrs;
  metal?: MetalSustainabilityAttrs;
  tile?: TileSustainabilityAttrs;
}

export interface SustainabilityData {
  /** Primary evidence source — populate this first */
  epd: EpdData;
  /** Detailed impact data by life-cycle module */
  impacts?: SustainabilityImpacts;
  /** Simplified headline figure for UI display */
  headlineCarbon?: HeadlineCarbon | null;
  /** All certifications and accreditations as flexible evidence records */
  certifications?: SustainabilityCertification[];
  /** Category-specific attributes — only populate the key that matches the product */
  categoryAttributes?: CategorySustainabilityAttributes;
  /** Normalised claims for badges and filtering */
  claims?: SustainabilityClaim[];
  /** Overall evidence quality for this product's sustainability data */
  evidenceLevel: EvidenceLevel;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * How a brand's product expresses colour/finish choice.
 *
 * photo-variants   — brand supplies a photo per variant; user picks by image + name
 *                    (carpet colourways, tile SKUs, LVT, brassware finishes, etc.)
 * colour-standard  — variants are RAL / NCS / BS codes; no per-variant photo needed
 *                    (powder coat, architectural paint, anodising)
 * surface-finish   — same material in different surface treatments, each with a photo
 *                    (stone polished/honed/flamed, timber oiled/lacquered/raw)
 * none             — single product, no variants (structural, insulation, generic)
 */
export type VariantMode = 'photo-variants' | 'colour-standard' | 'surface-finish' | 'none';

export interface ProductVariant {
  id: string;
  /** Manufacturer's own descriptive name — never a colour code ("Mottled Brown", "Matt Black") */
  name: string;
  /** Product photo for this specific variant — required for photo-variants & surface-finish */
  imageUrl: string;
  /** Representative hex — internal/AI colour-matching only, never shown to the user */
  tone: string;
  /** Manufacturer SKU for this specific variant */
  productCode?: string;
  /** Which variant is shown first on the product card */
  isDefault?: boolean;
  /**
   * Only used for mixed-mode products (e.g. a cladding panel where you first pick
   * a named texture with a photo, then choose a RAL colour within that texture).
   */
  finishFamily?: FinishFamily;
}

export interface MaterialOption {
  id: string;
  name: string;
  tone: string; // hex value for quick swatch
  finish: string;
  description: string;
  keywords: string[];
  category: MaterialCategory;
  colorOptions?: { label: string; tone: string }[];
  supportsColor?: boolean;
  finishOptions?: string[];
  varietyOptions?: string[]; // Material varieties (e.g., stone types: Bath, Portland, Carrara)
  selectedVariety?: string; // User-selected variety label
  treePaths?: string[];
  carbonIntensity?: 'low' | 'medium' | 'high' | 'unknown';
  tags?: string[]; // Material attribute tags (e.g., 'paint', 'timber-panels', etc.)
  isCustom?: boolean; // Whether this is a user-created custom material
  customImage?: string; // Data URL for custom material images
  customDescription?: string; // User-provided description for custom materials
  colorVariantId?: string; // ID for colored variant (e.g., 'steel-yellow') used to load colored icons
  colorLabel?: string; // Label for the color variant (e.g., 'Yellow')
  coloredIconBlobUrl?: string; // Azure Blob Storage URL for colored icon (server-side storage)
  iconWebpUrl?: string; // Blob/SAS URL for default WebP icon
  iconPngUrl?: string; // Blob/SAS URL for default PNG icon fallback
  excludeFromMoodboardRender?: boolean; // Exclude from moodboard image render
  note?: string; // User note for this material instance (saved with moodboard)
  // Material classification attributes
  materialType?: MaterialType; // Base material composition (e.g., metal, timber, composite)
  materialForm?: MaterialForm[]; // Physical forms available (e.g., sheet, board, tube)
  materialFunction?: MaterialFunction[]; // Primary functions (e.g., structural, surface)
  manufacturingProcess?: ManufacturingProcess[]; // How the material is processed
  finishFamily?: FinishFamily; // Finish family/standard (e.g., RAL, timber-oil, stone-honed)
  // Sustainability briefing pre-stored content
  strategicValue?: string; // For low-carbon materials: why this is an excellent choice (1-2 sentences)
  mitigationTip?: string; // For high-carbon materials: practical tip to reduce impact (1-2 sentences)
  // Structured sustainability actions (replacing legacy 'actions' array)
  actionDocumentation?: string; // Request for EPD, certification, or sourcing evidence
  actionVerification?: string; // Specification to verify (recycled content, VOC levels, etc.)
  actionCircularity?: string; // End-of-life action (take-back, disassembly, reuse)

  // --- Media ---
  /** Primary representative image — required for variantMode: "none" and "colour-standard" */
  imageUrl?: string;
  /** Supporting images: texture closeups, installation context, scale shots */
  galleryImageUrls?: string[];

  // --- Source / data quality ---
  // Drives visual stratification: generic cards are simplified, branded cards show full detail
  source?: 'generic' | 'verified-brand' | 'standard-brand' | 'partner-brand';
  /** ISO date when the product data was last verified */
  verifiedAt?: string;
  /** Internal user, team, or process that performed verification */
  verifiedBy?: string;
  /** Manufacturer URL used for verification — for re-checking if specs change */
  dataLastCheckedUrl?: string;

  // --- Brand attribution (populated for verified-brand / partner-brand) ---
  brandId?: string;
  brandName?: string;
  brandLogoUrl?: string;
  brandWebsite?: string;
  brandTier?: 'partner' | 'verified' | 'standard';

  // --- Product identity ---
  productCode?: string;        // Manufacturer SKU / reference
  productCollection?: string;  // Highest grouping level (e.g. "Human Nature" by Interface)
  productRange?: string;       // Sub-collection / range name (e.g. "Cliff Edge")
  productPageUrl?: string;     // Link to product on brand's website
  sampleRequestUrl?: string;   // URL for ordering a physical sample

  // --- Product variant model ---
  variantMode?: VariantMode;
  /** True on the "family" document that groups all colourways/finishes under one card */
  isVariantParent?: boolean;
  /** materialId of the parent document (set on each individual variant) */
  variantOf?: string;
  /** Shared key across all variants of the same product — used to query siblings */
  variantGroup?: string;
  /** Colour family grouping for filtering within a brand page (e.g. "Warm Neutrals") */
  colorFamily?: string;
  /** Weave/pattern name where relevant (e.g. "Herringbone", "Plain Loop") */
  patternName?: string;
  /** Inline variant list — populated on the parent document */
  variants?: ProductVariant[];

  // --- Brand-supplied assets ---
  specSheetUrl?: string;       // PDF product datasheet
  installGuideUrl?: string;    // PDF installation guide
  bimObjectUrl?: string;       // Revit / ArchiCAD object download
  productImages?: string[];    // Azure Blob URLs — multiple finishes / angles

  // --- Technical specification ---
  dimensions?: {
    thickness?: string;
    width?: string;
    length?: string;
    weightPerM2?: string;
  };
  fireRating?: string;         // e.g. "Euroclass A1"
  acousticRating?: string;     // e.g. "Rw 52 dB"
  thermalValue?: string;       // e.g. "λ = 0.034 W/mK"
  slipResistance?: string;     // e.g. "R10"
  warranty?: string;           // e.g. "25 years"

  // --- Sustainability (structured) ---
  /** Full nested sustainability model — use this for all new records */
  sustainability?: SustainabilityData;

  // --- Sustainability (legacy flat fields — deprecated, use sustainability{} instead) ---
  /** @deprecated Use sustainability.epd.epdUrl */
  epdUrl?: string;
  /** @deprecated Use sustainability.impacts.gwp.modules.A1A3 and sustainability.headlineCarbon */
  embodiedCarbonA1A3?: number;
  /** @deprecated Use sustainability.categoryAttributes[type].recycledContentPct or sustainability.claims */
  recycledContentPct?: number;
  /** @deprecated Use sustainability.certifications or sustainability.claims */
  recycledAtEol?: boolean;
  /** @deprecated Use sustainability.certifications with scheme: 'VOC' */
  vocClass?: string;
  /** @deprecated Use sustainability.certifications[] array */
  certifications?: string[];
  nbsClause?: string;

  // --- Application context ---
  /** Where the material can be physically applied */
  applications?: Array<'floor' | 'wall' | 'ceiling' | 'external-wall' | 'roof' | 'wet-area'>;
  /** Whether the product is for internal use, external use, or both */
  internalExternal?: 'internal' | 'external' | 'both';
  /** Typical building use contexts — useful for filtering and AI recommendations */
  typicalUse?: Array<'commercial' | 'residential' | 'education' | 'hospitality' | 'healthcare' | 'retail'>;

  // --- Commercial ---
  priceRange?: string;         // e.g. "£45–£65/m²"
  leadTime?: string;           // e.g. "4–6 weeks"
  minOrderQty?: string;        // e.g. "10 m²"
}

export interface UploadedImage {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
  sizeBytes?: number;
  originalSizeBytes?: number;
  width?: number;
  height?: number;
  sourceGenerationId?: string | null;
}

export type StyleReferenceSource = 'project' | 'external';

export type BrandTier = 'partner' | 'verified' | 'standard';

// Lightweight brand profile used in material cards, homepage showcase, and brand pages
export interface BrandProfile {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  tagline: string | null;
  tier: BrandTier;
  isFeatured: boolean;
  featuredOrder: number | null;
}

// Form data shape for the brand product submission flow
export interface BrandSubmissionForm {
  // Step 1: Company profile
  companyName: string;
  website: string;
  logoFile?: File;
  tagline: string;
  countryOfOrigin: string;
  contactName: string;
  contactEmail: string;

  // Step 2+: One or more products (added incrementally in the form)
  products: BrandProductSubmission[];
}

export interface BrandProductSubmission {
  // Basics
  name: string;
  category: string;
  productCode: string;
  productRange: string;
  productPageUrl: string;
  finish: string;
  description: string;
  keywords: string;
  tone: string; // hex swatch

  // Assets
  specSheetFile?: File;
  installGuideFile?: File;
  bimObjectUrl: string;
  productImageFiles?: File[];

  // Technical
  dimensionThickness: string;
  dimensionWidth: string;
  dimensionLength: string;
  weightPerM2: string;
  fireRating: string;
  acousticRating: string;
  thermalValue: string;
  slipResistance: string;
  warranty: string;

  // Sustainability
  epdFile?: File;
  epdUrl: string;
  embodiedCarbonA1A3: string; // string in form, parsed to number on submit
  recycledContentPct: string;
  recycledAtEol: boolean | null;
  vocClass: string;
  certifications: string;     // pipe-separated in form
  nbsClause: string;

  // Commercial (optional)
  priceRange: string;
  leadTime: string;
  minOrderQty: string;

  // Health & risks
  carbonIntensity: 'low' | 'medium' | 'high' | '';
  healthRiskLevel: 'low' | 'medium' | 'high' | '';
  healthConcerns: string;
  healthNote: string;
  risks: string; // "Risk=>Mitigation|..." format, same as CSV
  serviceLife: string;
  finishOptions: string;
  colorOptions: string;
}
