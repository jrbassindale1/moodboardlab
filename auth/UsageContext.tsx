import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { getUsage, checkQuota } from '../api';

const FREE_MONTHLY_LIMIT = 10;
const ANONYMOUS_DAILY_LIMIT = 3;
const ANONYMOUS_QUOTA_KEY = 'moodboard_anon_quota';

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
  incrementLocalUsage: () => void;
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

// Helper for anonymous user quota tracking (localStorage)
function getAnonymousQuota(): { count: number; date: string } {
  try {
    const stored = localStorage.getItem(ANONYMOUS_QUOTA_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      const today = new Date().toISOString().split('T')[0];
      if (data.date === today) {
        return data;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return { count: 0, date: new Date().toISOString().split('T')[0] };
}

function setAnonymousQuota(count: number): void {
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem(ANONYMOUS_QUOTA_KEY, JSON.stringify({ count, date: today }));
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
  const incrementLocalUsage = useCallback(() => {
    if (!isAuthenticated) {
      const newCount = anonymousCount + 1;
      setAnonymousCount(newCount);
      setAnonymousQuota(newCount);
    }
  }, [isAuthenticated, anonymousCount]);

  // Calculate remaining and limits based on auth state
  const isAnonymous = !isAuthenticated;
  const limit = isAnonymous ? ANONYMOUS_DAILY_LIMIT : FREE_MONTHLY_LIMIT;
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
