import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { getUsage, checkQuota, confirmCheckoutSession } from '../api';

type GenerationType = 'moodboard' | 'applyMaterials' | 'upscale' | 'materialIcon' | 'sustainabilityBriefing';

// Generation types that don't count towards the user's free limit
const FREE_GENERATION_TYPES: GenerationType[] = ['materialIcon'];

const FREE_MONTHLY_LIMIT = 10;
const ANONYMOUS_MONTHLY_LIMIT = 10;
const ANONYMOUS_QUOTA_KEY = 'moodboard_anon_quota_monthly_v1';

export interface UsageData {
  moodboard: number;
  applyMaterials: number;
  upscale: number;
  materialIcon: number;
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
}

const UsageContext = createContext<UsageContextType | null>(null);

export const useUsage = (): UsageContextType => {
  const context = useContext(UsageContext);
  if (!context) {
    throw new Error('useUsage must be used within a UsageProvider');
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
  const processedCheckoutSessionsRef = useRef<Set<string>>(new Set());

  // Fetch usage from server for authenticated users
  const refreshUsage = useCallback(async () => {
    if (!isAuthenticated) {
      // For anonymous users, use localStorage
      const quota = getAnonymousQuota();
      setAnonymousCount(quota.count);
      setUsage(null);
      setPurchasedCredits(0);
      setFreeRemaining(Math.max(0, ANONYMOUS_MONTHLY_LIMIT - quota.count));
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
    if (typeof window === 'undefined' || authLoading || !isAuthenticated) {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const creditsPurchased = currentUrl.searchParams.get('credits_purchased') === 'true';
    const sessionId = currentUrl.searchParams.get('session_id')?.trim() || '';

    if (!creditsPurchased || !sessionId || processedCheckoutSessionsRef.current.has(sessionId)) {
      return;
    }

    processedCheckoutSessionsRef.current.add(sessionId);
    let cancelled = false;

    const clearCheckoutParams = () => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('credits_purchased');
      nextUrl.searchParams.delete('credits_cancelled');
      nextUrl.searchParams.delete('session_id');
      window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    };

    const confirmPurchase = async () => {
      let shouldClearParams = false;

      try {
        const token = await getAccessToken();
        if (!token) {
          processedCheckoutSessionsRef.current.delete(sessionId);
          return;
        }

        await confirmCheckoutSession(token, sessionId);
        shouldClearParams = true;

        if (!cancelled) {
          await refreshUsage();
        }
      } catch (error) {
        processedCheckoutSessionsRef.current.delete(sessionId);
        console.error('Failed to confirm credit purchase:', error);
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
    : freeRemaining + purchasedCredits;
  const canGenerate = remaining > 0;

  return (
    <UsageContext.Provider
      value={{
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
      }}
    >
      {children}
    </UsageContext.Provider>
  );
};

export default UsageProvider;
