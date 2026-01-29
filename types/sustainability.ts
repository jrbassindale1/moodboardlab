// Sustainability types for the enhanced PDF report
// Provides canonical data structures for comparative analysis, benefits/risks scoring,
// and system-level summaries

import type { LifecycleStageKey, Confidence, LifecycleProfile } from '../lifecycleProfiles';

// Re-export for convenience
export type { LifecycleStageKey, Confidence, LifecycleProfile };

// Traffic light rating for comparative dashboard
export type TrafficLight = 'green' | 'amber' | 'red';

// Benefit types for positive sustainability attributes
export type BenefitType =
  | 'biodiversity'
  | 'circularity'
  | 'durability'
  | 'operational_carbon'
  | 'health_voc'
  | 'sequestration';

// Benefit category - determines whether benefit can offset embodied carbon
export type BenefitCategory = 'environmental' | 'practical';

// Classification of benefits by category
// ENVIRONMENTAL: Can offset embodied carbon in traffic light rating
// PRACTICAL: Shown for info but cannot improve rating for high-carbon materials
export const BENEFIT_CATEGORIES: Record<BenefitType, BenefitCategory> = {
  // Environmental benefits - CAN offset embodied carbon
  biodiversity: 'environmental',
  sequestration: 'environmental',
  operational_carbon: 'environmental',

  // Practical benefits - CANNOT offset embodied carbon
  durability: 'practical',
  circularity: 'practical',
  health_voc: 'practical',
};

// Risk types for potential concerns
export type RiskType =
  | 'supply_chain'
  | 'durability'
  | 'maintenance'
  | 'disposal'
  | 'regulatory'
  | 'cost';

// Enhanced hotspot with stage reference and reason
export interface Hotspot {
  stage: LifecycleStageKey;
  score: 1 | 2 | 3 | 4 | 5;
  reason: string;
}

// UK compliance check with standard codes
export interface UKCheck {
  label: string;
  standard_code?: string; // e.g., "EN 15804", "FSC COC", "ISO 14025"
  url?: string;
  status?: TrafficLight; // For compliance dashboard
}

// Benefit scoring
export interface Benefit {
  type: BenefitType;
  score_1to5: 1 | 2 | 3 | 4 | 5;
  note?: string;
}

// Risk identification
export interface Risk {
  type: RiskType;
  severity_1to5: 1 | 2 | 3 | 4 | 5;
  note?: string;
}

// Carbon payback for sequestering/generating materials
export interface CarbonPayback {
  years: number; // Years until embodied carbon is offset
  mechanism: 'sequestration' | 'generation' | 'avoided_emissions';
  assumption: string; // What the payback is based on
}

// Computed metrics for a single material
export interface MaterialMetrics {
  embodied_proxy: number; // Weighted RAW + MFG + TRN + INS
  in_use_proxy: number; // Weighted USE + MNT
  end_of_life_proxy: number; // EOL
  overall_impact_proxy: number; // Weighted sum of all
  benefit_score: number; // Average of ALL benefits (for display)
  environmental_benefit_score: number; // Environmental benefits only (biodiversity, sequestration, operational) - used for traffic light
  practical_benefit_score: number; // Practical benefits only (durability, circularity, health) - shown but doesn't affect rating
  confidence_score: number; // 0-1 scale
  traffic_light: TrafficLight;
  traffic_light_reason: string; // Human-readable explanation for the rating
  low_confidence_flag: boolean;
  // Lifecycle duration metrics (NEW)
  service_life: number; // Expected lifespan in years
  replacement_cycle: number; // How often replaced/refurbished (years)
  lifecycle_multiplier: number; // How many replacements over 60-year building life
  carbon_payback?: CarbonPayback; // Only for sequestering/generating materials
}

// Enhanced sustainability insight (extends current SustainabilityInsight)
export interface EnhancedSustainabilityInsight {
  id: string;
  title: string;
  headline: string;
  hotspots: Hotspot[]; // Changed from string[]
  whyItLooksLikeThis: string;
  designLevers: string[];
  whatCouldChange: string[];
  ukChecks: UKCheck[]; // Changed from string[]
  benefits: Benefit[]; // NEW
  risks: Risk[]; // NEW
  design_risk?: string; // NEW - generated from hotspots
  design_response?: string; // NEW - generated from design levers
}

// Synergy detected between materials
export interface Synergy {
  materials: string[]; // IDs of materials involved
  type: 'circularity' | 'biodiversity' | 'performance' | 'carbon';
  description: string;
}

// Conflict or watch-out between materials
export interface Conflict {
  materials: string[]; // IDs of materials involved
  type: 'acoustic' | 'thermal' | 'maintenance' | 'aesthetic';
  description: string;
  mitigation?: string;
}

// System-level summary for the palette
export interface SystemLevelSummary {
  top_embodied_items: string[]; // Top 3 material IDs by embodied carbon
  top_benefit_items: string[]; // Top 3 material IDs by benefit score
  net_statement: string; // Overall palette strategy statement
  synergies: Synergy[];
  conflicts: Conflict[];
}

// Client-facing summary for front page
export interface ClientSummary {
  achievements: string[]; // 3 bullets of what the palette achieves
  risks_and_mitigations: string[]; // 3 bullets of risks and responses
  evidence_checklist: string[]; // Items to collect
  confidence_statement: string; // Overall confidence note
}

// QA validation result before PDF export
export interface QAValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// PDF rendering context (for passing between section renderers)
export interface PDFContext {
  doc: any; // jsPDF instance
  pageWidth: number;
  pageHeight: number;
  cursorY: number;
  margin: number;
}

// Backward compatibility: convert old string[] hotspots to new format
export function convertLegacyHotspots(hotspots: string[]): Hotspot[] {
  return hotspots.map((text) => ({
    stage: 'manufacturing' as LifecycleStageKey, // Default to manufacturing
    score: 3 as const,
    reason: text,
  }));
}

// Backward compatibility: convert old string[] ukChecks to new format
export function convertLegacyUKChecks(checks: string[]): UKCheck[] {
  return checks.map((label) => ({ label }));
}

// Type guard to check if insight has enhanced structure
export function isEnhancedInsight(
  insight: any
): insight is EnhancedSustainabilityInsight {
  return (
    insight &&
    Array.isArray(insight.hotspots) &&
    insight.hotspots.length > 0 &&
    typeof insight.hotspots[0] === 'object' &&
    'stage' in insight.hotspots[0]
  );
}
