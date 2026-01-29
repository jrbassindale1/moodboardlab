// Synergy and conflict detection rules engine
// Ensures at least 1 synergy and 1 watch-out are always generated

import type { Synergy, Conflict, MaterialMetrics } from '../types/sustainability';
import type { MaterialOption, MaterialCategory } from '../types';

// Category groupings
const THERMAL_MASS_MATERIALS = ['rammed-earth', 'hempcrete', 'concrete', 'brick', 'stone', 'cob', 'adobe'];
const INSULATION_MATERIALS = ['hempcrete', 'cork', 'wool', 'cellulose', 'woodfibre', 'straw'];
const TIMBER_STRUCTURAL = ['clt', 'glulam', 'timber', 'mass-timber', 'nlt', 'dlt'];
const HIGH_EMBODIED = ['steel', 'aluminium', 'concrete', 'glass'];
const HARD_LANDSCAPE = ['gravel', 'paving', 'block', 'sett', 'concrete', 'asphalt', 'resin'];
const SOFT_LANDSCAPE = ['meadow', 'wildflower', 'native', 'planting', 'lawn', 'sedum', 'green-roof'];
const ACOUSTIC = ['acoustic', 'felt', 'baffle', 'absorber'];
const GLAZING = ['glass', 'glazing', 'curtain-wall', 'window', 'partition'];

// Helper functions
function materialMatches(material: MaterialOption, patterns: string[]): boolean {
  const id = material.id.toLowerCase();
  const name = material.name.toLowerCase();
  const keywords = (material.keywords || []).map(k => k.toLowerCase());

  return patterns.some(p =>
    id.includes(p) ||
    name.includes(p) ||
    keywords.some(k => k.includes(p))
  );
}

function getMaterialsMatching(materials: MaterialOption[], patterns: string[]): MaterialOption[] {
  return materials.filter(m => materialMatches(m, patterns));
}

function hasCategory(materials: MaterialOption[], categories: MaterialCategory[]): boolean {
  return materials.some(m => categories.includes(m.category));
}

function getMaterialsByCategory(materials: MaterialOption[], categories: MaterialCategory[]): MaterialOption[] {
  return materials.filter(m => categories.includes(m.category));
}

// ============== SYNERGY RULES ==============

interface SynergyRule {
  id: string;
  condition: (materials: MaterialOption[]) => boolean;
  generate: (materials: MaterialOption[]) => Synergy;
}

const SYNERGY_RULES: SynergyRule[] = [
  // Thermal mass + insulation synergy
  {
    id: 'thermal-mass-insulation',
    condition: (materials) => {
      const hasThermalMass = getMaterialsMatching(materials, THERMAL_MASS_MATERIALS).length > 0;
      const hasInsulation = getMaterialsMatching(materials, INSULATION_MATERIALS).length > 0 ||
        hasCategory(materials, ['insulation']);
      return hasThermalMass && hasInsulation;
    },
    generate: (materials) => ({
      materials: [
        ...getMaterialsMatching(materials, THERMAL_MASS_MATERIALS),
        ...getMaterialsMatching(materials, INSULATION_MATERIALS),
      ].map(m => m.id),
      type: 'performance',
      description: 'Thermal mass materials combined with natural insulation support passive temperature regulation',
    }),
  },

  // Multiple timber elements = carbon storage
  {
    id: 'timber-carbon-storage',
    condition: (materials) => {
      const timberCount = getMaterialsMatching(materials, TIMBER_STRUCTURAL).length +
        materials.filter(m => m.category === 'structure' && materialMatches(m, ['timber', 'wood'])).length;
      return timberCount >= 2;
    },
    generate: (materials) => ({
      materials: getMaterialsMatching(materials, [...TIMBER_STRUCTURAL, 'timber', 'wood']).map(m => m.id),
      type: 'carbon',
      description: 'Multiple timber elements maximize biogenic carbon storage and reduce embodied carbon',
    }),
  },

  // Natural/bio-based palette
  {
    id: 'bio-based-palette',
    condition: (materials) => {
      const bioBased = materials.filter(m =>
        materialMatches(m, ['timber', 'wood', 'cork', 'hemp', 'straw', 'wool', 'cellulose', 'bamboo', 'rattan', 'linen', 'jute'])
      );
      return bioBased.length >= 3;
    },
    generate: (materials) => ({
      materials: materials.filter(m =>
        materialMatches(m, ['timber', 'wood', 'cork', 'hemp', 'straw', 'wool', 'cellulose', 'bamboo'])
      ).map(m => m.id),
      type: 'carbon',
      description: 'Bio-based material palette stores carbon and reduces reliance on high-embodied alternatives',
    }),
  },

  // Soft landscape biodiversity
  {
    id: 'biodiversity-landscape',
    condition: (materials) => {
      return getMaterialsMatching(materials, SOFT_LANDSCAPE).length > 0 ||
        materials.some(m => m.category === 'landscape' && !materialMatches(m, HARD_LANDSCAPE));
    },
    generate: (materials) => ({
      materials: materials.filter(m => m.category === 'landscape').map(m => m.id),
      type: 'biodiversity',
      description: 'Landscape specification supports local ecology and provides habitat value',
    }),
  },

  // Demountable/mechanical fixings
  {
    id: 'circularity-fixings',
    condition: (materials) => {
      return materials.some(m =>
        (m.description?.toLowerCase().includes('demountable') ||
         m.description?.toLowerCase().includes('mechanical') ||
         m.description?.toLowerCase().includes('bolted') ||
         m.description?.toLowerCase().includes('screwed') ||
         materialMatches(m, ['dlt', 'nlt']))
      );
    },
    generate: (materials) => ({
      materials: materials.filter(m =>
        m.description?.toLowerCase().includes('demountable') ||
        m.description?.toLowerCase().includes('mechanical')
      ).map(m => m.id),
      type: 'circularity',
      description: 'Mechanical fixings enable future disassembly and material recovery',
    }),
  },

  // Low-carbon structure
  {
    id: 'low-carbon-structure',
    condition: (materials) => {
      const structure = materials.filter(m => m.category === 'structure' || m.category === 'exposed-structure');
      const lowCarbon = structure.filter(m =>
        materialMatches(m, ['timber', 'wood', 'clt', 'glulam', 'rammed', 'hempcrete', 'straw', 'bamboo'])
      );
      return structure.length > 0 && lowCarbon.length >= structure.length * 0.5;
    },
    generate: (materials) => ({
      materials: materials.filter(m =>
        (m.category === 'structure' || m.category === 'exposed-structure') &&
        materialMatches(m, ['timber', 'wood', 'clt', 'glulam', 'rammed', 'hempcrete'])
      ).map(m => m.id),
      type: 'carbon',
      description: 'Low-carbon structural system significantly reduces whole-building embodied carbon',
    }),
  },

  // Reclaimed/recycled content
  {
    id: 'reclaimed-materials',
    condition: (materials) => {
      return materials.some(m =>
        materialMatches(m, ['reclaimed', 'recycled', 'salvaged', 'upcycled', 'reused'])
      );
    },
    generate: (materials) => ({
      materials: materials.filter(m =>
        materialMatches(m, ['reclaimed', 'recycled', 'salvaged', 'upcycled'])
      ).map(m => m.id),
      type: 'circularity',
      description: 'Reclaimed materials avoid virgin resource extraction and extend material lifespan',
    }),
  },

  // Natural finishes
  {
    id: 'natural-finishes',
    condition: (materials) => {
      const finishes = materials.filter(m =>
        ['floor', 'wall-internal', 'finish'].includes(m.category)
      );
      const natural = finishes.filter(m =>
        materialMatches(m, ['timber', 'wood', 'cork', 'stone', 'clay', 'lime', 'earth', 'terracotta'])
      );
      return finishes.length > 0 && natural.length >= finishes.length * 0.4;
    },
    generate: (materials) => ({
      materials: materials.filter(m =>
        ['floor', 'wall-internal', 'finish'].includes(m.category) &&
        materialMatches(m, ['timber', 'wood', 'cork', 'stone', 'clay', 'lime'])
      ).map(m => m.id),
      type: 'performance',
      description: 'Natural finish materials contribute to healthy indoor air quality and occupant wellbeing',
    }),
  },
];

// ============== CONFLICT RULES ==============

interface ConflictRule {
  id: string;
  condition: (materials: MaterialOption[]) => boolean;
  generate: (materials: MaterialOption[]) => Conflict;
}

const CONFLICT_RULES: ConflictRule[] = [
  // Glazing + acoustic (performance conflict)
  {
    id: 'glazing-acoustic',
    condition: (materials) => {
      const hasGlazing = getMaterialsMatching(materials, GLAZING).length > 0 ||
        hasCategory(materials, ['window']);
      const hasAcoustic = getMaterialsMatching(materials, ACOUSTIC).length > 0;
      return hasGlazing && hasAcoustic;
    },
    generate: (materials) => ({
      materials: [
        ...getMaterialsMatching(materials, GLAZING),
        ...getMaterialsMatching(materials, ACOUSTIC),
      ].map(m => m.id),
      type: 'acoustic',
      description: 'Extensive glazing may compromise acoustic performance despite panel treatment',
      mitigation: 'Consider acoustic laminated glass or review glazing-to-wall ratios',
    }),
  },

  // Multiple hard landscape (redundant carbon)
  {
    id: 'hard-landscape-duplication',
    condition: (materials) => {
      const hardLandscape = getMaterialsMatching(materials, HARD_LANDSCAPE);
      const landscapeMaterials = materials.filter(m =>
        m.category === 'landscape' || m.category === 'external-ground'
      );
      return hardLandscape.length >= 2 ||
        (landscapeMaterials.length >= 2 && hardLandscape.length >= 1);
    },
    generate: (materials) => ({
      materials: getMaterialsMatching(materials, HARD_LANDSCAPE).map(m => m.id),
      type: 'aesthetic',
      description: 'Multiple hard landscape materials may duplicate embodied carbon without design benefit',
      mitigation: 'Rationalise hard landscape palette or substitute with permeable alternatives',
    }),
  },

  // High-carbon structure + low-carbon finishes (mixed message)
  {
    id: 'mixed-carbon-message',
    condition: (materials) => {
      const structure = materials.filter(m => m.category === 'structure');
      const highCarbonStructure = structure.filter(m =>
        materialMatches(m, HIGH_EMBODIED)
      );
      const finishes = materials.filter(m =>
        ['floor', 'wall-internal', 'finish'].includes(m.category)
      );
      const lowCarbonFinish = finishes.filter(m =>
        m.carbonIntensity === 'low' || materialMatches(m, ['timber', 'cork', 'bamboo'])
      );
      return highCarbonStructure.length > 0 && lowCarbonFinish.length > 0;
    },
    generate: (materials) => ({
      materials: materials.filter(m =>
        m.category === 'structure' || ['floor', 'wall-internal', 'finish'].includes(m.category)
      ).map(m => m.id),
      type: 'aesthetic',
      description: 'Low-carbon finishes with high-carbon structure may undermine sustainability narrative',
      mitigation: 'Consider structural alternatives or emphasise whole-life carbon benefits in communications',
    }),
  },

  // High-maintenance materials
  {
    id: 'high-maintenance',
    condition: (materials) => {
      const highMaintenance = materials.filter(m =>
        m.description?.toLowerCase().includes('maintenance') ||
        m.description?.toLowerCase().includes('refinish') ||
        m.description?.toLowerCase().includes('re-oil') ||
        materialMatches(m, ['living-wall', 'green-wall', 'planted'])
      );
      return highMaintenance.length >= 2;
    },
    generate: (materials) => ({
      materials: materials.filter(m =>
        m.description?.toLowerCase().includes('maintenance') ||
        materialMatches(m, ['living-wall', 'green-wall'])
      ).map(m => m.id),
      type: 'maintenance',
      description: 'Multiple high-maintenance materials increase whole-life operational burden',
      mitigation: 'Provide clear maintenance schedules and consider lifecycle cost implications',
    }),
  },

  // Fit-out churn risk (partitions + acoustic)
  {
    id: 'fitout-churn',
    condition: (materials) => {
      const partitions = materials.filter(m =>
        materialMatches(m, ['partition', 'divider', 'screen']) ||
        m.category === 'wall-internal'
      );
      const fitout = materials.filter(m =>
        m.category === 'acoustic-panel' || m.category === 'ceiling' ||
        materialMatches(m, ['suspended', 'demountable', 'modular'])
      );
      return partitions.length > 0 && fitout.length > 0;
    },
    generate: (materials) => ({
      materials: materials.filter(m =>
        materialMatches(m, ['partition', 'divider']) ||
        m.category === 'acoustic-panel'
      ).map(m => m.id),
      type: 'maintenance',
      description: 'Extensive fit-out elements may face early replacement due to occupancy changes',
      mitigation: 'Design for adaptability and specify demountable systems where possible',
    }),
  },

  // External timber without protection
  {
    id: 'exposed-timber',
    condition: (materials) => {
      const externalTimber = materials.filter(m =>
        m.category === 'external' &&
        materialMatches(m, ['timber', 'wood', 'cedar', 'larch', 'oak'])
      );
      return externalTimber.length > 0;
    },
    generate: (materials) => ({
      materials: materials.filter(m =>
        m.category === 'external' && materialMatches(m, ['timber', 'wood'])
      ).map(m => m.id),
      type: 'maintenance',
      description: 'External timber cladding requires ongoing maintenance to prevent weathering',
      mitigation: 'Ensure adequate roof overhang or specify modified timber (acetylated/thermally-treated)',
    }),
  },
];

// ============== FALLBACK GENERATORS ==============

/**
 * Generate a fallback synergy based on actual material properties
 */
function generateFallbackSynergy(materials: MaterialOption[], metrics?: Map<string, MaterialMetrics>): Synergy {
  // Find the best-performing materials
  if (metrics && metrics.size > 0) {
    const sorted = [...metrics.entries()]
      .sort((a, b) => a[1].overall_impact_proxy - b[1].overall_impact_proxy);

    if (sorted.length >= 2) {
      const [id1] = sorted[0];
      const [id2] = sorted[1];
      const mat1 = materials.find(m => m.id === id1);
      const mat2 = materials.find(m => m.id === id2);

      if (mat1 && mat2) {
        return {
          materials: [id1, id2],
          type: 'carbon',
          description: `${mat1.name} and ${mat2.name} are the lowest-impact materials in this palette`,
        };
      }
    }
  }

  // Check for any category coherence
  const categories = new Map<MaterialCategory, MaterialOption[]>();
  materials.forEach(m => {
    if (!categories.has(m.category)) {
      categories.set(m.category, []);
    }
    categories.get(m.category)!.push(m);
  });

  // Find a category with multiple materials
  for (const [category, mats] of categories) {
    if (mats.length >= 2) {
      return {
        materials: mats.slice(0, 2).map(m => m.id),
        type: 'performance',
        description: `Consistent ${category} specification supports design coherence`,
      };
    }
  }

  // Ultimate fallback
  return {
    materials: materials.slice(0, 2).map(m => m.id),
    type: 'performance',
    description: 'Material palette supports early-stage design intent',
  };
}

/**
 * Generate a fallback conflict/watch-out based on actual material properties
 */
function generateFallbackConflict(materials: MaterialOption[], metrics?: Map<string, MaterialMetrics>): Conflict {
  // Find the highest-impact material
  if (metrics && metrics.size > 0) {
    const sorted = [...metrics.entries()]
      .sort((a, b) => b[1].embodied_proxy - a[1].embodied_proxy);

    if (sorted.length > 0) {
      const [id, metric] = sorted[0];
      const mat = materials.find(m => m.id === id);

      if (mat && metric.embodied_proxy > 2.5) {
        return {
          materials: [id],
          type: 'aesthetic',
          description: `${mat.name} has the highest embodied carbon in this palette`,
          mitigation: 'Review specification for lower-impact alternatives or recycled content',
        };
      }
    }
  }

  // Check for material count
  if (materials.length > 8) {
    return {
      materials: materials.slice(0, 3).map(m => m.id),
      type: 'aesthetic',
      description: 'Large material palette may complicate procurement and increase waste',
      mitigation: 'Consider rationalising palette to reduce specification complexity',
    };
  }

  // Low system interaction fallback
  return {
    materials: [],
    type: 'aesthetic',
    description: 'Low system interaction detected between materials',
    mitigation: 'Consider material rationalisation or complementary specifications',
  };
}

// ============== PUBLIC API ==============

/**
 * Detect synergies in a material palette
 * ALWAYS returns at least 1 synergy
 */
export function detectSynergies(
  materials: MaterialOption[],
  metrics?: Map<string, MaterialMetrics>
): Synergy[] {
  if (!materials || materials.length === 0) return [];

  const synergies: Synergy[] = [];

  for (const rule of SYNERGY_RULES) {
    if (rule.condition(materials)) {
      synergies.push(rule.generate(materials));
      if (synergies.length >= 3) break;
    }
  }

  // ALWAYS ensure at least 1 synergy
  if (synergies.length === 0) {
    synergies.push(generateFallbackSynergy(materials, metrics));
  }

  return synergies.slice(0, 3);
}

/**
 * Detect conflicts in a material palette
 * ALWAYS returns at least 1 watch-out
 */
export function detectConflicts(
  materials: MaterialOption[],
  metrics?: Map<string, MaterialMetrics>
): Conflict[] {
  if (!materials || materials.length === 0) return [];

  const conflicts: Conflict[] = [];

  for (const rule of CONFLICT_RULES) {
    if (rule.condition(materials)) {
      conflicts.push(rule.generate(materials));
      if (conflicts.length >= 3) break;
    }
  }

  // ALWAYS ensure at least 1 watch-out
  if (conflicts.length === 0) {
    conflicts.push(generateFallbackConflict(materials, metrics));
  }

  return conflicts.slice(0, 3);
}

/**
 * Generate a net statement describing the overall palette strategy
 */
export function generateNetStatement(
  topEmbodied: string[],
  topBenefit: string[],
  synergies: Synergy[],
  materials: MaterialOption[]
): string {
  const hasCarbonSynergy = synergies.some(s => s.type === 'carbon');
  const hasBiodiversity = synergies.some(s => s.type === 'biodiversity');
  const hasCircularity = synergies.some(s => s.type === 'circularity');

  const landscapeCount = materials.filter(m => m.category === 'landscape').length;
  const timberCount = materials.filter(m =>
    m.id.includes('timber') || m.id.includes('clt') || m.id.includes('glulam') || m.id.includes('wood')
  ).length;

  let statement = 'This palette ';

  if (topEmbodied.length >= 2 && topBenefit.length >= 2) {
    statement += 'balances higher-embodied materials with sustainability benefits. ';
  } else if (topEmbodied.length < 2 && topBenefit.length >= 2) {
    statement += 'demonstrates low overall embodied carbon with additional benefits. ';
  } else if (topEmbodied.length >= 2) {
    statement += 'includes materials requiring careful specification to reduce impact. ';
  } else {
    statement += 'presents an early-stage selection requiring further development. ';
  }

  const benefits: string[] = [];
  if (hasCarbonSynergy) benefits.push('carbon reduction');
  if (hasBiodiversity) benefits.push('biodiversity value');
  if (hasCircularity) benefits.push('circular design');
  if (timberCount >= 2) benefits.push('biogenic carbon storage');
  if (landscapeCount >= 2) benefits.push('landscape integration');

  if (benefits.length > 0) {
    statement += `Key opportunities include ${benefits.slice(0, 2).join(' and ')}.`;
  }

  return statement;
}

/**
 * Get all synergy and conflict rule IDs (for testing/debugging)
 */
export function getRuleIds(): { synergies: string[]; conflicts: string[] } {
  return {
    synergies: SYNERGY_RULES.map(r => r.id),
    conflicts: CONFLICT_RULES.map(r => r.id),
  };
}
