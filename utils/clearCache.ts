import {
  clearSessionData,
  clearUserData,
  clearGlobalSensitiveKeys,
  getCurrentUserId,
} from './storageManager';

/**
 * @deprecated Use storageManager.clearAllStorage() instead.
 * This function is kept for backward compatibility.
 * Clears all moodboard-related data from both sessionStorage and localStorage.
 * Called on logout to ensure user data doesn't persist across accounts.
 */
export const clearMoodboardCache = (): void => {
  if (typeof window === 'undefined') return;

  try {
    // Clear sessionStorage (auto-clears on browser close anyway)
    clearSessionData();

    // Clear user-scoped localStorage
    const userId = getCurrentUserId();
    if (userId) {
      clearUserData(userId);
    }

    // Clear sensitive global keys (admin bypass, cached user data, etc.)
    clearGlobalSensitiveKeys();
  } catch {
    // Ignore storage errors
  }
};

