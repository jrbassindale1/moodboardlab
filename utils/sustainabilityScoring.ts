// Sustainability scoring calculations
// Computes aggregate metrics for materials based on lifecycle scores

import type {
  LifecycleProfile,
  Confidence,
  Benefit,
  MaterialMetrics,
  TrafficLight,
} from '../types/sustainability';

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
 * Determine traffic light rating based on impact and benefit scores
 *
 * Rules:
 * - Green: overall impact <= 2.2 OR (moderate impact AND high benefit)
 * - Amber: moderate impact with moderate benefit
 * - Red: high impact OR low benefit
 * - Cap at Amber if confidence < threshold
 */
export function determineTrafficLight(
  overallImpact: number,
  benefitScore: number,
  confidenceScore: number
): { light: TrafficLight; lowConfidenceFlag: boolean } {
  const lowConfidenceFlag = confidenceScore < CONFIDENCE_THRESHOLD;

  let light: TrafficLight;

  // Low impact is always good
  if (overallImpact <= 2.2) {
    light = 'green';
  }
  // Moderate impact (2.2 - 3.5) with high benefit (>= 3.5)
  else if (overallImpact <= 3.5 && benefitScore >= 3.5) {
    light = 'green';
  }
  // Moderate impact with moderate benefit (>= 2.0)
  else if (overallImpact <= 3.5 && benefitScore >= 2.0) {
    light = 'amber';
  }
  // High impact (> 3.5) or low benefit (< 2.0)
  else {
    light = 'red';
  }

  // Cap at amber if low confidence
  if (lowConfidenceFlag && light === 'green') {
    light = 'amber';
  }

  return { light, lowConfidenceFlag };
}

/**
 * Calculate all material metrics from lifecycle profile and benefits
 */
export function calculateMaterialMetrics(
  profile: LifecycleProfile,
  benefits: Benefit[] = []
): MaterialMetrics {
  const embodied_proxy = calculateEmbodiedProxy(profile);
  const in_use_proxy = calculateInUseProxy(profile);
  const end_of_life_proxy = calculateEndOfLifeProxy(profile);
  const overall_impact_proxy = calculateOverallImpactProxy(profile);
  const benefit_score = calculateBenefitScore(benefits);
  const confidence_score = calculateConfidenceScore(profile);

  const { light, lowConfidenceFlag } = determineTrafficLight(
    overall_impact_proxy,
    benefit_score,
    confidence_score
  );

  return {
    embodied_proxy,
    in_use_proxy,
    end_of_life_proxy,
    overall_impact_proxy,
    benefit_score,
    confidence_score,
    traffic_light: light,
    low_confidence_flag: lowConfidenceFlag,
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
