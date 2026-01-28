// Design consequences module
// Generates design risk statements and response recommendations based on hotspots

import type { Hotspot, LifecycleStageKey } from '../types/sustainability';

// Design response templates per lifecycle stage
const DESIGN_RESPONSE_TEMPLATES: Record<LifecycleStageKey, string[]> = {
  raw: [
    'specify reclaimed or recycled content alternatives',
    'consider bio-based material substitutes',
    'request chain-of-custody certification',
  ],
  manufacturing: [
    'specify reclaimed / low-carbon alternative',
    'reduce quantity through efficient design',
    'source from manufacturers with renewable energy',
  ],
  transport: [
    'source locally (within 50km where possible)',
    'reduce mass through material optimization',
    'consolidate deliveries with other site materials',
  ],
  installation: [
    'specify prefabricated components',
    'simplify build-ups to reduce site waste',
    'use dry construction methods where possible',
  ],
  inUse: [
    'ensure adequate ventilation specification',
    'specify low-VOC alternatives',
    'design for passive performance',
  ],
  maintenance: [
    'specify durable finishes to extend intervals',
    'ensure accessible design for easy maintenance',
    'provide client maintenance guidance',
  ],
  endOfLife: [
    'design for disassembly with mechanical fixings',
    'avoid composite materials where possible',
    'specify take-back schemes or circular suppliers',
  ],
};

// Design risk statement templates per lifecycle stage
const DESIGN_RISK_TEMPLATES: Record<LifecycleStageKey, string> = {
  raw: 'Resource extraction impacts may be significant',
  manufacturing: 'Manufacturing process has high embodied carbon',
  transport: 'Long-distance sourcing increases transport emissions',
  installation: 'Complex installation may increase site waste',
  inUse: 'In-use performance may affect occupant health or comfort',
  maintenance: 'Maintenance requirements may be intensive',
  endOfLife: 'End-of-life disposal options may be limited',
};

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

/**
 * Generate design risk statement from hotspots
 * Picks top 1-2 hotspots by score and combines their risk statements
 */
export function generateDesignRisk(hotspots: Hotspot[]): string {
  if (!hotspots || hotspots.length === 0) {
    return 'No significant hotspots identified';
  }

  // Sort by score descending and take top 2
  const topHotspots = [...hotspots]
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const risks = topHotspots.map((h) => DESIGN_RISK_TEMPLATES[h.stage]);

  // Remove duplicates if same stage appears
  const uniqueRisks = [...new Set(risks)];

  return `Design risk: ${uniqueRisks.join('; ')}`;
}

/**
 * Generate design response from hotspots
 * Picks the top hotspot and selects the first response template
 */
export function generateDesignResponse(hotspots: Hotspot[]): string {
  if (!hotspots || hotspots.length === 0) {
    return 'No specific design responses required';
  }

  // Get top hotspot by score
  const topHotspot = [...hotspots].sort((a, b) => b.score - a.score)[0];
  const responses = DESIGN_RESPONSE_TEMPLATES[topHotspot.stage];

  return `Design response: ${responses[0]}`;
}

/**
 * Get detailed design levers based on hotspots
 * Returns all relevant levers for high-impact stages
 */
export function getDetailedDesignLevers(hotspots: Hotspot[]): string[] {
  if (!hotspots || hotspots.length === 0) {
    return [];
  }

  const levers: string[] = [];

  hotspots.forEach((hotspot) => {
    const templates = DESIGN_RESPONSE_TEMPLATES[hotspot.stage];
    if (hotspot.score >= 4) {
      // High impact - add all responses for that stage
      levers.push(...templates);
    } else if (hotspot.score >= 3) {
      // Medium impact - add first response only
      levers.push(templates[0]);
    }
  });

  // Deduplicate and return
  return [...new Set(levers)];
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
 * Get all responses for a specific stage
 */
export function getResponsesForStage(stage: LifecycleStageKey): string[] {
  return DESIGN_RESPONSE_TEMPLATES[stage];
}

/**
 * Get risk statement for a specific stage
 */
export function getRiskForStage(stage: LifecycleStageKey): string {
  return DESIGN_RISK_TEMPLATES[stage];
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

/**
 * Generate a combined design consequence block
 * Returns both risk and response as separate lines
 */
export function generateDesignConsequences(hotspots: Hotspot[]): {
  risk: string;
  response: string;
} {
  return {
    risk: generateDesignRisk(hotspots),
    response: generateDesignResponse(hotspots),
  };
}
