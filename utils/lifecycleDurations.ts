// Lifecycle duration data
// Service life, replacement cycles, and carbon payback for materials
// Critical for honest lifecycle assessment

import type { MaterialOption, MaterialCategory } from '../types';
import type { CarbonPaybackCategory } from '../types/sustainability';

// ============================================================================
// TYPES
// ============================================================================

export interface LifecycleDuration {
  serviceLife: number; // Expected lifespan in years
  replacementCycle: number; // How often replaced/refurbished (years)
  carbonPayback?: CarbonPayback; // Only for biogenic/operational/ecosystem claims
  carbonPaybackNote?: string; // Used when no payback claim is appropriate
  replacementScope?: 'full' | 'partial'; // Whether replacements are full system or partial
  partialReplacementFactor?: number; // Optional factor to scale replacements for partial systems
  notes?: string;
}

export interface CarbonPayback {
  years: number; // Years until embodied carbon is offset (0 = immediate)
  rangeYears?: [number, number]; // Optional range for variable contexts
  category: CarbonPaybackCategory;
  assumption: string; // What the payback is based on
}

// ============================================================================
// CATEGORY-BASED SERVICE LIFE DEFAULTS
// Based on RICS whole-life carbon assessment guidance
// ============================================================================

const CATEGORY_DURATIONS: Record<MaterialCategory, LifecycleDuration> = {
  // Long-life structural elements (60+ years)
  structure: { serviceLife: 60, replacementCycle: 60, notes: 'Building lifespan' },
  'exposed-structure': { serviceLife: 60, replacementCycle: 60, notes: 'Building lifespan' },

  // Envelope (40-60 years with maintenance)
  external: { serviceLife: 40, replacementCycle: 40, notes: 'Weather exposure reduces life' },
  roof: { serviceLife: 40, replacementCycle: 40, notes: 'Depends on material type' },
  window: { serviceLife: 30, replacementCycle: 30, notes: 'Seal degradation limits life' },
  insulation: { serviceLife: 60, replacementCycle: 60, notes: 'If protected from moisture' },

  // Internal partitions (25-40 years)
  'wall-internal': { serviceLife: 25, replacementCycle: 25, notes: 'Tenant churn drives replacement' },
  door: { serviceLife: 30, replacementCycle: 30 },
  balustrade: { serviceLife: 40, replacementCycle: 40 },

  // Floors (15-25 years for finishes)
  floor: { serviceLife: 20, replacementCycle: 15, notes: 'High wear area' },

  // Ceilings (20-30 years)
  ceiling: { serviceLife: 25, replacementCycle: 20, notes: 'Access requirements affect life' },
  soffit: { serviceLife: 30, replacementCycle: 30 },

  // Finishes and coatings (5-15 years)
  finish: { serviceLife: 10, replacementCycle: 10, notes: 'Aesthetic-driven replacement' },
  'paint-wall': { serviceLife: 7, replacementCycle: 5, notes: 'Touch-up at 3-5 years, full at 7' },
  'paint-ceiling': { serviceLife: 10, replacementCycle: 7, notes: 'Less wear than walls' },
  plaster: { serviceLife: 40, replacementCycle: 40, notes: 'Substrate for other finishes' },
  microcement: { serviceLife: 20, replacementCycle: 15 },

  // Wall finishes (10-25 years)
  'timber-panel': { serviceLife: 25, replacementCycle: 20, notes: 'Depends on timber type' },
  tile: { serviceLife: 25, replacementCycle: 25, notes: 'Grout needs maintenance' },
  wallpaper: { serviceLife: 10, replacementCycle: 8, notes: 'Fashion-driven replacement' },
  'acoustic-panel': { serviceLife: 20, replacementCycle: 15, notes: 'Absorption degrades' },
  'timber-slat': { serviceLife: 25, replacementCycle: 20 },

  // Joinery and fixtures (15-25 years)
  joinery: { serviceLife: 25, replacementCycle: 20, notes: 'Quality-dependent' },
  fixture: { serviceLife: 15, replacementCycle: 15, notes: 'Technology obsolescence' },

  // Landscape (varies widely)
  landscape: { serviceLife: 25, replacementCycle: 10, notes: 'Planting: 10-30 years' },
  'external-ground': { serviceLife: 30, replacementCycle: 25, notes: 'Hard landscape more durable' },

  // Furniture (5-15 years)
  furniture: { serviceLife: 10, replacementCycle: 7, notes: 'Tenant churn drives replacement' },
};

// ============================================================================
// MATERIAL-SPECIFIC OVERRIDES
// Pattern matching for specific materials with different characteristics
// ============================================================================

interface MaterialDurationOverride {
  pattern: RegExp;
  categories?: MaterialCategory[];
  duration: LifecycleDuration;
}

const MATERIAL_OVERRIDES: MaterialDurationOverride[] = [
  // CARBON PAYBACK MATERIALS (biogenic/operational/ecosystem)

  // CLT/Mass timber - biogenic storage
  {
    pattern: /clt|cross.?laminated|mass.?timber|glulam/i,
    duration: {
      serviceLife: 60,
      replacementCycle: 60,
      carbonPayback: {
        years: 0,
        category: 'biogenic_storage',
        assumption: 'Rule of thumb: ~0.7-1.0 tCO₂ stored per m³ timber (density-dependent)',
      },
      notes: 'Biogenic storage benefit depends on accounting method and end-of-life scenario',
    },
  },

  // Timber - biogenic storage
  {
    pattern: /timber|wood|oak|ash|pine|birch/i,
    categories: ['structure', 'exposed-structure'],
    duration: {
      serviceLife: 60,
      replacementCycle: 60,
      carbonPayback: {
        years: 0, // Immediate - biogenic storage at installation
        category: 'biogenic_storage',
        assumption: 'Rule of thumb: ~0.7-1.0 tCO₂ stored per m³ timber (density-dependent); counted as biogenic storage at installation under EN 15978 conventions',
      },
      notes: 'Biogenic storage from day 1; maintained if kept in use',
    },
  },

  // Hempcrete - biogenic storage
  {
    pattern: /hempcrete|hemp.?lime|hemp.?block/i,
    duration: {
      serviceLife: 60,
      replacementCycle: 60,
      carbonPayback: {
        years: 0,
        category: 'biogenic_storage',
        assumption: 'Bio-based content stores carbon; net sequestration depends on mix design, binder content, and LCA boundary',
      },
      notes: 'Often low-carbon; potential net sequestration depends on mix design, binder content, and LCA boundary',
    },
  },

  // Cork - biogenic storage
  {
    pattern: /cork/i,
    duration: {
      serviceLife: 30,
      replacementCycle: 25,
      carbonPayback: {
        years: 0,
        category: 'biogenic_storage',
        assumption: 'Biogenic carbon stored in product; benefits depend on forestry management and product lifespan',
      },
    },
  },

  // Sheep wool insulation - biogenic storage
  {
    pattern: /sheep.?wool|lambswool|natural.?wool/i,
    categories: ['insulation'],
    duration: {
      serviceLife: 60,
      replacementCycle: 60,
      carbonPayback: {
        years: 0,
        category: 'biogenic_storage',
        assumption: 'Bio-based content stores carbon; overall footprint depends strongly on farming system allocation and processing',
      },
    },
  },

  // Wood fibre insulation - biogenic storage
  {
    pattern: /wood.?fibre|woodfibre|cellulose.?insulation/i,
    categories: ['insulation'],
    duration: {
      serviceLife: 60,
      replacementCycle: 60,
      carbonPayback: {
        years: 0,
        category: 'biogenic_storage',
        assumption: 'Recycled newsprint or wood waste; stored carbon',
      },
    },
  },

  // PV panels - operational offset
  {
    pattern: /pv|photovoltaic|solar.?panel/i,
    duration: {
      serviceLife: 30,
      replacementCycle: 25,
      replacementScope: 'partial',
      partialReplacementFactor: 0.6,
      carbonPayback: {
        years: 2,
        rangeYears: [1.5, 4],
        category: 'operational_offset',
        assumption: 'UK context, grid-dependent',
      },
      notes: 'Inverter replacement at 15 years',
    },
  },

  // Green roof - ecosystem sequestration
  {
    pattern: /green.?roof|sedum|living.?roof/i,
    categories: ['roof', 'landscape'],
    duration: {
      serviceLife: 40,
      replacementCycle: 40,
      carbonPayback: {
        years: 8,
        category: 'ecosystem_sequestration',
        assumption: 'Modeled sequestration from planting/soil; site-specific',
      },
      notes: 'Biodiversity and stormwater benefits not counted',
    },
  },

  // LOW-EMBODIED MATERIALS

  // Rammed earth
  {
    pattern: /rammed.?earth|pisé|cob/i,
    duration: {
      serviceLife: 100,
      replacementCycle: 100,
      notes: 'Very low embodied carbon if local',
    },
  },

  // Lime mortar/plaster - carbonation (no payback claim)
  {
    pattern: /lime.?mortar|lime.?plaster|limecrete/i,
    duration: {
      serviceLife: 60,
      replacementCycle: 60,
    },
  },

  // HIGH-EMBODIED / SHORT-LIFE MATERIALS

  // Carpet
  {
    pattern: /carpet|rug/i,
    categories: ['floor', 'finish'],
    duration: {
      serviceLife: 10,
      replacementCycle: 7,
      notes: 'High wear; aesthetic replacement common',
    },
  },

  // Vinyl/LVT
  {
    pattern: /vinyl|lvt|linoleum/i,
    categories: ['floor'],
    duration: {
      serviceLife: 15,
      replacementCycle: 12,
      notes: 'Linoleum lasts longer than vinyl',
    },
  },

  // Aluminium windows
  {
    pattern: /aluminium.*window|aluminum.*window/i,
    categories: ['window'],
    duration: {
      serviceLife: 40,
      replacementCycle: 30,
      replacementScope: 'partial',
      partialReplacementFactor: 0.7,
      notes: 'Frame durable; IGUs and gaskets often replaced before full frame',
    },
  },

  // Steel structure
  {
    pattern: /steel/i,
    categories: ['structure', 'exposed-structure'],
    duration: {
      serviceLife: 60,
      replacementCycle: 60,
      notes: 'Requires corrosion protection',
    },
  },

  // Concrete structure
  {
    pattern: /concrete|cement/i,
    categories: ['structure', 'exposed-structure'],
    duration: {
      serviceLife: 60,
      replacementCycle: 60,
      carbonPaybackNote: 'durability benefit only',
    },
  },

  // Brick
  {
    pattern: /brick|masonry/i,
    categories: ['structure', 'external', 'wall-internal'],
    duration: {
      serviceLife: 100,
      replacementCycle: 100,
      notes: 'With lime mortar, can be reclaimed',
    },
  },

  // Natural stone
  {
    pattern: /stone|marble|granite|slate|limestone/i,
    duration: {
      serviceLife: 100,
      replacementCycle: 100,
      notes: 'Extremely durable; reusable',
    },
  },

  // Porcelain/ceramic tiles
  {
    pattern: /porcelain|ceramic|tile/i,
    categories: ['floor', 'wall-internal', 'tile'],
    duration: {
      serviceLife: 40,
      replacementCycle: 35,
      notes: 'Durable but adhesive limits reuse',
    },
  },

  // Glass
  {
    pattern: /glass|glazing/i,
    duration: {
      serviceLife: 30,
      replacementCycle: 30,
      notes: 'IGU seal failure typically 25-30 years',
    },
  },

  // Paint
  {
    pattern: /paint|emulsion/i,
    categories: ['paint-wall', 'paint-ceiling', 'finish'],
    duration: {
      serviceLife: 7,
      replacementCycle: 5,
      notes: 'Touch-up at 3-5 years',
    },
  },

  // Plasterboard/drywall
  {
    pattern: /plasterboard|drywall|gypsum.?board/i,
    duration: {
      serviceLife: 40,
      replacementCycle: 25,
      notes: 'Partition churn in offices',
    },
  },

  // Mineral wool insulation
  {
    pattern: /mineral.?wool|rockwool|glass.?wool/i,
    categories: ['insulation'],
    duration: {
      serviceLife: 60,
      replacementCycle: 60,
      notes: 'If kept dry, lasts building life',
    },
  },

  // PIR/PUR insulation
  {
    pattern: /pir|pur|polyurethane|polyisocyanurate/i,
    categories: ['insulation'],
    duration: {
      serviceLife: 50,
      replacementCycle: 50,
      notes: 'Some thermal drift over time',
    },
  },

  // Soft landscape
  {
    pattern: /plant|meadow|grass|turf|hedge|shrub|tree/i,
    categories: ['landscape'],
    duration: {
      serviceLife: 30,
      replacementCycle: 10,
      carbonPayback: {
        years: 15,
        rangeYears: [10, 40],
        category: 'ecosystem_sequestration',
        assumption: 'Order-of-magnitude placeholder; sequestration depends on species, age profile, maintenance, survival and site conditions',
      },
      notes: 'Potential sequestration over time (site-specific), not directly comparable to operational payback',
    },
  },

  // Hard landscape - gravel
  {
    pattern: /gravel|aggregate|pebble/i,
    categories: ['landscape', 'external-ground'],
    duration: {
      serviceLife: 50,
      replacementCycle: 30,
      notes: 'Needs periodic top-up',
    },
  },

  // Hard landscape - paving
  {
    pattern: /paving|paver|flag|sett/i,
    categories: ['landscape', 'external-ground'],
    duration: {
      serviceLife: 40,
      replacementCycle: 40,
      notes: 'Dry-laid can be lifted and reused',
    },
  },
];

// ============================================================================
// LANDSCAPE / REGENERATIVE MATERIAL DETECTION
// ============================================================================

/**
 * Landscape material IDs - these get special treatment:
 * - Capped contribution to palette carbon
 * - "Establishment + maintenance" model instead of "replacement"
 * - Cannot be "carbon dominant components"
 * - Different rating language (no "avoid unless essential")
 */
const LANDSCAPE_MATERIAL_IDS = new Set([
  'wildflower-meadow',
  'native-planting',
  'rain-garden',
  'living-wall-external',
  'ornamental-planting',
  'tree-planting',
  'green-roof',
  'living-green-wall',
]);

const LANDSCAPE_PATTERNS = [
  /wildflower|meadow/i,
  /native.?plant/i,
  /rain.?garden/i,
  /bioswale/i,
  /living.?wall/i,
  /green.?wall/i,
  /green.?roof|sedum|living.?roof/i,
  /tree.?plant/i,
  /ornamental.?plant/i,
  /hedge|shrub/i,
];

/**
 * Check if a material is a landscape/regenerative system
 * These materials use a different carbon model (establishment + maintenance)
 */
export function isLandscapeMaterial(material: MaterialOption): boolean {
  // Check by ID first
  if (LANDSCAPE_MATERIAL_IDS.has(material.id)) return true;

  // Check by category
  if (material.category === 'landscape') return true;

  // Check by pattern matching
  const materialText = `${material.id} ${material.name} ${material.description || ''}`;
  return LANDSCAPE_PATTERNS.some((pattern) => pattern.test(materialText));
}

/**
 * Landscape maintenance factor - represents ongoing carbon from re-seeding,
 * soil amendments, plant replacement, etc. over 60 years.
 * This is MUCH lower than full replacement multiplier.
 *
 * Typical landscape maintenance activities:
 * - Annual mowing/management: ~5% of initial embodied
 * - Periodic re-seeding (every 5-10 years): ~10-15% each
 * - Soil amendments: ~5% per decade
 *
 * Over 60 years with good establishment:
 * - Initial establishment: 100%
 * - Ongoing maintenance: ~80-120% additional
 * - Total: ~1.8-2.2x, NOT 6x
 */
const LANDSCAPE_MAINTENANCE_FACTOR = 1.8;

// ============================================================================
// PUBLIC FUNCTIONS
// ============================================================================

/**
 * Get lifecycle duration for a material
 * Uses pattern matching then falls back to category default
 */
export function getLifecycleDuration(material: MaterialOption): LifecycleDuration {
  const materialText = `${material.id} ${material.name} ${material.description || ''}`;

  // Try pattern matching first
  for (const override of MATERIAL_OVERRIDES) {
    if (!override.pattern.test(materialText)) continue;

    // Check category filter if specified
    if (override.categories && !override.categories.includes(material.category)) continue;

    return override.duration;
  }

  // Fall back to category default
  return CATEGORY_DURATIONS[material.category];
}

/**
 * Get carbon payback if applicable, null otherwise
 */
export function getCarbonPayback(material: MaterialOption): CarbonPayback | null {
  const duration = getLifecycleDuration(material);
  return duration.carbonPayback || null;
}

/**
 * Check if material has carbon payback (biogenic/operational/ecosystem)
 */
export function hasPayback(material: MaterialOption): boolean {
  return getCarbonPayback(material) !== null;
}

/**
 * Format carbon payback for display
 */
export function formatCarbonPayback(payback: CarbonPayback): string {
  if (payback.years === 0) {
    const immediateLabel =
      payback.category === 'biogenic_storage'
        ? 'Biogenic storage from day 1'
        : payback.category === 'operational_offset'
        ? 'Operational offset (time-dependent)'
        : 'Immediate ecosystem sequestration';
    return immediateLabel;
  }

  const categoryText =
    payback.category === 'biogenic_storage'
      ? 'biogenic storage'
      : payback.category === 'operational_offset'
      ? 'operational offset'
      : 'ecosystem sequestration';

  if (payback.rangeYears) {
    return `~${payback.rangeYears[0]}-${payback.rangeYears[1]} years (${categoryText})`;
  }

  return `~${payback.years} years (${categoryText})`;
}

/**
 * Calculate lifecycle multiplier for impact assessment
 * Materials replaced more often have higher lifetime impact
 *
 * IMPORTANT: Landscape materials use a different model:
 * - Industrial materials: Full replacement cycles (e.g., carpet replaced 8x)
 * - Landscape materials: Establishment + maintenance (NOT full replacement)
 *   Re-seeding a meadow ≠ re-manufacturing steel
 */
export function getLifecycleMultiplier(
  material: MaterialOption,
  buildingLife: number = 60
): number {
  // Landscape materials use maintenance factor, NOT replacement multiplier
  if (isLandscapeMaterial(material)) {
    return LANDSCAPE_MAINTENANCE_FACTOR;
  }

  const duration = getLifecycleDuration(material);
  // How many times will this material be installed over the building's life?
  const baseMultiplier = Math.ceil(buildingLife / duration.replacementCycle);
  if (duration.replacementScope === 'partial' && duration.partialReplacementFactor) {
    const scaled = baseMultiplier * duration.partialReplacementFactor;
    return Math.max(1, Math.round(scaled * 10) / 10);
  }
  return baseMultiplier;
}

/**
 * Get service life category for display
 */
export function getServiceLifeCategory(
  years: number
): 'short' | 'medium' | 'long' | 'permanent' {
  if (years <= 10) return 'short';
  if (years <= 25) return 'medium';
  if (years <= 50) return 'long';
  return 'permanent';
}

/**
 * Format service life for display
 */
export function formatServiceLife(years: number): string {
  if (years >= 100) return '100+ years';
  return `${years} years`;
}

/**
 * Get all durations for a set of materials
 * Returns a Map for easy lookup
 */
export function getDurationsForMaterials(
  materials: MaterialOption[]
): Map<string, LifecycleDuration> {
  const map = new Map<string, LifecycleDuration>();
  materials.forEach((m) => {
    map.set(m.id, getLifecycleDuration(m));
  });
  return map;
}

/**
 * Categorize materials by service life
 * Useful for grouping in reports
 */
export function categorizeMaterialsByLife(
  materials: MaterialOption[]
): {
  short: MaterialOption[];
  medium: MaterialOption[];
  long: MaterialOption[];
  permanent: MaterialOption[];
} {
  const result = {
    short: [] as MaterialOption[],
    medium: [] as MaterialOption[],
    long: [] as MaterialOption[],
    permanent: [] as MaterialOption[],
  };

  materials.forEach((m) => {
    const duration = getLifecycleDuration(m);
    const category = getServiceLifeCategory(duration.serviceLife);
    result[category].push(m);
  });

  return result;
}

/**
 * Get materials with carbon payback (for highlighting)
 */
export function getMaterialsWithPayback(
  materials: MaterialOption[]
): Array<{ material: MaterialOption; payback: CarbonPayback }> {
  return materials
    .map((m) => ({ material: m, payback: getCarbonPayback(m) }))
    .filter((x): x is { material: MaterialOption; payback: CarbonPayback } =>
      x.payback !== null
    );
}
