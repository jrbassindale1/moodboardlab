// Lifecycle fingerprint types and profiles
// Data now loaded from JSON files for easier database migration

import {
  getLifecycleProfiles,
  getLifecycleProfile as getProfileFromData,
  hasLifecycleProfile as hasProfileFromData,
  getProfiledMaterialIds,
} from './data';

// ============================================================================
// TYPE EXPORTS (preserved for backward compatibility)
// ============================================================================

export type LifecycleStageKey =
  | 'raw'
  | 'manufacturing'
  | 'transport'
  | 'installation'
  | 'inUse'
  | 'maintenance'
  | 'endOfLife';

export type Confidence = 'high' | 'medium' | 'low';

export type LifecycleStageScore = {
  impact: 1 | 2 | 3 | 4 | 5;
  confidence?: Confidence;
};

export type LifecycleProfile = Record<LifecycleStageKey, LifecycleStageScore>;

// ============================================================================
// DATA ACCESS (loaded from JSON via data loader)
// ============================================================================

/**
 * Get the lifecycle profiles map
 * Lazily loaded from JSON data
 */
function getProfilesMap(): Map<string, LifecycleProfile> {
  return getLifecycleProfiles() as Map<string, LifecycleProfile>;
}

/**
 * Lifecycle profiles for materials
 * @deprecated Use getLifecycleProfile() function instead for better performance
 */
export const MATERIAL_LIFECYCLE_PROFILES: Record<string, LifecycleProfile> =
  new Proxy({} as Record<string, LifecycleProfile>, {
    get(_, key: string) {
      return getProfilesMap().get(key);
    },
    has(_, key: string) {
      return getProfilesMap().has(key);
    },
    ownKeys() {
      return Array.from(getProfilesMap().keys());
    },
    getOwnPropertyDescriptor(_, key: string) {
      if (getProfilesMap().has(key)) {
        return {
          enumerable: true,
          configurable: true,
          value: getProfilesMap().get(key),
        };
      }
      return undefined;
    },
  });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a material has a lifecycle profile
 */
export function hasLifecycleProfile(materialId: string): boolean {
  return hasProfileFromData(materialId);
}

/**
 * Get lifecycle profile for a material, returns null if not found
 */
export function getLifecycleProfile(materialId: string): LifecycleProfile | null {
  const profile = getProfileFromData(materialId);
  return profile ? (profile as LifecycleProfile) : null;
}

/**
 * Get all material IDs that have lifecycle profiles
 */
export function getProfileIds(): Set<string> {
  return new Set(getProfiledMaterialIds());
}
