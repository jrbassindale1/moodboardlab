import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, Loader2, AlertCircle, Search, RefreshCw } from 'lucide-react';
import { MaterialOption } from '../../types';
import { searchPrecedents, checkQuota, PrecedentResult } from '../../api';
import { useAuth, useUsage, isAuthBypassEnabled } from '../../auth';
import PrecedentCard from './PrecedentCard';
import {
  getFreeCreditsBlockedMessage,
  isFreeCreditsBlockedForNetwork,
} from '../../utils/freeCreditSupport';
import FreeCreditsBlockedNotice from '../FreeCreditsBlockedNotice';

interface FindPrecedentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  materials: MaterialOption[];
  onSave?: (precedents: PrecedentResult[]) => void;
}

const SEARCH_CREDIT_COST = 1;

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

interface SearchError {
  type: 'network' | 'no_results' | 'api_error' | 'rate_limit' | 'quota_exceeded' | 'auth_required';
  message: string;
}

const ERROR_MESSAGES: Record<SearchError['type'], string> = {
  network: 'Could not connect to the server. Please check your connection and try again.',
  no_results: 'No precedents found for these materials. Try adding different materials to your moodboard.',
  api_error: 'Something went wrong while searching. Please try again.',
  rate_limit: 'Search limit reached. Please wait a moment and try again.',
  quota_exceeded: 'Monthly generation limit reached. Your quota resets on the 1st of next month.',
  auth_required: 'Please sign in to search for precedents.',
};

const FindPrecedentsModal: React.FC<FindPrecedentsModalProps> = ({
  isOpen,
  onClose,
  materials,
  onSave,
}) => {
  const { isAuthenticated, getAccessToken } = useAuth();
  const { refreshUsage } = useUsage();
  const isLocalAdminBypassEnabled =
    typeof window !== 'undefined' && localStorage.getItem('moodboard_admin_bypass_enabled') === 'true';
  const isTestingEnvironment = Boolean(import.meta.env.DEV || isAuthBypassEnabled || isLocalAdminBypassEnabled);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [results, setResults] = useState<PrecedentResult[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [error, setError] = useState<SearchError | null>(null);
  const searchInFlightRef = useRef(false);

  const performSearch = useCallback(async () => {
    try {
      if (searchInFlightRef.current) {
        return;
      }
      // Check quota before searching
      if (!isAuthBypassEnabled && isAuthenticated) {
        const token = await getAccessToken();
        if (!token) {
          setError({ type: 'auth_required', message: ERROR_MESSAGES.auth_required });
          setStatus('error');
          return;
        }

        const quota = await checkQuota(token);
        if (
          isFreeCreditsBlockedForNetwork({
            freeCreditsBlocked: quota.freeCreditsBlocked,
          }) &&
          (quota.purchasedCredits || 0) < SEARCH_CREDIT_COST
        ) {
          setError({ type: 'quota_exceeded', message: getFreeCreditsBlockedMessage() });
          setStatus('error');
          return;
        }
        if (!quota.canGenerate) {
          setError({ type: 'quota_exceeded', message: ERROR_MESSAGES.quota_exceeded });
          setStatus('error');
          return;
        }
      }
      searchInFlightRef.current = true;

      if (materials.length === 0) {
        setError({ type: 'no_results', message: ERROR_MESSAGES.no_results });
        setStatus('error');
        return;
      }

      // Check authentication (unless bypass is enabled)
      if (!isTestingEnvironment && !isAuthenticated) {
        setError({ type: 'auth_required', message: ERROR_MESSAGES.auth_required });
        setStatus('error');
        return;
      }

      setStatus('loading');
      setError(null);
      setResults([]);

      try {
        let accessToken: string | null = null;
        if (isAuthenticated) {
          accessToken = await getAccessToken();
        }

        // Check quota before searching
        if (!isTestingEnvironment && isAuthenticated) {
          if (!accessToken) {
            setError({ type: 'auth_required', message: ERROR_MESSAGES.auth_required });
            setStatus('error');
            return;
          }

          const quota = await checkQuota(accessToken);
          if (!quota.canGenerate) {
            setError({ type: 'quota_exceeded', message: ERROR_MESSAGES.quota_exceeded });
            setStatus('error');
            return;
          }
        }

        // Perform the search
        const response = await searchPrecedents(materials, {
          maxResults: 12,
          accessToken,
        });
        setSearchQuery(response.query);

        if (response.results.length === 0) {
          setError({ type: 'no_results', message: ERROR_MESSAGES.no_results });
          setStatus('error');
          return;
        }

        // Credits are consumed server-side by the search endpoint.
        if (!isTestingEnvironment && isAuthenticated) {
          void refreshUsage();
        }

        setResults(response.results);
        setStatus('success');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        if (errorMessage === 'auth_required') {
          setError({ type: 'auth_required', message: ERROR_MESSAGES.auth_required });
        } else if (errorMessage === 'rate_limit') {
          setError({ type: 'rate_limit', message: ERROR_MESSAGES.rate_limit });
        } else if (errorMessage.includes('timed out') || errorMessage.includes('network')) {
          setError({ type: 'network', message: ERROR_MESSAGES.network });
        } else {
          setError({ type: 'api_error', message: ERROR_MESSAGES.api_error });
        }
        setStatus('error');
      }
    } finally {
      searchInFlightRef.current = false;
    }
  }, [materials, isTestingEnvironment, isAuthenticated, getAccessToken, refreshUsage]);

  // Trigger search when modal opens
  useEffect(() => {
    if (isOpen && status === 'idle') {
      performSearch();
    }
  }, [isOpen, status, performSearch]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setResults([]);
      setError(null);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 px-4 py-4 sm:py-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-6xl bg-white shadow-2xl my-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5" />
            <div className="font-display uppercase tracking-widest text-base">
              Find Precedents
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* Search info */}
          {searchQuery && status === 'success' && (
            <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-500 font-mono">
                Found {results.length} precedents from ArchDaily, Dezeen, Architizer, and Designboom
              </p>
              <button
                onClick={performSearch}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-black transition-colors font-mono uppercase tracking-wider"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh (1 credit)
              </button>
            </div>
          )}

          {/* Loading state */}
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <p className="text-sm text-gray-600 font-sans">
                Searching for architectural precedents...
              </p>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && error && (
            isFreeCreditsBlockedForNetwork({ message: error.message }) ? (
              <div className="py-8">
                <FreeCreditsBlockedNotice isAuthenticated={isAuthenticated} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <AlertCircle className="w-8 h-8 text-gray-400" />
                <p className="text-sm text-gray-600 font-sans text-center max-w-md">
                  {error.message}
                </p>
                {error.type !== 'no_results' && error.type !== 'quota_exceeded' && error.type !== 'auth_required' && (
                  <button
                    onClick={performSearch}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 font-mono text-[11px] uppercase tracking-widest hover:bg-black hover:text-white hover:border-black transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Try Again
                  </button>
                )}
              </div>
            )
          )}

          {/* Results grid */}
          {status === 'success' && results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {results.map((precedent) => (
                <PrecedentCard key={precedent.id} precedent={precedent} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {status === 'success' && results.length > 0 && (
          <div className="border-t border-gray-200 px-4 sm:px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 text-gray-700 font-mono text-[11px] uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onSave?.(results);
                onClose();
              }}
              className="px-4 py-2 bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-800 transition-colors"
            >
              Save & Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FindPrecedentsModal;
