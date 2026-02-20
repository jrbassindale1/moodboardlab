import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useAuth, useUsage, isClerkAuthEnabled, isAuthBypassEnabled } from '../auth';
import { getGenerations } from '../api';
import type { MaterialOption } from '../types';
import { Calendar, Image, Loader2, LogIn, Download } from 'lucide-react';
import { trackEvent } from '../utils/analytics';

interface Generation {
  id: string;
  type: 'moodboard' | 'applyMaterials' | 'upscale' | 'materialIcon' | 'sustainabilityBriefing';
  blobUrl?: string;
  createdAt: string;
  prompt: string;
  materials?: unknown;
}

interface DashboardProps {
  onNavigate?: (page: string) => void;
  onRestoreGeneration?: (payload: {
    targetPage: 'moodboard' | 'apply';
    board: MaterialOption[];
    generationImageUrl: string | null;
    sourceType: Generation['type'];
  }) => void;
}

type BoardItemLike = {
  id?: string;
  name?: string;
  finish?: string;
};

const typeLabels: Record<string, string> = {
  moodboard: 'Moodboard',
  applyMaterials: 'Applied Materials',
  upscale: '4K Upscale',
  materialIcon: 'Material Icon',
  sustainabilityBriefing: 'Sustainability',
};
const STAGING_INSIGHTS_EMAIL = 'jrbassindale@yahoo.co.uk';
const LATEST_MOODBOARDS_LIMIT = 10;
const LATEST_MOODBOARDS_PAGE_SIZE = 50;
const LATEST_MOODBOARDS_MAX_PAGES = 5;
const PREVIEW_SAMPLE_BOARD: MaterialOption[] = [
  {
    id: 'preview-concrete',
    name: 'Concrete',
    tone: '#B4B4B0',
    finish: 'Smooth cast',
    description: 'Sample preview material for dashboard restore flow.',
    keywords: ['preview', 'concrete'],
    category: 'structure',
  },
  {
    id: 'preview-oak-floor',
    name: 'Oak flooring',
    tone: '#A88157',
    finish: 'Matte oil',
    description: 'Sample preview material for dashboard restore flow.',
    keywords: ['preview', 'timber', 'floor'],
    category: 'floor',
  },
  {
    id: 'preview-plaster',
    name: 'Lime plaster',
    tone: '#E7E1D6',
    finish: 'Fine trowel',
    description: 'Sample preview material for dashboard restore flow.',
    keywords: ['preview', 'plaster', 'wall'],
    category: 'wall-internal',
  },
];

const isPdfGeneration = (gen: Generation): boolean => {
  if (!gen.blobUrl) return false;
  const urlWithoutQuery = gen.blobUrl.split('?')[0];
  return urlWithoutQuery.toLowerCase().endsWith('.pdf');
};

type PdfBucket = 'materialsSheet' | 'sustainabilityBriefing';

const getPdfBucket = (gen: Generation): PdfBucket | null => {
  if (gen.type === 'materialIcon' || /materials sheet/i.test(gen.prompt || '')) {
    return 'materialsSheet';
  }
  if (gen.type === 'sustainabilityBriefing') {
    return 'sustainabilityBriefing';
  }
  return null;
};

const toTimestamp = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isNewerGeneration = (candidate: Generation, current?: Generation | null): boolean => {
  if (!current) return true;
  return toTimestamp(candidate.createdAt) > toTimestamp(current.createdAt);
};

const getBoardKey = (materials?: unknown): string | null => {
  if (!materials || typeof materials !== 'object') return null;
  const board = (materials as { board?: BoardItemLike[] }).board;
  if (!Array.isArray(board) || board.length === 0) return null;
  const parts = board
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const id = String(item.id || '');
      const name = String(item.name || '');
      const finish = String(item.finish || '');
      return `${id}|${name}|${finish}`;
    })
    .filter(Boolean)
    .sort();
  if (!parts.length) return null;
  return parts.join('::');
};

const toMaterialOption = (value: unknown): MaterialOption | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;

  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.filter((keyword): keyword is string => typeof keyword === 'string')
    : [];

  return {
    ...(raw as Partial<MaterialOption>),
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : 'Material',
    tone: typeof raw.tone === 'string' ? raw.tone : '#9ca3af',
    finish: typeof raw.finish === 'string' ? raw.finish : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    keywords,
    category: (typeof raw.category === 'string' ? raw.category : 'finish') as MaterialOption['category'],
  };
};

const extractBoardFromMaterials = (materials?: unknown): MaterialOption[] => {
  if (!materials || typeof materials !== 'object') return [];
  const board = (materials as { board?: unknown }).board;
  if (!Array.isArray(board)) return [];
  return board
    .map(toMaterialOption)
    .filter((item): item is MaterialOption => Boolean(item));
};

const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onRestoreGeneration }) => {
  const { user, isAuthenticated, getAccessToken } = useAuth();
  const { usage, remaining, limit } = useUsage();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [latestMoodboards, setLatestMoodboards] = useState<Generation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLatestMoodboardsLoading, setIsLatestMoodboardsLoading] = useState(false);
  const [latestMoodboardsError, setLatestMoodboardsError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const hasFetchedRef = useRef(false);
  const hasFetchedLatestMoodboardsRef = useRef(false);
  const limit_per_page = 12;
  const normalizedUserEmail = (user?.email || '').toLowerCase();
  const isPreviewMode = isAuthBypassEnabled && !isAuthenticated;
  const canAccessDashboard = isAuthenticated || isPreviewMode;
  const canViewStagingInsights = normalizedUserEmail === STAGING_INSIGHTS_EMAIL || isPreviewMode;
  const previewDisplayItems = useMemo(() => {
    if (!isPreviewMode) return [];
    const now = Date.now();
    const previewGenerations: Generation[] = [
      {
        id: 'preview-moodboard-1',
        type: 'moodboard',
        createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
        prompt: 'Preview moodboard generation',
        materials: { board: PREVIEW_SAMPLE_BOARD },
      },
      {
        id: 'preview-apply-1',
        type: 'applyMaterials',
        createdAt: new Date(now - 12 * 60 * 1000).toISOString(),
        prompt: 'Preview apply generation',
        materials: { board: PREVIEW_SAMPLE_BOARD },
      },
    ];

    return previewGenerations.map((gen) => ({ gen, attachments: [] as Generation[] }));
  }, [isPreviewMode]);

  const displayItems = useMemo(() => {
    const pdfByBoardKey = new Map<string, Map<PdfBucket, Generation>>();
    for (const gen of generations) {
      if (!isPdfGeneration(gen)) continue;
      const bucket = getPdfBucket(gen);
      if (!bucket) continue;
      const key = getBoardKey(gen.materials);
      if (!key) continue;
      if (!pdfByBoardKey.has(key)) {
        pdfByBoardKey.set(key, new Map());
      }
      const bucketMap = pdfByBoardKey.get(key)!;
      if (isNewerGeneration(gen, bucketMap.get(bucket))) {
        bucketMap.set(bucket, gen);
      }
    }

    return generations
      .filter((gen) => !isPdfGeneration(gen))
      .map((gen) => {
        let attachments: Generation[] = [];
        if (gen.type === 'moodboard') {
          const boardKey = getBoardKey(gen.materials);
          if (boardKey && pdfByBoardKey.has(boardKey)) {
            const bucketMap = pdfByBoardKey.get(boardKey);
            if (bucketMap) {
              const order: Record<PdfBucket, number> = {
                materialsSheet: 0,
                sustainabilityBriefing: 1,
              };
              attachments = Array.from(bucketMap.entries())
                .sort(([a], [b]) => order[a] - order[b])
                .map(([, item]) => item);
            }
            pdfByBoardKey.delete(boardKey);
          }
        }
        return { gen, attachments };
      });
  }, [generations]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      setGenerations([]);
      setHasMore(false);
      setOffset(0);
      hasFetchedRef.current = false;
      return;
    }

    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchGenerations = async () => {
      setIsLoading(true);
      try {
        const token = await getAccessToken();
        if (token) {
          const data = await getGenerations(token, { limit: limit_per_page, offset: 0 });
          setGenerations(data.items || []);
          setHasMore(data.hasMore || false);
          setOffset(limit_per_page);
        }
      } catch (error) {
        console.error('Failed to fetch generations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGenerations();
  }, [isAuthenticated, getAccessToken]);

  useEffect(() => {
    if (!isAuthenticated || !canViewStagingInsights) {
      setLatestMoodboards([]);
      setLatestMoodboardsError(null);
      setIsLatestMoodboardsLoading(false);
      hasFetchedLatestMoodboardsRef.current = false;
      return;
    }

    if (hasFetchedLatestMoodboardsRef.current) return;
    hasFetchedLatestMoodboardsRef.current = true;

    const fetchLatestMoodboards = async () => {
      setIsLatestMoodboardsLoading(true);
      setLatestMoodboardsError(null);
      try {
        const token = await getAccessToken();
        if (!token) {
          setLatestMoodboards([]);
          return;
        }

        const moodboards: Generation[] = [];
        let page = 0;
        let nextOffset = 0;
        let hasNextPage = true;

        while (
          hasNextPage &&
          moodboards.length < LATEST_MOODBOARDS_LIMIT &&
          page < LATEST_MOODBOARDS_MAX_PAGES
        ) {
          const data = await getGenerations(token, {
            limit: LATEST_MOODBOARDS_PAGE_SIZE,
            offset: nextOffset,
          });

          for (const item of data.items || []) {
            if (item.type !== 'moodboard') continue;
            moodboards.push(item);
            if (moodboards.length >= LATEST_MOODBOARDS_LIMIT) {
              break;
            }
          }

          hasNextPage = data.hasMore || false;
          nextOffset += LATEST_MOODBOARDS_PAGE_SIZE;
          page += 1;
        }

        setLatestMoodboards(moodboards);
      } catch (error) {
        console.error('Failed to fetch latest moodboards:', error);
        setLatestMoodboards([]);
        setLatestMoodboardsError('Could not load latest moodboards right now.');
      } finally {
        setIsLatestMoodboardsLoading(false);
      }
    };

    fetchLatestMoodboards();
  }, [isAuthenticated, canViewStagingInsights, getAccessToken]);

  const loadMore = async () => {
    if (!isAuthenticated || !hasMore) return;

    try {
      const token = await getAccessToken();
      if (token) {
        const data = await getGenerations(token, { limit: limit_per_page, offset });
        setGenerations((prev) => [...prev, ...(data.items || [])]);
        setHasMore(data.hasMore || false);
        setOffset((prev) => prev + limit_per_page);
      }
    } catch (error) {
      console.error('Failed to load more generations:', error);
    }
  };

  const handleRestoreGeneration = (gen: Generation) => {
    if (!onRestoreGeneration) return;
    const board = extractBoardFromMaterials(gen.materials);
    if (!board.length) return;

    const targetPage =
      gen.type === 'moodboard' ? 'moodboard' : gen.type === 'applyMaterials' || gen.type === 'upscale' ? 'apply' : null;
    if (!targetPage) return;

    onRestoreGeneration({
      targetPage,
      board,
      generationImageUrl: gen.blobUrl || null,
      sourceType: gen.type,
    });
  };

  if (!canAccessDashboard) {
    return (
      <div className="w-full min-h-screen pt-20 bg-white">
        <div className="max-w-screen-lg mx-auto px-6 py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <LogIn className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-tighter mb-4">
            Sign In Required
          </h1>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Sign in to view your dashboard, track your usage, and access your generation history.
          </p>
          {isClerkAuthEnabled ? (
            <SignInButton mode="modal">
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 transition-colors">
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            </SignInButton>
          ) : (
            <p className="text-gray-500 text-sm">Authentication not configured</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen pt-20 bg-white">
      <div className="max-w-screen-2xl mx-auto px-6 py-12 space-y-8">
        {isPreviewMode && (
          <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Preview mode: authentication is bypassed in this environment. Dashboard data is hidden, but layout and UI changes are visible.
          </div>
        )}

        {/* Header */}
        <div className="border-b border-gray-200 pb-6">
          <h1 className="font-display text-5xl font-bold uppercase tracking-tighter">
            Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Welcome back, {user?.name || 'User'}
          </p>
        </div>

        {/* Usage Stats */}
        <div className="grid md:grid-cols-4 gap-6">
          <div className="border border-gray-200 p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Remaining This Month
            </div>
            <div className="font-display text-4xl font-bold">
              {remaining}{' '}
              <span className="text-gray-400 text-2xl">/ {limit}</span>
            </div>
          </div>
          <div className="border border-gray-200 p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Moodboards
            </div>
            <div className="font-display text-4xl font-bold">
              {usage?.moodboard ?? 0}
            </div>
          </div>
          <div className="border border-gray-200 p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Applied Materials
            </div>
            <div className="font-display text-4xl font-bold">
              {usage?.applyMaterials ?? 0}
            </div>
          </div>
          <div className="border border-gray-200 p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Total This Month
            </div>
            <div className="font-display text-4xl font-bold">
              {usage?.total ?? 0}
            </div>
          </div>
        </div>

        {/* Generation History */}
        {canViewStagingInsights && (
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight mb-4">
              Latest 10 Moodboards ({STAGING_INSIGHTS_EMAIL})
            </h2>

            {isLatestMoodboardsLoading ? (
              <div className="flex items-center justify-center py-8 border border-gray-200">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : isPreviewMode ? (
              <div className="border border-dashed border-gray-300 p-6 text-sm text-gray-600">
                Preview mode active. Sign in with {STAGING_INSIGHTS_EMAIL} to load real moodboards.
              </div>
            ) : latestMoodboardsError ? (
              <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {latestMoodboardsError}
              </div>
            ) : latestMoodboards.length === 0 ? (
              <div className="border border-dashed border-gray-300 p-6 text-sm text-gray-600">
                No moodboards found for this account.
              </div>
            ) : (
              <div className="border border-gray-200 divide-y divide-gray-100">
                {latestMoodboards.map((moodboard, index) => (
                  <div key={moodboard.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                        Moodboard {index + 1}
                      </p>
                      <p className="text-sm text-gray-700 truncate">
                        {new Date(moodboard.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {moodboard.blobUrl ? (
                      <a
                        href={moodboard.blobUrl}
                        download
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400 shrink-0">No file</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Generation History */}
        <div>
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight mb-4">
            Recent Generations
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (isPreviewMode ? previewDisplayItems : displayItems).length === 0 ? (
            <div className="border border-dashed border-gray-300 p-8 text-center">
              <Image className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">{isPreviewMode ? 'No preview generations available.' : 'No generations yet.'}</p>
              <button
                onClick={() => onNavigate?.('moodboard')}
                className="px-4 py-2 bg-black text-white font-mono text-[11px] uppercase tracking-widest"
              >
                Create Your First Moodboard
              </button>
            </div>
          ) : (
            <>
              {isPreviewMode && (
                <div className="mb-4 border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Preview sample data shown so you can test the restore buttons without live generation history.
                </div>
              )}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {(isPreviewMode ? previewDisplayItems : displayItems).map(({ gen, attachments }) => {
                  const targetPage =
                    gen.type === 'moodboard' ? 'moodboard' : gen.type === 'applyMaterials' || gen.type === 'upscale' ? 'apply' : null;
                  const restoreLabel =
                    gen.type === 'moodboard' ? 'Open in Moodboard Lab' : gen.type === 'applyMaterials' || gen.type === 'upscale' ? 'Open in Apply' : null;
                  const hasRestorableBoard = extractBoardFromMaterials(gen.materials).length > 0;
                  const canRestore = Boolean(targetPage && restoreLabel && hasRestorableBoard && onRestoreGeneration);

                  return (
                    <div
                      key={gen.id}
                      className="border border-gray-200 overflow-hidden group hover:border-black transition-colors"
                    >
                      {gen.blobUrl ? (
                        <div className="relative aspect-square bg-gray-100 overflow-hidden">
                          <img
                            src={gen.blobUrl}
                            alt={gen.type}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <a
                            href={gen.blobUrl}
                            download
                            className="absolute top-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/90 border border-gray-200 text-gray-700 shadow-sm transition-opacity"
                            aria-label="Download image"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ) : (
                        <div className="aspect-square bg-gray-100 flex items-center justify-center">
                          <Image className="w-12 h-12 text-gray-300" />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500 bg-gray-100 px-2 py-1">
                            {typeLabels[gen.type] || gen.type}
                          </span>
                          <span className="flex items-center gap-1 text-gray-500 text-xs">
                            <Calendar className="w-3 h-3" />
                            {new Date(gen.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {attachments.map((pdf) => {
                              const rawUrl = pdf.blobUrl || '';
                              const isMaterialsSheet = getPdfBucket(pdf) === 'materialsSheet';
                              const pdfLabel = isMaterialsSheet
                                ? 'Materials Sheet'
                                : 'Download Sustainability Briefing';
                              const pdfButtonClass = isMaterialsSheet
                                ? 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 rounded hover:bg-emerald-200 transition-colors'
                                : 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 transition-colors';

                              return rawUrl ? (
                                <a
                                  key={pdf.id}
                                  href={rawUrl}
                                  download={isMaterialsSheet ? 'materials-sheet.pdf' : 'sustainability-briefing.pdf'}
                                  className={pdfButtonClass}
                                  onClick={() =>
                                    trackEvent('download_pdf', {
                                      pdf_type: isMaterialsSheet
                                        ? 'materials_sheet'
                                        : 'sustainability_briefing',
                                      source: 'dashboard',
                                    })
                                  }
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  {pdfLabel}
                                </a>
                              ) : null;
                            })}
                          </div>
                        )}
                        {restoreLabel && (
                          <div className="mt-3">
                            <button
                              onClick={() => handleRestoreGeneration(gen)}
                              disabled={!canRestore}
                              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border transition-colors ${
                                canRestore
                                  ? 'border-gray-300 text-gray-700 hover:border-black hover:text-black'
                                  : 'border-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                              title={
                                canRestore
                                  ? undefined
                                  : 'This generation does not include reusable material data.'
                              }
                            >
                              {restoreLabel}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasMore && (
                <div className="text-center mt-8">
                  <button
                    onClick={loadMore}
                    className="px-6 py-2 border border-gray-200 font-mono text-[11px] uppercase tracking-widest hover:border-black transition-colors"
                  >
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
