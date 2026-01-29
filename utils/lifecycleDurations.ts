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
  notes?: string;
}

export interface CarbonPayback {
  years: number; // Years until embodied carbon is offset (0 = immediate)
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

  // Timber - biogenic storage
  {
    pattern: /timber|wood|oak|ash|pine|birch|clt|glulam/i,
    categories: ['structure', 'exposed-structure'],
    duration: {
      serviceLife: 60,
      replacementCycle: 60,
      carbonPayback: {
        years: 0, // Immediate - biogenic storage at installation
        category: 'biogenic_storage',
        assumption: '1 m³ timber stores ~1 tonne CO₂; counted at installation',
      },
      notes: 'Biogenic storage from day 1; maintained if kept in use',
    },
  },

  // CLT/Mass timber - biogenic storage
  {
    pattern: /clt|cross.?laminated|mass.?timber|glulam/i,
    duration: {
      serviceLife: 60,
      replacementCycle: 60,
      carbonPayback: {
        years: 0,
        category: 'biogenic_storage',
        assumption: '~800 kgCO₂/m³ stored; processing adds ~150 kgCO₂/m³',
      },
      notes: 'Net carbon negative if sustainably sourced',
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
        assumption: 'Hemp sequesters ~1.5 tonnes CO₂/tonne; lime carbonation adds more',
      },
      notes: 'Carbon negative material; improves with age',
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
        assumption: 'Cork oak regenerates; harvesting promotes growth',
      },
    },
  },

  // Wool insulation - biogenic storage
  {
    pattern: /wool.?insulation|sheep.?wool/i,
    categories: ['insulation'],
    duration: {
      serviceLife: 60,
      replacementCycle: 60,
      carbonPayback: {
        years: 0,
        category: 'biogenic_storage',
        assumption: 'Biogenic carbon storage; low processing emissions',
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
      carbonPayback: {
        years: 2,
        category: 'operational_offset',
        assumption: 'UK average ~2 years; varies with orientation and location',
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
      replacementCycle: 40,
      notes: 'Frame durable; seals need maintenance',
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
        years: 5,
        category: 'ecosystem_sequestration',
        assumption: 'Trees: ~20 kgCO₂/year; hedges: ~5 kgCO₂/m/year',
      },
      notes: 'Trees have longest payback but highest storage',
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
        ? 'Immediate operational offset'
        : 'Immediate ecosystem sequestration';
    return immediateLabel;
  }

  const categoryText =
    payback.category === 'biogenic_storage'
      ? 'biogenic storage'
      : payback.category === 'operational_offset'
      ? 'operational offset'
      : 'ecosystem sequestration';

  return `~${payback.years} years (${categoryText})`;
}

/**
 * Calculate lifecycle multiplier for impact assessment
 * Materials replaced more often have higher lifetime impact
 */
export function getLifecycleMultiplier(
  material: MaterialOption,
  buildingLife: number = 60
): number {
  const duration = getLifecycleDuration(material);
  // How many times will this material be installed over the building's life?
  return Math.ceil(buildingLife / duration.replacementCycle);
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
