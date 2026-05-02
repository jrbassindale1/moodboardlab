import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useAuth, useUsage, isClerkAuthEnabled, isAuthBypassEnabled } from '../auth';
import { getGenerations, PrecedentResult } from '../api';
import type { MaterialOption } from '../types';
import type { SustainabilityBriefingResponse, SustainabilityBriefingPayload } from '../utils/sustainabilityBriefing';
import { Calendar, Image, Loader2, LogIn, Download, ChevronDown, ChevronRight, FolderOpen, Clock, Plus } from 'lucide-react';
import { trackEvent } from '../utils/analytics';

interface Generation {
  id: string;
  type: 'moodboard' | 'applyMaterials' | 'upscale' | 'materialIcon' | 'sustainabilityBriefing' | 'precedentSearch';
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
    sustainabilityBriefing?: SustainabilityBriefingResponse | null;
    briefingPayload?: SustainabilityBriefingPayload | null;
    moodboardRenderUrl?: string | null;
    savedPrecedents?: PrecedentResult[] | null;
    projectId?: string | null;
    projectName?: string | null;
    generationId?: string | null;
  }) => void;
  onOpenProjectModal?: () => void;
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

const extractProjectFromMaterials = (materials?: unknown): { id: string; name: string } | null => {
  if (!materials || typeof materials !== 'object') return null;
  const mat = materials as { projectId?: string; projectName?: string };
  if (!mat.projectId) return null;
  return {
    id: mat.projectId,
    name: mat.projectName || 'Untitled Project'
  };
};

type ProjectGroup = {
  projectId: string;
  projectName: string;
  generations: Array<{ gen: Generation; attachments: Generation[] }>;
  moodboardGen?: Generation; // The main moodboard for this project (used as cover)
  createdAt: string; // Earliest generation timestamp
};

async function downloadUrl(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onRestoreGeneration, onOpenProjectModal }) => {
  const { user, isAuthenticated, getAccessToken } = useAuth();
  const { usage, remaining, limit, purchasedCredits } = useUsage();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const hasFetchedRef = useRef(false);
  const limit_per_page = 12;
  const isPreviewMode = isAuthBypassEnabled && !isAuthenticated;
  const canAccessDashboard = isAuthenticated || isPreviewMode;
  const previewDisplayItems = useMemo(() => {
    if (!isPreviewMode) return [];
    const now = Date.now();
    const previewProjectId = 'preview-project-1';
    const previewProjectName = 'Moodboard 19 Mar 2026';
    const previewGenerations: Generation[] = [
      // New project-based generations
      {
        id: 'preview-moodboard-1',
        type: 'moodboard',
        blobUrl: 'https://placehold.co/400x400/e5e5e5/9ca3af?text=Moodboard',
        createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
        prompt: 'Preview moodboard generation',
        materials: {
          board: PREVIEW_SAMPLE_BOARD,
          projectId: previewProjectId,
          projectName: previewProjectName,
        },
      },
      {
        id: 'preview-apply-1',
        type: 'applyMaterials',
        blobUrl: 'https://placehold.co/400x400/d4d4d4/737373?text=Applied',
        createdAt: new Date(now - 12 * 60 * 1000).toISOString(),
        prompt: 'Preview apply generation',
        materials: {
          board: PREVIEW_SAMPLE_BOARD,
          projectId: previewProjectId,
          projectName: previewProjectName,
        },
      },
      // Legacy generations without projectId (will appear in Recent Generations)
      {
        id: 'preview-legacy-1',
        type: 'moodboard',
        blobUrl: 'https://placehold.co/400x400/fef3c7/d97706?text=Legacy+1',
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        prompt: 'Legacy moodboard without project',
        materials: {
          board: PREVIEW_SAMPLE_BOARD,
          // No projectId - this will be "ungrouped"
        },
      },
      {
        id: 'preview-legacy-2',
        type: 'applyMaterials',
        blobUrl: 'https://placehold.co/400x400/dbeafe/2563eb?text=Legacy+2',
        createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        prompt: 'Legacy apply without project',
        materials: {
          board: PREVIEW_SAMPLE_BOARD,
          // No projectId - this will be "ungrouped"
        },
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

  // Group generations by project
  const projectGroups = useMemo(() => {
    const groups = new Map<string, ProjectGroup>();
    const ungrouped: Array<{ gen: Generation; attachments: Generation[] }> = [];
    const itemsToGroup = isPreviewMode ? previewDisplayItems : displayItems;

    for (const item of itemsToGroup) {
      const project = extractProjectFromMaterials(item.gen.materials);

      if (project) {
        if (!groups.has(project.id)) {
          groups.set(project.id, {
            projectId: project.id,
            projectName: project.name,
            generations: [],
            createdAt: item.gen.createdAt
          });
        }
        const group = groups.get(project.id)!;
        group.generations.push(item);

        // Track moodboard as cover image
        if (item.gen.type === 'moodboard' && !group.moodboardGen) {
          group.moodboardGen = item.gen;
        }

        // Update createdAt to earliest
        if (toTimestamp(item.gen.createdAt) < toTimestamp(group.createdAt)) {
          group.createdAt = item.gen.createdAt;
        }
      } else {
        ungrouped.push(item);
      }
    }

    // Sort projects by most recent activity (newest first)
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      const aLatest = Math.max(...a.generations.map(g => toTimestamp(g.gen.createdAt)));
      const bLatest = Math.max(...b.generations.map(g => toTimestamp(g.gen.createdAt)));
      return bLatest - aLatest;
    });

    return { projects: sortedGroups, ungrouped };
  }, [displayItems, isPreviewMode, previewDisplayItems]);

  // State for expanded projects
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // State for recent generations section (legacy items without projectId, starts closed)
  const [recentGenExpanded, setRecentGenExpanded] = useState(false);

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

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

    // Extract sustainability briefing data, moodboard URL, precedents, and project info
    const materials = gen.materials as Record<string, unknown> | undefined;
    const sustainabilityBriefing = materials?.sustainabilityBriefing as SustainabilityBriefingResponse | undefined;
    const briefingPayload = materials?.briefingPayload as SustainabilityBriefingPayload | undefined;
    const moodboardRenderUrl = materials?.moodboardRenderUrl as string | undefined;
    const savedPrecedents = materials?.savedPrecedents as PrecedentResult[] | undefined;
    const projectId = materials?.projectId as string | undefined;
    const projectName = materials?.projectName as string | undefined;

    console.log('=== DASHBOARD RESTORE ===');
    console.log('Generation type:', gen.type);
    console.log('Materials keys:', materials ? Object.keys(materials) : 'no materials');
    console.log('moodboardRenderUrl present:', !!moodboardRenderUrl);
    console.log('projectId:', projectId || 'none');

    onRestoreGeneration({
      targetPage,
      board,
      generationImageUrl: gen.blobUrl || null,
      sourceType: gen.type,
      sustainabilityBriefing: sustainabilityBriefing || null,
      briefingPayload: briefingPayload || null,
      moodboardRenderUrl: moodboardRenderUrl || null,
      savedPrecedents: savedPrecedents || null,
      projectId: projectId || null,
      projectName: projectName || null,
      generationId: gen.id,
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
        <div className="flex items-start justify-between border-b border-gray-200 pb-6">
          <div>
            <h1 className="font-display text-5xl font-bold uppercase tracking-tighter">
              Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Welcome back, {user?.name || 'User'}
            </p>
          </div>
          {onOpenProjectModal && (
            <button
              onClick={onOpenProjectModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          )}
        </div>

        {/* Usage Stats */}
        <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-6">
          <div className="border border-gray-200 p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Available Credits
            </div>
            <div className="font-display text-4xl font-bold">
              {remaining}
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {purchasedCredits > 0 ? `Includes ${purchasedCredits} purchased credits` : `${limit} free each month`}
            </div>
          </div>
          <div className="border border-gray-200 p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Purchased Credits
            </div>
            <div className="font-display text-4xl font-bold text-green-600">
              {purchasedCredits}
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Non-expiring balance
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

        {/* Projects & Generation History */}
        <div>
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight mb-4">
            Your Projects
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (isPreviewMode ? previewDisplayItems : displayItems).length === 0 ? (
            <div className="border border-dashed border-gray-300 p-8 text-center">
              <FolderOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">{isPreviewMode ? 'No preview projects available.' : 'No projects yet.'}</p>
              <button
                onClick={() => onNavigate?.('moodboard')}
                className="px-4 py-2 bg-black text-white font-mono text-[11px] uppercase tracking-widest"
              >
                Create Your First Project
              </button>
            </div>
          ) : (
            <>
              {isPreviewMode && (
                <div className="mb-4 border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Preview sample data shown so you can test the restore buttons without live generation history.
                </div>
              )}

              {/* Project Cards */}
              {projectGroups.projects.length > 0 && (
                <div className="space-y-4 mb-8">
                  {projectGroups.projects.map((project) => {
                    const isExpanded = expandedProjects.has(project.projectId);
                    const genCount = project.generations.length;

                    return (
                      <div key={project.projectId} className="border border-gray-200 overflow-hidden">
                        {/* Project Header */}
                        <button
                          onClick={() => toggleProject(project.projectId)}
                          className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                        >
                          {/* Cover Image */}
                          <div className="w-20 h-20 flex-shrink-0 bg-gray-100 overflow-hidden">
                            {project.moodboardGen?.blobUrl ? (
                              <img
                                src={project.moodboardGen.blobUrl}
                                alt={project.projectName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FolderOpen className="w-8 h-8 text-gray-300" />
                              </div>
                            )}
                          </div>

                          {/* Project Info */}
                          <div className="flex-grow min-w-0">
                            <h3 className="font-display text-lg font-bold truncate">
                              {project.projectName}
                            </h3>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(project.createdAt).toLocaleDateString()}
                              </span>
                              <span className="font-mono text-[10px] uppercase tracking-widest bg-gray-100 px-2 py-0.5">
                                {genCount} {genCount === 1 ? 'item' : 'items'}
                              </span>
                            </div>
                          </div>

                          {/* Expand/Collapse */}
                          <div className="flex-shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 bg-gray-50 p-4">
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {project.generations.map(({ gen, attachments }) => {
                                const targetPage =
                                  gen.type === 'moodboard' ? 'moodboard' : gen.type === 'applyMaterials' || gen.type === 'upscale' ? 'apply' : null;
                                const restoreLabel =
                                  gen.type === 'moodboard' ? 'Open in Workspace' : gen.type === 'applyMaterials' || gen.type === 'upscale' ? 'Open in Render' : null;
                                const hasRestorableBoard = extractBoardFromMaterials(gen.materials).length > 0;
                                const canRestore = Boolean(targetPage && restoreLabel && hasRestorableBoard && onRestoreGeneration);

                                return (
                                  <div
                                    key={gen.id}
                                    className="border border-gray-200 bg-white overflow-hidden group hover:border-black transition-colors"
                                  >
                                    {gen.blobUrl ? (
                                      <div className="relative aspect-square bg-gray-100 overflow-hidden">
                                        <img
                                          src={gen.blobUrl}
                                          alt={gen.type}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                          loading="lazy"
                                        />
                                        <button
                                          onClick={(e) => { e.preventDefault(); downloadUrl(gen.blobUrl!, `image-${gen.id}.png`); }}
                                          className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 border border-gray-200 text-gray-700 shadow-sm"
                                          aria-label="Download image"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="aspect-square bg-gray-100 flex items-center justify-center">
                                        <Image className="w-10 h-10 text-gray-300" />
                                      </div>
                                    )}
                                    <div className="p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-mono text-[9px] uppercase tracking-widest text-gray-500 bg-gray-100 px-1.5 py-0.5">
                                          {typeLabels[gen.type] || gen.type}
                                        </span>
                                        <span className="text-gray-400 text-[10px]">
                                          {new Date(gen.createdAt).toLocaleDateString()}
                                        </span>
                                      </div>
                                      {attachments.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                          {attachments.map((pdf) => {
                                            const rawUrl = pdf.blobUrl || '';
                                            const isMaterialsSheet = getPdfBucket(pdf) === 'materialsSheet';
                                            return rawUrl ? (
                                              <button
                                                key={pdf.id}
                                                onClick={() => downloadUrl(rawUrl, `${isMaterialsSheet ? 'materials-sheet' : 'briefing'}-${pdf.id}.pdf`)}
                                                className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded ${
                                                  isMaterialsSheet
                                                    ? 'text-emerald-700 bg-emerald-100'
                                                    : 'text-green-700 bg-green-100'
                                                }`}
                                              >
                                                <Download className="w-3 h-3" />
                                                {isMaterialsSheet ? 'Sheet' : 'Briefing'}
                                              </button>
                                            ) : null;
                                          })}
                                        </div>
                                      )}
                                      {restoreLabel && canRestore && (
                                        <button
                                          onClick={() => handleRestoreGeneration(gen)}
                                          className="w-full px-2 py-1 font-mono text-[9px] uppercase tracking-widest border border-gray-300 text-gray-700 hover:border-black hover:text-black transition-colors"
                                        >
                                          {restoreLabel}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Recent Generations - legacy items without projectId (collapsible, starts closed) */}
              {projectGroups.ungrouped.length > 0 && (
                <div className="border border-gray-200 overflow-hidden mb-8">
                  <button
                    onClick={() => setRecentGenExpanded(!recentGenExpanded)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 flex-shrink-0 bg-gray-100 rounded-full flex items-center justify-center">
                      <Clock className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <h3 className="font-display text-lg font-bold">
                        Other Generations
                      </h3>
                      <p className="text-sm text-gray-500">
                        {projectGroups.ungrouped.length} {projectGroups.ungrouped.length === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {recentGenExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {recentGenExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {projectGroups.ungrouped.map(({ gen, attachments }) => {
                          const targetPage =
                            gen.type === 'moodboard' ? 'moodboard' : gen.type === 'applyMaterials' || gen.type === 'upscale' ? 'apply' : null;
                          const restoreLabel =
                            gen.type === 'moodboard' ? 'Open in Workspace' : gen.type === 'applyMaterials' || gen.type === 'upscale' ? 'Open in Render' : null;
                          const hasRestorableBoard = extractBoardFromMaterials(gen.materials).length > 0;
                          const canRestore = Boolean(targetPage && restoreLabel && hasRestorableBoard && onRestoreGeneration);

                          return (
                            <div
                              key={gen.id}
                              className="border border-gray-200 bg-white overflow-hidden group hover:border-black transition-colors"
                            >
                              {gen.blobUrl ? (
                                <div className="relative aspect-square bg-gray-100 overflow-hidden">
                                  <img
                                    src={gen.blobUrl}
                                    alt={gen.type}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                  />
                                  <button
                                    onClick={(e) => { e.preventDefault(); downloadUrl(gen.blobUrl!, `image-${gen.id}.png`); }}
                                    className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 border border-gray-200 text-gray-700 shadow-sm"
                                    aria-label="Download image"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                                  <Image className="w-10 h-10 text-gray-300" />
                                </div>
                              )}
                              <div className="p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-mono text-[9px] uppercase tracking-widest text-gray-500 bg-gray-100 px-1.5 py-0.5">
                                    {typeLabels[gen.type] || gen.type}
                                  </span>
                                  <span className="text-gray-400 text-[10px]">
                                    {new Date(gen.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                {attachments.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {attachments.map((pdf) => {
                                      const rawUrl = pdf.blobUrl || '';
                                      const isMaterialsSheet = getPdfBucket(pdf) === 'materialsSheet';
                                      return rawUrl ? (
                                        <button
                                          key={pdf.id}
                                          onClick={() => downloadUrl(rawUrl, `${isMaterialsSheet ? 'materials-sheet' : 'briefing'}-${pdf.id}.pdf`)}
                                          className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded ${
                                            isMaterialsSheet
                                              ? 'text-emerald-700 bg-emerald-100'
                                              : 'text-green-700 bg-green-100'
                                          }`}
                                        >
                                          <Download className="w-3 h-3" />
                                          {isMaterialsSheet ? 'Sheet' : 'Briefing'}
                                        </button>
                                      ) : null;
                                    })}
                                  </div>
                                )}
                                {restoreLabel && canRestore && (
                                  <button
                                    onClick={() => handleRestoreGeneration(gen)}
                                    className="w-full px-2 py-1 font-mono text-[9px] uppercase tracking-widest border border-gray-300 text-gray-700 hover:border-black hover:text-black transition-colors"
                                  >
                                    {restoreLabel}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
