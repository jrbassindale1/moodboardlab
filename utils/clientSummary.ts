// Client summary generator
// Creates honest, credible front-page summary for the PDF report

import type {
  ClientSummary,
  EnhancedSustainabilityInsight,
  MaterialMetrics,
  Synergy,
  Conflict,
} from '../types/sustainability';
import type { MaterialOption, MaterialCategory } from '../types';

// Category groupings for trade-off analysis
const STRUCTURE_CATEGORIES: MaterialCategory[] = ['structure', 'exposed-structure'];
const ENVELOPE_CATEGORIES: MaterialCategory[] = ['external', 'roof', 'window', 'insulation'];
const FINISH_CATEGORIES: MaterialCategory[] = ['floor', 'wall-internal', 'ceiling', 'finish', 'paint-wall', 'paint-ceiling', 'plaster', 'tile', 'wallpaper', 'timber-panel', 'acoustic-panel', 'timber-slat'];
const LANDSCAPE_CATEGORIES: MaterialCategory[] = ['landscape', 'external-ground'];

/**
 * Generate the client-facing summary - HONEST and CREDIBLE
 */
export function generateClientSummary(
  materials: MaterialOption[],
  insights: EnhancedSustainabilityInsight[],
  metrics: Map<string, MaterialMetrics>,
  synergies: Synergy[],
  conflicts: Conflict[]
): ClientSummary {
  // Analyze the palette honestly
  const analysis = analyzePalette(materials, metrics);

  // Generate trade-off narrative (not celebration)
  const achievements = generateTradeOffNarrative(materials, metrics, synergies, analysis);

  // Generate risks with specific materials named
  const risksAndMitigations = generateRisksWithMaterials(
    materials,
    insights,
    metrics,
    conflicts,
    analysis
  );

  // Generate evidence checklist
  const evidenceChecklist = generateEvidenceChecklist(materials, insights, analysis);

  // Generate honest confidence statement
  const confidenceStatement = generateConfidenceStatement(metrics, analysis);

  return {
    achievements,
    risks_and_mitigations: risksAndMitigations,
    evidence_checklist: evidenceChecklist,
    confidence_statement: confidenceStatement,
  };
}

interface PaletteAnalysis {
  // Counts by rating
  greenCount: number;
  amberCount: number;
  redCount: number;
  totalCount: number;

  // Top risks (sorted by embodied impact)
  topCarbonRisks: Array<{ material: MaterialOption; metric: MaterialMetrics }>;

  // Top benefits (sorted by benefit score)
  topBenefits: Array<{ material: MaterialOption; metric: MaterialMetrics }>;

  // Materials flagged for redesign (red rating or high impact + low benefit)
  flaggedForRedesign: Array<{ material: MaterialOption; metric: MaterialMetrics; reason: string }>;

  // Category breakdown
  structureAvgImpact: number;
  envelopeAvgImpact: number;
  finishAvgImpact: number;
  landscapeAvgImpact: number;

  // Low confidence materials
  lowConfidenceCount: number;
}

function analyzePalette(
  materials: MaterialOption[],
  metrics: Map<string, MaterialMetrics>
): PaletteAnalysis {
  const metricsArray = [...metrics.entries()].map(([id, m]) => ({
    material: materials.find(mat => mat.id === id)!,
    metric: m,
  })).filter(x => x.material);

  // Count by rating
  const greenCount = metricsArray.filter(x => x.metric.traffic_light === 'green').length;
  const amberCount = metricsArray.filter(x => x.metric.traffic_light === 'amber').length;
  const redCount = metricsArray.filter(x => x.metric.traffic_light === 'red').length;

  // Top 3 carbon risks (highest embodied impact)
  const topCarbonRisks = [...metricsArray]
    .sort((a, b) => b.metric.embodied_proxy - a.metric.embodied_proxy)
    .slice(0, 3);

  // Top 3 benefits (highest benefit score, must have some benefit)
  const topBenefits = [...metricsArray]
    .filter(x => x.metric.benefit_score > 0)
    .sort((a, b) => b.metric.benefit_score - a.metric.benefit_score)
    .slice(0, 3);

  // Materials flagged for redesign
  const flaggedForRedesign = metricsArray
    .filter(x => {
      // Red rating
      if (x.metric.traffic_light === 'red') return true;
      // High embodied (top quartile) with low benefit
      if (x.metric.embodied_proxy > 3.0 && x.metric.benefit_score < 2.0) return true;
      return false;
    })
    .map(x => ({
      ...x,
      reason: x.metric.traffic_light === 'red'
        ? 'High overall impact'
        : 'High embodied carbon without offsetting benefits',
    }));

  // Category averages
  const getCategoryAvg = (categories: MaterialCategory[]) => {
    const items = metricsArray.filter(x => categories.includes(x.material.category));
    if (items.length === 0) return 0;
    return items.reduce((sum, x) => sum + x.metric.embodied_proxy, 0) / items.length;
  };

  return {
    greenCount,
    amberCount,
    redCount,
    totalCount: materials.length,
    topCarbonRisks,
    topBenefits,
    flaggedForRedesign,
    structureAvgImpact: getCategoryAvg(STRUCTURE_CATEGORIES),
    envelopeAvgImpact: getCategoryAvg(ENVELOPE_CATEGORIES),
    finishAvgImpact: getCategoryAvg(FINISH_CATEGORIES),
    landscapeAvgImpact: getCategoryAvg(LANDSCAPE_CATEGORIES),
    lowConfidenceCount: metricsArray.filter(x => x.metric.low_confidence_flag).length,
  };
}

/**
 * Generate trade-off narrative - honest about what's good AND what's problematic
 */
function generateTradeOffNarrative(
  materials: MaterialOption[],
  metrics: Map<string, MaterialMetrics>,
  synergies: Synergy[],
  analysis: PaletteAnalysis
): string[] {
  const narratives: string[] = [];

  // Primary trade-off statement based on category analysis
  const parts: string[] = [];

  if (analysis.structureAvgImpact > 0 && analysis.structureAvgImpact < 2.5) {
    parts.push('low-carbon structure');
  } else if (analysis.structureAvgImpact >= 3.0) {
    parts.push('high-embodied structure');
  }

  if (analysis.envelopeAvgImpact > 0 && analysis.envelopeAvgImpact < 2.5) {
    parts.push('efficient envelope');
  }

  if (analysis.finishAvgImpact >= 2.5) {
    parts.push('processed finishes with higher impact');
  }

  if (analysis.landscapeAvgImpact >= 2.5) {
    parts.push('hard landscape elements');
  }

  // Build the primary statement
  if (parts.length >= 2) {
    const positives = parts.filter(p =>
      p.includes('low-carbon') || p.includes('efficient')
    );
    const negatives = parts.filter(p =>
      p.includes('high') || p.includes('processed') || p.includes('hard')
    );

    if (positives.length > 0 && negatives.length > 0) {
      narratives.push(
        `This palette prioritises ${positives.join(' and ')}, but relies on ${negatives.join(' and ')}`
      );
    } else if (negatives.length > 0) {
      narratives.push(
        `This palette includes ${negatives.join(' and ')} that require attention`
      );
    } else if (positives.length > 0) {
      narratives.push(
        `This palette benefits from ${positives.join(' and ')}`
      );
    }
  }

  // Rating breakdown (honest)
  if (analysis.redCount > 0) {
    narratives.push(
      `${analysis.redCount} material${analysis.redCount > 1 ? 's' : ''} flagged for review due to high environmental impact`
    );
  } else if (analysis.amberCount > analysis.greenCount) {
    narratives.push(
      `Most materials (${analysis.amberCount} of ${analysis.totalCount}) require specification attention to reduce impact`
    );
  }

  // Synergy mention (if genuine)
  if (synergies.length > 0) {
    const synergyType = synergies[0].type;
    if (synergyType === 'circularity') {
      narratives.push('Design supports future disassembly and material reuse');
    } else if (synergyType === 'biodiversity') {
      narratives.push('Landscape specification enhances ecological value');
    } else if (synergyType === 'carbon') {
      narratives.push('Material combinations support carbon reduction strategy');
    }
  }

  // Fallback if we don't have enough
  if (narratives.length === 0) {
    narratives.push(
      'Early-stage assessment identifies areas requiring specification development'
    );
  }

  return narratives.slice(0, 3);
}

/**
 * Generate risks with specific materials named
 */
function generateRisksWithMaterials(
  materials: MaterialOption[],
  insights: EnhancedSustainabilityInsight[],
  metrics: Map<string, MaterialMetrics>,
  conflicts: Conflict[],
  analysis: PaletteAnalysis
): string[] {
  const risks: string[] = [];

  // Top carbon risks (name the materials)
  if (analysis.topCarbonRisks.length > 0) {
    const topRisk = analysis.topCarbonRisks[0];
    const insight = insights.find(i => i.id === topRisk.material.id);
    const lever = insight?.designLevers?.[0];

    risks.push(
      `${topRisk.material.name} has highest embodied carbon${lever ? ` — ${lever.toLowerCase()}` : ''}`
    );
  }

  // Second highest risk
  if (analysis.topCarbonRisks.length > 1) {
    const secondRisk = analysis.topCarbonRisks[1];
    const insight = insights.find(i => i.id === secondRisk.material.id);
    const lever = insight?.designLevers?.[0];

    risks.push(
      `${secondRisk.material.name} contributes significant embodied impact${lever ? ` — ${lever.toLowerCase()}` : ''}`
    );
  }

  // Flagged for redesign
  if (analysis.flaggedForRedesign.length > 0) {
    const flagged = analysis.flaggedForRedesign[0];
    risks.push(
      `${flagged.material.name}: ${flagged.reason.toLowerCase()} — consider alternatives`
    );
  }

  // Conflicts
  conflicts.slice(0, 1).forEach(conflict => {
    if (conflict.mitigation) {
      risks.push(`${conflict.description} — ${conflict.mitigation.toLowerCase()}`);
    }
  });

  // Fallback
  if (risks.length < 2) {
    risks.push('Gather product-level data to refine impact estimates during detailed design');
  }

  return risks.slice(0, 3);
}

/**
 * Generate evidence checklist focused on flagged materials
 */
function generateEvidenceChecklist(
  materials: MaterialOption[],
  insights: EnhancedSustainabilityInsight[],
  analysis: PaletteAnalysis
): string[] {
  const checklist: string[] = [];

  if (materials.length === 0 || insights.length === 0) {
    checklist.push('Add materials and generate insights to surface evidence priorities.');
    return checklist;
  }

  // High-impact items: prioritise data verification
  analysis.topCarbonRisks.slice(0, 2).forEach(risk => {
    checklist.push(`Prioritise data verification for ${risk.material.name}`);
  });

  // Low confidence items
  if (analysis.lowConfidenceCount > 0) {
    checklist.push(
      `Obtain supplier data for ${analysis.lowConfidenceCount} material${analysis.lowConfidenceCount > 1 ? 's' : ''} with uncertain lifecycle estimates`
    );
  }

  // Transport and sourcing
  checklist.push('Review sourcing and transport assumptions for high-mass materials');
  checklist.push('Confirm end-of-life pathways for key components');

  return checklist.slice(0, 5);
}

/**
 * Generate honest confidence statement
 */
function generateConfidenceStatement(
  metrics: Map<string, MaterialMetrics>,
  analysis: PaletteAnalysis
): string {
  const totalCount = analysis.totalCount;
  const lowConfCount = analysis.lowConfidenceCount;

  if (totalCount === 0) {
    return 'No materials have been assessed. Add materials to generate sustainability insights.';
  }

  // Build honest statement
  let statement = '';

  if (lowConfCount === 0) {
    statement = 'Lifecycle estimates are based on industry-average data. ';
  } else if (lowConfCount <= 2) {
    statement = `${lowConfCount} material${lowConfCount > 1 ? 's have' : ' has'} limited lifecycle data. `;
  } else {
    statement = `${lowConfCount} of ${totalCount} materials have uncertain lifecycle estimates. `;
  }

  statement += 'Product-specific data should be obtained during detailed design to validate these preliminary figures. ';
  statement += 'This assessment is for early-stage decision support only and does not constitute a formal lifecycle assessment.';

  return statement;
}

/**
 * Get a brief one-line summary suitable for headers
 */
export function getOneLinerSummary(
  metrics: Map<string, MaterialMetrics>,
  synergies: Synergy[]
): string {
  const metricsArray = [...metrics.values()];
  const greenCount = metricsArray.filter(m => m.traffic_light === 'green').length;
  const redCount = metricsArray.filter(m => m.traffic_light === 'red').length;
  const totalCount = metricsArray.length;

  if (totalCount === 0) return 'No materials assessed';

  if (redCount >= totalCount * 0.3) {
    return 'Palette requires significant review — multiple high-impact materials';
  } else if (redCount > 0) {
    return `${redCount} material${redCount > 1 ? 's' : ''} flagged for attention`;
  } else if (greenCount >= totalCount * 0.5) {
    return 'Balanced palette with improvement opportunities';
  } else {
    return 'Early-stage palette requiring specification development';
  }
}
