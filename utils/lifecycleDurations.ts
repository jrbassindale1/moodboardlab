// Lifecycle duration data
// Service life, replacement cycles, and carbon payback for materials
// Data now loaded from JSON files for easier database migration

import type { MaterialOption } from '../types';
import type { CarbonPaybackCategory } from '../types/sustainability';
import {
  getCategoryDuration,
  getMaterialDurationOverrides,
  getLandscapeConfig,
} from '../data';

// ============================================================================
// TYPE EXPORTS (preserved for backward compatibility)
// ============================================================================

export interface LifecycleDuration {
  serviceLife: number;
  replacementCycle: number;
  carbonPayback?: CarbonPayback;
  carbonPaybackNote?: string;
  replacementScope?: 'full' | 'partial';
  partialReplacementFactor?: number;
  notes?: string;
}

export interface CarbonPayback {
  years: number;
  rangeYears?: [number, number];
  category: CarbonPaybackCategory;
  assumption: string;
}

// ============================================================================
// LANDSCAPE / REGENERATIVE MATERIAL DETECTION
// ============================================================================

/**
 * Check if a material is a landscape/regenerative system
 * These materials use a different carbon model (establishment + maintenance)
 */
export function isLandscapeMaterial(material: MaterialOption): boolean {
  const config = getLandscapeConfig();

  // Check by ID first
  if (config.materialIds.has(material.id)) return true;

  // Check by category
  if (material.category === 'landscape') return true;

  // Check by pattern matching
  const materialText = `${material.id} ${material.name} ${material.description || ''}`;
  return config.patterns.some((pattern) => pattern.test(materialText));
}

/**
 * Check if a material is a "hard" landscape material (gravel, paving, etc.)
 * Hard landscape materials should appear under Functional benefits, not Ecosystem benefits
 */
export function isHardLandscapeMaterial(material: MaterialOption): boolean {
  // Must be in a landscape-related category
  if (material.category !== 'external-ground' && material.category !== 'landscape') {
    return false;
  }

  const materialText = `${material.id} ${material.name} ${material.description || ''}`.toLowerCase();
  const hardPatterns = /gravel|paving|paver|sett|flag|cobble|aggregate|resin.?bound|permeable.?surface/;

  return hardPatterns.test(materialText);
}

// ============================================================================
// PUBLIC FUNCTIONS
// ============================================================================

/**
 * Get lifecycle duration for a material
 * Uses pattern matching then falls back to category default
 */
export function getLifecycleDuration(material: MaterialOption): LifecycleDuration {
  const materialText = `${material.id} ${material.name} ${material.description || ''}`;
  const overrides = getMaterialDurationOverrides();

  // Try pattern matching first
  for (const override of overrides) {
    if (!override.pattern.test(materialText)) continue;

    // Check category filter if specified
    if (override.categories && !override.categories.includes(material.category)) continue;

    return override.duration as LifecycleDuration;
  }

  // Fall back to category default
  return getCategoryDuration(material.category) as LifecycleDuration;
}

/**
 * Get carbon payback if applicable, null otherwise
 */
export function getCarbonPayback(material: MaterialOption): CarbonPayback | null {
  const duration = getLifecycleDuration(material);
  return duration.carbonPayback || null;
}

/**
 * Check if material has carbon payback (biogenic/operational/ecosystem)
 */
export function hasPayback(material: MaterialOption): boolean {
  return getCarbonPayback(material) !== null;
}

/**
 * Format carbon payback for display
 */
export function formatCarbonPayback(payback: CarbonPayback): string {
  if (payback.years === 0) {
    const immediateLabel =
      payback.category === 'biogenic_storage'
        ? 'Biogenic storage from day 1'
        : payback.category === 'operational_offset'
        ? 'Operational offset (time-dependent)'
        : 'Immediate ecosystem sequestration';
    return immediateLabel;
  }

  const categoryText =
    payback.category === 'biogenic_storage'
      ? 'biogenic storage'
      : payback.category === 'operational_offset'
      ? 'operational offset'
      : 'ecosystem sequestration';

  if (payback.rangeYears) {
    return `~${payback.rangeYears[0]}-${payback.rangeYears[1]} years (${categoryText})`;
  }

  return `~${payback.years} years (${categoryText})`;
}

/**
 * Calculate lifecycle multiplier for impact assessment
 * Materials replaced more often have higher lifetime impact
 *
 * IMPORTANT: Landscape materials use a different model:
 * - Industrial materials: Full replacement cycles (e.g., carpet replaced 8x)
 * - Landscape materials: Establishment + maintenance (NOT full replacement)
 *   Re-seeding a meadow ≠ re-manufacturing steel
 */
export function getLifecycleMultiplier(
  material: MaterialOption,
  buildingLife: number = 60
): number {
  // Landscape materials use maintenance factor, NOT replacement multiplier
  if (isLandscapeMaterial(material)) {
    return getLandscapeConfig().maintenanceFactor;
  }

  const duration = getLifecycleDuration(material);
  // How many times will this material be installed over the building's life?
  const baseMultiplier = Math.ceil(buildingLife / duration.replacementCycle);
  if (duration.replacementScope === 'partial' && duration.partialReplacementFactor) {
    const scaled = baseMultiplier * duration.partialReplacementFactor;
    return Math.max(1, Math.round(scaled * 10) / 10);
  }
  return baseMultiplier;
}

/**
 * Get service life category for display
 */
export function getServiceLifeCategory(
  years: number
): 'short' | 'medium' | 'long' | 'permanent' {
  if (years <= 10) return 'short';
  if (years <= 25) return 'medium';
  if (years <= 50) return 'long';
  return 'permanent';
}

/**
 * Format service life for display
 */
export function formatServiceLife(years: number): string {
  if (years >= 100) return '100+ years';
  return `${years} years`;
}

/**
 * Get all durations for a set of materials
 * Returns a Map for easy lookup
 */
export function getDurationsForMaterials(
  materials: MaterialOption[]
): Map<string, LifecycleDuration> {
  const map = new Map<string, LifecycleDuration>();
  materials.forEach((m) => {
    map.set(m.id, getLifecycleDuration(m));
  });
  return map;
}

/**
 * Categorize materials by service life
 * Useful for grouping in reports
 */
export function categorizeMaterialsByLife(
  materials: MaterialOption[]
): {
  short: MaterialOption[];
  medium: MaterialOption[];
  long: MaterialOption[];
  permanent: MaterialOption[];
} {
  const result = {
    short: [] as MaterialOption[],
    medium: [] as MaterialOption[],
    long: [] as MaterialOption[],
    permanent: [] as MaterialOption[],
  };

  materials.forEach((m) => {
    const duration = getLifecycleDuration(m);
    const category = getServiceLifeCategory(duration.serviceLife);
    result[category].push(m);
  });

  return result;
}

/**
 * Get materials with carbon payback (for highlighting)
 */
export function getMaterialsWithPayback(
  materials: MaterialOption[]
): Array<{ material: MaterialOption; payback: CarbonPayback }> {
  return materials
    .map((m) => ({ material: m, payback: getCarbonPayback(m) }))
    .filter((x): x is { material: MaterialOption; payback: CarbonPayback } =>
      x.payback !== null
    );
}
