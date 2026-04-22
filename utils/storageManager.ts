/**
 * Unified Storage Manager
 *
 * Manages both sessionStorage (current session) and localStorage (user preferences)
 * with automatic user ID scoping for localStorage.
 *
 * sessionStorage: Auto-clears on browser close, survives page refresh
 * localStorage: User-scoped keys, cleared on logout
 */

let currentUserId: string | null = null;

/**
 * Set the current user ID for localStorage scoping
 */
export function setCurrentUserId(userId: string | null): void {
  currentUserId = userId;
}

/**
 * Get the current user ID
 */
export function getCurrentUserId(): string | null {
  return currentUserId;
}

// ============================================
// SESSION STORAGE (Current Session, Temp Work)
// ============================================

/**
 * Store data in sessionStorage (auto-clears on browser close, survives refresh)
 */
export function setSessionData<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to write to sessionStorage (${key}):`, err);
  }
}

/**
 * Retrieve data from sessionStorage
 */
export function getSessionData<T>(key: string): T | null {
  try {
    const item = sessionStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (err) {
    console.error(`Failed to read from sessionStorage (${key}):`, err);
    return null;
  }
}

/**
 * Remove specific key from sessionStorage
 */
export function removeSessionData(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch (err) {
    console.error(`Failed to remove from sessionStorage (${key}):`, err);
  }
}

/**
 * Clear all sessionStorage (useful on logout, though browser auto-clears on close)
 */
export function clearSessionData(): void {
  try {
    sessionStorage.clear();
  } catch (err) {
    console.error('Failed to clear sessionStorage:', err);
  }
}

// ============================================
// LOCAL STORAGE (User Preferences, User-Scoped)
// ============================================

/**
 * Generate user-scoped localStorage key
 * Format: `user_{userId}::{baseKey}`
 */
function getUserScopedKey(baseKey: string, userId?: string): string {
  const uid = userId || currentUserId;
  if (!uid) {
    console.warn(`No user ID available for localStorage key: ${baseKey}`);
    return `${baseKey}`; // Fallback to unscopedkey if no user
  }
  return `user_${uid}::${baseKey}`;
}

/**
 * Store user preference in localStorage (user-scoped)
 * Only use for preferences that should persist across sessions for a specific user
 */
export function setUserPreference<T>(baseKey: string, value: T, userId?: string): void {
  try {
    const key = getUserScopedKey(baseKey, userId);
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to write user preference (${baseKey}):`, err);
  }
}

/**
 * Retrieve user preference from localStorage (user-scoped)
 */
export function getUserPreference<T>(baseKey: string, userId?: string): T | null {
  try {
    const key = getUserScopedKey(baseKey, userId);
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (err) {
    console.error(`Failed to read user preference (${baseKey}):`, err);
    return null;
  }
}

/**
 * Remove specific user preference from localStorage
 */
export function removeUserPreference(baseKey: string, userId?: string): void {
  try {
    const key = getUserScopedKey(baseKey, userId);
    localStorage.removeItem(key);
  } catch (err) {
    console.error(`Failed to remove user preference (${baseKey}):`, err);
  }
}

/**
 * Clear all user-scoped data from localStorage for a specific user
 * Called on logout to prevent data leak to next user
 */
export function clearUserData(userId: string): void {
  try {
    const prefix = `user_${userId}::`;
    const keysToRemove: string[] = [];

    // Find all keys belonging to this user
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    // Remove all user's keys
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} localStorage entries for user ${userId}`);
  } catch (err) {
    console.error(`Failed to clear user data for ${userId}:`, err);
  }
}

/**
 * Clear all temporary storage on logout
 * sessionStorage will auto-clear on browser close anyway, but clear it explicitly
 */
export function clearAllStorage(): void {
  try {
    // Clear sessionStorage (auto-clears on browser close, but be explicit)
    clearSessionData();

    // Clear user-scoped localStorage
    if (currentUserId) {
      clearUserData(currentUserId);
    }
  } catch (err) {
    console.error('Failed to clear all storage:', err);
  }
}

// ============================================
// LEGACY SUPPORT (Backward compatibility)
// ============================================

/**
 * Migrate old localStorage keys to sessionStorage
 * Call this once during app initialization to clean up old data
 */
export function migrateOldStorageKeys(): void {
  const oldKeys = [
    'moodboard_selected_materials_v1',
    'moodboard_render_url_v1',
    'moodboard_applied_url_v1',
    'moodboard_apply_state_v1',
    'moodboard_sustainability_briefing_v1',
  ];

  oldKeys.forEach(oldKey => {
    try {
      const value = localStorage.getItem(oldKey);
      if (value) {
        // Move to sessionStorage
        sessionStorage.setItem(oldKey, value);
        // Remove from localStorage
        localStorage.removeItem(oldKey);
        console.log(`Migrated ${oldKey} from localStorage to sessionStorage`);
      }
    } catch (err) {
      console.error(`Failed to migrate ${oldKey}:`, err);
    }
  });
}
