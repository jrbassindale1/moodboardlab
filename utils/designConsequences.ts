// Design consequences module
// Generates architectural guidance based on material type and hotspots
// Focus: actionable design directives, not generic environmental statements

import type { Hotspot, LifecycleStageKey } from '../types/sustainability';
import type { MaterialOption, MaterialCategory } from '../types';

// Short-form stage labels for display
export const STAGE_LABELS: Record<LifecycleStageKey, string> = {
  raw: 'RAW',
  manufacturing: 'MFG',
  transport: 'TRN',
  installation: 'INS',
  inUse: 'USE',
  maintenance: 'MNT',
  endOfLife: 'EOL',
};

// Long-form stage descriptions
export const STAGE_DESCRIPTIONS: Record<LifecycleStageKey, string> = {
  raw: 'Raw material extraction',
  manufacturing: 'Manufacturing & processing',
  transport: 'Transport & logistics',
  installation: 'Installation',
  inUse: 'In-use operation',
  maintenance: 'Maintenance & repair',
  endOfLife: 'End-of-life',
};

// ============================================================================
// ARCHITECTURAL CONSEQUENCE TEMPLATES
// These are design-active directives based on material type and hotspot
// ============================================================================

interface ArchitecturalConsequence {
  risk: string;      // What the design risk means architecturally
  response: string;  // Specific design action to take
}

// Material pattern matchers with architectural consequences
// Ordered by specificity - more specific patterns first
const MATERIAL_CONSEQUENCES: Array<{
  pattern: RegExp;
  categories?: MaterialCategory[];
  stages: Partial<Record<LifecycleStageKey, ArchitecturalConsequence>>;
  default: ArchitecturalConsequence;
}> = [
  // GLASS / GLAZING
  {
    pattern: /glass|glazing|glazed|partition/i,
    stages: {
      manufacturing: {
        risk: 'Should not be used as default cellular partitioning system',
        response: 'Reserve for feature walls and borrowed light only',
      },
      transport: {
        risk: 'Large panels increase logistics complexity',
        response: 'Design to standard sheet sizes to reduce breakage and waste',
      },
      endOfLife: {
        risk: 'Laminated glass cannot be recycled locally',
        response: 'Specify toughened single-pane where safety permits',
      },
    },
    default: {
      risk: 'High embodied carbon limits appropriate use',
      response: 'Use strategically for daylight and views, not as default partition',
    },
  },

  // CONCRETE / CEMENT
  {
    pattern: /concrete|cement|screed|terrazzo/i,
    stages: {
      manufacturing: {
        risk: 'High cement content should justify exposed finish',
        response: 'Should replace applied finishes, not add layers',
      },
      raw: {
        risk: 'Aggregate extraction has significant land impact',
        response: 'Specify minimum 30% recycled aggregate content',
      },
      endOfLife: {
        risk: 'Demolition produces large waste volumes',
        response: 'Design for sectional removal and crushing on-site',
      },
    },
    default: {
      risk: 'High cement carbon should be offset by durability',
      response: 'Expose as final finish to avoid additional floor/wall coverings',
    },
  },

  // STEEL
  {
    pattern: /steel|metal frame|corten/i,
    categories: ['structure', 'exposed-structure'],
    stages: {
      manufacturing: {
        risk: 'Primary steel has 3x the carbon of recycled',
        response: 'Specify minimum 95% recycled content (EAF steel)',
      },
      transport: {
        risk: 'Heavy sections increase transport emissions',
        response: 'Source from UK mills where possible',
      },
      endOfLife: {
        risk: 'Welded connections limit reuse',
        response: 'Use bolted connections throughout for future disassembly',
      },
    },
    default: {
      risk: 'Steel choice should enable circular outcomes',
      response: 'Specify recycled content and bolted connections',
    },
  },

  // ALUMINIUM
  {
    pattern: /aluminium|aluminum/i,
    stages: {
      manufacturing: {
        risk: 'Primary aluminium is highly carbon-intensive',
        response: 'Specify minimum 75% post-consumer recycled content',
      },
      raw: {
        risk: 'Bauxite mining has severe environmental impacts',
        response: 'Use only where durability justifies the embodied cost',
      },
    },
    default: {
      risk: 'Aluminium should be justified by longevity',
      response: 'Reserve for external applications requiring 40+ year life',
    },
  },

  // TIMBER / WOOD
  {
    pattern: /timber|wood|oak|ash|pine|birch|ply|clt|glulam/i,
    stages: {
      raw: {
        risk: 'Uncertified timber may contribute to deforestation',
        response: 'FSC or PEFC certification required for all timber',
      },
      manufacturing: {
        risk: 'Engineered products vary widely in adhesive content',
        response: 'Specify low-formaldehyde or formaldehyde-free adhesives',
      },
      maintenance: {
        risk: 'Softwood requires regular refinishing',
        response: 'Use hardwood or specify robust factory finish for high-wear areas',
      },
      endOfLife: {
        risk: 'Treated timber cannot be composted or burned',
        response: 'Avoid preservative treatments where moisture control is adequate',
      },
    },
    default: {
      risk: 'Timber benefit depends on certification and treatment',
      response: 'Verify FSC chain-of-custody and avoid unnecessary treatments',
    },
  },

  // BRICK / MASONRY
  {
    pattern: /brick|masonry|block/i,
    stages: {
      manufacturing: {
        risk: 'Fired brick has high kiln energy demand',
        response: 'Specify unfired or low-carbon alternatives where structural',
      },
      transport: {
        risk: 'Heavy mass increases transport emissions',
        response: 'Source from kilns within 50 miles',
      },
      endOfLife: {
        risk: 'Cement mortar prevents brick reuse',
        response: 'Use lime mortar throughout for future recovery',
      },
    },
    default: {
      risk: 'Brick durability should be leveraged',
      response: 'Design for 100+ year life with lime mortar for reuse',
    },
  },

  // GRAVEL / AGGREGATE / STONE
  {
    pattern: /gravel|aggregate|pebble|shingle|stone chip/i,
    categories: ['landscape', 'external-ground'],
    stages: {
      raw: {
        risk: 'Aggregate extraction depletes finite resources',
        response: 'Should be limited to secondary surfaces only',
      },
      transport: {
        risk: 'Heavy bulk transport has high emissions',
        response: 'Source from nearest quarry, accept natural variation',
      },
    },
    default: {
      risk: 'Hard landscape should not dominate',
      response: 'Limit to functional areas; prioritise soft landscape elsewhere',
    },
  },

  // PAVING / HARD LANDSCAPE
  {
    pattern: /paving|paver|flag|sett/i,
    categories: ['landscape', 'external-ground'],
    stages: {
      manufacturing: {
        risk: 'Concrete paving has significant cement content',
        response: 'Specify permeable paving to offset with SUDS benefit',
      },
      endOfLife: {
        risk: 'Mortared paving cannot be reused',
        response: 'Use dry-laid sand bedding for future lifting',
      },
    },
    default: {
      risk: 'Extent should be minimised',
      response: 'Reduce paved area through landscape design; use permeable systems',
    },
  },

  // CARPET / SOFT FLOORING
  {
    pattern: /carpet|rug/i,
    categories: ['floor', 'finish'],
    stages: {
      manufacturing: {
        risk: 'Synthetic carpets have high embodied carbon',
        response: 'Specify wool or recycled content minimum 80%',
      },
      maintenance: {
        risk: 'Short replacement cycles multiply lifecycle impact',
        response: 'Use carpet tiles for partial replacement; specify 10-year warranty',
      },
      endOfLife: {
        risk: 'Mixed materials prevent recycling',
        response: 'Specify take-back scheme as procurement requirement',
      },
    },
    default: {
      risk: 'Carpet lifecycle should drive specification',
      response: 'Require take-back scheme and minimum recycled content',
    },
  },

  // LINOLEUM (BIO-BASED RESILIENT)
  {
    pattern: /linoleum/i,
    categories: ['floor'],
    stages: {
      manufacturing: {
        risk: 'Bio-based binders and pigments still drive manufacturing impact',
        response: 'Specify verified bio-based linoleum with low-impact pigments',
      },
      maintenance: {
        risk: 'Short replacement cycles multiply lifecycle impact',
        response: 'Specify protective finish and maintenance plan to reach 30–40 year life',
      },
      endOfLife: {
        risk: 'End-of-life pathways vary by supplier',
        response: 'Require manufacturer take-back or verified recovery route',
      },
    },
    default: {
      risk: 'Bio-based flooring still needs durability and recovery planning',
      response: 'Confirm long-life performance and take-back before specification',
    },
  },

  // VINYL / RESILIENT FLOORING
  {
    pattern: /vinyl|lvt|rubber floor/i,
    categories: ['floor'],
    stages: {
      manufacturing: {
        risk: 'PVC production is petrochemical-intensive',
        response: 'Specify linoleum (bio-based) where traffic allows',
      },
      endOfLife: {
        risk: 'Vinyl flooring cannot be recycled in UK',
        response: 'Require manufacturer take-back as contract condition',
      },
    },
    default: {
      risk: 'Petrochemical flooring should be justified',
      response: 'Consider linoleum or polished concrete as alternatives',
    },
  },

  // PAINT / COATINGS
  {
    pattern: /paint|emulsion|lacquer|varnish|stain/i,
    categories: ['paint-wall', 'paint-ceiling', 'finish'],
    stages: {
      manufacturing: {
        risk: 'Conventional paints contain VOCs and petrochemicals',
        response: 'Specify mineral or plant-based paints throughout',
      },
      maintenance: {
        risk: 'Frequent repainting multiplies lifecycle impact',
        response: 'Use scrubbable finishes in high-touch areas',
      },
      inUse: {
        risk: 'VOC emissions affect indoor air quality',
        response: 'Specify zero-VOC products; allow extended off-gassing before occupation',
      },
    },
    default: {
      risk: 'Paint specification affects air quality',
      response: 'Specify mineral-based, zero-VOC products',
    },
  },

  // PLASTER / RENDER
  {
    pattern: /plaster|render|skim/i,
    categories: ['plaster', 'wall-internal'],
    stages: {
      manufacturing: {
        risk: 'Gypsum plaster has moderate embodied carbon',
        response: 'Consider lime plaster for heritage or breathable walls',
      },
      installation: {
        risk: 'Wet trades generate significant site waste',
        response: 'Use board-based dry lining where appropriate',
      },
    },
    default: {
      risk: 'Wet plastering should be considered against alternatives',
      response: 'Evaluate dry lining for programme and waste benefits',
    },
  },

  // ACOUSTIC PANELS
  {
    pattern: /acoustic|sound|absorb/i,
    categories: ['acoustic-panel', 'ceiling'],
    stages: {
      manufacturing: {
        risk: 'Mineral wool panels have high embodied energy',
        response: 'Specify recycled PET or wood-wool alternatives',
      },
      endOfLife: {
        risk: 'Composite panels are difficult to recycle',
        response: 'Use demountable fixing systems for replacement',
      },
    },
    default: {
      risk: 'Acoustic treatment should be right-sized',
      response: 'Calculate absorption requirements; avoid over-specification',
    },
  },

  // INSULATION
  {
    pattern: /insulation|rockwool|mineral wool|pir|eps|xps/i,
    categories: ['insulation'],
    stages: {
      manufacturing: {
        risk: 'Petrochemical insulation has high embodied carbon',
        response: 'Specify wood fibre, hemp, or recycled content alternatives',
      },
      installation: {
        risk: 'Cut-off waste from rigid boards is significant',
        response: 'Design to board module; specify blown insulation for irregular spaces',
      },
      endOfLife: {
        risk: 'Bonded insulation cannot be separated from structure',
        response: 'Use mechanical fixings to enable future recovery',
      },
    },
    default: {
      risk: 'Insulation choice has long-term lock-in',
      response: 'Prioritise bio-based options where performance allows',
    },
  },

  // TILES (CERAMIC/PORCELAIN)
  {
    pattern: /tile|ceramic|porcelain/i,
    categories: ['tile', 'floor', 'wall-internal'],
    stages: {
      manufacturing: {
        risk: 'High-temperature firing is energy-intensive',
        response: 'Specify local manufacture to offset transport',
      },
      transport: {
        risk: 'Heavy and fragile; import tiles have high transport impact',
        response: 'UK or European manufacture only',
      },
      installation: {
        risk: 'Adhesive fixing prevents reuse',
        response: 'Use thicker tiles with mechanical or dry-bed fixing where possible',
      },
    },
    default: {
      risk: 'Tile durability should offset embodied cost',
      response: 'Specify for 30+ year high-wear locations only',
    },
  },

  // NATURAL STONE
  {
    pattern: /stone|marble|granite|slate|limestone|sandstone|travertine/i,
    stages: {
      raw: {
        risk: 'Quarrying has visual and ecological impacts',
        response: 'Verify responsible quarry management certification',
      },
      transport: {
        risk: 'Imported stone has very high transport emissions',
        response: 'Specify UK or near-European origin only',
      },
    },
    default: {
      risk: 'Natural stone should be justified by permanence',
      response: 'Reserve for areas requiring 60+ year durability',
    },
  },

  // PLANTING / SOFT LANDSCAPE
  {
    pattern: /plant|meadow|grass|turf|hedge|shrub|tree|sedum/i,
    categories: ['landscape'],
    stages: {
      raw: {
        risk: 'Non-native species reduce biodiversity value',
        response: 'Specify native and locally-provenance planting',
      },
      maintenance: {
        risk: 'Intensive maintenance increases lifecycle impact',
        response: 'Design for minimal intervention; avoid formal planting',
      },
    },
    default: {
      risk: 'Planting should maximise ecological benefit',
      response: 'Native species, minimal maintenance regime, no pesticides',
    },
  },
];

// Fallback consequences by category when no pattern matches
const CATEGORY_FALLBACKS: Partial<Record<MaterialCategory, ArchitecturalConsequence>> = {
  structure: {
    risk: 'Structural material has long-term lock-in',
    response: 'Design for adaptability and future disassembly',
  },
  'exposed-structure': {
    risk: 'Exposed structure must work as finished surface',
    response: 'Ensure quality of finish justifies eliminated layers',
  },
  floor: {
    risk: 'Floor finish lifecycle affects overall impact',
    response: 'Specify for durability matching intended use',
  },
  'wall-internal': {
    risk: 'Internal finishes have shorter lifecycles',
    response: 'Design for easy replacement without structural impact',
  },
  ceiling: {
    risk: 'Ceiling access requirements drive material choice',
    response: 'Use demountable systems where services access required',
  },
  external: {
    risk: 'External materials must justify weathering demands',
    response: 'Specify for minimum 40-year maintenance-free life',
  },
  landscape: {
    risk: 'Landscape should deliver biodiversity benefit',
    response: 'Maximise soft landscape; specify native planting',
  },
  'external-ground': {
    risk: 'Hard surface extent should be minimised',
    response: 'Design for permeable surfaces where possible',
  },
  joinery: {
    risk: 'Bespoke joinery has high embodied cost',
    response: 'Consider off-the-shelf alternatives where quality allows',
  },
  furniture: {
    risk: 'Furniture lifecycle is typically 5-10 years',
    response: 'Specify refurbished or specify for longevity',
  },
};

// Generic fallback when nothing else matches
const GENERIC_FALLBACK: ArchitecturalConsequence = {
  risk: 'Material selection should be justified by performance need',
  response: 'Verify specification is fit-for-purpose without over-engineering',
};

// ============================================================================
// PUBLIC FUNCTIONS
// ============================================================================

/**
 * Generate architectural design risk based on material and hotspots
 * Returns specific design directive, not generic environmental statement
 */
export function generateDesignRisk(
  hotspots: Hotspot[],
  material?: MaterialOption
): string {
  const consequence = getConsequenceForMaterial(hotspots, material);
  return consequence.risk;
}

/**
 * Generate design response based on material and hotspots
 * Returns actionable architectural guidance
 */
export function generateDesignResponse(
  hotspots: Hotspot[],
  material?: MaterialOption
): string {
  const consequence = getConsequenceForMaterial(hotspots, material);
  return consequence.response;
}

/**
 * Generate combined design consequences
 */
export function generateDesignConsequences(
  hotspots: Hotspot[],
  material?: MaterialOption
): { risk: string; response: string } {
  const consequence = getConsequenceForMaterial(hotspots, material);
  return {
    risk: `Design risk: ${consequence.risk}`,
    response: `Design response: ${consequence.response}`,
  };
}

/**
 * Get the most relevant consequence for a material based on its type and hotspots
 */
function getConsequenceForMaterial(
  hotspots: Hotspot[],
  material?: MaterialOption
): ArchitecturalConsequence {
  // Get top hotspot stage
  const topHotspot = hotspots && hotspots.length > 0
    ? [...hotspots].sort((a, b) => b.score - a.score)[0]
    : null;

  // Try to match material pattern
  if (material) {
    const materialText = `${material.id} ${material.name} ${material.description || ''}`;

    for (const entry of MATERIAL_CONSEQUENCES) {
      // Check pattern match
      if (!entry.pattern.test(materialText)) continue;

      // Check category filter if specified
      if (entry.categories && !entry.categories.includes(material.category)) continue;

      // Found a match - return stage-specific or default consequence
      if (topHotspot && entry.stages[topHotspot.stage]) {
        return entry.stages[topHotspot.stage]!;
      }
      return entry.default;
    }

    // No pattern match - try category fallback
    const categoryFallback = CATEGORY_FALLBACKS[material.category];
    if (categoryFallback) {
      return categoryFallback;
    }
  }

  // No material or no match - return generic
  return GENERIC_FALLBACK;
}

/**
 * Get detailed design levers based on hotspots
 * Returns all relevant levers for high-impact stages
 */
export function getDetailedDesignLevers(
  hotspots: Hotspot[],
  material?: MaterialOption
): string[] {
  if (!hotspots || hotspots.length === 0) {
    return [];
  }

  const levers: string[] = [];

  // Add consequence response as primary lever
  const consequence = getConsequenceForMaterial(hotspots, material);
  levers.push(consequence.response);

  // Add stage-specific generic responses for other hotspots
  hotspots
    .filter((h) => h.score >= 3)
    .slice(0, 3)
    .forEach((hotspot) => {
      const stageResponse = getGenericStageResponse(hotspot.stage);
      if (stageResponse && !levers.includes(stageResponse)) {
        levers.push(stageResponse);
      }
    });

  return levers;
}

/**
 * Get generic response for a lifecycle stage (backup)
 */
function getGenericStageResponse(stage: LifecycleStageKey): string {
  const responses: Record<LifecycleStageKey, string> = {
    raw: 'Verify responsible sourcing certification',
    manufacturing: 'Specify low-carbon manufacturing where available',
    transport: 'Source locally to reduce transport emissions',
    installation: 'Use prefabrication to reduce site waste',
    inUse: 'Ensure adequate maintenance access',
    maintenance: 'Specify durable finishes to extend intervals',
    endOfLife: 'Design for disassembly with mechanical fixings',
  };
  return responses[stage];
}

/**
 * Format hotspot for display
 * Returns "STAGE (score): reason" format
 */
export function formatHotspot(hotspot: Hotspot): string {
  const label = STAGE_LABELS[hotspot.stage];
  return `${label} (${hotspot.score}): ${hotspot.reason}`;
}

/**
 * Identify the highest-impact stage from a set of hotspots
 */
export function getHighestImpactStage(
  hotspots: Hotspot[]
): LifecycleStageKey | null {
  if (!hotspots || hotspots.length === 0) return null;

  const sorted = [...hotspots].sort((a, b) => b.score - a.score);
  return sorted[0].stage;
}
