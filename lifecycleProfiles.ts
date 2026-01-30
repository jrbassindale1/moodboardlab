// Lifecycle fingerprint types and profiles
// Separated from constants.ts to reduce bundle size

export type LifecycleStageKey =
  | 'raw'
  | 'manufacturing'
  | 'transport'
  | 'installation'
  | 'inUse'
  | 'maintenance'
  | 'endOfLife';

export type Confidence = 'high' | 'medium' | 'low';

export type LifecycleStageScore = {
  impact: 1 | 2 | 3 | 4 | 5;
  confidence?: Confidence;
};

export type LifecycleProfile = Record<LifecycleStageKey, LifecycleStageScore>;

const makeSteelStructureProfile = (): LifecycleProfile => ({
  raw: { impact: 5, confidence: 'high' }, // Iron ore mining + pre-processing
  manufacturing: { impact: 5, confidence: 'high' }, // Blast furnace / EAF very energy-intensive
  transport: { impact: 3, confidence: 'medium' }, // Heavy but often local/regional
  installation: { impact: 2, confidence: 'high' }, // Welding/bolting moderate
  inUse: { impact: 1, confidence: 'high' }, // Inert, long life
  maintenance: { impact: 1, confidence: 'high' }, // Painting occasionally
  endOfLife: { impact: 1, confidence: 'high' } // Highly recyclable
});

const makeConcreteFrameProfile = (): LifecycleProfile => ({
  raw: { impact: 3, confidence: 'high' }, // Cement + aggregates
  manufacturing: { impact: 5, confidence: 'high' }, // Cement very high
  transport: { impact: 3, confidence: 'medium' }, // Heavy
  installation: { impact: 3, confidence: 'high' }, // Formwork + curing
  inUse: { impact: 1, confidence: 'high' }, // Inert in use
  maintenance: { impact: 1, confidence: 'high' }, // Very low
  endOfLife: { impact: 3, confidence: 'medium' } // Crushing possible
});

const makeGlulamProfile = (): LifecycleProfile => ({
  raw: { impact: 1, confidence: 'high' },
  manufacturing: { impact: 2, confidence: 'high' }, // Glue + pressing
  transport: { impact: 2, confidence: 'medium' },
  installation: { impact: 2, confidence: 'high' },
  inUse: { impact: 1, confidence: 'high' }, // Inert in use
  maintenance: { impact: 1, confidence: 'high' },
  endOfLife: { impact: 1, confidence: 'high' }
});

const makePlasterboardProfile = (): LifecycleProfile => ({
  raw: { impact: 2, confidence: 'high' },
  manufacturing: { impact: 3, confidence: 'medium' },
  transport: { impact: 3, confidence: 'medium' },
  installation: { impact: 2, confidence: 'high' },
  inUse: { impact: 1, confidence: 'high' },
  maintenance: { impact: 1, confidence: 'high' },
  endOfLife: { impact: 2, confidence: 'medium' }
});

const makePrecastConcreteProfile = (): LifecycleProfile => ({
  raw: { impact: 3, confidence: 'high' },
  manufacturing: { impact: 5, confidence: 'high' },
  transport: { impact: 3, confidence: 'medium' },
  installation: { impact: 3, confidence: 'high' },
  inUse: { impact: 1, confidence: 'high' },
  maintenance: { impact: 1, confidence: 'high' },
  endOfLife: { impact: 3, confidence: 'medium' }
});

// NOTE: Impact scores represent burdens (higher = worse). Model benefits elsewhere.

// Export lifecycle profiles mapping
export const MATERIAL_LIFECYCLE_PROFILES: Record<string, LifecycleProfile> = {
  // STEEL
  'steel-frame': makeSteelStructureProfile(),
  'steel-columns-beams': makeSteelStructureProfile(),

  // RAMMED EARTH
  'rammed-earth-structure': {
    raw: { impact: 1, confidence: 'high' }, // Local soil
    manufacturing: { impact: 1, confidence: 'high' }, // Minimal processing
    transport: { impact: 1, confidence: 'high' }, // Often on-site
    installation: { impact: 2, confidence: 'medium' }, // Labor intensive
    inUse: { impact: 1, confidence: 'high' }, // Very low
    maintenance: { impact: 1, confidence: 'high' }, // Minimal
    endOfLife: { impact: 1, confidence: 'high' } // Return to earth
  },


  // TIMBER FLOORING
  'timber-flooring': {
    raw: { impact: 1, confidence: 'high' }, // FSC timber
    manufacturing: { impact: 2, confidence: 'high' }, // Milling + lamination
    transport: { impact: 2, confidence: 'medium' }, // Varies by source
    installation: { impact: 1, confidence: 'high' }, // Adhesive/clips
    inUse: { impact: 1, confidence: 'high' }, // Inert in use
    maintenance: { impact: 2, confidence: 'medium' }, // Refinishing possible
    endOfLife: { impact: 1, confidence: 'high' } // Recyclable/biodegradable
  },

  // GLASS DOORS
  'glass-door': {
    raw: { impact: 3, confidence: 'high' }, // Silica + additives
    manufacturing: { impact: 4, confidence: 'high' }, // High-temp melting
    transport: { impact: 3, confidence: 'medium' }, // Heavy, fragile
    installation: { impact: 2, confidence: 'high' }, // Skilled fitting
    inUse: { impact: 1, confidence: 'high' }, // Inert
    maintenance: { impact: 1, confidence: 'high' }, // Cleaning only
    endOfLife: { impact: 3, confidence: 'medium' } // Recycling depends on type
  },

  // PET ACOUSTIC BAFFLES
  'acoustic-ceiling-baffles': {
    raw: { impact: 3, confidence: 'medium' }, // PET from recycled bottles
    manufacturing: { impact: 3, confidence: 'medium' }, // Processing + forming
    transport: { impact: 2, confidence: 'medium' }, // Lightweight
    installation: { impact: 1, confidence: 'high' }, // Suspension
    inUse: { impact: 1, confidence: 'high' }, // Inert
    maintenance: { impact: 1, confidence: 'high' }, // Minimal
    endOfLife: { impact: 3, confidence: 'low' } // Recycling uncertain
  },

  // CONCRETE
  'concrete-frame': makeConcreteFrameProfile(),
  'rc-columns-beams': makeConcreteFrameProfile(),

  // TIMBER STRUCTURES
  'glulam-structure': makeGlulamProfile(),
  'glulam-columns-beams': makeGlulamProfile(),
  'clt-structure': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 1, confidence: 'high' }, // Prefab
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  // BRICK
  'brick-veneer': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' }, // Kiln firing
    transport: { impact: 3, confidence: 'medium' }, // Heavy
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },


  // Add defaults for other common materials
  'polished-concrete': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },


  // === AUTO-GENERATED PROFILES ===

  'hybrid-structure': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'nlt-structure': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'ggbs-concrete': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'lino-floor': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'recycled-terrazzo': {
    raw: { impact: 4, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 1, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'low' }
  },

  'rubber-floor': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'grey-carpet': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'bamboo-parquet': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'cork-plank-floor': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'reclaimed-timber-floor': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'stone-paver': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'vinyl-planks': {
    raw: { impact: 4, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 1, confidence: 'high' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 4, confidence: 'low' }
  },

  'resin-flooring': {
    raw: { impact: 4, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 1, confidence: 'high' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 4, confidence: 'low' }
  },

  'microcement-floor': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'ceramic-tiles': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'epoxy-flooring': {
    raw: { impact: 4, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 1, confidence: 'high' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 4, confidence: 'low' }
  },

  'travertine-tiles': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'marble-floor': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'engineered-oak-floor': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'linoleum-tiles': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'aluminum-frame': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'timber-frame': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'recycled-aluminum-frame': {
    raw: { impact: 2, confidence: 'medium' },
    manufacturing: { impact: 2, confidence: 'medium' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'steel-window-frame': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'composite-window-frame': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'upvc-window-frame': {
    raw: { impact: 4, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 1, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 4, confidence: 'low' }
  },

  'curtain-wall-system': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'frameless-glazing': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'clay-plaster': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'gypsum-wall': {
    raw: { impact: 3, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'low' }
  },

  'plasterboard-wall': makePlasterboardProfile(),

  'plywood-panels-wall': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'acoustic-panels-wall': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'glass-partitions': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'brick-internal': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'concrete-block-wall': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'mineral-microcement': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'standard-wall-paint': {
    raw: { impact: 3, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'low' }
  },

  'custom-wall-paint': {
    raw: { impact: 3, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'low' }
  },

  'standard-ceiling-paint': {
    raw: { impact: 3, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'low' }
  },

  'custom-ceiling-paint': {
    raw: { impact: 3, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'low' }
  },


  'perforated-metal-ceiling': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'timber-slat-ceiling': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'gypsum-ceiling': {
    raw: { impact: 3, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'low' }
  },

  'open-grid-ceiling': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'stretch-fabric-ceiling': {
    raw: { impact: 2, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 1, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'low' }
  },

  'coffered-ceiling': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'plasterboard-ceiling': makePlasterboardProfile(),

  'exposed-clt-ceiling': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'metal-mesh-ceiling': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'acoustic-tiles-ceiling': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'exposed-concrete-soffit': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'timber-slat-soffit': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'perforated-metal-soffit': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'timber-linings': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'bio-fibre-panels': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 1, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'timber-wall-panels': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'porcelain-tiles': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'textured-wallpaper': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'fabric-acoustic-panels': {
    raw: { impact: 2, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 1, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'low' }
  },

  'oak-timber-slats': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'cork-panels': {
    raw: { impact: 2, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'reclaimed-boarding': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'mycelium-tiles': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'wool-felt-panels': {
    raw: { impact: 1, confidence: 'medium' },
    manufacturing: { impact: 2, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'bamboo-slat-wall': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'plywood-panels-finish': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'marble-panels': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 4, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'leather-panels': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'medium' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'metal-mesh-panels': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'glass-panels-finish': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'acoustic-plaster': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 1, confidence: 'high' },
    transport: { impact: 1, confidence: 'high' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'lime-plaster': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 1, confidence: 'high' },
    transport: { impact: 1, confidence: 'high' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'tadelakt-plaster': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 1, confidence: 'high' },
    transport: { impact: 1, confidence: 'high' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'secondary-steelwork': makeSteelStructureProfile(),

  'brick-loadbearing': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'hempcrete-structural': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'steel-concrete-composite': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'precast-concrete': makePrecastConcreteProfile(),

  'mass-timber-columns': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'steel-trusses': makeSteelStructureProfile(),

  'prestressed-concrete': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'permeable-paving': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'joinery-built-in': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'brass-fixtures': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'standing-seam-roof': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'green-roof': {
    raw: { impact: 3, confidence: 'medium' },
    manufacturing: { impact: 4, confidence: 'medium' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'medium' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 3, confidence: 'medium' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'cool-roof': {
    raw: { impact: 2, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'pv-roof': {
    raw: { impact: 3, confidence: 'medium' },
    manufacturing: { impact: 4, confidence: 'medium' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 3, confidence: 'low' }
  },

  'blue-roof': {
    raw: { impact: 3, confidence: 'medium' },
    manufacturing: { impact: 4, confidence: 'medium' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'medium' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'clay-tiles-roof': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'slate-tiles-roof': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'metal-tiles-roof': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'epdm-membrane': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'tpo-membrane': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'built-up-roofing': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'polycarbonate-roof': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'wood-fiber-insulation': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'hemp-insulation': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 1, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'sheep-wool-insulation': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 1, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'cellulose-insulation': {
    raw: { impact: 2, confidence: 'medium' },
    manufacturing: { impact: 2, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'mineral-wool': {
    raw: { impact: 2, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'pir-insulation': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'aerogel-insulation': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'timber-door': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'steel-door': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'aluminum-door': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'composite-door': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'fire-rated-door': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'glass-balustrade': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'steel-railing': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'timber-railing': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'cable-railing': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'mesh-railing': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'gravel-paving': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'resin-bound-gravel': {
    raw: { impact: 4, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 1, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 4, confidence: 'low' }
  },

  'concrete-paving': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'block-paving': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'grass-reinforcement': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'decking-external': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'clt-loadbearing-walls': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'masonry-loadbearing': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  // === FAÇADE — Masonry and Mineral-Based ===
  'brick-slip-rainscreen': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 3, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'stone-facade': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 3, confidence: 'high' },
    transport: { impact: 4, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  // stone-rainscreen, slate-cladding — profiles defined earlier in file

  'precast-concrete-panels': {
    ...makePrecastConcreteProfile(),
    transport: { impact: 4, confidence: 'medium' }
  },

  'gfrc-grc-panels': {
    raw: { impact: 2, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  // === FAÇADE — Bio-Based and Low-Carbon ===
  // hemp-lime-wall, charred-timber-cladding, cork-rainscreen — profiles defined earlier in file

  'timber-rainscreen': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'wood-fibre-lime-render': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 1, confidence: 'high' },
    transport: { impact: 1, confidence: 'high' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'living-green-wall': {
    raw: { impact: 1, confidence: 'medium' },
    manufacturing: { impact: 2, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 3, confidence: 'medium' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 3, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'medium' }
  },

  // === FAÇADE — Metal and Industrial Systems ===
  // zinc-cladding, copper-cladding, metal-composite-panels — profiles defined earlier in file

  'weathering-steel-cladding': {
    raw: { impact: 4, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'insulated-metal-panels': {
    raw: { impact: 4, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'fibre-cement-panels': {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 3, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  // === FAÇADE — Lightweight and Transparent ===
  'glass-facade': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },

  'etfe-tensile-facade': {
    raw: { impact: 2, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 1, confidence: 'medium' },
    installation: { impact: 3, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'low' }
  },

  'native-planting': {
    raw: { impact: 2, confidence: 'low' },
    manufacturing: { impact: 3, confidence: 'low' },
    transport: { impact: 2, confidence: 'low' },
    installation: { impact: 3, confidence: 'medium' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'wildflower-meadow': {
    raw: { impact: 2, confidence: 'low' },
    manufacturing: { impact: 3, confidence: 'low' },
    transport: { impact: 2, confidence: 'low' },
    installation: { impact: 3, confidence: 'medium' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'rain-garden': {
    raw: { impact: 2, confidence: 'low' },
    manufacturing: { impact: 3, confidence: 'low' },
    transport: { impact: 2, confidence: 'low' },
    installation: { impact: 3, confidence: 'medium' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'living-wall-external': {
    raw: { impact: 2, confidence: 'low' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 3, confidence: 'medium' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 3, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'ornamental-planting': {
    raw: { impact: 2, confidence: 'low' },
    manufacturing: { impact: 3, confidence: 'low' },
    transport: { impact: 2, confidence: 'low' },
    installation: { impact: 3, confidence: 'medium' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'tree-planting': {
    raw: { impact: 2, confidence: 'low' },
    manufacturing: { impact: 3, confidence: 'low' },
    transport: { impact: 2, confidence: 'low' },
    installation: { impact: 3, confidence: 'medium' },
    inUse: { impact: 2, confidence: 'medium' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },

  'oak-dining-table': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'upholstered-seating': {
    raw: { impact: 2, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 1, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'low' }
  },

  'metal-chair': {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'plywood-furniture': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'reclaimed-timber-furniture': {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },

  'modular-shelving': {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  }
};

// Helper functions for lifecycle profiles

/**
 * Check if a material has a lifecycle profile
 */
export function hasLifecycleProfile(materialId: string): boolean {
  return materialId in MATERIAL_LIFECYCLE_PROFILES;
}

/**
 * Get lifecycle profile for a material, returns null if not found
 */
export function getLifecycleProfile(materialId: string): LifecycleProfile | null {
  return MATERIAL_LIFECYCLE_PROFILES[materialId] || null;
}

/**
 * Get all material IDs that have lifecycle profiles
 */
export function getProfileIds(): Set<string> {
  return new Set(Object.keys(MATERIAL_LIFECYCLE_PROFILES));
}
