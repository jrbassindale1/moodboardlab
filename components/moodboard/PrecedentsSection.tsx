import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { MaterialOption } from '../../types';
import { searchPrecedents, enrichPrecedentImages, checkQuota, PrecedentResult, savePrecedents } from '../../api';
import { useAuth, useUsage, isAuthBypassEnabled } from '../../auth';
import PrecedentCard from './PrecedentCard';
import {
  getFreeCreditsBlockedMessage,
  isFreeCreditsBlockedForNetwork,
} from '../../utils/freeCreditSupport';
import FreeCreditsBlockedNotice from '../FreeCreditsBlockedNotice';

// Track which URLs are currently loading images
type ImageLoadingState = Set<string>;

interface PrecedentsSectionProps {
  materials: MaterialOption[];
  savedPrecedents: PrecedentResult[] | null;
  onPrecedentsChange: (precedents: PrecedentResult[] | null) => void;
  autoSearchTrigger?: number;
  onSearchComplete?: () => void;
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

const PrecedentsSection: React.FC<PrecedentsSectionProps> = ({
  materials,
  savedPrecedents,
  onPrecedentsChange,
  autoSearchTrigger,
  onSearchComplete,
}) => {
  const { isAuthenticated, getAccessToken } = useAuth();
  const { refreshUsage } = useUsage();
  const isLocalAdminBypassEnabled =
    typeof window !== 'undefined' && localStorage.getItem('moodboard_admin_bypass_enabled') === 'true';
  const isTestingEnvironment = Boolean(import.meta.env.DEV || isAuthBypassEnabled || isLocalAdminBypassEnabled);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [results, setResults] = useState<PrecedentResult[]>([]);
  const [error, setError] = useState<SearchError | null>(null);
  const [loadingImages, setLoadingImages] = useState<ImageLoadingState>(new Set());
  const lastAutoSearchTriggerRef = useRef(0);
  const searchInFlightRef = useRef(false);

  // Enrich precedents with images (Phase 2 of two-phase loading)
  const enrichWithImages = useCallback(async (
    precedents: PrecedentResult[],
    accessToken?: string | null
  ) => {
    const urlsNeedingImages = precedents
      .filter(p => p.imageUrl === null)
      .map(p => p.url);

    if (urlsNeedingImages.length === 0) return;

    // Mark all as loading
    setLoadingImages(new Set(urlsNeedingImages));

    try {
      const response = await enrichPrecedentImages(urlsNeedingImages, {
        timeoutMs: 30000,
        accessToken,
      });

      // Update results with fetched images
      setResults((prevResults: PrecedentResult[]) => {
        const imageMap = new Map(response.images.map(img => [img.url, img.imageUrl]));
        return prevResults.map((p: PrecedentResult) => {
          if (imageMap.has(p.url)) {
            return { ...p, imageUrl: imageMap.get(p.url) ?? null };
          }
          return p;
        });
      });
    } catch (err) {
      console.error('Failed to enrich images:', err);
      // Silently fail - cards will show placeholder
    } finally {
      setLoadingImages(new Set());
    }
  }, []);

  const performSearch = useCallback(async () => {
    try {
      if (searchInFlightRef.current) {
        return;
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
        onSearchComplete?.();

        // Phase 2: Lazy-load images in background
        void enrichWithImages(response.results, accessToken);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Precedent search error:', errorMessage, err);

        if (errorMessage === 'auth_required') {
          setError({ type: 'auth_required', message: ERROR_MESSAGES.auth_required });
        } else if (errorMessage === 'rate_limit') {
          setError({ type: 'rate_limit', message: ERROR_MESSAGES.rate_limit });
        } else if (errorMessage.includes('timed out') || errorMessage.includes('network') || errorMessage.includes('fetch')) {
          setError({ type: 'network', message: ERROR_MESSAGES.network });
        } else {
          setError({ type: 'api_error', message: ERROR_MESSAGES.api_error });
        }
        setStatus('error');
      }
    } finally {
      searchInFlightRef.current = false;
    }
  }, [materials, isTestingEnvironment, isAuthenticated, getAccessToken, refreshUsage, enrichWithImages]);

  const handleSaveResults = async () => {
    // Save to parent state (local)
    onPrecedentsChange(results);
    setResults([]);
    setStatus('idle');

    // Save to database if authenticated
    if (isAuthenticated && !isTestingEnvironment) {
      try {
        const token = await getAccessToken();
        if (token) {
          await savePrecedents(token, {
            precedents: results,
            materials: materials,
          });
        }
      } catch (err) {
        console.error('Failed to save precedents to database:', err);
        // Don't fail the UI operation if database save fails
      }
    }
  };

  const handleClearSaved = () => {
    onPrecedentsChange(null);
  };

  const hasMaterials = materials.length > 0;
  const hasSearchResults = status === 'success' && results.length > 0;
  const hasSavedPrecedents = savedPrecedents && savedPrecedents.length > 0;

  useEffect(() => {
    if (!autoSearchTrigger || autoSearchTrigger <= 0) return;
    if (autoSearchTrigger === lastAutoSearchTriggerRef.current) return;
    lastAutoSearchTriggerRef.current = autoSearchTrigger;
    void performSearch();
  }, [autoSearchTrigger]);

  return (
    <section className="border border-gray-200 bg-white">
      {/* Search action bar */}
      <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2 bg-gray-50 border-b border-gray-200">
        <p className="text-xs text-gray-600 font-sans">
          Search for buildings using similar materials.
        </p>
        <div className="flex items-center gap-2">
          {hasSavedPrecedents && (
            <button
              onClick={handleClearSaved}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors font-mono uppercase tracking-wider"
            >
              <Trash2 className="w-3 h-3" />
              Clear
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
                <PrecedentCard
                  key={precedent.id}
                  precedent={precedent}
                  isLoadingImage={loadingImages.has(precedent.url)}
                />
              ))}
            </div>
          </div>
        )}

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
              isFreeCreditsBlockedForNetwork({ message: error.message }) ? (
                <div className="py-8">
                  <FreeCreditsBlockedNotice isAuthenticated={isAuthenticated} />
                </div>
              ) : (
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
              )
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
    </section>
  );
};

export default PrecedentsSection;
