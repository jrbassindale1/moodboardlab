/**
 * Clears all moodboard-related data from localStorage.
 * Called on logout to ensure user data doesn't persist across accounts.
 */
export const clearMoodboardCache = (): void => {
  if (typeof window === 'undefined') return;

  const cacheKeys = [
    'moodboard_sustainability_briefing_v1',
    'moodboard_selected_materials_v1',
    'moodboard_render_url_v1',
    'moodboard_applied_url_v1',
    'moodboard_apply_state_v1',
    'moodboard_current_project_v1',
    'moodboard_project_counter_v1',
  ];

  cacheKeys.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  });
};
