import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { callGeminiImage, saveGenerationAuth, checkQuota, consumeCredits, CREDIT_COSTS, GenerationType, getGenerations, type Generation } from '../api';
import { MaterialOption, UploadedImage, StyleReferenceSource } from '../types';
import { isAuthBypassEnabled, useAuth, useUsage } from '../auth';
import { DrawingType } from '../utils/renderViewGuidance';
import { trackEvent } from '../utils/analytics';
import { IMAGE_MODEL_FALLBACK_WARNING, isImageModelFallbackUsed } from '../utils/imageModelFallback';
import { resolveImageSourceToDataUrl } from '../utils/imageUtils';
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
import PostProcessingModal from './apply-materials/PostProcessingModal';
import ProjectContextPanel from './apply-materials/ProjectContextPanel';
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
  const prevMoodboardRef = useRef(moodboardRenderUrl);
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
    setPreviousRenderUrl(null);
    setImageModelFallbackWarning(null);
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
  ) => {
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
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        console.warn('Skipping save-generation: missing access token.');
        return;
      }
      await saveGenerationAuth({
        prompt,
        imageDataUri,
        materials: metadata,
        generationType
      }, token);
    } catch (err) {
      console.error('Authenticated save failed:', err);
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
        const token = await getAccessToken();
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

      const data = await callGeminiImage(singlePayload, { timeoutMs: 120000 });
      const fallbackUsed = isImageModelFallbackUsed(data);
      const modelUsed = typeof data?.imageModelUsed === 'string' ? data.imageModelUsed : undefined;

      const newUrl = extractImageFromResponse(data);
      if (!newUrl) {
        throw new Error('Gemini did not return an image payload.');
      }

      setImageModelFallbackWarning(fallbackUsed ? IMAGE_MODEL_FALLBACK_WARNING : null);

      if (isAuthenticated) {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Please sign in to continue.');
        }

        await consumeCredits(token, {
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
        await refreshUsage();
      } else {
        incrementLocalUsage(requiredCredits, billedGenerationType);
      }

      setPreviousRenderUrl(appliedRenderUrl);
      onAppliedRenderUrlChange(newUrl);

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

      void persistGeneration(newUrl, prompt, billedGenerationType, {
        imageModelUsed: modelUsed,
        imageFallbackUsed: fallbackUsed
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the Gemini image backend.');
      return false;
    } finally {
      setStatus('idle');
      setRenderingMode(null);
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
          <h1 className="font-display text-3xl uppercase tracking-tight text-black sm:text-4xl lg:text-5xl">
            Render
          </h1>
          <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400">
            Costs: {CREDIT_COSTS.MOODBOARD_GENERATION} moodboard / {CREDIT_COSTS.RENDER_GENERATION} sketch+edits / {CREDIT_COSTS.FOUR_K_GENERATION} final (4K)
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
