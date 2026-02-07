/**
 * Data loader module
 * Imports JSON data files and provides type-safe access with validation
 * Designed for easy migration to a database in the future
 */

import type { MaterialCategory } from '../types';
import type { Confidence, CarbonPaybackCategory } from '../types/sustainability';

// ============================================================================
// TYPES (matching the existing TypeScript definitions)
// ============================================================================

export interface LifecycleStage {
  impact: 1 | 2 | 3 | 4 | 5;
  confidence: Confidence;
}

export interface LifecycleProfile {
  raw: LifecycleStage;
  manufacturing: LifecycleStage;
  transport: LifecycleStage;
  installation: LifecycleStage;
  inUse: LifecycleStage;
  maintenance: LifecycleStage;
  endOfLife: LifecycleStage;
}

export interface CarbonPayback {
  years: number;
  rangeYears?: [number, number];
  category: CarbonPaybackCategory;
  assumption: string;
}

export interface LifecycleDuration {
  serviceLife: number;
  replacementCycle: number;
  carbonPayback?: CarbonPayback;
  carbonPaybackNote?: string;
  replacementScope?: 'full' | 'partial';
  partialReplacementFactor?: number;
  notes?: string;
}

export interface MaterialDurationOverride {
  id: string;
  pattern: RegExp;
  categories?: MaterialCategory[];
  duration: LifecycleDuration;
}

export interface LandscapeConfig {
  materialIds: Set<string>;
  patterns: RegExp[];
  maintenanceFactor: number;
}

// ============================================================================
// JSON DATA IMPORTS
// ============================================================================

import lifecycleProfilesData from './lifecycleProfiles.json';
import categoryDurationsData from './categoryDurations.json';
import materialDurationsData from './materialDurations.json';
import lifecycleInsightsData from './lifecycleInsights.json';

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Load and validate lifecycle profiles from JSON
 */
function loadLifecycleProfiles(): Map<string, LifecycleProfile> {
  const profiles = new Map<string, LifecycleProfile>();

  const data = lifecycleProfilesData as {
    profiles: Record<string, LifecycleProfile>;
  };

  for (const [id, profile] of Object.entries(data.profiles)) {
    // Validate profile structure
    if (
      !profile.raw ||
      !profile.manufacturing ||
      !profile.transport ||
      !profile.installation ||
      !profile.inUse ||
      !profile.maintenance ||
      !profile.endOfLife
    ) {
      console.warn(`[DataLoader] Invalid lifecycle profile for ${id}, missing stages`);
      continue;
    }

    profiles.set(id, profile);
  }

  return profiles;
}

/**
 * Load category durations from JSON
 */
function loadCategoryDurations(): Record<MaterialCategory, LifecycleDuration> {
  const data = categoryDurationsData as {
    durations: Record<string, LifecycleDuration>;
  };

  return data.durations as Record<MaterialCategory, LifecycleDuration>;
}

/**
 * Load material duration overrides from JSON
 * Converts string patterns to RegExp objects
 */
function loadMaterialDurationOverrides(): MaterialDurationOverride[] {
  const data = materialDurationsData as {
    overrides: Array<{
      id: string;
      pattern: string;
      patternFlags?: string;
      categories?: MaterialCategory[];
      duration: LifecycleDuration;
    }>;
  };

  return data.overrides.map((override) => ({
    id: override.id,
    pattern: new RegExp(override.pattern, override.patternFlags || 'i'),
    categories: override.categories,
    duration: override.duration,
  }));
}

/**
 * Load landscape configuration from JSON
 * Converts string patterns to RegExp objects and array to Set
 */
function loadLandscapeConfig(): LandscapeConfig {
  const data = materialDurationsData as {
    landscapeConfig: {
      materialIds: string[];
      patterns: string[];
      maintenanceFactor: number;
    };
  };

  return {
    materialIds: new Set(data.landscapeConfig.materialIds),
    patterns: data.landscapeConfig.patterns.map((p) => new RegExp(p, 'i')),
    maintenanceFactor: data.landscapeConfig.maintenanceFactor,
  };
}

// ============================================================================
// CACHED DATA (loaded once at module initialization)
// ============================================================================

let _lifecycleProfiles: Map<string, LifecycleProfile> | null = null;
let _lifecycleInsights: Map<string, string> | null = null;
let _categoryDurations: Record<MaterialCategory, LifecycleDuration> | null = null;
let _materialDurationOverrides: MaterialDurationOverride[] | null = null;
let _landscapeConfig: LandscapeConfig | null = null;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Load lifecycle insights from JSON
 */
function loadLifecycleInsights(): Map<string, string> {
  const insights = new Map<string, string>();
  const data = lifecycleInsightsData as { insights: Record<string, string> };

  for (const [id, insight] of Object.entries(data.insights)) {
    insights.set(id, insight);
  }

  return insights;
}

/**
 * Get all lifecycle profiles
 * Lazy-loaded and cached
 */
export function getLifecycleProfiles(): Map<string, LifecycleProfile> {
  if (!_lifecycleProfiles) {
    _lifecycleProfiles = loadLifecycleProfiles();
  }
  return _lifecycleProfiles;
}

/**
 * Get lifecycle profile by material ID
 */
export function getLifecycleProfile(materialId: string): LifecycleProfile | undefined {
  return getLifecycleProfiles().get(materialId);
}

/**
 * Check if a lifecycle profile exists
 */
export function hasLifecycleProfile(materialId: string): boolean {
  return getLifecycleProfiles().has(materialId);
}

/**
 * Get all material IDs with lifecycle profiles
 */
export function getProfiledMaterialIds(): string[] {
  return Array.from(getLifecycleProfiles().keys());
}

/**
 * Get all lifecycle insights
 * Lazy-loaded and cached
 */
export function getLifecycleInsights(): Map<string, string> {
  if (!_lifecycleInsights) {
    _lifecycleInsights = loadLifecycleInsights();
  }
  return _lifecycleInsights;
}

/**
 * Get lifecycle insight for a material
 */
export function getLifecycleInsight(materialId: string): string | undefined {
  return getLifecycleInsights().get(materialId);
}

/**
 * Get category durations
 * Lazy-loaded and cached
 */
export function getCategoryDurations(): Record<MaterialCategory, LifecycleDuration> {
  if (!_categoryDurations) {
    _categoryDurations = loadCategoryDurations();
  }
  return _categoryDurations;
}

/**
 * Get duration for a specific category
 */
export function getCategoryDuration(category: MaterialCategory): LifecycleDuration {
  return getCategoryDurations()[category];
}

/**
 * Get material duration overrides
 * Lazy-loaded and cached
 */
export function getMaterialDurationOverrides(): MaterialDurationOverride[] {
  if (!_materialDurationOverrides) {
    _materialDurationOverrides = loadMaterialDurationOverrides();
  }
  return _materialDurationOverrides;
}

/**
 * Get landscape configuration
 * Lazy-loaded and cached
 */
export function getLandscapeConfig(): LandscapeConfig {
  if (!_landscapeConfig) {
    _landscapeConfig = loadLandscapeConfig();
  }
  return _landscapeConfig;
}

/**
 * Get counts for debugging/stats
 */
export function getDataStats(): {
  lifecycleProfiles: number;
  categoryDurations: number;
  materialOverrides: number;
  landscapeMaterialIds: number;
  landscapePatterns: number;
} {
  return {
    lifecycleProfiles: getLifecycleProfiles().size,
    categoryDurations: Object.keys(getCategoryDurations()).length,
    materialOverrides: getMaterialDurationOverrides().length,
    landscapeMaterialIds: getLandscapeConfig().materialIds.size,
    landscapePatterns: getLandscapeConfig().patterns.length,
  };
}

/**
 * Clear cached data (useful for testing or hot-reloading)
 */
export function clearCache(): void {
  _lifecycleProfiles = null;
  _lifecycleInsights = null;
  _categoryDurations = null;
  _materialDurationOverrides = null;
  _landscapeConfig = null;
}
