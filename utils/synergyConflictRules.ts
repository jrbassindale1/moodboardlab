// Synergy and conflict detection rules engine
// Hard-coded rules for detecting material interactions

import type { Synergy, Conflict } from '../types/sustainability';
import type { MaterialOption } from '../types';

// Rule interface for synergy detection
interface SynergyRule {
  id: string;
  condition: (materials: MaterialOption[]) => boolean;
  generate: (materials: MaterialOption[]) => Synergy;
}

// Rule interface for conflict detection
interface ConflictRule {
  id: string;
  condition: (materials: MaterialOption[]) => boolean;
  generate: (materials: MaterialOption[]) => Conflict;
}

// Helper to check if any material matches criteria
function hasMatchingMaterial(
  materials: MaterialOption[],
  matcher: (m: MaterialOption) => boolean
): boolean {
  return materials.some(matcher);
}

// Helper to find materials matching criteria
function findMatchingMaterials(
  materials: MaterialOption[],
  matcher: (m: MaterialOption) => boolean
): MaterialOption[] {
  return materials.filter(matcher);
}

// Check if material ID contains any of the given terms
function idContains(material: MaterialOption, terms: string[]): boolean {
  const id = material.id.toLowerCase();
  return terms.some((term) => id.includes(term.toLowerCase()));
}

// Check if keywords contain any of the given terms
function keywordsContain(material: MaterialOption, terms: string[]): boolean {
  if (!material.keywords) return false;
  const keywords = material.keywords.map((k) => k.toLowerCase());
  return terms.some((term) =>
    keywords.some((k) => k.includes(term.toLowerCase()))
  );
}

// Check if description contains any of the given terms
function descriptionContains(
  material: MaterialOption,
  terms: string[]
): boolean {
  if (!material.description) return false;
  const desc = material.description.toLowerCase();
  return terms.some((term) => desc.includes(term.toLowerCase()));
}

// ============== SYNERGY RULES ==============

const SYNERGY_RULES: SynergyRule[] = [
  // PV + durable roof = renewable energy synergy
  {
    id: 'pv-durable-roof',
    condition: (materials) => {
      const hasPV = hasMatchingMaterial(
        materials,
        (m) =>
          idContains(m, ['pv', 'solar', 'photovoltaic']) ||
          keywordsContain(m, ['solar', 'pv', 'photovoltaic'])
      );
      const hasDurableRoof = hasMatchingMaterial(
        materials,
        (m) =>
          m.category === 'roof' &&
          (idContains(m, ['metal', 'slate', 'standing-seam', 'zinc', 'copper']) ||
            keywordsContain(m, ['durable', 'long-life']))
      );
      return hasPV && hasDurableRoof;
    },
    generate: (materials) => ({
      materials: findMatchingMaterials(
        materials,
        (m) =>
          idContains(m, ['pv', 'solar']) ||
          (m.category === 'roof' &&
            idContains(m, ['metal', 'slate', 'standing-seam', 'zinc', 'copper']))
      ).map((m) => m.id),
      type: 'carbon',
      description:
        'Solar PV combined with durable roofing maximizes renewable generation lifespan',
    }),
  },

  // Brick + lime mortar = circularity synergy
  {
    id: 'brick-lime',
    condition: (materials) => {
      const hasBrick = hasMatchingMaterial(materials, (m) =>
        idContains(m, ['brick'])
      );
      const hasLime = hasMatchingMaterial(
        materials,
        (m) =>
          idContains(m, ['lime']) ||
          keywordsContain(m, ['lime mortar', 'lime-based'])
      );
      return hasBrick && hasLime;
    },
    generate: (materials) => ({
      materials: findMatchingMaterials(
        materials,
        (m) => idContains(m, ['brick']) || idContains(m, ['lime'])
      ).map((m) => m.id),
      type: 'circularity',
      description:
        'Lime mortar enables future brick reuse and creates a vapour-open assembly',
    }),
  },

  // Meadow/native planting = biodiversity synergy
  {
    id: 'biodiversity-planting',
    condition: (materials) => {
      return hasMatchingMaterial(
        materials,
        (m) =>
          idContains(m, [
            'meadow',
            'native-planting',
            'wildflower',
            'rain-garden',
            'biodiverse',
          ]) || keywordsContain(m, ['native', 'wildflower', 'meadow', 'pollinator'])
      );
    },
    generate: (materials) => ({
      materials: findMatchingMaterials(
        materials,
        (m) => m.category === 'landscape'
      ).map((m) => m.id),
      type: 'biodiversity',
      description:
        'Native and meadow planting supports local pollinators and ecological networks',
    }),
  },

  // Multiple timber elements = carbon storage synergy
  {
    id: 'timber-carbon-storage',
    condition: (materials) => {
      const timberStructural = findMatchingMaterials(
        materials,
        (m) =>
          (m.category === 'structure' || m.category === 'exposed-structure') &&
          (idContains(m, ['clt', 'glulam', 'timber', 'mass-timber', 'nlt', 'dlt']) ||
            keywordsContain(m, ['timber', 'wood', 'biogenic']))
      );
      return timberStructural.length >= 2;
    },
    generate: (materials) => ({
      materials: findMatchingMaterials(
        materials,
        (m) =>
          (m.category === 'structure' || m.category === 'exposed-structure') &&
          (idContains(m, ['timber', 'clt', 'glulam']) ||
            keywordsContain(m, ['timber', 'wood']))
      ).map((m) => m.id),
      type: 'carbon',
      description:
        'Multiple timber elements maximize carbon storage and create coherent biogenic palette',
    }),
  },

  // Mechanical fixings / demountable = circularity synergy
  {
    id: 'mechanical-fixings',
    condition: (materials) => {
      return hasMatchingMaterial(
        materials,
        (m) =>
          descriptionContains(m, ['demountable', 'mechanical', 'bolted', 'screwed']) ||
          idContains(m, ['dlt', 'nlt']) ||
          keywordsContain(m, ['demountable', 'mechanical fixings', 'reversible'])
      );
    },
    generate: (materials) => ({
      materials: findMatchingMaterials(
        materials,
        (m) =>
          descriptionContains(m, ['demountable', 'mechanical']) ||
          keywordsContain(m, ['demountable'])
      ).map((m) => m.id),
      type: 'circularity',
      description:
        'Mechanical fixings enable future disassembly and material reuse',
    }),
  },

  // Green roof + rainwater = performance synergy
  {
    id: 'green-roof-water',
    condition: (materials) => {
      const hasGreenRoof = hasMatchingMaterial(
        materials,
        (m) =>
          m.category === 'roof' &&
          (idContains(m, ['green', 'sedum', 'living']) ||
            keywordsContain(m, ['green roof', 'living roof']))
      );
      return hasGreenRoof;
    },
    generate: (materials) => ({
      materials: findMatchingMaterials(
        materials,
        (m) =>
          m.category === 'roof' &&
          (idContains(m, ['green', 'sedum']) || keywordsContain(m, ['green roof']))
      ).map((m) => m.id),
      type: 'performance',
      description:
        'Green roof provides stormwater attenuation, biodiversity, and thermal benefits',
    }),
  },
];

// ============== CONFLICT RULES ==============

const CONFLICT_RULES: ConflictRule[] = [
  // Large glazing + acoustic panels = potential conflict
  {
    id: 'glazing-acoustic',
    condition: (materials) => {
      const hasLargeGlazing = hasMatchingMaterial(
        materials,
        (m) =>
          idContains(m, ['curtain-wall', 'frameless-glazing', 'structural-glazing']) ||
          (m.category === 'window' &&
            (descriptionContains(m, ['full-height', 'floor-to-ceiling']) ||
              idContains(m, ['large', 'full'])))
      );
      const hasAcoustic = hasMatchingMaterial(materials, (m) =>
        idContains(m, ['acoustic'])
      );
      return hasLargeGlazing && hasAcoustic;
    },
    generate: (materials) => ({
      materials: findMatchingMaterials(
        materials,
        (m) =>
          idContains(m, ['glazing', 'curtain', 'window']) ||
          idContains(m, ['acoustic'])
      ).map((m) => m.id),
      type: 'acoustic',
      description:
        'Large glazing areas may compromise acoustic performance despite panel treatment',
      mitigation:
        'Consider acoustic laminated glass or secondary glazing in noise-sensitive areas',
    }),
  },

  // High-carbon structure + low-carbon finishes = mixed message
  {
    id: 'mixed-carbon-message',
    condition: (materials) => {
      const hasHighCarbonStructure = hasMatchingMaterial(
        materials,
        (m) =>
          m.category === 'structure' &&
          (idContains(m, ['steel', 'concrete']) ||
            m.carbonIntensity === 'high') &&
          !idContains(m, ['ggbs', 'recycled', 'reclaimed'])
      );
      const hasLowCarbonFinish = hasMatchingMaterial(
        materials,
        (m) =>
          m.carbonIntensity === 'low' &&
          (m.category === 'finish' ||
            m.category === 'wall-internal' ||
            m.category === 'floor')
      );
      return hasHighCarbonStructure && hasLowCarbonFinish;
    },
    generate: (materials) => ({
      materials: findMatchingMaterials(
        materials,
        (m) => m.category === 'structure' || m.category === 'finish'
      ).map((m) => m.id),
      type: 'aesthetic',
      description:
        'Low-carbon finishes paired with high-carbon structure may create inconsistent sustainability narrative',
      mitigation:
        'Consider structural alternatives or emphasize whole-life carbon story in client communications',
    }),
  },

  // Multiple high-maintenance materials
  {
    id: 'high-maintenance',
    condition: (materials) => {
      const highMaintenance = findMatchingMaterials(
        materials,
        (m) =>
          descriptionContains(m, [
            'requires maintenance',
            'refinish',
            'regular maintenance',
            're-oiling',
          ]) || idContains(m, ['living-wall', 'green-wall'])
      );
      return highMaintenance.length >= 2;
    },
    generate: (materials) => ({
      materials: findMatchingMaterials(
        materials,
        (m) =>
          descriptionContains(m, ['maintenance', 'refinish']) ||
          idContains(m, ['living'])
      ).map((m) => m.id),
      type: 'maintenance',
      description:
        'Multiple high-maintenance materials may increase whole-life costs',
      mitigation:
        'Provide clear maintenance schedules and consider lifecycle cost analysis',
    }),
  },

  // External timber without protection
  {
    id: 'exposed-timber',
    condition: (materials) => {
      const hasExternalTimber = hasMatchingMaterial(
        materials,
        (m) =>
          m.category === 'external' &&
          (idContains(m, ['timber', 'wood', 'cedar', 'larch']) ||
            keywordsContain(m, ['timber', 'wood']))
      );
      const hasNoProtection = !hasMatchingMaterial(
        materials,
        (m) =>
          m.category === 'external' &&
          (idContains(m, ['canopy', 'overhang', 'shelter']) ||
            keywordsContain(m, ['protected', 'sheltered']))
      );
      return hasExternalTimber && hasNoProtection;
    },
    generate: (materials) => ({
      materials: findMatchingMaterials(
        materials,
        (m) =>
          m.category === 'external' &&
          (idContains(m, ['timber', 'wood']) || keywordsContain(m, ['timber']))
      ).map((m) => m.id),
      type: 'maintenance',
      description:
        'External timber cladding may require regular maintenance without adequate roof overhang',
      mitigation:
        'Ensure 300mm+ overhang at eaves or specify acetylated/thermally-modified timber',
    }),
  },
];

/**
 * Detect synergies in a material palette
 * Returns top 3 synergies found
 */
export function detectSynergies(materials: MaterialOption[]): Synergy[] {
  if (!materials || materials.length === 0) return [];

  const synergies: Synergy[] = [];

  for (const rule of SYNERGY_RULES) {
    if (rule.condition(materials)) {
      synergies.push(rule.generate(materials));
    }
  }

  // Return top 3
  return synergies.slice(0, 3);
}

/**
 * Detect conflicts in a material palette
 * Returns top 3 conflicts found
 */
export function detectConflicts(materials: MaterialOption[]): Conflict[] {
  if (!materials || materials.length === 0) return [];

  const conflicts: Conflict[] = [];

  for (const rule of CONFLICT_RULES) {
    if (rule.condition(materials)) {
      conflicts.push(rule.generate(materials));
    }
  }

  // Return top 3
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
  const hasCarbonSynergy = synergies.some((s) => s.type === 'carbon');
  const hasBiodiversity = synergies.some((s) => s.type === 'biodiversity');
  const hasCircularity = synergies.some((s) => s.type === 'circularity');

  const landscapeCount = materials.filter(
    (m) => m.category === 'landscape'
  ).length;
  const timberCount = materials.filter(
    (m) =>
      m.id.includes('timber') || m.id.includes('clt') || m.id.includes('glulam')
  ).length;

  // Build statement based on palette characteristics
  let statement = 'This palette ';

  if (topEmbodied.length >= 2 && topBenefit.length >= 2) {
    statement +=
      'balances higher-embodied materials with strong sustainability benefits. ';
  } else if (topEmbodied.length < 2 && topBenefit.length >= 2) {
    statement +=
      'demonstrates strong sustainability credentials with low overall embodied carbon. ';
  } else if (topEmbodied.length >= 2) {
    statement +=
      'includes some higher-embodied materials that require careful specification. ';
  } else {
    statement += 'presents a balanced approach to material selection. ';
  }

  // Add specific synergy mentions
  const benefits: string[] = [];
  if (hasCarbonSynergy) benefits.push('renewable energy integration');
  if (hasBiodiversity) benefits.push('biodiversity enhancement');
  if (hasCircularity) benefits.push('circular design principles');
  if (timberCount >= 2) benefits.push('biogenic carbon storage');
  if (landscapeCount >= 2) benefits.push('landscape-led ecological value');

  if (benefits.length > 0) {
    statement += `Key strengths include ${benefits.slice(0, 3).join(', ')}.`;
  }

  return statement;
}

/**
 * Get all synergy and conflict rule IDs (for testing/debugging)
 */
export function getRuleIds(): { synergies: string[]; conflicts: string[] } {
  return {
    synergies: SYNERGY_RULES.map((r) => r.id),
    conflicts: CONFLICT_RULES.map((r) => r.id),
  };
}
