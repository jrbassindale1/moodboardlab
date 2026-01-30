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
  isLandscapeMaterial,
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

const WEIGHT_EPSILON = 0.001;
const isProd =
  typeof import.meta !== 'undefined' &&
  typeof import.meta.env !== 'undefined' &&
  import.meta.env.PROD === true;

function assertWeightSums(): void {
  if (isProd) return;
  const sum = (values: Record<string, number>) =>
    Object.values(values).reduce((acc, v) => acc + v, 0);
  const embodiedSum = sum(SCORING_WEIGHTS.embodied);
  const inUseSum = sum(SCORING_WEIGHTS.inUse);
  const overallSum = sum(SCORING_WEIGHTS.overall);

  if (Math.abs(embodiedSum - 1) > WEIGHT_EPSILON) {
    console.warn(`[SustainabilityScoring] Embodied weights sum to ${embodiedSum.toFixed(3)} (expected 1.0)`);
  }
  if (Math.abs(inUseSum - 1) > WEIGHT_EPSILON) {
    console.warn(`[SustainabilityScoring] In-use weights sum to ${inUseSum.toFixed(3)} (expected 1.0)`);
  }
  if (Math.abs(overallSum - 1) > WEIGHT_EPSILON) {
    console.warn(`[SustainabilityScoring] Overall weights sum to ${overallSum.toFixed(3)} (expected 1.0)`);
  }
}

assertWeightSums();

// Confidence numeric values for averaging
const CONFIDENCE_VALUES: Record<Confidence, number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.3,
};

// Default confidence when not specified
const DEFAULT_CONFIDENCE: Confidence = 'medium';

// Threshold below which confidence is considered "low"
export const CONFIDENCE_THRESHOLD = 0.5;

// ============================================================================
// LANDSCAPE CARBON CAP
// ============================================================================
// Landscape materials cannot dominate palette carbon in early-stage mode
// because we don't have quantities - treating meadow seeds as equivalent to
// steel is conceptually wrong.
//
// Hard cap: 10% - landscape cannot exceed this share of total embodied
// Soft cap: 15% - warning added if exceeded
export const LANDSCAPE_CARBON_CAP_HARD = 0.10;
export const LANDSCAPE_CARBON_CAP_SOFT = 0.15;

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
 * Uses the maximum score to avoid penalizing multiple benefits.
 */
export function calculateEnvironmentalBenefitScore(benefits: Benefit[]): number {
  if (!benefits || benefits.length === 0) return 0;
  const envBenefits = benefits.filter(
    (b) => BENEFIT_CATEGORIES[b.type as BenefitType] === 'environmental'
  );
  if (envBenefits.length === 0) return 0;
  return Math.max(...envBenefits.map((b) => b.score_1to5));
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
 * STRICT Rules for INDUSTRIAL materials (credibility-focused):
 * - Embodied ≥ 3.6 OR max stage ≥ 4.5 → RED (very high carbon, avoid unless essential)
 * - Embodied ≥ 3.6 AND replacements ≥ 2 → RED (high carbon compounded by short life)
 * - Overall impact > 3.2 → RED
 * - Moderate-high impact without environmental offset → AMBER
 * - Green: Genuinely low impact (≤ 1.8) AND some environmental benefit (≥ 2.0) - should be RARE
 * - Cap at Amber if confidence < threshold
 *
 * LANDSCAPE materials use different rules:
 * - NEVER "avoid unless essential" - that language is inappropriate for regenerative systems
 * - Focus on establishment quality and long-term ecosystem benefits
 * - Green is achievable with meaningful biodiversity/sequestration scores
 */
export function determineTrafficLight(
  overallImpact: number,
  environmentalBenefitScore: number,
  confidenceScore: number,
  embodiedProxy: number = 0,
  lifecycleMultiplier: number = 1,
  maxEmbodiedStage: number = 0,
  isLandscape: boolean = false
): { light: TrafficLight; lowConfidenceFlag: boolean; reason: string } {
  const lowConfidenceFlag = confidenceScore < CONFIDENCE_THRESHOLD;

  let light: TrafficLight;
  let reason: string;

  // =========================================================================
  // LANDSCAPE MATERIALS - Different rules for regenerative systems
  // =========================================================================
  if (isLandscape) {
    // Landscape with strong environmental benefits = GREEN
    if (environmentalBenefitScore >= 3.0) {
      light = 'green';
      reason = 'Regenerative system with biodiversity/sequestration benefits';
    }
    // Landscape with some environmental benefits = GREEN (lower threshold)
    else if (environmentalBenefitScore >= 2.0) {
      light = 'green';
      reason = 'Landscape system with ecosystem benefits';
    }
    // Landscape without documented benefits = AMBER (needs assessment)
    else {
      light = 'amber';
      reason = 'Landscape system - ecological review recommended';
    }

    // Cap at amber if low confidence
    if (lowConfidenceFlag && light === 'green') {
      light = 'amber';
      reason = `${reason} (capped: low confidence)`;
    }

    return { light, lowConfidenceFlag, reason };
  }

  // =========================================================================
  // INDUSTRIAL MATERIALS - Standard strict rules
  // =========================================================================

  // RULE 1: Very high embodied carbon (≥ 3.6) or extreme stage (≥ 4.5) = RED
  // These materials should be avoided unless structurally essential
  if (embodiedProxy >= 3.6 || maxEmbodiedStage >= 4.5) {
    light = 'red';
    reason = `Embodied ${embodiedProxy.toFixed(1)} - avoid unless essential`;
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
    reason = `Overall impact ${overallImpact.toFixed(1)} - high lifecycle burden`;
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
    reason = 'Low impact with no carbon-offsetting benefit identified';
  }
  // RULE 8: Moderate-high impact without environmental offset = AMBER (review)
  else if (overallImpact > 2.5 && environmentalBenefitScore < 2.0) {
    light = 'amber';
    reason = `Moderate-high impact (${overallImpact.toFixed(1)}) without environmental offset`;
  }
  // DEFAULT: Everything else = AMBER
  else {
    light = 'amber';
    reason = `Moderate impact (${overallImpact.toFixed(1)}) - review design levers`;
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
  const embodied_proxy_per_install = calculateEmbodiedProxy(profile);
  const in_use_proxy = calculateInUseProxy(profile);
  const end_of_life_proxy = calculateEndOfLifeProxy(profile);
  const benefit_score = calculateBenefitScore(benefits);
  const environmental_benefit_score = calculateEnvironmentalBenefitScore(benefits);
  const practical_benefit_score = calculatePracticalBenefitScore(benefits);
  const confidence_score = calculateConfidenceScore(profile);
  const max_embodied_stage = Math.max(
    profile.raw.impact,
    profile.manufacturing.impact,
    profile.transport.impact,
    profile.installation.impact
  );

  // Get lifecycle duration data FIRST (needed for traffic light calculation)
  let service_life = 25; // Default
  let replacement_cycle = 25;
  let lifecycle_multiplier = 2;
  let carbon_payback: CarbonPayback | undefined;
  let carbon_payback_note: string | undefined;

  if (material) {
    const duration = getLifecycleDuration(material);
    service_life = duration.serviceLife;
    replacement_cycle = duration.replacementCycle;
    lifecycle_multiplier = getLifecycleMultiplier(material);
    carbon_payback_note = duration.carbonPaybackNote;

    // Get carbon payback if applicable
    const payback = getPaybackData(material);
    if (payback) {
      carbon_payback = {
        years: payback.years,
        rangeYears: payback.rangeYears,
        category: payback.category,
        assumption: payback.assumption,
      };
    }
  }

  const embodied_proxy = embodied_proxy_per_install * lifecycle_multiplier;
  const overall_impact_proxy =
    embodied_proxy * SCORING_WEIGHTS.overall.embodied +
    in_use_proxy * SCORING_WEIGHTS.overall.inUse +
    end_of_life_proxy * SCORING_WEIGHTS.overall.endOfLife;

  // Detect if this is a landscape/regenerative material
  const isLandscape = material ? isLandscapeMaterial(material) : false;

  // IMPORTANT: Pass per-install embodied proxy and lifecycle multiplier for stricter thresholds
  const { light, lowConfidenceFlag, reason } = determineTrafficLight(
    overall_impact_proxy,
    environmental_benefit_score,
    confidence_score,
    embodied_proxy_per_install,
    lifecycle_multiplier,
    max_embodied_stage,
    isLandscape
  );

  let traffic_light_reason = reason;

  // Landscape-specific reason enhancements
  if (isLandscape) {
    if (carbon_payback?.category === 'ecosystem_sequestration') {
      traffic_light_reason = `${reason} - potential carbon sequestration over time (site-dependent)`;
    }
    // Add establishment note for landscape
    if (light === 'green' && environmental_benefit_score >= 3.0) {
      traffic_light_reason = 'Regenerative landscape with biodiversity and potential sequestration benefits';
    }
  }
  // Non-landscape biogenic storage note
  else if (
    carbon_payback?.category === 'biogenic_storage' &&
    traffic_light_reason === 'Low impact with no carbon-offsetting benefit identified'
  ) {
    traffic_light_reason =
      'Low embodied impact with biogenic carbon storage benefits (subject to system boundary assumptions)';
  }

  // Recycled aluminium specific note
  if (material && light !== 'green') {
    const materialText = `${material.id} ${material.name}`.toLowerCase();
    if (materialText.includes('recycled') && (materialText.includes('aluminium') || materialText.includes('aluminum'))) {
      traffic_light_reason =
        'Lower impact than virgin aluminium, but still higher than bio-based alternatives; prioritise where durability and recyclability justify use';
    }
  }

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
    traffic_light_reason,
    low_confidence_flag: lowConfidenceFlag,
    service_life,
    replacement_cycle,
    lifecycle_multiplier,
    carbon_payback,
    carbon_payback_note,
  };
}

/**
 * Get circularity indicator based on end-of-life score
 * Used for dashboard display
 */
export function getCircularityIndicator(
  endOfLifeScore: number
): 'high' | 'medium' | 'low' {
  // Assumes endOfLifeScore represents environmental burden (lower = more circular).
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
