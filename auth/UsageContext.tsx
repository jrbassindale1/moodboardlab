import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { getUsage, checkQuota, confirmCheckoutSession } from '../api';

type GenerationType = 'moodboard' | 'applyMaterials' | 'upscale' | 'materialIcon' | 'materialDetection' | 'sustainabilityBriefing';

// Generation types that don't count towards the user's free limit
// materialIcon is admin-only and doesn't use credits at all
const FREE_GENERATION_TYPES: GenerationType[] = [];

const FREE_MONTHLY_LIMIT = 10;
const ANONYMOUS_MONTHLY_LIMIT = 10;
const ANONYMOUS_QUOTA_KEY = 'moodboard_anon_quota_monthly_v1';

export interface UsageData {
  moodboard: number;
  applyMaterials: number;
  upscale: number;
  materialIcon: number;
  materialDetection: number;
  sustainabilityBriefing: number;
  total: number;
  yearMonth?: string;
}

export interface QuotaData {
  canGenerate: boolean;
  remaining: number;
  limit: number;
  used: number;
  freeRemaining?: number;
  purchasedCredits?: number;
  isAdmin?: boolean;
}

export interface CheckoutStatusNotice {
  type: 'success' | 'cancelled' | 'error' | 'processing';
  message: string;
}

interface UsageContextType {
  usage: UsageData | null;
  remaining: number;
  limit: number;
  isLoading: boolean;
  refreshUsage: () => Promise<void>;
  canGenerate: boolean;
  incrementLocalUsage: (count?: number, generationType?: GenerationType) => void;
  isAnonymous: boolean;
  purchasedCredits: number;
  freeRemaining: number;
  isAdmin: boolean;
  checkoutStatus: CheckoutStatusNotice | null;
  dismissCheckoutStatus: () => void;
}

const UsageContext = createContext<UsageContextType | null>(null);

const FALLBACK_USAGE_CONTEXT: UsageContextType = {
  usage: null,
  remaining: ANONYMOUS_MONTHLY_LIMIT,
  limit: 10,
  isLoading: false,
  refreshUsage: async () => {},
  canGenerate: true,
  incrementLocalUsage: () => {},
  isAnonymous: true,
  purchasedCredits: 0,
  freeRemaining: ANONYMOUS_MONTHLY_LIMIT,
  isAdmin: false,
  checkoutStatus: null,
  dismissCheckoutStatus: () => {},
};

export const useUsage = (): UsageContextType => {
  const context = useContext(UsageContext);
  if (!context) {
    console.error('useUsage called outside UsageProvider; using fallback usage context.');
    return FALLBACK_USAGE_CONTEXT;
  }
  return context;
};

const getCurrentYearMonth = (): string => new Date().toISOString().slice(0, 7);

// Helper for anonymous user quota tracking (localStorage, monthly window)
function getAnonymousQuota(): { count: number; yearMonth: string } {
  try {
    const stored = localStorage.getItem(ANONYMOUS_QUOTA_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      const currentYearMonth = getCurrentYearMonth();
      if (data.yearMonth === currentYearMonth) {
        return data;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return { count: 0, yearMonth: getCurrentYearMonth() };
}

function setAnonymousQuota(count: number): void {
  const yearMonth = getCurrentYearMonth();
  localStorage.setItem(ANONYMOUS_QUOTA_KEY, JSON.stringify({ count, yearMonth }));
}

interface UsageProviderProps {
  children: ReactNode;
}

export const UsageProvider: React.FC<UsageProviderProps> = ({ children }) => {
  const { isAuthenticated, getAccessToken, isLoading: authLoading } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [anonymousCount, setAnonymousCount] = useState(0);
  const [purchasedCredits, setPurchasedCredits] = useState(0);
  const [freeRemaining, setFreeRemaining] = useState(FREE_MONTHLY_LIMIT);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatusNotice | null>(null);
  const processedCheckoutSessionsRef = useRef<Set<string>>(new Set());

  const dismissCheckoutStatus = useCallback(() => {
    setCheckoutStatus(null);
  }, []);

  // Fetch usage from server for authenticated users
  const refreshUsage = useCallback(async () => {
    if (!isAuthenticated) {
      // For anonymous users, use localStorage
      const quota = getAnonymousQuota();
      setAnonymousCount(quota.count);
      setUsage(null);
      setPurchasedCredits(0);
      setFreeRemaining(Math.max(0, ANONYMOUS_MONTHLY_LIMIT - quota.count));
      setIsAdmin(false);
      return;
    }

    setIsLoading(true);
    try {
      const token = await getAccessToken();
      if (token) {
        // Fetch both usage details and quota (which includes purchased credits)
        const [usageData, quotaData] = await Promise.all([
          getUsage(token),
          checkQuota(token),
        ]);
        setUsage(usageData);
        setPurchasedCredits(quotaData.purchasedCredits || 0);
        setFreeRemaining(quotaData.freeRemaining ?? Math.max(0, FREE_MONTHLY_LIMIT - usageData.total));
        setIsAdmin(Boolean(quotaData.isAdmin));
      }
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAccessToken]);

  // Refresh usage when auth state changes
  useEffect(() => {
    if (!authLoading) {
      refreshUsage();
    }
  }, [isAuthenticated, authLoading, refreshUsage]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const creditsCancelled = currentUrl.searchParams.get('credits_cancelled') === 'true';
    const creditsPurchased = currentUrl.searchParams.get('credits_purchased') === 'true';
    const rawSessionId = currentUrl.searchParams.get('session_id')?.trim() || '';
    // Validate session ID format - Stripe session IDs start with cs_ (or cs_test_ in test mode)
    const sessionId = rawSessionId.startsWith('cs_') ? rawSessionId : '';

    const clearCheckoutParams = () => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('credits_purchased');
      nextUrl.searchParams.delete('credits_cancelled');
      nextUrl.searchParams.delete('session_id');
      window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    };

    if (creditsCancelled) {
      setCheckoutStatus({
        type: 'cancelled',
        message: 'Credit purchase cancelled. No charges were made.',
      });
      clearCheckoutParams();
      return;
    }

    if (!creditsPurchased || !sessionId || processedCheckoutSessionsRef.current.has(sessionId)) {
      return;
    }

    if (authLoading) {
      setCheckoutStatus({
        type: 'processing',
        message: 'Confirming your credit purchase...',
      });
      return;
    }

    if (!isAuthenticated) {
      setCheckoutStatus({
        type: 'error',
        message: 'Payment completed, but you need to sign in again to refresh your credits.',
      });
      return;
    }

    processedCheckoutSessionsRef.current.add(sessionId);
    let cancelled = false;
    setCheckoutStatus({
      type: 'processing',
      message: 'Confirming your credit purchase...',
    });

    const confirmPurchase = async () => {
      let shouldClearParams = false;

      try {
        const token = await getAccessToken();
        if (!token) {
          processedCheckoutSessionsRef.current.delete(sessionId);
          if (!cancelled) {
            setCheckoutStatus({
              type: 'error',
              message: 'Payment completed, but you need to sign in again to refresh your credits.',
            });
          }
          return;
        }

        const result = await confirmCheckoutSession(token, sessionId);
        shouldClearParams = true;

        if (!cancelled) {
          await refreshUsage();
          setCheckoutStatus({
            type: 'success',
            message: result.alreadyProcessed
              ? 'Credits are already available on your account.'
              : 'Credits added to your account.',
          });
        }
      } catch (error) {
        processedCheckoutSessionsRef.current.delete(sessionId);
        console.error('Failed to confirm credit purchase:', error);
        if (!cancelled) {
          setCheckoutStatus({
            type: 'error',
            message: 'Payment completed, but credit confirmation is still pending. Refresh in a moment.',
          });
        }
      } finally {
        if (!cancelled && shouldClearParams) {
          clearCheckoutParams();
        }
      }
    };

    void confirmPurchase();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, getAccessToken, refreshUsage]);

  // Increment local anonymous usage (skips free generation types like materialIcon)
  const incrementLocalUsage = useCallback((count = 1, generationType?: GenerationType) => {
    if (!isAuthenticated) {
      // Skip counting for free generation types
      if (generationType && FREE_GENERATION_TYPES.includes(generationType)) {
        return;
      }
      const incrementBy = Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1;
      const newCount = anonymousCount + incrementBy;
      setAnonymousCount(newCount);
      setAnonymousQuota(newCount);
    }
  }, [isAuthenticated, anonymousCount]);

  // Calculate remaining and limits based on auth state
  const isAnonymous = !isAuthenticated;
  const limit = isAnonymous ? ANONYMOUS_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT;
  const used = isAnonymous ? anonymousCount : (usage?.total ?? 0);
  // Total remaining = free remaining + purchased credits
  const remaining = isAnonymous
    ? Math.max(0, limit - used)
    : isAdmin
    ? 999999
    : freeRemaining + purchasedCredits;
  const canGenerate = isAdmin || remaining > 0;
  const contextValue = useMemo<UsageContextType>(() => ({
    usage,
    remaining,
    limit,
    isLoading,
    refreshUsage,
    canGenerate,
    incrementLocalUsage,
    isAnonymous,
    purchasedCredits,
    freeRemaining,
    isAdmin,
    checkoutStatus,
    dismissCheckoutStatus,
  }), [
    canGenerate,
    checkoutStatus,
    dismissCheckoutStatus,
    freeRemaining,
    incrementLocalUsage,
    isAdmin,
    isAnonymous,
    isLoading,
    limit,
    purchasedCredits,
    refreshUsage,
    remaining,
    usage,
  ]);

  return (
    <UsageContext.Provider value={contextValue}>
      {children}
    </UsageContext.Provider>
  );
};

export default UsageProvider;
