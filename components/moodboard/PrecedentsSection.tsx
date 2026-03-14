import React, { useState, useCallback } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { MaterialOption } from '../../types';
import { searchPrecedents, consumeCredits, checkQuota, PrecedentResult } from '../../api';
import { useAuth, useUsage, isAuthBypassEnabled } from '../../auth';
import PrecedentCard from './PrecedentCard';

interface PrecedentsSectionProps {
  materials: MaterialOption[];
  savedPrecedents: PrecedentResult[] | null;
  onPrecedentsChange: (precedents: PrecedentResult[] | null) => void;
}

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

const SEARCH_CREDIT_COST = 1;

const PrecedentsSection: React.FC<PrecedentsSectionProps> = ({
  materials,
  savedPrecedents,
  onPrecedentsChange,
}) => {
  const { isAuthenticated, getAccessToken } = useAuth();
  const { refreshUsage } = useUsage();
  const [isExpanded, setIsExpanded] = useState(true);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [results, setResults] = useState<PrecedentResult[]>([]);
  const [error, setError] = useState<SearchError | null>(null);

  const performSearch = useCallback(async () => {
    if (materials.length === 0) {
      setError({ type: 'no_results', message: ERROR_MESSAGES.no_results });
      setStatus('error');
      return;
    }

    // Check authentication (unless bypass is enabled)
    if (!isAuthBypassEnabled && !isAuthenticated) {
      setError({ type: 'auth_required', message: ERROR_MESSAGES.auth_required });
      setStatus('error');
      return;
    }

    setStatus('loading');
    setError(null);
    setResults([]);

    try {
      // Check quota before searching
      if (!isAuthBypassEnabled && isAuthenticated) {
        const token = await getAccessToken();
        if (!token) {
          setError({ type: 'auth_required', message: ERROR_MESSAGES.auth_required });
          setStatus('error');
          return;
        }

        const quota = await checkQuota(token);
        if (!quota.canGenerate) {
          setError({ type: 'quota_exceeded', message: ERROR_MESSAGES.quota_exceeded });
          setStatus('error');
          return;
        }
      }

      // Perform the search
      const response = await searchPrecedents(materials, { maxResults: 12 });

      if (response.results.length === 0) {
        setError({ type: 'no_results', message: ERROR_MESSAGES.no_results });
        setStatus('error');
        return;
      }

      // Consume credits after successful search
      if (!isAuthBypassEnabled && isAuthenticated) {
        try {
          const token = await getAccessToken();
          if (token) {
            await consumeCredits(token, {
              generationType: 'precedentSearch',
              credits: SEARCH_CREDIT_COST,
              reason: 'precedent-search',
            });
            await refreshUsage();
          }
        } catch (err) {
          console.error('Failed to consume credits:', err);
          // Don't fail the search if credit consumption fails
        }
      }

      setResults(response.results);
      setStatus('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      if (errorMessage === 'rate_limit') {
        setError({ type: 'rate_limit', message: ERROR_MESSAGES.rate_limit });
      } else if (errorMessage.includes('timed out') || errorMessage.includes('network')) {
        setError({ type: 'network', message: ERROR_MESSAGES.network });
      } else {
        setError({ type: 'api_error', message: ERROR_MESSAGES.api_error });
      }
      setStatus('error');
    }
  }, [materials, isAuthenticated, getAccessToken, refreshUsage]);

  const handleSaveResults = () => {
    onPrecedentsChange(results);
    setResults([]);
    setStatus('idle');
  };

  const handleClearSaved = () => {
    onPrecedentsChange(null);
  };

  const hasMaterials = materials.length > 0;
  const hasSearchResults = status === 'success' && results.length > 0;
  const hasSavedPrecedents = savedPrecedents && savedPrecedents.length > 0;

  return (
    <section className="border border-gray-200 bg-white">
      {/* Header */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4" />
          <span className="font-mono text-[11px] uppercase tracking-widest">
            Precedents
            {hasSavedPrecedents && ` (${savedPrecedents.length} saved)`}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Search action bar */}
          <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2 bg-gray-50 border-b border-gray-200">
            <p className="text-xs text-gray-600 font-sans">
              Search ArchDaily, Dezeen, Architizer, and Designboom for buildings using similar materials.
            </p>
            <div className="flex items-center gap-2">
              {hasSavedPrecedents && (
                <button
                  onClick={handleClearSaved}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors font-mono uppercase tracking-wider"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Saved
                </button>
              )}
              <button
                onClick={performSearch}
                disabled={!hasMaterials || status === 'loading'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Searching
                  </>
                ) : (
                  <>
                    <Search className="w-3 h-3" />
                    Search (1 credit)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Content area */}
          <div className="p-4">
            {/* Loading state */}
            {status === 'loading' && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                <p className="text-sm text-gray-600 font-sans">
                  Searching for architectural precedents...
                </p>
              </div>
            )}

            {/* Error state */}
            {status === 'error' && error && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
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
            )}

            {/* Search results */}
            {hasSearchResults && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-gray-500 font-mono">
                    Found {results.length} precedents
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={performSearch}
                      className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-black transition-colors font-mono uppercase tracking-wider"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Refresh
                    </button>
                    <button
                      onClick={handleSaveResults}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-mono uppercase tracking-wider hover:bg-gray-800 transition-colors"
                    >
                      Save Results
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.map((precedent) => (
                    <PrecedentCard key={precedent.id} precedent={precedent} />
                  ))}
                </div>
              </div>
            )}

            {/* Saved precedents */}
            {!hasSearchResults && hasSavedPrecedents && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-gray-500 font-mono">
                    {savedPrecedents.length} saved precedents
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedPrecedents.map((precedent) => (
                    <PrecedentCard key={precedent.id} precedent={precedent} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {status === 'idle' && !hasSavedPrecedents && (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <Search className="w-8 h-8 text-gray-300" />
                <div>
                  <p className="text-sm text-gray-600 font-sans mb-1">
                    No precedents yet
                  </p>
                  <p className="text-xs text-gray-400 font-sans">
                    {hasMaterials
                      ? 'Click "Search" to find buildings using similar materials'
                      : 'Add materials to your moodboard, then search for precedents'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default PrecedentsSection;
