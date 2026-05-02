import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  callGeminiImage,
  callOpenAIImage,
  saveGenerationAuth,
  savePdfAuth,
  checkQuota,
  consumeCredits,
  CREDIT_COSTS,
  GenerationType,
  getGenerations,
  getSavedMaterialTranslation,
  translateRenderToProducts,
  type Generation,
} from '../api';
import { MaterialOption, UploadedImage, StyleReferenceSource } from '../types';
import { isAuthBypassEnabled, useAuth, useUsage } from '../auth';
import { DrawingType } from '../utils/renderViewGuidance';
import { trackEvent } from '../utils/analytics';
import { IMAGE_MODEL_FALLBACK_WARNING, isImageModelFallbackUsed } from '../utils/imageModelFallback';
import { resolveImageSourceToDataUrl } from '../utils/imageUtils';
import type {
  MaterialTranslationContext,
  MaterialTranslationResult,
  MaterialTranslationStatus,
} from '../types/materialTranslation';
import {
  buildPreservedFilename,
  buildTimestampedFilename,
  calculateAspectRatio,
  createNamedObjectUrlFromSource,
  dataUrlSizeBytes,
  dataUrlToInlineData,
  downscaleImage,
  isDataUri,
  loadImage,
} from '../utils/imageProcessing';
import { DEFAULT_SCENE_CONTROLS } from './apply-materials/constants';
import MaterialTranslationPanel from './apply-materials/MaterialTranslationPanel';
import PostProcessingModal from './apply-materials/PostProcessingModal';
import ProjectContextPanel from './apply-materials/ProjectContextPanel';
import ProjectContextHeader from './ProjectContextHeader';
import RenderSetupPanel from './apply-materials/RenderSetupPanel';
import RenderWorkspacePanel from './apply-materials/RenderWorkspacePanel';
import SceneControlsSection from './apply-materials/SceneControlsSection';
import { buildApplyRenderPrompt } from './apply-materials/promptBuilder';
import type { ImageSourceMode, Project, SceneControls } from './apply-materials/types';

interface ApplyMaterialsProps {
  onNavigate?: (page: string) => void;
  board: MaterialOption[];
  onBoardChange?: (items: MaterialOption[]) => void;
  moodboardRenderUrl: string | null;
  appliedRenderUrl: string | null;
  onAppliedRenderUrlChange: (url: string | null) => void;
  restoredWithoutMoodboard?: boolean;
  onClearRestoredFlag?: () => void;
  // Lifted state from App.tsx (persists across navigation)
  uploadedImages: UploadedImage[];
  onUploadedImagesChange: (images: UploadedImage[]) => void;
  styleReferenceImage: UploadedImage | null;
  onStyleReferenceImageChange: (image: UploadedImage | null) => void;
  styleReferenceSource: StyleReferenceSource | null;
  onStyleReferenceSourceChange: (source: StyleReferenceSource | null) => void;
  styleReferenceSourceId: string | null;
  onStyleReferenceSourceIdChange: (sourceId: string | null) => void;
  sceneControls: SceneControls;
  onSceneControlsChange: (controls: SceneControls) => void;
  renderNote: string;
  onRenderNoteChange: (note: string) => void;
  appliedEditPrompt: string;
  onAppliedEditPromptChange: (prompt: string) => void;
  appliedRenderGenerationId: string | null;
  onAppliedRenderGenerationIdChange: (generationId: string | null) => void;
  // Project state
  currentProject?: Project | null;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB limit
const RECENT_STYLE_REFERENCE_LIMIT = 8;

const formatCreditCostMessage = (credits: number) =>
  credits === 1
    ? 'Not enough credits. This action costs 1 credit.'
    : `Not enough credits. This action costs ${credits} credits.`;

const PROJECT_GENERATION_LABELS: Partial<Record<Generation['type'], string>> = {
  moodboard: 'Moodboard',
  applyMaterials: 'Render',
  upscale: 'Final Output (4K)'
};

const isPdfBlobUrl = (blobUrl?: string) => {
  if (!blobUrl) return false;
  const urlWithoutQuery = blobUrl.split('?')[0];
  return urlWithoutQuery.toLowerCase().endsWith('.pdf');
};

const getGenerationProjectId = (generation: Generation): string | null => {
  if (!generation.materials || typeof generation.materials !== 'object') return null;
  const projectId = (generation.materials as { projectId?: unknown }).projectId;
  return typeof projectId === 'string' && projectId.trim() ? projectId : null;
};

const isSelectableProjectGeneration = (generation: Generation): boolean => {
  if (!generation.blobUrl || isPdfBlobUrl(generation.blobUrl)) return false;
  return generation.type === 'moodboard' || generation.type === 'applyMaterials' || generation.type === 'upscale';
};

const formatRelativeTime = (value: string): string => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
};

const getSceneControlValues = (controls: SceneControls): Array<SceneControls[keyof SceneControls]> =>
  Object.values(controls) as Array<SceneControls[keyof SceneControls]>;

const ApplyMaterials: React.FC<ApplyMaterialsProps> = ({
  onNavigate,
  board,
  onBoardChange,
  moodboardRenderUrl,
  appliedRenderUrl,
  onAppliedRenderUrlChange,
  restoredWithoutMoodboard,
  onClearRestoredFlag,
  // Lifted state from App.tsx
  uploadedImages,
  onUploadedImagesChange,
  styleReferenceImage,
  onStyleReferenceImageChange,
  styleReferenceSource,
  onStyleReferenceSourceChange,
  styleReferenceSourceId,
  onStyleReferenceSourceIdChange,
  sceneControls,
  onSceneControlsChange,
  renderNote,
  onRenderNoteChange,
  appliedEditPrompt,
  onAppliedEditPromptChange,
  appliedRenderGenerationId,
  onAppliedRenderGenerationIdChange,
  // Project state
  currentProject
}) => {
  // Auth and usage hooks
  const { isAuthenticated, getAccessToken } = useAuth();
  const { refreshUsage, incrementLocalUsage, canGenerate, remaining, purchasedCredits, isAdmin } = useUsage();

  // Check for localStorage admin bypass (for testing)
  const isLocalAdminBypassEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('moodboard_admin_bypass_enabled') === 'true';
  }, []);
  const isTestingEnvironment = Boolean(import.meta.env.DEV || isAuthBypassEnabled || isLocalAdminBypassEnabled);

  // Effective canGenerate that includes admin bypass
  const effectiveCanGenerate = canGenerate || isLocalAdminBypassEnabled;

  // Local UI state only (transient, doesn't need to persist)
  const [status, setStatus] = useState<'idle' | 'render'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [imageModelFallbackWarning, setImageModelFallbackWarning] = useState<string | null>(null);
  const [imageProvider, setImageProvider] = useState<'gemini' | 'openai'>('gemini');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectingProjectImageId, setSelectingProjectImageId] = useState<string | null>(null);
  const [projectGenerations, setProjectGenerations] = useState<Generation[]>([]);
  const [isProjectGenerationsLoading, setIsProjectGenerationsLoading] = useState(false);
  const [projectGenerationsError, setProjectGenerationsError] = useState<string | null>(null);
  const [baseImageSourceMode, setBaseImageSourceMode] = useState<ImageSourceMode>('upload');
  const [styleReferenceSourceMode, setStyleReferenceSourceMode] = useState<ImageSourceMode>('upload');
  const [drawingType, setDrawingType] = useState<DrawingType>('auto');
  const [renderingMode, setRenderingMode] = useState<'upload-1k' | 'upscale-4k' | 'edit' | null>(null);
  const [compareSplitPercent, setCompareSplitPercent] = useState(100);
  const [previousRenderUrl, setPreviousRenderUrl] = useState<string | null>(null);
  const [workspaceDisplayUrl, setWorkspaceDisplayUrl] = useState<string | null>(null);
  const [isWorkspaceImageModalOpen, setIsWorkspaceImageModalOpen] = useState(false);
  const [isSetupSceneControlsOpen, setIsSetupSceneControlsOpen] = useState(false);
  const [isRefineSceneControlsOpen, setIsRefineSceneControlsOpen] = useState(false);
  const [materialTranslationStatus, setMaterialTranslationStatus] = useState<MaterialTranslationStatus>('idle');
  const [materialTranslationResult, setMaterialTranslationResult] = useState<MaterialTranslationResult | null>(null);
  const [materialTranslationError, setMaterialTranslationError] = useState<string | null>(null);
  const [materialTranslationCreatedAt, setMaterialTranslationCreatedAt] = useState<string | null>(null);
  const [materialTranslationRenderId, setMaterialTranslationRenderId] = useState<string | null>(null);
  const [isExportingSpecificationPdf, setIsExportingSpecificationPdf] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'render' | 'translation'>('render');
  const [isPersistingRenderRecord, setIsPersistingRenderRecord] = useState(false);
  const loadedMaterialTranslationRenderRef = useRef<string | null>(null);
  const prevMoodboardRef = useRef(moodboardRenderUrl);
  const applyRenderInFlightRef = useRef(false);
  const workspaceObjectUrlRef = useRef<string | null>(null);
  const baseFileInputRef = useRef<HTMLInputElement | null>(null);
  const styleReferenceFileInputRef = useRef<HTMLInputElement | null>(null);

  // Convenience setters that call parent callbacks
  const setUploadedImages = onUploadedImagesChange;
  const setStyleReferenceImage = onStyleReferenceImageChange;
  const setStyleReferenceSource = onStyleReferenceSourceChange;
  const setStyleReferenceSourceId = onStyleReferenceSourceIdChange;
  const setSceneControls = onSceneControlsChange;
  const setRenderNote = onRenderNoteChange;
  const setAppliedEditPrompt = onAppliedEditPromptChange;
  const setAppliedRenderGenerationId = onAppliedRenderGenerationIdChange;

  const resetMaterialTranslationState = (options?: { closePanel?: boolean }) => {
    setMaterialTranslationStatus('idle');
    setMaterialTranslationResult(null);
    setMaterialTranslationError(null);
    setMaterialTranslationCreatedAt(null);
    setMaterialTranslationRenderId(null);
    loadedMaterialTranslationRenderRef.current = null;
    if (options?.closePanel) {
      setActiveWorkspaceTab('render');
    }
  };

  const resetBaseImageDependentState = () => {
    setDrawingType('auto');
    setStyleReferenceImage(null);
    setStyleReferenceSource(null);
    setStyleReferenceSourceId(null);
    setStyleReferenceSourceMode('upload');
    setSceneControls(DEFAULT_SCENE_CONTROLS);
    setRenderNote('');
    setAppliedEditPrompt('');
    onAppliedRenderUrlChange(null);
    setAppliedRenderGenerationId(null);
    setIsPersistingRenderRecord(false);
    setPreviousRenderUrl(null);
    setImageModelFallbackWarning(null);
    resetMaterialTranslationState({ closePanel: true });
    setError(null);
  };

  // Reset scene controls only when a NEW moodboard is generated
  useEffect(() => {
    if (moodboardRenderUrl && moodboardRenderUrl !== prevMoodboardRef.current) {
      onSceneControlsChange(DEFAULT_SCENE_CONTROLS);
      prevMoodboardRef.current = moodboardRenderUrl;
    }
  }, [moodboardRenderUrl, onSceneControlsChange]);

  const renderMaterials = useMemo(
    () => board.filter((item) => !item.excludeFromMoodboardRender),
    [board]
  );
  const uploadedImage = uploadedImages[0] ?? null;
  const workspaceImageUrl = appliedRenderUrl || uploadedImage?.dataUrl || null;
  const workspaceImageAlt = appliedRenderUrl ? 'Applied render' : uploadedImage ? 'Base image preview' : '';
  const hasProjectImagePicker = Boolean(currentProject?.id);
  const hasSceneControlsEnabled = useMemo(
    () => getSceneControlValues(sceneControls).some((control) => control.enabled),
    [sceneControls]
  );
  useEffect(() => {
    if (!hasSceneControlsEnabled) return;
    if (appliedRenderUrl) {
      setIsRefineSceneControlsOpen(true);
      return;
    }
    setIsSetupSceneControlsOpen(true);
  }, [hasSceneControlsEnabled, appliedRenderUrl]);
  const projectImageGenerations = useMemo(
    () =>
      projectGenerations
        .filter((generation) => getGenerationProjectId(generation) === currentProject?.id)
        .filter(isSelectableProjectGeneration)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [currentProject?.id, projectGenerations]
  );
  const effectiveStyleReferenceSource = useMemo<StyleReferenceSource | null>(() => {
    if (!styleReferenceImage) return null;
    return styleReferenceSource ?? (styleReferenceSourceId ? 'project' : 'external');
  }, [styleReferenceImage, styleReferenceSource, styleReferenceSourceId]);
  const styleReferenceSourceLabel = effectiveStyleReferenceSource === 'project'
    ? 'Sourced from project render'
    : 'Uploaded file';
  const excludedCount = board.length - renderMaterials.length;
  const canCompareBeforeAfter = Boolean(appliedRenderUrl && uploadedImage);
  const renderDiagnostics = useMemo(() => {
    const warnings: string[] = [];

    if (renderMaterials.length > 0 && renderMaterials.length < 2) {
      warnings.push('Only one material is active. Consider at least two mapped materials for stronger realism.');
    }

    const activeCategoryCount = new Set(renderMaterials.map((item) => item.category)).size;
    if (renderMaterials.length > 0 && activeCategoryCount < 2) {
      warnings.push('Material selection is concentrated in one category. Coverage may look incomplete.');
    }

    if (styleReferenceImage && hasSceneControlsEnabled) {
      warnings.push('Style reference and scene controls are both active. Scene controls will override conflicting style cues.');
    }

    return warnings;
  }, [
    uploadedImage?.width,
    uploadedImage?.height,
    renderMaterials,
    styleReferenceImage,
    hasSceneControlsEnabled,
    appliedRenderUrl,
  ]);

  const handleSceneControlEnabledChange = (key: keyof SceneControls, enabled: boolean) => {
    setSceneControls({
      ...sceneControls,
      [key]: {
        ...sceneControls[key],
        enabled
      }
    });
  };

  const handleSceneControlValueChange = (key: keyof SceneControls, value: number) => {
    setSceneControls({
      ...sceneControls,
      [key]: {
        ...sceneControls[key],
        value
      }
    });
  };

  useEffect(() => {
    let isCancelled = false;

    const revokeWorkspaceObjectUrl = () => {
      if (workspaceObjectUrlRef.current) {
        URL.revokeObjectURL(workspaceObjectUrlRef.current);
        workspaceObjectUrlRef.current = null;
      }
    };

    if (!workspaceImageUrl) {
      revokeWorkspaceObjectUrl();
      setWorkspaceDisplayUrl(null);
      return;
    }

    const filename = appliedRenderUrl
      ? buildTimestampedFilename('applied-render', workspaceImageUrl)
      : uploadedImage
      ? buildPreservedFilename(uploadedImage.name, workspaceImageUrl)
      : buildTimestampedFilename('render', workspaceImageUrl);

    if (!isDataUri(workspaceImageUrl)) {
      revokeWorkspaceObjectUrl();
      setWorkspaceDisplayUrl(workspaceImageUrl);
      return;
    }

    void (async () => {
      try {
        const objectUrl = await createNamedObjectUrlFromSource(workspaceImageUrl, filename);
        if (isCancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        revokeWorkspaceObjectUrl();
        workspaceObjectUrlRef.current = objectUrl;
        setWorkspaceDisplayUrl(objectUrl);
      } catch {
        if (!isCancelled) {
          revokeWorkspaceObjectUrl();
          setWorkspaceDisplayUrl(workspaceImageUrl);
        }
      }
    })();

    return () => {
      isCancelled = true;
      revokeWorkspaceObjectUrl();
    };
  }, [appliedRenderUrl, uploadedImage, workspaceImageUrl]);

  useEffect(() => {
    if (workspaceDisplayUrl) return;
    setIsWorkspaceImageModalOpen(false);
  }, [workspaceDisplayUrl]);

  useEffect(() => {
    if (appliedRenderUrl) return;
    setActiveWorkspaceTab('render');
  }, [appliedRenderUrl]);

  useEffect(() => {
    if (!isWorkspaceImageModalOpen || typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsWorkspaceImageModalOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isWorkspaceImageModalOpen]);

  useEffect(() => {
    if (!hasProjectImagePicker) {
      setBaseImageSourceMode('upload');
      setStyleReferenceSourceMode('upload');
      return;
    }
    if (uploadedImage?.sourceGenerationId) {
      setBaseImageSourceMode('project');
    }
    if (effectiveStyleReferenceSource === 'project') {
      setStyleReferenceSourceMode('project');
      return;
    }
    if (effectiveStyleReferenceSource === 'external') {
      setStyleReferenceSourceMode('upload');
    }
  }, [effectiveStyleReferenceSource, hasProjectImagePicker, uploadedImage?.sourceGenerationId]);

  useEffect(() => {
    if (!hasProjectImagePicker) {
      setProjectGenerations([]);
      setProjectGenerationsError(null);
      setIsProjectGenerationsLoading(false);
      return;
    }
    if (baseImageSourceMode !== 'project' && styleReferenceSourceMode !== 'project') {
      return;
    }
    if (!isAuthenticated) {
      setProjectGenerations([]);
      setProjectGenerationsError(null);
      setIsProjectGenerationsLoading(false);
      return;
    }

    let isCancelled = false;

    const loadProjectGenerations = async () => {
      setIsProjectGenerationsLoading(true);
      setProjectGenerationsError(null);
      try {
        const token = await getAccessToken();
        if (!token) {
          if (!isCancelled) {
            setProjectGenerations([]);
          }
          return;
        }

        const allItems: Generation[] = [];
        let offset = 0;
        const shouldFetchAllPages = baseImageSourceMode === 'project';
        const limit = shouldFetchAllPages ? 100 : RECENT_STYLE_REFERENCE_LIMIT;

        while (true) {
          const data = await getGenerations(token, { limit, offset });
          allItems.push(...(data.items || []));
          if (!shouldFetchAllPages || !data.hasMore) break;
          offset += limit;
        }

        if (!isCancelled) {
          setProjectGenerations(allItems);
        }
      } catch (err) {
        if (!isCancelled) {
          setProjectGenerations([]);
          setProjectGenerationsError(err instanceof Error ? err.message : 'Could not load project renders.');
        }
      } finally {
        if (!isCancelled) {
          setIsProjectGenerationsLoading(false);
        }
      }
    };

    void loadProjectGenerations();

    return () => {
      isCancelled = true;
    };
  }, [
    baseImageSourceMode,
    currentProject?.id,
    getAccessToken,
    hasProjectImagePicker,
    isAuthenticated,
    styleReferenceSourceMode
  ]);

  useEffect(() => {
    if (!appliedRenderGenerationId || !isAuthenticated) return;
    if (loadedMaterialTranslationRenderRef.current === appliedRenderGenerationId) return;

    let isCancelled = false;

    const loadSavedTranslation = async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const saved = await getSavedMaterialTranslation(appliedRenderGenerationId, token);
        if (isCancelled || !saved?.result) return;

        setMaterialTranslationResult(saved.result);
        setMaterialTranslationStatus('ready');
        setMaterialTranslationError(null);
        setMaterialTranslationCreatedAt(saved.createdAt || null);
        setMaterialTranslationRenderId(appliedRenderGenerationId);
        loadedMaterialTranslationRenderRef.current = appliedRenderGenerationId;
      } catch (err) {
        const message = err instanceof Error ? err.message.toLowerCase() : '';
        if (message.includes('no saved material translation') || message.includes('status 404')) {
          if (!isCancelled && materialTranslationRenderId !== appliedRenderGenerationId) {
            setMaterialTranslationResult(null);
            setMaterialTranslationStatus('idle');
            setMaterialTranslationError(null);
            setMaterialTranslationCreatedAt(null);
            setMaterialTranslationRenderId(null);
          }
          loadedMaterialTranslationRenderRef.current = appliedRenderGenerationId;
          return;
        }
        if (!isCancelled) {
          console.warn('Could not load saved material translation', err);
        }
      }
    };

    void loadSavedTranslation();

    return () => {
      isCancelled = true;
    };
  }, [appliedRenderGenerationId, getAccessToken, isAuthenticated, materialTranslationRenderId]);

  useEffect(() => {
    if (!appliedRenderGenerationId) return;
    if (!materialTranslationRenderId) return;
    if (materialTranslationRenderId === appliedRenderGenerationId) return;

    setMaterialTranslationResult(null);
    setMaterialTranslationStatus('idle');
    setMaterialTranslationError(null);
    setMaterialTranslationCreatedAt(null);
    setMaterialTranslationRenderId(null);
    setActiveWorkspaceTab('render');
  }, [appliedRenderGenerationId, materialTranslationRenderId]);

  const handleToggleExclude = (idxToToggle: number, value: boolean) => {
    if (!onBoardChange) return;
    onBoardChange(
      board.map((item, idx) =>
        idx === idxToToggle ? { ...item, excludeFromMoodboardRender: value } : item
      )
    );
  };

  const summaryText = useMemo(() => {
    if (!renderMaterials.length) return 'No materials selected yet.';
    const grouped = renderMaterials.reduce<Record<string, MaterialOption[]>>((acc, mat) => {
      acc[mat.category] = acc[mat.category] || [];
      acc[mat.category].push(mat);
      return acc;
    }, {});
    const lines = Object.entries(grouped).map(([cat, items]) => {
      const categoryItems = items as MaterialOption[];
      return `${cat}: ${categoryItems.map((i) => `${i.name} (${i.finish}) [color: ${i.tone}]`).join(', ')}`;
    });
    return lines.join('\n');
  }, [renderMaterials]);

  const buildMaterialKey = () => {
    if (!renderMaterials.length) return 'No materials selected yet.';
    return renderMaterials.map((item) => `${item.name} — ${item.finish}`).join('\n');
  };

  const processImageDataUrl = async ({
    dataUrl,
    name,
    originalSizeBytes,
    sourceGenerationId
  }: {
    dataUrl: string;
    name: string;
    originalSizeBytes?: number;
    sourceGenerationId?: string | null;
  }): Promise<UploadedImage> => {
    const resized = await downscaleImage(dataUrl);
    return {
      id: `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      dataUrl: resized.dataUrl,
      mimeType: resized.mimeType,
      sizeBytes: resized.sizeBytes,
      originalSizeBytes,
      width: resized.width,
      height: resized.height,
      sourceGenerationId: sourceGenerationId || null
    };
  };

  const handleRemoveBaseImage = () => {
    setUploadedImages([]);
    resetBaseImageDependentState();
  };

  const handleRemoveStyleReference = () => {
    setStyleReferenceImage(null);
    setStyleReferenceSource(null);
    setStyleReferenceSourceId(null);
  };

  const openBaseFilePicker = () => {
    setBaseImageSourceMode('upload');
    window.requestAnimationFrame(() => {
      baseFileInputRef.current?.click();
    });
  };

  const renderProjectPickerState = (target: 'base' | 'style') => {
    if (!isAuthenticated) {
      return (
        <div className="border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
          Sign in to browse renders saved to this project.
        </div>
      );
    }
    if (isProjectGenerationsLoading) {
      return (
        <div className="flex items-center gap-2 border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading project renders...
        </div>
      );
    }
    if (projectGenerationsError) {
      return (
        <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {projectGenerationsError}
        </div>
      );
    }
    if (!projectImageGenerations.length) {
      return (
        <div className="border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
          No renders saved to this project yet.
        </div>
      );
    }

    const selectedGenerationId = target === 'base'
      ? uploadedImage?.sourceGenerationId || null
      : styleReferenceSourceId;
    const recentStyleReferenceGenerations = projectImageGenerations.slice(0, RECENT_STYLE_REFERENCE_LIMIT);
    const selectedStyleGeneration = target === 'style' && selectedGenerationId
      ? projectImageGenerations.find((generation) => generation.id === selectedGenerationId) ?? null
      : null;
    const generationsToRender = target === 'style'
      ? selectedStyleGeneration && !recentStyleReferenceGenerations.some((generation) => generation.id === selectedStyleGeneration.id)
        ? [selectedStyleGeneration, ...recentStyleReferenceGenerations.slice(0, RECENT_STYLE_REFERENCE_LIMIT - 1)]
        : recentStyleReferenceGenerations
      : projectImageGenerations;
    const hiddenCount = target === 'style'
      ? Math.max(projectImageGenerations.length - generationsToRender.length, 0)
      : 0;

    return (
      <div className="space-y-2">
        {target === 'style' && (
          <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
            <span>
              Showing the {generationsToRender.length} most recent project renders for style matching.
            </span>
            {hiddenCount > 0 ? <span>{hiddenCount} older render{hiddenCount === 1 ? '' : 's'} hidden.</span> : null}
          </div>
        )}
        <div className={target === 'style' ? 'flex gap-3 overflow-x-auto pb-2' : 'grid grid-cols-2 gap-3 md:grid-cols-3'}>
        {generationsToRender.map((generation) => {
          const isSelected = selectedGenerationId === generation.id;
          const isSelecting = selectingProjectImageId === `${target}:${generation.id}`;
          return (
            <button
              key={`${target}-${generation.id}`}
              type="button"
              onClick={() => void handleProjectGenerationSelect(generation, target)}
              disabled={Boolean(selectingProjectImageId)}
              className={`${target === 'style' ? 'w-40 shrink-0' : 'overflow-hidden'} border p-2 text-left transition-colors ${
                isSelected ? 'border-black bg-gray-50' : 'border-gray-200 bg-white hover:border-black'
              } disabled:cursor-wait disabled:opacity-70`}
            >
              <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                {generation.blobUrl ? (
                  <img
                    src={generation.blobUrl}
                    alt={PROJECT_GENERATION_LABELS[generation.type] || 'Project render'}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-gray-600">
                {PROJECT_GENERATION_LABELS[generation.type] || generation.type}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {formatRelativeTime(generation.createdAt) || new Date(generation.createdAt).toLocaleDateString()}
              </div>
              {isSelecting && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Selecting...
                </div>
              )}
            </button>
          );
        })}
        </div>
      </div>
    );
  };

  const persistGeneration = async (
    imageDataUri: string,
    prompt: string,
    generationType: Extract<GenerationType, 'applyMaterials' | 'upscale'>,
    generationMeta?: {
      imageModelUsed?: string;
      imageFallbackUsed?: boolean;
    }
  ): Promise<string | null> => {
    const trimmedNote = renderNote.trim();
    console.log('=== SAVING RENDER ===');
    console.log('moodboardRenderUrl prop:', moodboardRenderUrl ? `${moodboardRenderUrl.substring(0, 80)}...` : 'null');

    const metadata = {
      renderMode: generationType === 'upscale' ? 'upscale-4k' : 'apply-to-upload',
      materialKey: buildMaterialKey(),
      summary: summaryText,
      imageModelUsed: generationMeta?.imageModelUsed || undefined,
      imageFallbackUsed: generationMeta?.imageFallbackUsed,
      renderNote: trimmedNote || undefined,
      userNote: trimmedNote || undefined,
      generatedPrompt: prompt,
      board,
      moodboardRenderUrl: moodboardRenderUrl || undefined,
      uploads: uploadedImage
        ? [{
            id: uploadedImage.id,
            name: uploadedImage.name,
            mimeType: uploadedImage.mimeType,
            sizeBytes: uploadedImage.sizeBytes,
            originalSizeBytes: uploadedImage.originalSizeBytes,
            width: uploadedImage.width,
            height: uploadedImage.height,
            dataUrl: uploadedImage.dataUrl,
            sourceGenerationId: uploadedImage.sourceGenerationId || undefined
          }]
        : [],
      sourceGenerationId: uploadedImage?.sourceGenerationId || undefined,
      styleReference: generationType === 'applyMaterials' && styleReferenceImage
        ? {
            id: styleReferenceImage.id,
            name: styleReferenceImage.name,
            mimeType: styleReferenceImage.mimeType,
            sizeBytes: styleReferenceImage.sizeBytes,
            originalSizeBytes: styleReferenceImage.originalSizeBytes,
            width: styleReferenceImage.width,
            height: styleReferenceImage.height,
            dataUrl: styleReferenceImage.dataUrl,
            sourceGenerationId: styleReferenceSourceId || undefined,
            source: effectiveStyleReferenceSource || undefined
          }
        : undefined,
      styleReferenceSource:
        generationType === 'applyMaterials' && styleReferenceImage
          ? effectiveStyleReferenceSource || undefined
          : undefined,
      styleReferenceSourceId:
        generationType === 'applyMaterials' && styleReferenceImage
          ? styleReferenceSourceId || undefined
          : undefined,
      // Project identification
      projectId: currentProject?.id,
      projectName: currentProject?.name
    };

    if (!isAuthenticated) {
      console.warn('Skipping save-generation: user not authenticated.');
      return null;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        console.warn('Skipping save-generation: missing access token.');
        return null;
      }
      const saved = await saveGenerationAuth({
        prompt,
        imageDataUri,
        materials: metadata,
        generationType
      }, token);
      return typeof saved.generationId === 'string' && saved.generationId.trim()
        ? saved.generationId
        : null;
    } catch (err) {
      console.error('Authenticated save failed:', err);
      return null;
    }
  };

  const inferAspectRatioFromDataUrl = async (dataUrl: string): Promise<string | null> => {
    try {
      const image = await loadImage(dataUrl);
      if (!image.width || !image.height) return null;
      return calculateAspectRatio(image.width, image.height);
    } catch {
      return null;
    }
  };

  const getAccessTokenWithRetry = useCallback(async (): Promise<string | null> => {
    if (!isAuthenticated) return null;

    let token = await getAccessToken();
    if (token) return token;

    // Clerk can briefly report authenticated while token hydration is still in flight.
    await new Promise((resolve) => setTimeout(resolve, 150));
    token = await getAccessToken();
    return token;
  }, [getAccessToken, isAuthenticated]);

  const buildMaterialTranslationContext = (): MaterialTranslationContext => {
    const selectedMaterialPalette = renderMaterials
      .slice(0, 20)
      .map((material) => `${material.name} (${material.category})`);

    return {
      projectType: currentProject?.name || undefined,
      region: undefined,
      userMaterials: renderMaterials
        .slice(0, 20)
        .map((material) => ({
          id: material.id,
          name: material.name,
          category: material.category,
          finish: material.finish,
        })),
      selectedMaterialPalette,
      sustainabilityPreference: undefined,
      budgetTier: undefined,
    };
  };

  const runMaterialTranslation = async (options?: { force?: boolean }) => {
    if (!appliedRenderUrl) return;
    if (materialTranslationStatus === 'loading') return;
    if (materialTranslationResult && !options?.force) {
      setActiveWorkspaceTab('translation');
      return;
    }

    setActiveWorkspaceTab('translation');
    setMaterialTranslationStatus('loading');
    setMaterialTranslationError(null);

    try {
      const token = isAuthenticated ? await getAccessToken() : null;
      const response = await translateRenderToProducts(
        {
          imageUrl: appliedRenderUrl,
          projectId: currentProject?.id,
          renderId: appliedRenderGenerationId || undefined,
          context: buildMaterialTranslationContext(),
        },
        {
          accessToken: token,
          timeoutMs: 120000,
        }
      );

      setMaterialTranslationResult(response.result);
      setMaterialTranslationStatus('ready');
      setMaterialTranslationError(null);
      setMaterialTranslationCreatedAt(response.createdAt || new Date().toISOString());
      const resolvedRenderId =
        (typeof response.renderId === 'string' && response.renderId.trim()) ||
        appliedRenderGenerationId ||
        null;
      setMaterialTranslationRenderId(resolvedRenderId);

      if (resolvedRenderId) {
        loadedMaterialTranslationRenderRef.current = resolvedRenderId;
        setAppliedRenderGenerationId(resolvedRenderId);
      }
    } catch (err) {
      setMaterialTranslationStatus('error');
      const message = err instanceof Error ? err.message : 'Could not translate this render right now.';
      setMaterialTranslationError(
        message === 'auth_required' ? 'Please sign in to continue.' : message
      );
    }
  };

  const handleTranslateToProducts = () => {
    if (!appliedRenderUrl) return;
    if (materialTranslationResult) {
      setActiveWorkspaceTab('translation');
      return;
    }
    void runMaterialTranslation();
  };

  const handleReanalyseMaterialTranslation = () => {
    setActiveWorkspaceTab('translation');
    void runMaterialTranslation({ force: true });
  };

  const loadImageAsDataUri = async (url: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Could not load render image for PDF.');
    }

    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read render image data.'));
      reader.readAsDataURL(blob);
    });
  };

  const handleDownloadSpecificationPdf = async () => {
    if (!materialTranslationResult) {
      setMaterialTranslationError('No specification pathways available to export yet.');
      return;
    }

    setIsExportingSpecificationPdf(true);
    try {
      const translation = materialTranslationResult;
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      type RGB = [number, number, number];

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 24;
      const topMargin = 24;
      const bottomLimit = pageHeight - 28;
      const contentWidth = pageWidth - marginX * 2;
      let cursorY = topMargin;

      const splitLines = (text: string, maxWidth: number): string[] =>
        (doc.splitTextToSize(
          (text || '-')
            .replace(/\s+/g, ' ')
            .trim(),
          maxWidth
        ) as string[]) || ['-'];

      const ensureSpace = (neededHeight: number) => {
        if (cursorY + neededHeight <= bottomLimit) return;
        doc.addPage();
        cursorY = topMargin;
      };

      const drawBadge = (
        text: string,
        x: number,
        y: number,
        background: RGB,
        foreground: RGB
      ): number => {
        const badgeHeight = 12;
        const badgeWidth = doc.getTextWidth(text) + 12;
        doc.setFillColor(background[0], background[1], background[2]);
        doc.roundedRect(x, y, badgeWidth, badgeHeight, 6, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(foreground[0], foreground[1], foreground[2]);
        doc.text(text, x + 6, y + 8.2);
        return badgeWidth;
      };

      const pickFirst = (...values: Array<string | undefined | null>): string => {
        for (const value of values) {
          const normalized = String(value || '').trim();
          if (normalized) return normalized;
        }
        return '';
      };

      const collectLegacySuppliers = (
        system: (typeof translation.systems)[number]
      ): Array<{ name: string; url: string }> => {
        const pool: Array<{ name: string; url: string }> = [];

        if (Array.isArray(system.recommendedPathway?.manufacturers)) {
          pool.push(...system.recommendedPathway.manufacturers);
        }
        if (Array.isArray(system.alternativePathway?.manufacturers)) {
          pool.push(...system.alternativePathway.manufacturers);
        }
        if (Array.isArray(system.buildableOptions)) {
          for (const option of system.buildableOptions.slice(0, 2)) {
            if (Array.isArray(option.manufacturers)) {
              pool.push(...option.manufacturers);
            }
          }
        }

        const deduped = new Map<string, { name: string; url: string }>();
        for (const supplier of pool) {
          const name = String(supplier?.name || '').trim();
          const url = String(supplier?.url || '').trim();
          if (!name || !url) continue;

          const key = `${name.toLowerCase()}|${url.toLowerCase()}`;
          if (!deduped.has(key)) {
            deduped.set(key, { name, url });
          }
        }

        return Array.from(deduped.values()).slice(0, 3);
      };

      const resolveSuppliers = (
        system: (typeof translation.systems)[number]
      ): Array<{ name: string; url: string }> => {
        const current = Array.isArray(system.possibleSuppliers)
          ? system.possibleSuppliers
              .map((supplier) => ({
                name: String(supplier?.name || '').trim(),
                url: String(supplier?.url || '').trim(),
              }))
              .filter((supplier) => supplier.name && supplier.url)
              .slice(0, 3)
          : [];

        if (current.length > 0) return current;
        return collectLegacySuppliers(system);
      };

      const resolveCostBand = (system: (typeof translation.systems)[number]): string | null => {
        const value = String(system.costBand || '').trim();
        if (value && value !== 'unknown') return value;
        const recommended = String(system.recommendedPathway?.costBand || '').trim();
        if (recommended) return recommended;
        const legacy = String(system.buildableOptions?.[0]?.costBand || '').trim();
        return legacy || null;
      };

      const resolveCarbonSignal = (system: (typeof translation.systems)[number]): string | null => {
        const value = String(system.carbonSignal || '').trim();
        if (value && value !== 'unknown') return value;
        const recommended = String(system.recommendedPathway?.carbonSignal || '').trim();
        if (recommended && recommended !== 'unknown') return recommended;
        const legacy = String(system.buildableOptions?.[0]?.carbonSignal || '').trim();
        if (legacy && legacy !== 'unknown') return legacy;
        return null;
      };

      const generatedLabel = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const confidence = translation.summary.confidence;
      const confidenceBadgeStyle: Record<typeof confidence, { bg: RGB; text: RGB }> = {
        high: { bg: [220, 252, 231], text: [22, 101, 52] },
        medium: { bg: [219, 234, 254], text: [30, 64, 175] },
        low: { bg: [254, 243, 199], text: [146, 64, 14] },
      };

      const headerHeight = 68;
      ensureSpace(headerHeight + 12);
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(marginX, cursorY, contentWidth, headerHeight, 8, 8, 'F');
      doc.setFillColor(236, 253, 245);
      doc.roundedRect(marginX + contentWidth * 0.48, cursorY, contentWidth * 0.52, headerHeight, 8, 8, 'F');
      doc.setDrawColor(209, 250, 229);
      doc.roundedRect(marginX, cursorY, contentWidth, headerHeight, 8, 8, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(31, 41, 55);
      doc.text('SPECIFICATION PATHWAYS', marginX + 12, cursorY + 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(75, 85, 99);
      doc.text('Render-led architectural routes for early-stage decision support.', marginX + 12, cursorY + 36);
      doc.text(`Generated ${generatedLabel}`, marginX + 12, cursorY + 50);

      drawBadge(
        `CONFIDENCE: ${confidence.toUpperCase()}`,
        marginX + contentWidth - 118,
        cursorY + 10,
        confidenceBadgeStyle[confidence].bg,
        confidenceBadgeStyle[confidence].text
      );

      cursorY += headerHeight + 12;

      if (appliedRenderUrl) {
        try {
          const imageDataUri = await loadImageAsDataUri(appliedRenderUrl);
          const image = await loadImage(imageDataUri);
          const imagePadding = 12;
          const maxWidth = contentWidth - imagePadding * 2;
          const maxHeight = 212;
          const imageRatio = image.width / image.height;
          let drawWidth = maxWidth;
          let drawHeight = drawWidth / imageRatio;
          if (drawHeight > maxHeight) {
            drawHeight = maxHeight;
            drawWidth = drawHeight * imageRatio;
          }

          const imageCardHeight = drawHeight + 26;
          ensureSpace(imageCardHeight + 12);

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(229, 231, 235);
          doc.roundedRect(marginX, cursorY, contentWidth, imageCardHeight, 8, 8, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(107, 114, 128);
          doc.text('REFERENCE RENDER', marginX + imagePadding, cursorY + 14);

          const imageFormat = imageDataUri.includes('image/png') ? 'PNG' : 'JPEG';
          const imageX = marginX + (contentWidth - drawWidth) / 2;
          doc.addImage(
            imageDataUri,
            imageFormat,
            imageX,
            cursorY + 18,
            drawWidth,
            drawHeight,
            undefined,
            'FAST'
          );

          cursorY += imageCardHeight + 14;
        } catch (imageError) {
          console.warn('Specification PDF image embedding failed', imageError);
        }
      }

      ensureSpace(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      doc.text('KEY SYSTEM PATHWAYS', marginX, cursorY);
      cursorY += 12;

      for (const system of translation.systems.slice(0, 4)) {
        const evidenceStrength = String(system.evidenceStrength || 'medium').toLowerCase();
        const readsAs = pickFirst(
          system.readsAs,
          system.whyThisReadsThisWay,
          system.visualIntent,
          system.likelySystem,
          'Likely system intent inferred from render evidence.'
        );
        const likelyRoute = pickFirst(
          system.likelyRoute,
          system.recommendedPathway?.name,
          system.likelySystem,
          system.buildableOptions?.[0]?.name,
          'Likely route requires project-specific validation.'
        );
        const alternative = pickFirst(
          system.alternative,
          system.alternativePathway?.name,
          system.buildableOptions?.[1]?.name,
          system.buildableOptions?.[0]?.name,
          'Alternative route to test against programme and buildability priorities.'
        );
        const watchOut = pickFirst(
          system.watchOut,
          system.risks?.[0],
          system.designNote,
          system.tradeOff,
          'Check interfaces, movement, fire, and drainage strategy before route lock-in.'
        );
        const suppliers = resolveSuppliers(system);
        const costBand = resolveCostBand(system);
        const carbonSignal = resolveCarbonSignal(system);

        const maxTextWidth = contentWidth - 24;
        const readsLines = splitLines(readsAs, maxTextWidth);
        const likelyLines = splitLines(likelyRoute, maxTextWidth);
        const alternativeLines = splitLines(alternative, maxTextWidth);
        const watchOutLines = splitLines(watchOut, maxTextWidth);

        const fieldHeight = (lineCount: number) => 12 + lineCount * 9.2 + 4;
        const suppliersHeight = suppliers.length > 0 ? 12 + suppliers.length * 20 : 0;
        const cardHeight =
          26 +
          fieldHeight(readsLines.length) +
          fieldHeight(likelyLines.length) +
          fieldHeight(alternativeLines.length) +
          fieldHeight(watchOutLines.length) +
          suppliersHeight +
          8;

        ensureSpace(cardHeight + 10);
        const cardTop = cursorY;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(229, 231, 235);
        doc.roundedRect(marginX, cardTop, contentWidth, cardHeight, 8, 8, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(17, 24, 39);
        doc.text(String(system.category || 'System').toUpperCase(), marginX + 12, cardTop + 16);

        const evidenceBadge = evidenceStrength === 'high'
          ? { bg: [220, 252, 231] as RGB, text: [22, 101, 52] as RGB, label: 'EVIDENCE: HIGH' }
          : evidenceStrength === 'low'
          ? { bg: [254, 243, 199] as RGB, text: [146, 64, 14] as RGB, label: 'EVIDENCE: LOW' }
          : { bg: [219, 234, 254] as RGB, text: [30, 64, 175] as RGB, label: 'EVIDENCE: MEDIUM' };

        const badgeQueue: Array<{ label: string; bg: RGB; text: RGB }> = [evidenceBadge];
        if (costBand) {
          badgeQueue.push({
            label: `COST ${String(costBand).toUpperCase()}`,
            bg: [243, 244, 246],
            text: [55, 65, 81],
          });
        }
        if (carbonSignal) {
          badgeQueue.push({
            label: `CARBON ${String(carbonSignal).toUpperCase()}`,
            bg: [241, 245, 249],
            text: [71, 85, 105],
          });
        }

        let badgeX = marginX + contentWidth - 12;
        for (let index = badgeQueue.length - 1; index >= 0; index -= 1) {
          const badge = badgeQueue[index];
          const badgeWidth = doc.getTextWidth(badge.label) + 12;
          badgeX -= badgeWidth;
          drawBadge(badge.label, badgeX, cardTop + 8, badge.bg, badge.text);
          badgeX -= 6;
        }

        let bodyY = cardTop + 30;

        const drawField = (label: string, lines: string[]) => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.8);
          doc.setTextColor(107, 114, 128);
          doc.text(label.toUpperCase(), marginX + 12, bodyY);
          bodyY += 10;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(31, 41, 55);
          doc.text(lines, marginX + 12, bodyY);
          bodyY += lines.length * 9.2 + 4;
        };

        drawField('Reads as', readsLines);
        drawField('Likely route', likelyLines);
        drawField('Alternative', alternativeLines);
        drawField('Watch-out', watchOutLines);

        if (suppliers.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.8);
          doc.setTextColor(107, 114, 128);
          doc.text('POSSIBLE SUPPLIERS', marginX + 12, bodyY);
          bodyY += 10;

          const linkApi = doc as unknown as {
            textWithLink?: (
              text: string,
              x: number,
              y: number,
              options: { url: string }
            ) => void;
          };

          for (const supplier of suppliers.slice(0, 3)) {
            const linkLabel = supplier.name;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.7);
            doc.setTextColor(37, 99, 235);
            if (typeof linkApi.textWithLink === 'function') {
              linkApi.textWithLink(linkLabel, marginX + 12, bodyY, { url: supplier.url });
            } else {
              doc.text(linkLabel, marginX + 12, bodyY);
            }
            const underlineWidth = Math.min(doc.getTextWidth(linkLabel), maxTextWidth - 4);
            doc.setDrawColor(59, 130, 246);
            doc.line(marginX + 12, bodyY + 1.5, marginX + 12 + underlineWidth, bodyY + 1.5);
            bodyY += 9;

            const supplierUrlLine = splitLines(supplier.url, maxTextWidth - 8)[0];
            doc.setFontSize(7.3);
            doc.setTextColor(100, 116, 139);
            doc.text(supplierUrlLine, marginX + 16, bodyY);
            bodyY += 11;
          }
        }

        cursorY = cardTop + cardHeight + 10;
      }

      const realityCheck = (translation.realityCheck || []).slice(0, 3);
      if (realityCheck.length > 0) {
        const realityLines = realityCheck.flatMap((item) =>
          splitLines(`- ${item}`, contentWidth - 24)
        );
        const realityHeight = Math.max(68, 24 + realityLines.length * 9.2 + 8);
        ensureSpace(realityHeight + 8);

        doc.setFillColor(249, 250, 251);
        doc.setDrawColor(229, 231, 235);
        doc.roundedRect(marginX, cursorY, contentWidth, realityHeight, 8, 8, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(75, 85, 99);
        doc.text('REALITY CHECK', marginX + 12, cursorY + 16);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.8);
        doc.setTextColor(55, 65, 81);
        doc.text(realityLines, marginX + 12, cursorY + 30);
        cursorY += realityHeight + 12;
      }

      ensureSpace(30);
      doc.setDrawColor(229, 231, 235);
      doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
      cursorY += 11;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 128);
      doc.text(`Generated by MoodboardLab | ${generatedLabel}`, pageWidth / 2, cursorY, {
        align: 'center',
      });
      cursorY += 9;

      const disclaimerLines = splitLines(
        translation.summary.disclaimer ||
          'Early-stage guidance only. Validate routes through project-specific design development.',
        contentWidth - 44
      ).slice(0, 2);
      doc.setFontSize(6.75);
      doc.setTextColor(148, 163, 184);
      doc.text(disclaimerLines, pageWidth / 2, cursorY, { align: 'center' });

      doc.save('specification-pathways.pdf');
      trackEvent('download_pdf', {
        pdf_type: 'specification_pathways',
        source: 'render',
      });

      if (isAuthenticated) {
        try {
          const token = await getAccessToken();
          if (token) {
            const pdfDataUri = doc.output('datauristring');
            await savePdfAuth(
              {
                pdfDataUri,
                pdfType: 'specificationPathways',
                materials: {
                  board,
                  materialTranslation: materialTranslationResult,
                  renderId: appliedRenderGenerationId,
                },
              },
              token
            );
          }
        } catch (saveErr) {
          console.warn('Specification pathways PDF downloaded but could not save to backend', saveErr);
        }
      }
    } catch (err) {
      console.error('Specification pathways PDF export failed', err);
      setMaterialTranslationError(
        err instanceof Error ? err.message : 'Could not create the specification pathways PDF.'
      );
    } finally {
      setIsExportingSpecificationPdf(false);
    }
  };

  const handleDownloadImage = async (url: string, renderId?: string) => {
    if (!url) return;
    setDownloadingId(renderId || null);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Could not download the rendered image.');
      const blob = await response.blob();
      const extension =
        blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `applied-render-${Date.now()}.${extension}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the rendered image.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleFileInput = async (files: FileList | null, target: 'base' | 'style') => {
    if (!files || files.length === 0) return;
    const file = Array.from(files).find((candidate) => candidate.type.startsWith('image/'));
    if (!file) {
      setError('Please upload a valid image file.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`Upload "${file.name}" is over the 5 MB limit.`);
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const processedImage = await processImageDataUrl({
        dataUrl,
        name: file.name,
        originalSizeBytes: file.size,
        sourceGenerationId: null
      });
      if (target === 'base') {
        resetBaseImageDependentState();
        setUploadedImages([processedImage]);
      } else {
        setStyleReferenceImage(processedImage);
        setStyleReferenceSource('external');
        setStyleReferenceSourceId(null);
      }
      setError(null);
    } catch (err) {
      console.error('Could not process upload', err);
      setError(`Could not process "${file.name}".`);
    }
  };

  const handleProjectGenerationSelect = async (generation: Generation, target: 'base' | 'style') => {
    if (!generation.blobUrl) return;
    const loadingKey = `${target}:${generation.id}`;
    setSelectingProjectImageId(loadingKey);
    try {
      const dataUrl = await resolveImageSourceToDataUrl(generation.blobUrl);
      const processedImage = await processImageDataUrl({
        dataUrl,
        name: `${PROJECT_GENERATION_LABELS[generation.type] || 'Project render'} ${new Date(generation.createdAt).toLocaleDateString()}`,
        originalSizeBytes: dataUrlSizeBytes(dataUrl),
        sourceGenerationId: generation.id
      });
      if (target === 'base') {
        resetBaseImageDependentState();
        setUploadedImages([processedImage]);
      } else {
        setStyleReferenceImage(processedImage);
        setStyleReferenceSource('project');
        setStyleReferenceSourceId(generation.id);
      }
      setError(null);
    } catch (err) {
      console.error('Could not process project image', err);
      setError(err instanceof Error ? err.message : 'Could not load the selected project image.');
    } finally {
      setSelectingProjectImageId(null);
    }
  };

  const onBaseFileInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) =>
    void handleFileInput(e.target.files, 'base');

  const onStyleReferenceFileInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) =>
    void handleFileInput(e.target.files, 'style');

  const runApplyRender = async (options?: {
    editPrompt?: string;
    baseImageDataUrl?: string;
    imageSize?: '1K' | '4K';
    renderMode?: 'upload-1k' | 'upscale-4k' | 'edit';
    drawingType?: DrawingType;
  }): Promise<boolean> => {
    if (applyRenderInFlightRef.current) {
      return false;
    }
    applyRenderInFlightRef.current = true;

    try {
    const currentBaseImageDataUrl =
      options?.baseImageDataUrl ??
      (options?.renderMode === 'upscale-4k' ? appliedRenderUrl : null);
    const isEditingRender = Boolean(currentBaseImageDataUrl && options?.renderMode === 'edit');
    const isUpscalingRender = Boolean(currentBaseImageDataUrl && options?.renderMode === 'upscale-4k');
    const generationMode =
      options?.renderMode === 'upscale-4k'
        ? '4k'
        : isEditingRender
        ? 'iterative'
        : 'standard';
    const requiredCredits =
      generationMode === '4k'
        ? CREDIT_COSTS.FOUR_K_GENERATION
        : CREDIT_COSTS.RENDER_GENERATION;
    const totalRequiredCredits = requiredCredits;
    const billedGenerationType = options?.renderMode === 'upscale-4k' ? 'upscale' : 'applyMaterials';

    // Check quota - server-side for authenticated users, shared local quota for anonymous users
    if (isTestingEnvironment) {
      // Skip quota checks in local/staging testing environments.
      console.log('[Quota Check] Bypassed (testing environment)');
    } else if (isAuthenticated) {
      // Refresh and check server-side quota
      try {
        const token = await getAccessTokenWithRetry();
        if (token) {
          const quotaCheck = await checkQuota(token);
          if (generationMode === '4k' && !quotaCheck.isAdmin && (quotaCheck.purchasedCredits || 0) < CREDIT_COSTS.FOUR_K_GENERATION) {
            setError('Finalise (4K) requires at least 5 purchased credits.');
            return false;
          }
          if (!quotaCheck.canGenerate || quotaCheck.remaining < totalRequiredCredits) {
            setError(formatCreditCostMessage(totalRequiredCredits));
            return false;
          }
        }
      } catch (err) {
        console.error('Quota check failed:', err);
        // Continue with render if quota check fails (graceful degradation)
      }
    } else {
      if (remaining < totalRequiredCredits) {
        setError(formatCreditCostMessage(totalRequiredCredits));
        return false;
      }
    }

    if (!board.length) {
      setError('Add materials to the moodboard first.');
      return false;
    }
    if (renderMaterials.length === 0) {
      setError('All materials are excluded from the render. Uncheck at least one material.');
      return false;
    }
    if (isUpscalingRender && !currentBaseImageDataUrl) {
      setError('Create a sketch render first before finalising to 4K.');
      return false;
    }
    if (!isEditingRender && !isUpscalingRender && !uploadedImage) {
      setError('Upload at least one base image first.');
      return false;
    }

    setStatus('render');
    setRenderingMode(options?.renderMode ?? null);
    setError(null);
    setImageModelFallbackWarning(null);
    setIsPersistingRenderRecord(false);
    setAppliedRenderGenerationId(null);
    resetMaterialTranslationState({ closePanel: true });
    const prompt = buildApplyRenderPrompt({
      renderMaterials,
      sceneControls,
      renderNote,
      editPrompt: options?.editPrompt,
      requestedDrawingType: options?.drawingType ?? 'auto',
      uploadedImageName: uploadedImage?.name || null,
      isEditingRender,
      isUpscalingRender,
      styleReferenceImagePresent: Boolean(styleReferenceImage),
      effectiveStyleReferenceSource,
      hasSceneControlsEnabled,
      summaryText,
    });
    const useStyleReference = Boolean(styleReferenceImage && !isUpscalingRender);

    console.log('=== PROMPT BEING SENT TO AI ===');
    console.log(prompt);
    console.log('=== END PROMPT ===');

    try {
      let baseImageDataUrl: string | null = currentBaseImageDataUrl;
      if ((isEditingRender || isUpscalingRender) && baseImageDataUrl && !isDataUri(baseImageDataUrl)) {
        try {
          baseImageDataUrl = await resolveImageSourceToDataUrl(baseImageDataUrl);
        } catch (loadErr) {
          const msg =
            loadErr instanceof Error ? loadErr.message : 'Could not load the selected render for editing.';
          throw new Error(`${msg} Try downloading and re-uploading the image.`);
        }
      }

      const imageSize = options?.imageSize ?? '1K';
      let aspectRatio = '1:1';
      if ((isEditingRender || isUpscalingRender) && baseImageDataUrl) {
        const inferredRatio = await inferAspectRatioFromDataUrl(baseImageDataUrl);
        if (inferredRatio) {
          aspectRatio = inferredRatio;
        }
      } else if (uploadedImage?.width && uploadedImage?.height) {
        if (uploadedImage.width && uploadedImage.height) {
          aspectRatio = calculateAspectRatio(uploadedImage.width, uploadedImage.height);
        }
      }

      const calculateOpenAISize = (ratio: string, requestedSize: '1K' | '4K'): string => {
        const [widthPart, heightPart] = ratio.split(':').map(Number);
        const safeWidthPart = widthPart || 1;
        const safeHeightPart = heightPart || 1;
        const targetRatio = safeWidthPart / safeHeightPart;

        const to16 = (value: number, mode: 'up' | 'down' = 'up'): number =>
          mode === 'down'
            ? Math.max(16, Math.floor(value / 16) * 16)
            : Math.max(16, Math.ceil(value / 16) * 16);

        const MAX_EDGE = 3840; // <= 3840 and divisible by 16
        const MIN_PIXELS = 655360;
        const MAX_PIXELS = 8294400;
        const MAX_RATIO = 3;

        // 4K mode pushes to max supported edge; standard mode stays around HD.
        const targetLongEdge = requestedSize === '4K' ? 3840 : 1024;
        let width = targetRatio >= 1 ? targetLongEdge : targetLongEdge * targetRatio;
        let height = targetRatio >= 1 ? targetLongEdge / targetRatio : targetLongEdge;

        let w = to16(width, 'up');
        let h = to16(height, 'up');

        const applyMaxEdge = () => {
          const maxEdge = Math.max(w, h);
          if (maxEdge <= MAX_EDGE) return;
          const scale = MAX_EDGE / maxEdge;
          w = to16(w * scale, 'down');
          h = to16(h * scale, 'down');
        };

        const applyMaxPixels = () => {
          const pixels = w * h;
          if (pixels <= MAX_PIXELS) return;
          const scale = Math.sqrt(MAX_PIXELS / pixels);
          w = to16(w * scale, 'down');
          h = to16(h * scale, 'down');
        };

        const applyMinPixels = () => {
          const pixels = w * h;
          if (pixels >= MIN_PIXELS) return;
          const scale = Math.sqrt(MIN_PIXELS / Math.max(1, pixels));
          w = to16(w * scale, 'up');
          h = to16(h * scale, 'up');
        };

        const applyRatioLimit = () => {
          const longEdge = Math.max(w, h);
          const shortEdge = Math.max(1, Math.min(w, h));
          if (longEdge / shortEdge <= MAX_RATIO) return;
          const limitedShort = to16(longEdge / MAX_RATIO, 'up');
          if (w >= h) {
            h = limitedShort;
          } else {
            w = limitedShort;
          }
        };

        applyRatioLimit();
        applyMaxEdge();
        applyMaxPixels();
        applyMinPixels();
        applyMaxEdge();
        applyMaxPixels();
        applyRatioLimit();

        return `${w}x${h}`;
      };

      const openaiImageSize = calculateOpenAISize(aspectRatio, imageSize);

      const imageParts =
        ((isEditingRender || isUpscalingRender) && baseImageDataUrl
          ? [dataUrlToInlineData(baseImageDataUrl)]
          : uploadedImage
          ? [dataUrlToInlineData(uploadedImage.dataUrl)]
          : []);
      const payloadParts = useStyleReference && styleReferenceImage
        ? [...imageParts, dataUrlToInlineData(styleReferenceImage.dataUrl)]
        : imageParts;

      const singlePayload = {
        contents: [
          {
            parts: [
              { text: prompt },
              ...payloadParts
            ]
          }
        ],
        generationConfig: {
          temperature: 0.35,
          candidateCount: 1,
          responseModalities: ['IMAGE']
        },
        imageConfig: {
          aspectRatio,
          imageSize
        }
      };

      const extractImageFromResponse = (data: unknown): string | null => {
        const candidates = (data as { candidates?: unknown[] })?.candidates || [];
        for (const c of candidates) {
          const parts = (c as { content?: { parts?: unknown[] }; parts?: unknown[] })?.content?.parts
            || (c as { parts?: unknown[] })?.parts || [];
          for (const p of parts) {
            const inline = (p as { inlineData?: { data: string; mimeType?: string }; inline_data?: { data: string; mime_type?: string } })?.inlineData
              || (p as { inline_data?: { data: string; mime_type?: string } })?.inline_data;
            if (inline?.data) {
              const mime = (inline as { mimeType?: string; mime_type?: string }).mimeType
                || (inline as { mime_type?: string }).mime_type || 'image/png';
              return `data:${mime};base64,${inline.data}`;
            }
          }
        }
        return null;
      };

      const openAIBaseImageDataUrl =
        isEditingRender || isUpscalingRender
          ? baseImageDataUrl
          : uploadedImage?.dataUrl || null;

      const openaiImageQuality = imageSize === '4K' ? 'high' : 'medium';

      const authToken = isAuthenticated ? await getAccessTokenWithRetry() : null;
      const hasUsableAuthToken = Boolean(authToken);
      const canUseOpenAiWithoutToken = isTestingEnvironment || isAuthBypassEnabled;
      if (imageProvider === 'openai' && !hasUsableAuthToken && !canUseOpenAiWithoutToken) {
        throw new Error('OpenAI rendering requires a signed-in session token. Please sign in again or switch provider to Gemini.');
      }

      const data = await (
        imageProvider === 'openai'
          ? callOpenAIImage(prompt, openAIBaseImageDataUrl ?? undefined, {
              timeoutMs: 240000,
              size: openaiImageSize,
              quality: openaiImageQuality,
              accessToken: authToken,
              generationType: billedGenerationType,
              generationMode,
            })
          : callGeminiImage(singlePayload, { timeoutMs: 120000 })
      );
      const fallbackUsed = imageProvider !== 'openai' && isImageModelFallbackUsed(data);
      const modelUsed = imageProvider === 'openai' ? 'gpt-image-2' : (typeof data?.imageModelUsed === 'string' ? data.imageModelUsed : undefined);

      const newUrl = extractImageFromResponse(data);
      if (!newUrl) {
        throw new Error('Gemini did not return an image payload.');
      }

      setImageModelFallbackWarning(fallbackUsed ? IMAGE_MODEL_FALLBACK_WARNING : null);

      if (hasUsableAuthToken) {
        if (imageProvider !== 'openai') {
          await consumeCredits(authToken!, {
            generationType: billedGenerationType,
            generationMode,
            credits: requiredCredits,
            reason:
              generationMode === '4k'
                ? 'apply-render-4k'
                : generationMode === 'iterative'
                ? 'apply-render-edit'
                : 'apply-render-standard',
          });
        }
        await refreshUsage();
      } else {
        incrementLocalUsage(requiredCredits, billedGenerationType);
      }

      setPreviousRenderUrl(appliedRenderUrl);
      onAppliedRenderUrlChange(newUrl);
      setActiveWorkspaceTab('render');

      // Reset scene controls after successful render
      setSceneControls(DEFAULT_SCENE_CONTROLS);

      // Track apply materials generation in Google Analytics
      const eventLabel = options?.renderMode === 'upscale-4k' ? 'upscale' : 'applyMaterials';
      trackEvent('apply_palette_to_image', {
        render_mode: eventLabel,
        material_count: renderMaterials.length,
      });
      trackEvent('generate_image', {
        event_category: 'generation',
        event_label: eventLabel,
      });

      if (hasUsableAuthToken) {
        setIsPersistingRenderRecord(true);
        void persistGeneration(newUrl, prompt, billedGenerationType, {
          imageModelUsed: modelUsed,
          imageFallbackUsed: fallbackUsed
        }).then((savedGenerationId) => {
          if (savedGenerationId) {
            setAppliedRenderGenerationId(savedGenerationId);
          }
        }).finally(() => {
          setIsPersistingRenderRecord(false);
        });
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not reach the Gemini image backend.';
      setError(message === 'auth_required' ? 'Please sign in to continue.' : message);
      return false;
    } finally {
      setStatus('idle');
      setRenderingMode(null);
    }
    } finally {
      applyRenderInFlightRef.current = false;
    }
  };

  const handleAppliedEdit = async () => {
    const trimmed = appliedEditPrompt.trim();
    const hasSceneControls = getSceneControlValues(sceneControls).some((control) => control.enabled);

    if (!appliedRenderUrl) {
      setError('Render with an upload first.');
      return;
    }
    if (!trimmed && !hasSceneControls) {
      setError('Add text instructions or enable scene controls to update the applied render.');
      return;
    }
    const wasUpdated = await runApplyRender({
      editPrompt: trimmed,
      baseImageDataUrl: appliedRenderUrl,
      renderMode: 'edit',
      drawingType
    });
    if (wasUpdated) {
      setAppliedEditPrompt('');
    }
  };

  const handleRender4K = async () => {
    if (!appliedRenderUrl) {
      setError('Create a sketch render first before finalising to 4K.');
      return;
    }
    if (!canUse4K) {
      setError('Finalise (4K) requires at least 5 purchased credits.');
      return;
    }

    const confirmed = window.confirm(
      isTestingEnvironment
        ? 'Finalise will create a high-resolution 4K version of your sketch. Continue?'
        : 'Finalise will create a high-resolution 4K version and cost 5 credits. This is your final output. Continue?'
    );
    if (!confirmed) {
      return;
    }

    await runApplyRender({
      baseImageDataUrl: appliedRenderUrl,
      imageSize: '4K',
      renderMode: 'upscale-4k',
      drawingType
    });
  };


  const canUse4K = isTestingEnvironment || Boolean(isAuthenticated && (isAdmin || purchasedCredits >= CREDIT_COSTS.FOUR_K_GENERATION));
  const fourKTooltip = isTestingEnvironment || isAdmin
    ? 'Create high-resolution 4K final output from your sketch'
    : canUse4K
    ? 'Create high-resolution 4K final output from your sketch'
    : 'Requires at least 5 purchased credits';
  const hasMaterialTranslation = Boolean(materialTranslationResult);
  const isTranslatingToProducts = materialTranslationStatus === 'loading';
  const canTranslateToProducts = Boolean(
    appliedRenderUrl &&
      (!isAuthenticated || hasMaterialTranslation || Boolean(appliedRenderGenerationId)) &&
      !isPersistingRenderRecord
  );
  const translateToProductsHint =
    isAuthenticated && !hasMaterialTranslation && !appliedRenderGenerationId
      ? 'Saving render record before specification pathways...'
      : null;
  const canStartRender = status === 'idle' && board.length > 0 && renderMaterials.length > 0 && effectiveCanGenerate && Boolean(uploadedImage);
  const unmetRenderRequirements = useMemo(() => {
    const hints: string[] = [];
    if (status !== 'idle') hints.push('Wait for the current render to finish.');
    if (board.length === 0) hints.push('Add materials to your palette.');
    else if (renderMaterials.length === 0) hints.push('Include at least one material in render (none can be excluded).');
    if (!uploadedImage) hints.push('Upload or select a base image.');
    if (!effectiveCanGenerate) hints.push('No generation credits available.');
    return hints;
  }, [status, board.length, renderMaterials.length, uploadedImage, effectiveCanGenerate]);
  const isGeneratingBaseRender = status === 'render' && renderingMode === 'upload-1k';

  return (
    <div className="w-full min-h-screen pt-20 bg-white">
      <div className="mx-auto max-w-[1800px] px-6 md:px-8 xl:px-10 2xl:px-12 py-6 space-y-6">
        <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-3xl uppercase tracking-tight text-black sm:text-4xl lg:text-5xl">
              Render
            </h1>
            <ProjectContextHeader project={currentProject || null} className="text-xs" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400">
              Costs: {CREDIT_COSTS.MOODBOARD_GENERATION} moodboard / {CREDIT_COSTS.RENDER_GENERATION} sketch+edits / {CREDIT_COSTS.FOUR_K_GENERATION} final (4K)
            </div>
            {/* Image Provider Selector (Test Environment) */}
            <select
              value={imageProvider}
              onChange={(e) => setImageProvider(e.target.value as 'gemini' | 'openai')}
              className="px-3 py-2 border border-gray-200 uppercase font-mono text-[10px] tracking-widest hover:border-black cursor-pointer bg-white"
              title="Switch between image generation models"
            >
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI (GPT Image 2)</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span>{error}</span>
          </div>
        )}

        {imageModelFallbackWarning && (
          <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-[2px]" />
            <span>{imageModelFallbackWarning}</span>
          </div>
        )}

        {board.length === 0 && !appliedRenderUrl && (
          <div className="border border-dashed border-amber-300 bg-amber-50 p-6 text-center space-y-3">
            <p className="font-sans text-amber-800 text-sm">
              Add materials to your palette before generating renders. You can upload a base image below, but rendering requires a material selection.
            </p>
            <button
              onClick={() => onNavigate?.('materials')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900"
            >
              Select Materials
            </button>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(400px,520px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(440px,580px)_minmax(0,1fr)] xl:items-start">
          <aside className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto">
            <RenderSetupPanel
              canStartRender={canStartRender}
              onGenerateRender={() => void runApplyRender({ renderMode: 'upload-1k', drawingType })}
              isGeneratingBaseRender={isGeneratingBaseRender}
              unmetRenderRequirements={unmetRenderRequirements}
              renderDiagnostics={renderDiagnostics}
              baseImageSourceMode={baseImageSourceMode}
              onBaseImageSourceModeChange={setBaseImageSourceMode}
              hasProjectImagePicker={hasProjectImagePicker}
              baseFileInputRef={baseFileInputRef}
              onBaseFileInputChange={onBaseFileInputChange}
              baseProjectPicker={renderProjectPickerState('base')}
              uploadedImage={uploadedImage}
              onRemoveBaseImage={handleRemoveBaseImage}
              drawingType={drawingType}
              onDrawingTypeChange={setDrawingType}
              renderNote={renderNote}
              onRenderNoteChange={setRenderNote}
              setupSceneControls={
                <SceneControlsSection
                  contextLabel="setup"
                  idPrefix="setup"
                  disabled={false}
                  isOpen={isSetupSceneControlsOpen}
                  onToggleOpen={() => setIsSetupSceneControlsOpen((prev) => !prev)}
                  hideHeader
                  sceneControls={sceneControls}
                  onToggleEnabled={handleSceneControlEnabledChange}
                  onChangeValue={handleSceneControlValueChange}
                />
              }
              styleReferenceSourceMode={styleReferenceSourceMode}
              onStyleReferenceSourceModeChange={setStyleReferenceSourceMode}
              styleReferenceFileInputRef={styleReferenceFileInputRef}
              onStyleReferenceFileInputChange={onStyleReferenceFileInputChange}
              styleProjectPicker={renderProjectPickerState('style')}
              styleReferenceImage={styleReferenceImage}
              styleReferenceSourceLabel={styleReferenceSourceLabel}
              onRemoveStyleReference={handleRemoveStyleReference}
              showSceneControlsOverrideNotice={Boolean(styleReferenceImage && hasSceneControlsEnabled)}
            />
            <ProjectContextPanel
              moodboardRenderUrl={moodboardRenderUrl}
              restoredWithoutMoodboard={restoredWithoutMoodboard}
              onClearRestoredFlag={onClearRestoredFlag}
              onNavigate={onNavigate}
              renderMaterialsCount={renderMaterials.length}
              board={board}
              excludedCount={excludedCount}
              onToggleExclude={handleToggleExclude}
            />
          </aside>
          <RenderWorkspacePanel
            appliedRenderUrl={appliedRenderUrl}
            uploadedImageAvailable={Boolean(uploadedImage)}
            workspaceImageUrl={workspaceImageUrl}
            workspaceDisplayUrl={workspaceDisplayUrl}
            workspaceImageAlt={workspaceImageAlt}
            canCompareBeforeAfter={canCompareBeforeAfter}
            compareSplitPercent={compareSplitPercent}
            onCompareSplitPercentChange={setCompareSplitPercent}
            comparisonBaseImageUrl={previousRenderUrl ?? uploadedImage?.dataUrl ?? null}
            status={status}
            renderingMode={renderingMode}
            onOpenPreview={() => setIsWorkspaceImageModalOpen(true)}
            onChooseBaseImage={openBaseFilePicker}
            appliedEditPrompt={appliedEditPrompt}
            onAppliedEditPromptChange={setAppliedEditPrompt}
            effectiveCanGenerate={effectiveCanGenerate}
            refineSceneControls={
              <SceneControlsSection
                contextLabel="refine"
                idPrefix="refine"
                disabled={!effectiveCanGenerate}
                isOpen={isRefineSceneControlsOpen}
                onToggleOpen={() => setIsRefineSceneControlsOpen((prev) => !prev)}
                sceneControls={sceneControls}
                onToggleEnabled={handleSceneControlEnabledChange}
                onChangeValue={handleSceneControlValueChange}
              />
            }
            showSceneControlsOverrideNotice={Boolean(styleReferenceImage && hasSceneControlsEnabled)}
            onApplyChanges={() => void handleAppliedEdit()}
            onRender4K={() => void handleRender4K()}
            canUse4K={canUse4K}
            fourKTooltip={fourKTooltip}
            onDownloadRender={() => void handleDownloadImage(appliedRenderUrl || '', 'applied')}
            isDownloadingApplied={downloadingId === 'applied'}
            activeWorkspaceTab={activeWorkspaceTab}
            onWorkspaceTabChange={setActiveWorkspaceTab}
            onTranslateToProducts={handleTranslateToProducts}
            isTranslatingToProducts={isTranslatingToProducts}
            hasMaterialTranslation={hasMaterialTranslation}
            canTranslateToProducts={canTranslateToProducts}
            translateToProductsHint={translateToProductsHint}
            materialTranslationPanel={
              <MaterialTranslationPanel
                isOpen={activeWorkspaceTab === 'translation'}
                status={materialTranslationStatus}
                result={materialTranslationResult}
                error={materialTranslationError}
                createdAt={materialTranslationCreatedAt}
                isDownloadingPdf={isExportingSpecificationPdf}
                onClose={() => setActiveWorkspaceTab('render')}
                onReanalyse={handleReanalyseMaterialTranslation}
                onDownloadPdf={() => void handleDownloadSpecificationPdf()}
              />
            }
          />
        </div>
      </div>
      <PostProcessingModal
        isOpen={isWorkspaceImageModalOpen}
        previewUrl={workspaceDisplayUrl || workspaceImageUrl}
        title={appliedRenderUrl ? 'Render Preview' : 'Image Preview'}
        imageAlt={workspaceImageAlt}
        isDownloading={downloadingId === 'modal-preview'}
        onDownload={() => void handleDownloadImage(workspaceDisplayUrl || workspaceImageUrl || '', 'modal-preview')}
        onClose={() => setIsWorkspaceImageModalOpen(false)}
      />
    </div>
  );
};

export default ApplyMaterials;
