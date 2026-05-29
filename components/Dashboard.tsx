import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useAuth, useUsage, isClerkAuthEnabled, isAuthBypassEnabled } from '../auth';
import { getGenerations, moveGenerationsToProject, PrecedentResult, type Project } from '../api';
import type { MaterialOption } from '../types';
import type { SustainabilityBriefingResponse, SustainabilityBriefingPayload } from '../utils/sustainabilityBriefing';
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FolderOpen,
  Image,
  Layers,
  Loader2,
  LogIn,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
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
  projects?: Project[];
  onRenameProject?: (projectId: string, name: string) => Promise<void>;
  onDeleteProject?: (projectId: string) => Promise<void>;
}

type BoardItemLike = {
  id?: string;
  name?: string;
  finish?: string;
};

const typeLabels: Record<string, string> = {
  moodboard: 'Moodboard',
  applyMaterials: 'Render',
  upscale: '4K Upscale',
  materialIcon: 'Material Icon',
  sustainabilityBriefing: 'Sustainability',
  precedentSearch: 'Precedents',
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
  project?: Project;
  generations: Array<{ gen: Generation; attachments: Generation[] }>;
  moodboardGen?: Generation;
  latestImageGen?: Generation;
  latestAt: string;
  createdAt: string;
};

type ProjectAction = {
  label: string;
  hint: string;
  page?: string;
  generation?: Generation;
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

const formatRelativeDate = (dateString: string): string => {
  const timestamp = toTimestamp(dateString);
  if (!timestamp) return 'Recently';
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 2) return 'Just now';
  if (diffMins < 60) return `${diffMins} mins ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getProjectCounts = (project: ProjectGroup) => {
  const generations = project.generations.map((item) => item.gen);
  const attachments = project.generations.flatMap((item) => item.attachments);
  return {
    moodboards: generations.filter((gen) => gen.type === 'moodboard').length,
    renders: generations.filter((gen) => gen.type === 'applyMaterials' || gen.type === 'upscale').length,
    documents: attachments.length,
    precedents: generations.filter((gen) => gen.type === 'precedentSearch').length,
  };
};

const getProjectAction = (project: ProjectGroup): ProjectAction => {
  const latestRestorable = [...project.generations]
    .sort((a, b) => toTimestamp(b.gen.createdAt) - toTimestamp(a.gen.createdAt))
    .map((item) => item.gen)
    .find((gen) => {
      const targetPage =
        gen.type === 'moodboard' ? 'moodboard' : gen.type === 'applyMaterials' || gen.type === 'upscale' ? 'apply' : null;
      return targetPage && extractBoardFromMaterials(gen.materials).length > 0;
    });

  if (latestRestorable) {
    return {
      label: latestRestorable.type === 'moodboard' ? 'Open Moodboard' : 'Open Render',
      hint: 'Continue from the latest project output.',
      generation: latestRestorable,
    };
  }

  if (!project.generations.length) {
    return {
      label: 'Start With Materials',
      hint: 'Choose materials to generate your first project output.',
      page: project.project?.entryRoute === 'sketch' ? 'apply' : 'materials',
    };
  }

  return {
    label: 'Open Render',
    hint: 'Apply your material palette to a project image.',
    page: 'apply',
  };
};

const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onRestoreGeneration,
  onOpenProjectModal,
  projects = [],
  onRenameProject,
  onDeleteProject,
}) => {
  const { user, isAuthenticated, getAccessToken } = useAuth();
  const { usage, remaining, limit, purchasedCredits } = useUsage();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [movingGenerationIds, setMovingGenerationIds] = useState<Set<string>>(new Set());
  const [moveError, setMoveError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);
  const limit_per_page = 12;
  const isPreviewMode = isAuthBypassEnabled;
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
    const projectById = new Map(projects.map((project) => [project.id, project]));

    for (const project of projects) {
      groups.set(project.id, {
        projectId: project.id,
        projectName: project.name,
        project,
        generations: [],
        latestAt: project.updatedAt || project.createdAt,
        createdAt: project.createdAt,
      });
    }

    for (const item of itemsToGroup) {
      const embeddedProject = extractProjectFromMaterials(item.gen.materials);

      if (embeddedProject) {
        const apiProject = projectById.get(embeddedProject.id);
        if (!groups.has(embeddedProject.id)) {
          groups.set(embeddedProject.id, {
            projectId: embeddedProject.id,
            projectName: apiProject?.name || embeddedProject.name,
            project: apiProject,
            generations: [],
            latestAt: apiProject?.updatedAt || item.gen.createdAt,
            createdAt: item.gen.createdAt
          });
        }
        const group = groups.get(embeddedProject.id)!;
        group.generations.push(item);
        if (apiProject) {
          group.project = apiProject;
          group.projectName = apiProject.name;
        }

        // Track moodboard as cover image
        if (item.gen.type === 'moodboard' && !group.moodboardGen) {
          group.moodboardGen = item.gen;
        }
        if (item.gen.blobUrl && isNewerGeneration(item.gen, group.latestImageGen)) {
          group.latestImageGen = item.gen;
        }

        // Update createdAt to earliest
        if (toTimestamp(item.gen.createdAt) < toTimestamp(group.createdAt)) {
          group.createdAt = item.gen.createdAt;
        }
        if (toTimestamp(item.gen.createdAt) > toTimestamp(group.latestAt)) {
          group.latestAt = item.gen.createdAt;
        }
      } else {
        ungrouped.push(item);
      }
    }

    // Sort projects by most recent activity (newest first)
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      return toTimestamp(b.latestAt) - toTimestamp(a.latestAt);
    });

    return { projects: sortedGroups, ungrouped };
  }, [displayItems, isPreviewMode, previewDisplayItems, projects]);

  const dashboardStats = useMemo(() => {
    const allProjectGroups = projectGroups.projects;
    const activeProjects = allProjectGroups.filter((project) => project.generations.length > 0).length;
    const allGenerations = [...displayItems, ...(isPreviewMode ? previewDisplayItems : [])].map((item) => item.gen);
    return {
      projects: allProjectGroups.length,
      activeProjects,
      moodboards: allGenerations.filter((gen) => gen.type === 'moodboard').length,
      renders: allGenerations.filter((gen) => gen.type === 'applyMaterials' || gen.type === 'upscale').length,
    };
  }, [displayItems, isPreviewMode, previewDisplayItems, projectGroups.projects]);

  // State for expanded projects
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // State for recent generations section (legacy items without projectId, starts closed)
  const [recentGenExpanded, setRecentGenExpanded] = useState(false);

  // Rename / delete state
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const handleRenameSubmit = async (projectId: string) => {
    if (!renameValue.trim() || !onRenameProject) return;
    setRenameSaving(true);
    try {
      await onRenameProject(projectId, renameValue.trim());
      setRenamingProjectId(null);
    } finally {
      setRenameSaving(false);
    }
  };

  const handleDeleteConfirm = async (projectId: string) => {
    if (!onDeleteProject) return;
    setDeleteSaving(true);
    try {
      await onDeleteProject(projectId);
      setConfirmDeleteId(null);
    } finally {
      setDeleteSaving(false);
    }
  };

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

  const handleMoveGenerations = async (
    generationIds: string[],
    targetProjectId: string
  ) => {
    if (!isAuthenticated || isPreviewMode || !targetProjectId || !generationIds.length) return;

    setMoveError(null);
    setMovingGenerationIds((prev) => new Set([...prev, ...generationIds]));
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Missing access token');
      const result = await moveGenerationsToProject(token, generationIds, targetProjectId);
      const updatedById = new Map(result.items.map((item) => [item.id, item]));
      setGenerations((prev) => prev.map((item) => updatedById.get(item.id) || item));
    } catch (error) {
      console.error('Failed to move generation:', error);
      setMoveError(error instanceof Error ? error.message : 'Failed to move generation');
    } finally {
      setMovingGenerationIds((prev) => {
        const next = new Set(prev);
        generationIds.forEach((id) => next.delete(id));
        return next;
      });
    }
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
            Preview mode: authentication is bypassed in this environment. Fake project data is shown so layout and restore flows can be tested safely.
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-5 border-b border-gray-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-5xl font-bold uppercase tracking-tighter">
              Projects
            </h1>
            <p className="text-gray-600 mt-2 max-w-2xl">
              Welcome back, {user?.name || 'User'}. Open a project to continue where you left off, or review outputs across all your work.
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
        <div className="grid grid-cols-2 gap-px border border-gray-200 bg-gray-200 lg:grid-cols-4 xl:grid-cols-6">
          <div className="bg-white p-4 sm:p-6">
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
          <div className="bg-white p-4 sm:p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Purchased Credits
            </div>
            <div className={`font-display text-4xl font-bold ${purchasedCredits > 0 ? 'text-green-600' : ''}`}>
              {purchasedCredits}
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Non-expiring balance
            </div>
          </div>
          <div className="bg-white p-4 sm:p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Projects
            </div>
            <div className="font-display text-4xl font-bold">
              {dashboardStats.projects}
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {dashboardStats.activeProjects} active
            </div>
          </div>
          <div className="bg-white p-4 sm:p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Moodboards
            </div>
            <div className="font-display text-4xl font-bold">
              {dashboardStats.moodboards || usage?.moodboard || 0}
            </div>
          </div>
          <div className="bg-white p-4 sm:p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Renders
            </div>
            <div className="font-display text-4xl font-bold">
              {dashboardStats.renders || usage?.applyMaterials || 0}
            </div>
          </div>
          <div className="bg-white p-4 sm:p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Total This Month
            </div>
            <div className="font-display text-4xl font-bold">
              {usage?.total || (dashboardStats.moodboards + dashboardStats.renders)}
            </div>
          </div>
        </div>

        {/* Projects & Generation History */}
        <div>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Open a project to continue your work, or review outputs from any named project.
              </p>
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : projectGroups.projects.length === 0 && projectGroups.ungrouped.length === 0 ? (
            <div className="border border-dashed border-gray-300 p-8 text-center">
              <FolderOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="font-display text-2xl font-bold uppercase tracking-tight">
                {isPreviewMode ? 'No preview projects available.' : 'No projects yet.'}
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600">
                Start by choosing materials. Moodboard Lab can create a named project when you generate your first output, or you can name the project now if you already know the job.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  onClick={() => onNavigate?.('materials')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white font-mono text-[11px] uppercase tracking-widest"
                >
                  <Layers className="w-4 h-4" />
                  Start With Materials
                </button>
                {onOpenProjectModal && (
                  <button
                    onClick={onOpenProjectModal}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white font-mono text-[11px] uppercase tracking-widest hover:border-gray-500 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Name Project First
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {isPreviewMode && (
                <div className="mb-4 border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Preview sample data shown so you can test the restore buttons without live generation history.
                </div>
              )}
              {moveError && (
                <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {moveError}
                </div>
              )}

              {/* Project Cards */}
              {projectGroups.projects.length > 0 && (
                <div className="space-y-4 mb-8">
                  {projectGroups.projects.map((project) => {
                    const isExpanded = expandedProjects.has(project.projectId);
                    const counts = getProjectCounts(project);
                    const action = getProjectAction(project);
                    const coverGeneration = project.moodboardGen || project.latestImageGen;

                    return (
                      <div key={project.projectId} className="border border-gray-200 bg-white overflow-hidden">
                        {/* Project Header */}
                        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)_260px]">
                          <button
                            onClick={() => toggleProject(project.projectId)}
                            className="relative h-44 bg-gray-100 text-left lg:h-auto"
                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${project.projectName}`}
                          >
                            {coverGeneration?.blobUrl ? (
                                <img
                                  src={coverGeneration.blobUrl}
                                  alt={project.projectName}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <FolderOpen className="h-10 w-10 text-gray-300" />
                                </div>
                              )}
                            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-white/90 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-gray-700">
                              <Calendar className="h-3 w-3" />
                              {formatRelativeDate(project.latestAt)}
                            </span>
                          </button>

                          <div className="min-w-0 border-t border-gray-200 p-5 lg:border-l lg:border-t-0">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              {project.project?.type && (
                                <span className="bg-gray-100 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-gray-500">
                                  {project.project.type}
                                </span>
                              )}
                              {project.project?.stage && (
                                <span className="bg-gray-100 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-gray-500">
                                  {project.project.stage}
                                </span>
                              )}
                              {project.project?.location && (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                  <MapPin className="h-3 w-3" />
                                  {project.project.location}
                                </span>
                              )}
                            </div>
                            {renamingProjectId === project.projectId ? (
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void handleRenameSubmit(project.projectId);
                                  if (e.key === 'Escape') setRenamingProjectId(null);
                                }}
                                onBlur={() => void handleRenameSubmit(project.projectId)}
                                disabled={renameSaving}
                                className="font-display text-2xl font-bold uppercase tracking-tight text-gray-950 border-b-2 border-black bg-transparent focus:outline-none w-full disabled:opacity-50"
                              />
                            ) : (
                              <div className="flex items-center gap-2 group/name">
                                <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-gray-950">
                                  {project.projectName}
                                </h3>
                                {onRenameProject && (
                                  <button
                                    onClick={() => { setRenamingProjectId(project.projectId); setRenameValue(project.projectName); }}
                                    className="opacity-0 group-hover/name:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-700"
                                    aria-label="Rename project"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                            {confirmDeleteId === project.projectId ? (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Delete project?</span>
                                <button
                                  onClick={() => void handleDeleteConfirm(project.projectId)}
                                  disabled={deleteSaving}
                                  className="font-mono text-[10px] uppercase tracking-widest text-red-600 hover:text-red-800 border border-red-200 px-2 py-1 disabled:opacity-50"
                                >
                                  {deleteSaving ? 'Deleting…' : 'Delete'}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="font-mono text-[10px] uppercase tracking-widest text-gray-500 border border-gray-200 px-2 py-1"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : onDeleteProject && renamingProjectId !== project.projectId && (
                              <button
                                onClick={() => setConfirmDeleteId(project.projectId)}
                                className="mt-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            )}
                            {project.project?.brief && (
                              <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                                {project.project.brief}
                              </p>
                            )}
                            <div className="mt-4 grid grid-cols-2 gap-px bg-gray-200 sm:grid-cols-4">
                              {[
                                { label: 'Moodboards', value: counts.moodboards },
                                { label: 'Renders', value: counts.renders },
                                { label: 'Files', value: counts.documents },
                                { label: 'Precedents', value: counts.precedents },
                              ].map((item) => (
                                <div key={item.label} className="bg-gray-50 px-3 py-2">
                                  <div className="font-mono text-lg font-bold text-gray-900">{item.value}</div>
                                  <div className="font-mono text-[8px] uppercase tracking-widest text-gray-400">
                                    {item.label}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="border-t border-gray-200 p-5 lg:border-l lg:border-t-0">
                            <div className="mb-4 flex items-start gap-3">
                              {project.generations.length ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-700" />
                              ) : (
                                <Sparkles className="mt-0.5 h-4 w-4 text-gray-400" />
                              )}
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                                  Next Step
                                </p>
                                <p className="mt-1 text-sm leading-relaxed text-gray-600">{action.hint}</p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => {
                                  if (action.generation) {
                                    handleRestoreGeneration(action.generation);
                                  } else if (action.page) {
                                    onNavigate?.(action.page);
                                  }
                                }}
                                className="inline-flex items-center justify-center gap-2 bg-black px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white transition-colors hover:bg-gray-900"
                              >
                                {action.label}
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => toggleProject(project.projectId)}
                                className="inline-flex items-center justify-center gap-2 border border-gray-200 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-gray-600 transition-colors hover:border-black hover:text-black"
                              >
                                {isExpanded ? 'Hide Outputs' : 'View Outputs'}
                                <Layers className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {project.generations.length === 0 && !isExpanded && (
                          <div className="border-t border-gray-200 bg-gray-50 px-5 py-3 text-sm text-gray-500">
                            This project is ready, but it does not have saved outputs yet.
                          </div>
                        )}

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 bg-gray-50 p-4">
                            {project.generations.length === 0 ? (
                              <div className="border border-dashed border-gray-300 bg-white p-8 text-center">
                                <FileText className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                                <p className="text-sm text-gray-500">Outputs from this project will appear here.</p>
                              </div>
                            ) : (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {project.generations.map(({ gen, attachments }) => {
                                const targetPage =
                                  gen.type === 'moodboard' ? 'moodboard' : gen.type === 'applyMaterials' || gen.type === 'upscale' ? 'apply' : null;
                                const restoreLabel =
                                  gen.type === 'moodboard' ? 'Open Moodboard' : gen.type === 'applyMaterials' || gen.type === 'upscale' ? 'Open Render' : null;
                                const hasRestorableBoard = extractBoardFromMaterials(gen.materials).length > 0;
                                const canRestore = Boolean(targetPage && restoreLabel && hasRestorableBoard && onRestoreGeneration);
                                const generationIdsToMove = [gen.id, ...attachments.map((item) => item.id)];
                                const isMoving = generationIdsToMove.some((id) => movingGenerationIds.has(id));
                                const currentProjectId = extractProjectFromMaterials(gen.materials)?.id || '';
                                const canMove = !isPreviewMode && projects.length > 0;

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
                                          className="w-full px-2 py-1 font-mono text-[9px] uppercase tracking-widest border border-gray-300 text-gray-700 hover:border-black hover:text-black transition-colors mb-2"
                                        >
                                          {restoreLabel}
                                        </button>
                                      )}
                                      {canMove && (
                                        <select
                                          value={currentProjectId}
                                          disabled={isMoving}
                                          onChange={(event) => {
                                            const nextProjectId = event.target.value;
                                            if (!nextProjectId || nextProjectId === currentProjectId) return;
                                            void handleMoveGenerations(generationIdsToMove, nextProjectId);
                                          }}
                                          className="w-full border border-gray-200 bg-white px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-gray-600 disabled:bg-gray-100 disabled:text-gray-400"
                                          aria-label="Move to project"
                                        >
                                          <option value="">Move to project</option>
                                          {projects.map((targetProject) => (
                                            <option key={targetProject.id} value={targetProject.id}>
                                              {targetProject.name}
                                            </option>
                                          ))}
                                        </select>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            )}
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
                        Unassigned Outputs
                      </h3>
                      <p className="text-sm text-gray-500">
                        {projectGroups.ungrouped.length} {projectGroups.ungrouped.length === 1 ? 'item' : 'items'} not linked to a project
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
                          const generationIdsToMove = [gen.id, ...attachments.map((item) => item.id)];
                          const isMoving = generationIdsToMove.some((id) => movingGenerationIds.has(id));
                          const currentProjectId = extractProjectFromMaterials(gen.materials)?.id || '';
                          const canMove = !isPreviewMode && projects.length > 0;

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
                                    className="w-full px-2 py-1 font-mono text-[9px] uppercase tracking-widest border border-gray-300 text-gray-700 hover:border-black hover:text-black transition-colors mb-2"
                                  >
                                    {restoreLabel}
                                  </button>
                                )}
                                {canMove && (
                                  <select
                                    value={currentProjectId}
                                    disabled={isMoving}
                                    onChange={(event) => {
                                      const nextProjectId = event.target.value;
                                      if (!nextProjectId || nextProjectId === currentProjectId) return;
                                      void handleMoveGenerations(generationIdsToMove, nextProjectId);
                                    }}
                                    className="w-full border border-gray-200 bg-white px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-gray-600 disabled:bg-gray-100 disabled:text-gray-400"
                                    aria-label="Move to project"
                                  >
                                    <option value="">Move to project</option>
                                    {projects.map((targetProject) => (
                                      <option key={targetProject.id} value={targetProject.id}>
                                        {targetProject.name}
                                      </option>
                                    ))}
                                  </select>
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
