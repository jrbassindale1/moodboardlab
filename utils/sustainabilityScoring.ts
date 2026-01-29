// Sustainability scoring calculations
// Computes aggregate metrics for materials based on lifecycle scores

import type {
  LifecycleProfile,
  Confidence,
  Benefit,
  MaterialMetrics,
  TrafficLight,
  CarbonPayback,
  BenefitType,
} from '../types/sustainability';
import { BENEFIT_CATEGORIES } from '../types/sustainability';
import type { MaterialOption } from '../types';
import {
  getLifecycleDuration,
  getLifecycleMultiplier,
  getCarbonPayback as getPaybackData,
} from './lifecycleDurations';

// Configurable weights for aggregate calculations
export const SCORING_WEIGHTS = {
  // Embodied carbon stages (must sum to 1.0)
  embodied: {
    raw: 0.25,
    manufacturing: 0.35,
    transport: 0.2,
    installation: 0.2,
  },
  // In-use stages (must sum to 1.0)
  inUse: {
    inUse: 0.6,
    maintenance: 0.4,
  },
  // Overall weighting between phases
  overall: {
    embodied: 0.55,
    inUse: 0.2,
    endOfLife: 0.25,
  },
} as const;

// Confidence numeric values for averaging
const CONFIDENCE_VALUES: Record<Confidence, number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.3,
};

// Default confidence when not specified
const DEFAULT_CONFIDENCE: Confidence = 'high';

// Threshold below which confidence is considered "low"
export const CONFIDENCE_THRESHOLD = 0.5;

/**
 * Calculate embodied carbon proxy score
 * Weighted sum of RAW + MFG + TRN + INS
 */
export function calculateEmbodiedProxy(profile: LifecycleProfile): number {
  const { embodied } = SCORING_WEIGHTS;
  return (
    profile.raw.impact * embodied.raw +
    profile.manufacturing.impact * embodied.manufacturing +
    profile.transport.impact * embodied.transport +
    profile.installation.impact * embodied.installation
  );
}

/**
 * Calculate in-use proxy score
 * Weighted sum of USE + MNT
 */
export function calculateInUseProxy(profile: LifecycleProfile): number {
  const { inUse } = SCORING_WEIGHTS;
  return (
    profile.inUse.impact * inUse.inUse +
    profile.maintenance.impact * inUse.maintenance
  );
}

/**
 * Calculate end-of-life proxy score
 * Direct EOL score
 */
export function calculateEndOfLifeProxy(profile: LifecycleProfile): number {
  return profile.endOfLife.impact;
}

/**
 * Calculate overall impact proxy
 * Weighted combination of embodied, in-use, and end-of-life
 */
export function calculateOverallImpactProxy(profile: LifecycleProfile): number {
  const { overall } = SCORING_WEIGHTS;
  const embodied = calculateEmbodiedProxy(profile);
  const inUse = calculateInUseProxy(profile);
  const eol = calculateEndOfLifeProxy(profile);

  return (
    embodied * overall.embodied + inUse * overall.inUse + eol * overall.endOfLife
  );
}

/**
 * Calculate benefit score
 * Average of all benefit scores (0 if no benefits)
 */
export function calculateBenefitScore(benefits: Benefit[]): number {
  if (!benefits || benefits.length === 0) return 0;
  const sum = benefits.reduce((acc, b) => acc + b.score_1to5, 0);
  return sum / benefits.length;
}

/**
 * Calculate environmental benefit score
 * Only includes benefits that CAN offset embodied carbon:
 * - biodiversity, sequestration, operational_carbon
 * This score is used for traffic light determination
 */
export function calculateEnvironmentalBenefitScore(benefits: Benefit[]): number {
  if (!benefits || benefits.length === 0) return 0;
  const envBenefits = benefits.filter(
    (b) => BENEFIT_CATEGORIES[b.type as BenefitType] === 'environmental'
  );
  if (envBenefits.length === 0) return 0;
  const sum = envBenefits.reduce((acc, b) => acc + b.score_1to5, 0);
  return sum / envBenefits.length;
}

/**
 * Calculate practical benefit score
 * Includes benefits that are valuable but CANNOT offset embodied carbon:
 * - durability, circularity, health_voc
 * This score is displayed but doesn't affect traffic light rating
 */
export function calculatePracticalBenefitScore(benefits: Benefit[]): number {
  if (!benefits || benefits.length === 0) return 0;
  const practicalBenefits = benefits.filter(
    (b) => BENEFIT_CATEGORIES[b.type as BenefitType] === 'practical'
  );
  if (practicalBenefits.length === 0) return 0;
  const sum = practicalBenefits.reduce((acc, b) => acc + b.score_1to5, 0);
  return sum / practicalBenefits.length;
}

/**
 * Calculate confidence score
 * Average confidence across all lifecycle stages (0-1 scale)
 */
export function calculateConfidenceScore(profile: LifecycleProfile): number {
  const stages = Object.values(profile);
  const confidenceSum = stages.reduce((acc, stage) => {
    const conf = stage.confidence || DEFAULT_CONFIDENCE;
    return acc + CONFIDENCE_VALUES[conf];
  }, 0);
  return confidenceSum / stages.length;
}

/**
 * Determine traffic light rating based on impact and ENVIRONMENTAL benefit scores
 *
 * IMPORTANT: Only ENVIRONMENTAL benefits (biodiversity, sequestration, operational_carbon)
 * can offset embodied carbon. Practical benefits (durability, circularity, health_voc) are
 * shown for information but CANNOT improve the rating for high-carbon materials.
 *
 * STRICT Rules (credibility-focused):
 * - Embodied ≥ 4.0 → RED (very high carbon, avoid unless essential)
 * - Embodied ≥ 3.6 AND replacements ≥ 2 → RED (high carbon compounded by short life)
 * - Overall impact > 3.2 → RED
 * - Green: Genuinely low impact (≤ 1.8) AND some environmental benefit (≥ 2.0) - should be RARE
 * - Cap at Amber if confidence < threshold
 */
export function determineTrafficLight(
  overallImpact: number,
  environmentalBenefitScore: number,
  confidenceScore: number,
  embodiedProxy: number = 0,
  lifecycleMultiplier: number = 1
): { light: TrafficLight; lowConfidenceFlag: boolean; reason: string } {
  const lowConfidenceFlag = confidenceScore < CONFIDENCE_THRESHOLD;

  let light: TrafficLight;
  let reason: string;

  // RULE 1: Very high embodied carbon (≥ 4.0) = RED
  // These materials should be avoided unless structurally essential
  if (embodiedProxy >= 4.0) {
    light = 'red';
    reason = `Embodied ${embodiedProxy.toFixed(1)} — avoid unless essential`;
  }
  // RULE 2: High embodied (≥ 3.6) with multiple replacements = RED
  // Short-lived high-carbon materials multiply their impact
  else if (embodiedProxy >= 3.6 && lifecycleMultiplier >= 2) {
    light = 'red';
    reason = `Embodied ${embodiedProxy.toFixed(1)} × ${lifecycleMultiplier} replacements`;
  }
  // RULE 3: High overall impact (> 3.2) = RED
  else if (overallImpact > 3.2) {
    light = 'red';
    reason = `Overall impact ${overallImpact.toFixed(1)} — high lifecycle burden`;
  }
  // RULE 4: Moderate-high impact (2.5-3.2) without strong environmental benefits = RED
  else if (overallImpact > 2.5 && environmentalBenefitScore < 3.0) {
    light = 'red';
    reason = `Impact ${overallImpact.toFixed(1)} without environmental offset`;
  }
  // RULE 5: Genuinely low impact with meaningful environmental benefits = GREEN (rare)
  else if (overallImpact <= 1.8 && environmentalBenefitScore >= 2.0) {
    light = 'green';
    reason = 'Low impact with environmental benefits';
  }
  // RULE 6: Moderate impact (1.8-2.5) with strong environmental benefits = GREEN
  else if (overallImpact <= 2.5 && environmentalBenefitScore >= 3.5) {
    light = 'green';
    reason = 'Environmental benefits offset moderate impact';
  }
  // RULE 7: Low impact but no environmental benefits = AMBER
  else if (overallImpact <= 2.0 && environmentalBenefitScore < 2.0) {
    light = 'amber';
    reason = 'Low impact but no environmental upside';
  }
  // DEFAULT: Everything else = AMBER
  else {
    light = 'amber';
    reason = `Moderate impact (${overallImpact.toFixed(1)}) — review design levers`;
  }

  // Cap at amber if low confidence
  if (lowConfidenceFlag && light === 'green') {
    light = 'amber';
    reason = `${reason} (capped: low confidence)`;
  }

  return { light, lowConfidenceFlag, reason };
}

/**
 * Calculate all material metrics from lifecycle profile and benefits
 * Optionally accepts material for lifecycle duration data
 */
export function calculateMaterialMetrics(
  profile: LifecycleProfile,
  benefits: Benefit[] = [],
  material?: MaterialOption
): MaterialMetrics {
  const embodied_proxy = calculateEmbodiedProxy(profile);
  const in_use_proxy = calculateInUseProxy(profile);
  const end_of_life_proxy = calculateEndOfLifeProxy(profile);
  const overall_impact_proxy = calculateOverallImpactProxy(profile);
  const benefit_score = calculateBenefitScore(benefits);
  const environmental_benefit_score = calculateEnvironmentalBenefitScore(benefits);
  const practical_benefit_score = calculatePracticalBenefitScore(benefits);
  const confidence_score = calculateConfidenceScore(profile);

  // Get lifecycle duration data FIRST (needed for traffic light calculation)
  let service_life = 25; // Default
  let replacement_cycle = 25;
  let lifecycle_multiplier = 2;
  let carbon_payback: CarbonPayback | undefined;

  if (material) {
    const duration = getLifecycleDuration(material);
    service_life = duration.serviceLife;
    replacement_cycle = duration.replacementCycle;
    lifecycle_multiplier = getLifecycleMultiplier(material);

    // Get carbon payback if applicable
    const payback = getPaybackData(material);
    if (payback) {
      carbon_payback = {
        years: payback.years,
        mechanism: payback.mechanism,
        assumption: payback.assumption,
      };
    }
  }

  // IMPORTANT: Pass embodied_proxy and lifecycle_multiplier for stricter thresholds
  const { light, lowConfidenceFlag, reason } = determineTrafficLight(
    overall_impact_proxy,
    environmental_benefit_score,
    confidence_score,
    embodied_proxy,
    lifecycle_multiplier
  );

  return {
    embodied_proxy,
    in_use_proxy,
    end_of_life_proxy,
    overall_impact_proxy,
    benefit_score,
    environmental_benefit_score,
    practical_benefit_score,
    confidence_score,
    traffic_light: light,
    traffic_light_reason: reason,
    low_confidence_flag: lowConfidenceFlag,
    service_life,
    replacement_cycle,
    lifecycle_multiplier,
    carbon_payback,
  };
}

/**
 * Get circularity indicator based on end-of-life score
 * Used for dashboard display
 */
export function getCircularityIndicator(
  endOfLifeScore: number
): 'high' | 'medium' | 'low' {
  if (endOfLifeScore <= 2) return 'high';
  if (endOfLifeScore <= 3) return 'medium';
  return 'low';
}

/**
 * Format score for display (1 decimal place)
 */
export function formatScore(score: number): string {
  return score.toFixed(1);
}

/**
 * Get a human-readable description of the traffic light
 */
export function getTrafficLightDescription(light: TrafficLight): string {
  switch (light) {
    case 'green':
      return 'Low impact or high benefit offset';
    case 'amber':
      return 'Moderate impact, review design levers';
    case 'red':
      return 'High impact, consider alternatives';
  }
}
