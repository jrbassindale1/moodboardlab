// QA validation module
// Pre-export checks to ensure report quality

import type {
  EnhancedSustainabilityInsight,
  MaterialMetrics,
  QAValidationResult,
} from '../types/sustainability';
import type { MaterialOption } from '../types';
import { CONFIDENCE_THRESHOLD } from './sustainabilityScoring';
import { MATERIAL_LIFECYCLE_PROFILES } from '../lifecycleProfiles';

/**
 * Validate sustainability insights before PDF export
 * Checks for completeness and data quality
 */
export function validateInsights(
  insights: EnhancedSustainabilityInsight[],
  materials: MaterialOption[],
  metrics: Map<string, MaterialMetrics>
): QAValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check: At least 1 design lever per material
  insights.forEach((insight) => {
    if (!insight.designLevers || insight.designLevers.length === 0) {
      errors.push(`Material "${insight.title}" has no design levers specified`);
    }
  });

  // Check: At least 1 hotspot per material when lifecycle profile indicates hotspots
  insights.forEach((insight) => {
    const profile = MATERIAL_LIFECYCLE_PROFILES[insight.id];
    const requiresHotspots = profile
      ? Object.values(profile).some((stage) => stage.impact >= 3)
      : true;
    if (requiresHotspots && (!insight.hotspots || insight.hotspots.length === 0)) {
      errors.push(`Material "${insight.title}" has no hotspots identified`);
    }
  });

  // Check: Comparative page totals match selected materials
  if (insights.length !== materials.length) {
    errors.push(
      `Insight count (${insights.length}) does not match material count (${materials.length})`
    );
  }

  // Check: All materials have corresponding insights
  materials.forEach((material) => {
    const hasInsight = insights.some((i) => i.id === material.id);
    if (!hasInsight) {
      errors.push(`No insight found for material "${material.name}"`);
    }
  });

  // Check: Confidence flags - warn when below threshold
  metrics.forEach((metric, materialId) => {
    if (metric.low_confidence_flag) {
      const material = materials.find((m) => m.id === materialId);
      warnings.push(
        `Material "${material?.name || materialId}" has low confidence scores - verify data sources`
      );
    }
  });

  // Check: Landscape-only board handling
  const landscapeCount = materials.filter(
    (m) => m.category === 'landscape'
  ).length;
  if (landscapeCount === materials.length && materials.length > 0) {
    warnings.push(
      'Board contains only landscape items - some metrics may not apply'
    );
  }

  // Check: Very short headlines
  insights.forEach((insight) => {
    if (insight.headline && insight.headline.length < 20) {
      warnings.push(
        `Headline for "${insight.title}" is very short - consider more detail`
      );
    }
  });

  // Check: Missing benefits for landscape materials
  materials.forEach((material) => {
    if (material.category === 'landscape') {
      const insight = insights.find((i) => i.id === material.id);
      const hasBiodiversity = insight?.benefits?.some(
        (b) => b.type === 'biodiversity'
      );
      if (!hasBiodiversity) {
        warnings.push(
          `Landscape material "${material.name}" missing biodiversity benefit score`
        );
      }
    }
  });

  // Check: UK checks present
  insights.forEach((insight) => {
    if (!insight.ukChecks || insight.ukChecks.length === 0) {
      warnings.push(
        `Material "${insight.title}" has no UK compliance checks listed`
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate before PDF export
 * Returns whether export should proceed and any issues to display
 */
export function validateBeforeExport(
  insights: EnhancedSustainabilityInsight[],
  materials: MaterialOption[],
  metrics: Map<string, MaterialMetrics>
): { canExport: boolean; issues: string[] } {
  const result = validateInsights(insights, materials, metrics);

  return {
    canExport: result.valid,
    issues: [...result.errors, ...result.warnings],
  };
}

/**
 * Quick check if report has minimum required content
 * Used to gate the export button
 */
export function hasMinimumContent(
  insights: EnhancedSustainabilityInsight[] | null,
  materials: MaterialOption[]
): boolean {
  if (!insights || insights.length === 0) return false;
  if (materials.length === 0) return false;
  return insights.length >= 1;
}

/**
 * Get a summary of validation status
 * Returns a human-readable status string
 */
export function getValidationSummary(result: QAValidationResult): string {
  if (result.valid && result.warnings.length === 0) {
    return 'All checks passed';
  } else if (result.valid && result.warnings.length > 0) {
    return `Passed with ${result.warnings.length} warning(s)`;
  } else {
    return `${result.errors.length} error(s) found`;
  }
}

/**
 * Check if confidence is below threshold for any material
 */
export function hasLowConfidenceMaterials(
  metrics: Map<string, MaterialMetrics>
): boolean {
  for (const metric of metrics.values()) {
    if (metric.confidence_score < CONFIDENCE_THRESHOLD) {
      return true;
    }
  }
  return false;
}

/**
 * Count materials by traffic light status
 */
export function countByTrafficLight(
  metrics: Map<string, MaterialMetrics>
): { green: number; amber: number; red: number } {
  let green = 0;
  let amber = 0;
  let red = 0;

  metrics.forEach((metric) => {
    switch (metric.traffic_light) {
      case 'green':
        green++;
        break;
      case 'amber':
        amber++;
        break;
      case 'red':
        red++;
        break;
    }
  });

  return { green, amber, red };
}

/**
 * Get list of materials missing lifecycle profiles
 */
export function getMaterialsWithoutProfiles(
  materials: MaterialOption[],
  profileIds: Set<string>
): MaterialOption[] {
  return materials.filter((m) => !profileIds.has(m.id));
}
