import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { getUsage } from '../api';

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

interface UsageContextType {
  usage: UsageData | null;
  remaining: number;
  limit: number;
  isLoading: boolean;
  refreshUsage: () => Promise<void>;
  canGenerate: boolean;
  incrementLocalUsage: (count?: number) => void;
  isAnonymous: boolean;
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

  // Fetch usage from server for authenticated users
  const refreshUsage = useCallback(async () => {
    if (!isAuthenticated) {
      // For anonymous users, use localStorage
      const quota = getAnonymousQuota();
      setAnonymousCount(quota.count);
      setUsage(null);
      return;
    }

    setIsLoading(true);
    try {
      const token = await getAccessToken();
      if (token) {
        const data = await getUsage(token);
        setUsage(data);
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

  // Increment local anonymous usage
  const incrementLocalUsage = useCallback((count = 1) => {
    if (!isAuthenticated) {
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
  const remaining = Math.max(0, limit - used);
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
      }}
    >
      {children}
    </UsageContext.Provider>
  );
};

export default UsageProvider;
