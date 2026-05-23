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
  carbonIntensity?: 'low' | 'medium' | 'high';
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

  // --- Source / data quality ---
  // Drives visual stratification: generic cards are simplified, branded cards show full detail
  source?: 'generic' | 'verified-brand' | 'partner-brand';

  // --- Brand attribution (populated for verified-brand / partner-brand) ---
  brandId?: string;
  brandName?: string;
  brandLogoUrl?: string;
  brandWebsite?: string;
  brandTier?: 'partner' | 'verified' | 'standard';

  // --- Product identity ---
  productCode?: string;        // Manufacturer SKU / reference
  productRange?: string;       // Collection or range name
  productPageUrl?: string;     // Link to product on brand's website

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

  // --- Verified sustainability & compliance ---
  epdUrl?: string;
  embodiedCarbonA1A3?: number; // kgCO2e/kg — cradle to gate
  recycledContentPct?: number; // 0–100
  recycledAtEol?: boolean;
  vocClass?: string;           // e.g. "A+"
  certifications?: string[];   // e.g. ["FSC", "BRE A+", "UKCA"]
  nbsClause?: string;

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
