import { useCallback, useEffect, useRef, useState } from 'react';

export interface InactivityTimeoutConfig {
  /** Time in ms before showing warning (default: 4 hours) */
  warningTimeoutMs?: number;
  /** Time in ms after warning before auto-logout (default: 5 minutes) */
  logoutDelayMs?: number;
  /** Whether the timeout is enabled (default: true when authenticated) */
  enabled?: boolean;
  /** Callback when auto-logout is triggered */
  onLogout: () => void;
}

export interface InactivityTimeoutState {
  /** Whether the warning modal should be shown */
  showWarning: boolean;
  /** Seconds remaining until auto-logout (only valid when showWarning is true) */
  secondsRemaining: number;
  /** Dismiss the warning and reset the inactivity timer */
  dismissWarning: () => void;
  /** Manually trigger logout now */
  logoutNow: () => void;
}

// Default: 4 hours of inactivity before warning
const DEFAULT_WARNING_TIMEOUT_MS = 4 * 60 * 60 * 1000;
// Default: 5 minutes to respond to warning
const DEFAULT_LOGOUT_DELAY_MS = 5 * 60 * 1000;

// Events that indicate user activity
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

/**
 * Hook to track user inactivity and show a warning before auto-logout.
 *
 * Usage:
 * ```tsx
 * const { showWarning, secondsRemaining, dismissWarning, logoutNow } = useInactivityTimeout({
 *   enabled: isAuthenticated,
 *   onLogout: () => logout(),
 * });
 * ```
 */
export function useInactivityTimeout(config: InactivityTimeoutConfig): InactivityTimeoutState {
  const {
    warningTimeoutMs = DEFAULT_WARNING_TIMEOUT_MS,
    logoutDelayMs = DEFAULT_LOGOUT_DELAY_MS,
    enabled = true,
    onLogout,
  } = config;

  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const showWarningRef = useRef(false);

  useEffect(() => {
    showWarningRef.current = showWarning;
  }, [showWarning]);

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Start the warning timer
  const startWarningTimer = useCallback(() => {
    clearAllTimers();
    lastActivityRef.current = Date.now();

    warningTimerRef.current = setTimeout(() => {
      // Show warning and start countdown
      setShowWarning(true);
      setSecondsRemaining(Math.ceil(logoutDelayMs / 1000));

      // Start countdown interval
      countdownIntervalRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Set logout timer
      logoutTimerRef.current = setTimeout(() => {
        clearAllTimers();
        setShowWarning(false);
        onLogout();
      }, logoutDelayMs);
    }, warningTimeoutMs);
  }, [clearAllTimers, logoutDelayMs, warningTimeoutMs, onLogout]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    // Only reset timer if warning is not showing
    // (Activity during warning is handled by dismissWarning)
    if (!showWarningRef.current) {
      lastActivityRef.current = Date.now();
      startWarningTimer();
    }
  }, [startWarningTimer]);

  // Dismiss warning and reset timer
  const dismissWarning = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    setSecondsRemaining(0);
    startWarningTimer();
  }, [clearAllTimers, startWarningTimer]);

  // Logout immediately
  const logoutNow = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    setSecondsRemaining(0);
    onLogout();
  }, [clearAllTimers, onLogout]);

  // Set up activity listeners and initial timer
  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      setShowWarning(false);
      setSecondsRemaining(0);
      return;
    }

    // Start the warning timer
    startWarningTimer();

    // Add activity listeners
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Handle visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !showWarningRef.current) {
        // Check if we should have shown warning while tab was hidden
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= warningTimeoutMs) {
          // Immediately show warning
          setShowWarning(true);
          const remainingMs = Math.max(0, logoutDelayMs - (elapsed - warningTimeoutMs));
          setSecondsRemaining(Math.ceil(remainingMs / 1000));

          if (remainingMs <= 0) {
            // Already past logout time
            clearAllTimers();
            setShowWarning(false);
            setSecondsRemaining(0);
            onLogout();
          } else {
            // Start countdown for remaining time
            clearAllTimers();
            countdownIntervalRef.current = setInterval(() => {
              setSecondsRemaining(prev => (prev <= 1 ? 0 : prev - 1));
            }, 1000);
            logoutTimerRef.current = setTimeout(() => {
              clearAllTimers();
              setShowWarning(false);
              onLogout();
            }, remainingMs);
          }
        } else {
          // Reset timer with remaining time
          startWarningTimer();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    enabled,
    warningTimeoutMs,
    logoutDelayMs,
    onLogout,
    handleActivity,
    startWarningTimer,
    clearAllTimers,
  ]);

  return {
    showWarning,
    secondsRemaining,
    dismissWarning,
    logoutNow,
  };
}

export default useInactivityTimeout;
