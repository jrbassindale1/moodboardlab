import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ImageDown, Loader2, Sparkles, Upload, Wand2, X } from 'lucide-react';
import { callGeminiImage, saveGenerationAuth, checkQuota, consumeCredits, CREDIT_COSTS, GenerationType, getGenerations, type Generation } from '../api';
import { MaterialOption, UploadedImage, StyleReferenceSource } from '../types';
import { isAuthBypassEnabled, useAuth, useUsage } from '../auth';
import {
  DrawingType,
  getDrawingTypePromptDirectives,
  getRenderViewGuidance,
  inferDrawingType,
} from '../utils/renderViewGuidance';
import { formatFinishForDisplay } from '../utils/materialDisplay';
import { trackEvent } from '../utils/analytics';
import { IMAGE_MODEL_FALLBACK_WARNING, isImageModelFallbackUsed } from '../utils/imageModelFallback';
import { resolveImageSourceToDataUrl } from '../utils/imageUtils';
import UsageDisplay from './UsageDisplay';

type SceneControl = {
  enabled: boolean;
  value: number;
};

type SceneControls = {
  weather: SceneControl;
  activity: SceneControl;
  timeOfDay: SceneControl;
  season: SceneControl;
  viewCharacter: SceneControl;
};

// Project type for grouping generations
type Project = {
  id: string;
  name: string;
  createdAt: string;
};

type ImageSourceMode = 'upload' | 'project';

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

const WEATHER_OPTIONS = ['clear / sunny', 'soft overcast', 'heavy overcast', 'misty / moody', 'wet after rain'];
const ACTIVITY_OPTIONS = ['empty', 'sparse', 'moderate', 'busy'];
const TIME_OPTIONS = ['morning', 'midday', 'afternoon / evening', 'dusk', 'night'];
const SEASON_OPTIONS = ['spring', 'summer', 'autumn', 'winter'];
const VIEW_OPTIONS = ['clean architectural', 'lightly lived-in', 'lived-in scene', 'editorial photo', 'candid street view'];

const DEFAULT_SCENE_CONTROLS: SceneControls = {
  weather: { enabled: false, value: 0 },
  activity: { enabled: false, value: 0 },
  timeOfDay: { enabled: false, value: 0 },
  season: { enabled: false, value: 0 },
  viewCharacter: { enabled: false, value: 0 }
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB limit
const MAX_UPLOAD_DIMENSION = 1000;
const RESIZE_QUALITY = 0.82;
const RESIZE_MIME = 'image/webp';
const dataUrlSizeBytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] || '';
  const padding = (base64.match(/=+$/)?.[0].length ?? 0);
  return Math.floor((base64.length * 3) / 4) - padding;
};

const isDataUri = (value: string) => value.startsWith('data:');

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const loadImage = (src: string, useCrossOrigin = true) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (useCrossOrigin) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const downscaleImage = (
  dataUrl: string,
  targetMime = RESIZE_MIME,
  quality = RESIZE_QUALITY
): Promise<{ dataUrl: string; width: number; height: number; mimeType: string; sizeBytes: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported in this browser.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const mime = targetMime || 'image/jpeg';
      const resizedUrl = canvas.toDataURL(mime, quality);
      resolve({
        dataUrl: resizedUrl,
        width,
        height,
        mimeType: mime,
        sizeBytes: dataUrlSizeBytes(resizedUrl)
      });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });

const calculateAspectRatio = (width: number, height: number): string => {
  const ratio = width / height;

  const validRatios: { label: string; value: number }[] = [
    { label: '1:1', value: 1 },
    { label: '3:2', value: 3 / 2 },
    { label: '2:3', value: 2 / 3 },
    { label: '3:4', value: 3 / 4 },
    { label: '4:3', value: 4 / 3 },
    { label: '4:5', value: 4 / 5 },
    { label: '5:4', value: 5 / 4 },
    { label: '9:16', value: 9 / 16 },
    { label: '16:9', value: 16 / 9 },
    { label: '21:9', value: 21 / 9 }
  ];

  let closest = validRatios[0];
  let minDiff = Math.abs(ratio - closest.value);

  for (const validRatio of validRatios) {
    const diff = Math.abs(ratio - validRatio.value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = validRatio;
    }
  }

  return closest.label;
};

const dataUrlToInlineData = (dataUrl: string) => {
  const [meta, content] = dataUrl.split(',');
  const mimeMatch = meta?.match(/data:(.*);base64/);
  return {
    inlineData: {
      mimeType: mimeMatch?.[1] || 'image/png',
      data: content || ''
    }
  };
};

const formatCreditCostMessage = (credits: number) =>
  credits === 1
    ? 'Not enough credits. This action costs 1 credit.'
    : `Not enough credits. This action costs ${credits} credits.`;

const PROJECT_GENERATION_LABELS: Partial<Record<Generation['type'], string>> = {
  moodboard: 'Moodboard',
  applyMaterials: 'Render',
  upscale: '4K Upscale'
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
  const { refreshUsage, incrementLocalUsage, isAnonymous, canGenerate, remaining, purchasedCredits, isAdmin } = useUsage();

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
  const [renderingMode, setRenderingMode] = useState<'upload-1k' | 'upscale-4k' | 'edit' | null>(null);
  const prevMoodboardRef = useRef(moodboardRenderUrl);
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
  const hasProjectImagePicker = Boolean(currentProject?.id);
  const hasSceneControlsEnabled = useMemo(
    () => (Object.values(sceneControls) as SceneControl[]).some((control) => control.enabled),
    [sceneControls]
  );
  const projectImageGenerations = useMemo(
    () =>
      projectGenerations
        .filter((generation) => getGenerationProjectId(generation) === currentProject?.id)
        .filter(isSelectableProjectGeneration),
    [currentProject?.id, projectGenerations]
  );
  const effectiveStyleReferenceSource = useMemo<StyleReferenceSource | null>(() => {
    if (!styleReferenceImage) return null;
    return styleReferenceSource ?? (styleReferenceSourceId ? 'project' : 'external');
  }, [styleReferenceImage, styleReferenceSource, styleReferenceSourceId]);
  const styleReferenceSourceLabel = effectiveStyleReferenceSource === 'project'
    ? 'Sourced from project render'
    : 'Uploaded file';
  const styleReferenceHint = effectiveStyleReferenceSource === 'project'
    ? 'Will match material expression for visual consistency across this project.'
    : 'Will influence lighting and atmosphere only. Materials come from your palette.';
  const excludedCount = board.length - renderMaterials.length;

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
        const limit = 100;

        while (true) {
          const data = await getGenerations(token, { limit, offset });
          allItems.push(...(data.items || []));
          if (!data.hasMore) break;
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

  const buildSceneControlsText = (controls: SceneControls): string => {
    const parts: string[] = [];

    if (controls.weather.enabled) {
      parts.push(`adjust atmospheric weather to ${WEATHER_OPTIONS[controls.weather.value]} (sky, clouds, light quality only - preserve all geometry and landscape)`);
    }
    if (controls.activity.enabled) {
      parts.push(`adjust entourage to ${ACTIVITY_OPTIONS[controls.activity.value]} activity level (people count/density only - no changes to architecture or site)`);
    }
    if (controls.timeOfDay.enabled) {
      parts.push(`adjust lighting to ${TIME_OPTIONS[controls.timeOfDay.value]} (sun angle, shadows, ambient light only - keep everything else identical)`);
    }
    if (controls.season.enabled) {
      parts.push(`adjust seasonal character to ${SEASON_OPTIONS[controls.season.value]} (vegetation appearance, foliage color only - preserve landscape type and site layout)`);
    }
    if (controls.viewCharacter.enabled) {
      parts.push(`adjust scene styling to ${VIEW_OPTIONS[controls.viewCharacter.value]} character (entourage detail level, styling approach only - no geometry changes)`);
    }

    if (parts.length === 0) return '';

    return `SUBTLE SCENE ADJUSTMENTS (preserve all architecture, geometry, camera, and landscape): ${parts.join('; ')}.`;
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

    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {projectImageGenerations.map((generation) => {
          const isSelected = selectedGenerationId === generation.id;
          const isSelecting = selectingProjectImageId === `${target}:${generation.id}`;
          return (
            <button
              key={`${target}-${generation.id}`}
              type="button"
              onClick={() => void handleProjectGenerationSelect(generation, target)}
              disabled={Boolean(selectingProjectImageId)}
              className={`overflow-hidden border p-2 text-left transition-colors ${
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
    const billedGenerationType = options?.renderMode === 'upscale-4k' ? 'upscale' : 'applyMaterials';

    // Check quota - server-side for authenticated users, shared local quota for anonymous users
    if (isAuthenticated) {
      // Refresh and check server-side quota
      try {
        const token = await getAccessToken();
        if (token) {
          const quotaCheck = await checkQuota(token);
          if (generationMode === '4k' && !quotaCheck.isAdmin && (quotaCheck.purchasedCredits || 0) < CREDIT_COSTS.FOUR_K_GENERATION) {
            setError('Render 4K requires at least 5 purchased credits.');
            return false;
          }
          if (!quotaCheck.canGenerate || quotaCheck.remaining < requiredCredits) {
            setError(formatCreditCostMessage(requiredCredits));
            return false;
          }
        }
      } catch (err) {
        console.error('Quota check failed:', err);
        // Continue with render if quota check fails (graceful degradation)
      }
    } else {
      if (remaining < requiredCredits) {
        setError(formatCreditCostMessage(requiredCredits));
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
      setError('Create a render first before generating a 4K version.');
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

    const materialsByCategory: Record<string, MaterialOption[]> = {};
    renderMaterials.forEach((item) => {
      if (!materialsByCategory[item.category]) {
        materialsByCategory[item.category] = [];
      }
      materialsByCategory[item.category].push(item);
    });

    const perMaterialLines = Object.entries(materialsByCategory)
      .map(([category, items]) => {
        const categoryHeader = `\n[${category.toUpperCase()}]`;
        const itemLines = items
          .map((item) => {
            const finishHasColorInfo =
              Boolean(item.colorLabel) ||
              item.finish.includes(' — ') ||
              item.finish.match(/\(#[0-9a-fA-F]{6}\)/) ||
              item.finish.toLowerCase().includes('colour') ||
              item.finish.toLowerCase().includes('color') ||
              item.finish.toLowerCase().includes('select');

            let colorInfo = '';
            if (finishHasColorInfo) {
              if (item.colorLabel) {
                colorInfo = ` | color: ${item.colorLabel}`;
              } else {
                const labelMatch = item.finish.match(/ — ([^(]+)/);
                if (labelMatch) {
                  colorInfo = ` | color: ${labelMatch[1].trim()}`;
                } else if (item.finish.match(/\(#[0-9a-fA-F]{6}\)/)) {
                  colorInfo = ` | color: ${item.tone}`;
                }
              }
            }

            return `- ${item.name} (${item.finish})${colorInfo} | description: ${item.description}`;
          })
          .join('\n');
        return `${categoryHeader}\n${itemLines}`;
      })
      .join('\n');

    const trimmedNote = renderNote.trim();
    const sceneControlsText = buildSceneControlsText(sceneControls);
    const noTextRule =
      'CRITICAL REQUIREMENT - ABSOLUTELY NO TEXT WHATSOEVER in the image: no words, letters, numbers, labels, captions, logos, watermarks, signatures, stamps, or typographic marks of ANY kind. NO pseudo-text, NO scribbles, NO marks that resemble writing. This is a STRICT requirement that must be followed. The image must be completely free of all textual elements, letters, numbers, and symbols.';
    const viewGuidanceInput = `${options?.editPrompt || ''}\n${trimmedNote}`.trim();
    const viewGuidance = getRenderViewGuidance(viewGuidanceInput);

    // Representation-aware branching stage.
    // Future prompt edits should preserve this decision point so orthographic inputs are not
    // accidentally rewritten as perspective scenes.
    const requestedDrawingType = options?.drawingType ?? 'auto';
    const drawingTypeResolution = inferDrawingType({
      requestedType: requestedDrawingType,
      userText: `${options?.editPrompt || ''}\n${trimmedNote}`,
      baseImageName: uploadedImage?.name || null,
    });
    const drawingType = drawingTypeResolution.drawingType;
    const representationDirectives = getDrawingTypePromptDirectives({
      drawingType,
      userInstruction: `${options?.editPrompt || ''}\n${trimmedNote}`,
      allowUserDrivenPerspectiveConversion: true,
    });
    const representationControlText = [
      'REPRESENTATION CONTROL:',
      `- requested drawingType: ${requestedDrawingType}`,
      `- resolved drawingType: ${drawingType} (source: ${drawingTypeResolution.source})`,
      ...representationDirectives.map((line) => `- ${line}`),
    ].join('\n');

    if (requestedDrawingType === 'auto') {
      console.log('[Apply Render] drawingType auto resolution', {
        requestedDrawingType,
        resolvedDrawingType: drawingType,
        source: drawingTypeResolution.source,
      });
    }

    const atmosphereInstruction = (viewGuidance.isTechnicalView || drawingType !== 'perspective')
      ? '- Use neutral, even lighting and keep edges/cut geometry crisp; avoid cinematic haze, vignette, and dramatic color grading.'
      : '- Include atmospheric effects: subtle depth haze, realistic sky, natural color grading.';
    const lineDrawingInstruction =
      drawingType === 'perspective'
        ? '- If input is a line drawing/sketch/CAD export: interpret the geometry and convert to a photorealistic perspective render while preserving source framing.'
        : `- If input is a line drawing/sketch/CAD export: preserve the ${drawingType} projection and convert it into a photorealistic ${drawingType} visualization without introducing perspective drift.`;
    const renderTargetInstruction =
      drawingType === 'perspective'
        ? 'Transform the provided base image into a PHOTOREALISTIC architectural render while applying the materials listed below.'
        : `Transform the provided base image into a PHOTOREALISTIC architectural ${drawingType} visualization while preserving its ${drawingType === 'plan' ? 'top-down orthographic' : 'orthographic'} projection.`;

    const basePrompt = isUpscalingRender
      ? `Create a 4K upscaled version of the provided architectural render. Preserve the exact composition, camera position, geometry, materials, entourage, and lighting from the source image. Do not redesign or reinterpret the image. Increase resolution, sharpen material detail, and improve fine-grain realism only.`
      : isEditingRender
      ? `You are in a multi-turn render conversation. Use the provided previous render as the base image and update it while preserving the composition, camera, and lighting. Keep material assignments consistent with the list below and do not remove existing context unless explicitly requested.\n\n${noTextRule}\n\nVIEW CONTROL:\n- ${viewGuidance.styleDirective}\n- ${viewGuidance.cameraDirective}\n- ${viewGuidance.antiDriftDirective}\n\n${representationControlText}\n\nMaterials to respect:\n${summaryText}\n\nNew instruction:\nBEFORE MAKING ANY CHANGES - CRITICAL CONSTRAINTS TO PRESERVE:\n- GEOMETRY: Keep ALL building forms, volumes, floor plans, and structural massing EXACTLY as shown - pixel-accurate preservation required\n- CAMERA: Use EXACT same viewpoint, angle, height, focal length, framing - no perspective shifts allowed\n- LANDSCAPE: Preserve ALL terrain, topography, water bodies, ground plane, site context - if water exists keep it, if hills exist keep them, do NOT change landscape type\n- ARCHITECTURE: Do NOT add, remove, resize, or relocate any windows, doors, walls, roofs, or structural elements\n- SITE: Keep all paths, decking, paving, retaining walls, and site infrastructure exactly as shown\n- ONLY ADJUST: Atmosphere (sky, clouds, weather), lighting quality (sun angle, shadows), entourage (people, vegetation appearance within existing landscape), and surface material finishes\n\n${options?.editPrompt || ''}${sceneControlsText ? `\n${sceneControlsText}` : ''}${trimmedNote ? `\nAdditional render note: ${trimmedNote}` : ''}`
      : `${renderTargetInstruction} Materials are organized by their architectural category to help you understand where each should be applied.\n\n${noTextRule}\n\nMaterials to apply (organized by category):\n${perMaterialLines}\n\nCRITICAL INSTRUCTIONS:\n- VIEW CONTROL:\n- ${viewGuidance.styleDirective}\n- ${viewGuidance.cameraDirective}\n- ${viewGuidance.antiDriftDirective}\n${representationControlText}\n- OUTPUT MUST BE PHOTOREALISTIC: realistic lighting, shadows, reflections, material textures, and depth of field\n- APPLY MATERIALS ACCORDING TO THEIR CATEGORIES: floors to horizontal surfaces, walls to vertical surfaces, ceilings to overhead surfaces, external materials to facades, etc.\n${lineDrawingInstruction}\n- If input is already photorealistic: enhance and apply materials while maintaining realism\n\nGEOMETRY PRESERVATION - CRITICAL:\n- STRICT ADHERENCE TO INPUT GEOMETRY: Do NOT alter, modify, reshape, or reinterpret the building forms, volumes, or spatial layout from the base image\n- PRESERVE EXACT BUILDING FOOTPRINT: Maintain the precise floor plan, building outline, and structural massing shown in the input\n- LOCK CAMERA POSITION: Use the EXACT camera angle, viewpoint height, focal length, and framing from the base image - do not shift perspective or change the view\n- MAINTAIN PROPORTIONS: Keep all dimensional relationships, floor heights, window-to-wall ratios, and scale relationships identical to the input\n- RESPECT ARCHITECTURAL ELEMENTS: Do not add, remove, resize, or relocate windows, doors, columns, walls, roofs, or any structural components\n- PRESERVE SPATIAL RELATIONSHIPS: Maintain distances between buildings, relationship to ground plane, and overall site composition\n- NO GEOMETRY DRIFT: The building shape, form, and layout must remain pixel-accurate to the input - only materials, lighting, and surface finishes should change\n\n- Apply materials accurately with realistic scale cues (joints, brick coursing, panel seams, wood grain direction)\n- Add realistic environmental lighting (natural daylight, ambient occlusion, soft shadows)\n${atmosphereInstruction}\n- Materials must look tactile and realistic with proper surface properties (roughness, reflectivity, texture detail)\n- Maintain architectural accuracy while achieving photographic quality\n- White background not required; enhance or maintain contextual environment from base image\n${sceneControlsText ? `- ${sceneControlsText}\n` : ''}${trimmedNote ? `- Additional requirements: ${trimmedNote}\n` : ''}`;
    const useStyleReference = Boolean(styleReferenceImage && !isUpscalingRender);
    const sceneControlsOverrideLine = hasSceneControlsEnabled
      ? '\n- Where scene controls (time of day, weather, season) conflict with the style reference, the SCENE CONTROLS take priority.'
      : '';
    const projectStyleReferenceBlock = `\n\nSTYLE REFERENCE IMAGE (FROM THIS PROJECT):\nTwo images are provided.\n- IMAGE 1 is the BASE IMAGE and is the ONLY authority on geometry, composition, camera, massing, landscape, and architectural layout.\n- IMAGE 2 is a PROJECT STYLE REFERENCE generated from the same material palette.\n\nUse IMAGE 2 to ensure VISUAL CONSISTENCY across the project:\n- Match how each material has been rendered - board direction, joint spacing, texture scale, surface reflectivity, colour tone, and weathering character\n- Maintain the same lighting quality, shadow behaviour, and colour temperature\n- Ensure the two renders look like they belong to the same architectural scheme\n- Carry forward the same level of material detail and photographic quality\n\nThe material list above still controls WHAT materials go WHERE. The project reference controls HOW those same materials should be expressed visually - their texture, scale, tone, and finish quality.\n\nABSOLUTE GEOMETRY FIREWALL:\n- NEVER transfer, blend, average, merge, interpolate, or borrow geometry from IMAGE 2\n- Do NOT copy building form, silhouette, rooflines, window patterns, door positions, facade arrangement, floor count, structural rhythm, site layout, horizon line, or camera perspective from IMAGE 2\n- If IMAGE 2 conflicts with IMAGE 1 in ANY spatial or architectural way, discard IMAGE 2 geometry completely and follow IMAGE 1 exactly\n- Treat IMAGE 2 as a material-expression, lighting, and finish-quality reference only - NOT as a spatial reference\n- Final output must preserve the footprint, outline, openings, proportions, and framing of IMAGE 1 only${sceneControlsOverrideLine}`;
    const externalStyleReferenceBlock = `\n\nSTYLE REFERENCE IMAGE (EXTERNAL):\nTwo images are provided.\n- IMAGE 1 is the BASE IMAGE and is the ONLY authority on geometry, composition, camera, massing, landscape, and architectural layout.\n- IMAGE 2 is an EXTERNAL STYLE REFERENCE.\n\nUse IMAGE 2 ONLY to inform the overall rendering quality:\n- Lighting behaviour (how light falls on surfaces, shadow softness, sun angle quality)\n- Colour grading and colour temperature (warm/cool, muted/saturated)\n- Depth of field and photographic character\n- Overall atmospheric mood\n\nSTRICT EXTERNAL REFERENCE RULES:\n- Do NOT take ANY material, colour, or surface information from IMAGE 2. ALL materials must come strictly and exclusively from the material list above. The material palette is the only authority on what materials appear and where.\n- NEVER transfer, blend, average, merge, interpolate, or borrow geometry from IMAGE 2.\n- Do NOT copy building form, silhouette, rooflines, window patterns, door positions, facade arrangement, floor count, structural rhythm, site layout, horizon line, or camera perspective from IMAGE 2.\n- If IMAGE 2 conflicts with IMAGE 1 in ANY spatial or architectural way, discard IMAGE 2 geometry completely and follow IMAGE 1 exactly.\n- Treat IMAGE 2 as a lighting, atmosphere, and photographic-quality reference only - NOT as a spatial or material reference.\n- This reference influences HOW the render looks, not WHAT it contains.${sceneControlsOverrideLine}`;
    const styleReferenceBlock = effectiveStyleReferenceSource === 'project'
      ? projectStyleReferenceBlock
      : externalStyleReferenceBlock;
    const prompt = useStyleReference
      ? `${basePrompt}${styleReferenceBlock}`
      : basePrompt;

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

      const payload = {
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

      const data = await callGeminiImage(payload);
      const fallbackUsed = isImageModelFallbackUsed(data);
      const modelUsed = typeof data?.imageModelUsed === 'string' ? data.imageModelUsed : undefined;
      setImageModelFallbackWarning(fallbackUsed ? IMAGE_MODEL_FALLBACK_WARNING : null);
      let img: string | null = null;
      let mime: string | null = null;
      const candidates = data?.candidates || [];
      for (const c of candidates) {
        const parts = c?.content?.parts || c?.parts || [];
        for (const p of parts) {
          const inline = p.inlineData || p.inline_data;
          if (inline?.data) {
            img = inline.data;
            mime = inline.mimeType || inline.mime_type || 'image/png';
            break;
          }
        }
        if (img) break;
      }
      if (!img) throw new Error('Gemini did not return an image payload.');
      const newUrl = `data:${mime || 'image/png'};base64,${img}`;

      if (isAuthenticated) {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Please sign in to continue.');
        }

        await consumeCredits(token, {
          generationType: billedGenerationType,
          generationMode,
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
    const hasSceneControls = (Object.values(sceneControls) as SceneControl[]).some(control => control.enabled);

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
      renderMode: 'edit'
    });
    if (wasUpdated) {
      setAppliedEditPrompt('');
    }
  };

  const handleRender4K = async () => {
    if (!appliedRenderUrl) {
      setError('Create a render first before generating a 4K version.');
      return;
    }
    if (!canUse4K) {
      setError('Render 4K requires at least 5 purchased credits.');
      return;
    }

    const confirmed = window.confirm(
      'Render 4K will upscale the current image and cost 5 credits. Continue?'
    );
    if (!confirmed) {
      return;
    }

    await runApplyRender({
      baseImageDataUrl: appliedRenderUrl,
      imageSize: '4K',
      renderMode: 'upscale-4k'
    });
  };


  const canUse4K = Boolean(isAuthenticated && (isAdmin || purchasedCredits >= CREDIT_COSTS.FOUR_K_GENERATION));
  const fourKTooltip = isAdmin
    ? 'Generate a 4K upscale of the current render'
    : canUse4K
    ? 'Generate a 4K upscale of the current render'
    : 'Requires at least 5 purchased credits';

  return (
    <div className="w-full min-h-screen pt-20 bg-white">
      <div className="max-w-screen-2xl mx-auto px-6 md:px-8 lg:px-12 py-12 space-y-10">
        <div className="flex flex-col lg:flex-row gap-6 border-b border-gray-200 pb-6">
          <div>
            <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter">
              Render
            </h1>
            <p className="font-sans text-gray-600 max-w-2xl mt-3">
              Upload a base image and apply the materials from your workspace to generate a new render.
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={() => onNavigate?.('moodboard')}
                className="px-4 py-2 border border-gray-200 uppercase font-mono text-[11px] tracking-widest hover:border-black"
              >
                Back to workspace
              </button>
            </div>
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

        <UsageDisplay variant="minimal" showSignUpPrompt={!isAuthBypassEnabled && isAnonymous} />

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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1fr)]">
          {moodboardRenderUrl ? (
            <div className="border border-gray-200 bg-white p-4 space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
                Current Moodboard
              </div>
              <div className="border border-gray-200 bg-gray-50 flex items-center justify-center">
                <img
                  src={moodboardRenderUrl}
                  alt="Moodboard preview"
                  className="max-h-[80vh] max-w-full h-auto w-auto object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 bg-white p-4 space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
                Moodboard Preview
              </div>
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                <p className="font-sans text-sm text-gray-600">
                  {restoredWithoutMoodboard
                    ? 'No moodboard is saved with this render.'
                    : 'No moodboard generated yet.'}
                </p>
                <button
                  onClick={() => {
                    onClearRestoredFlag?.();
                    onNavigate?.('moodboard');
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 bg-white font-mono text-[10px] uppercase tracking-widest hover:border-black"
                >
                  Go to workspace
                </button>
              </div>
            </div>
          )}

              <div className="border border-gray-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
                    Materials in Render
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                    {renderMaterials.length}/{board.length} included
                  </div>
                </div>
                <p className="font-sans text-xs text-gray-600">
                  Tick a material to exclude it from this render. Excluded materials still stay in the sustainability report.
                </p>
                {board.length === 0 ? (
                  <div className="border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
                    No materials selected yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {board.map((item, idx) => (
                      <label
                        key={`${item.id}-${idx}`}
                        className={`flex items-start gap-3 border border-gray-200 p-2 bg-white hover:bg-gray-50 ${
                          item.excludeFromMoodboardRender ? 'opacity-70' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(item.excludeFromMoodboardRender)}
                          onChange={(e) => handleToggleExclude(idx, e.target.checked)}
                          className="mt-1 h-3 w-3 border-gray-300 text-gray-900"
                          aria-label={`Exclude ${item.name} from render`}
                        />
                        <div className="w-8 h-8 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: item.tone }} />
                        <div className="min-w-0">
                          <div className="font-sans text-sm text-gray-900 truncate">{item.name}</div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500 truncate">
                            {formatFinishForDisplay(item.finish)}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {excludedCount > 0 && (
                  <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                    {excludedCount} excluded from render
                  </div>
                )}
              </div>

	              <div className="space-y-3 border border-gray-200 bg-white p-4">
	                <div className="space-y-3 border border-gray-200 bg-white p-3">
	                  <div className="flex items-center justify-between gap-3">
	                    <div>
	                      <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
	                        Base Image
	                      </div>
	                      <p className="mt-1 text-sm text-gray-600">
	                        Use one base image to define geometry, composition, and camera angle.
	                      </p>
	                    </div>
	                  </div>
	                  <div className="flex flex-wrap gap-2">
	                    <button
	                      type="button"
	                      onClick={() => setBaseImageSourceMode('upload')}
	                      className={`inline-flex items-center gap-2 px-3 py-2 border font-mono text-[10px] uppercase tracking-widest ${
	                        baseImageSourceMode === 'upload'
	                          ? 'border-black bg-black text-white'
	                          : 'border-gray-300 bg-white text-gray-700 hover:border-black'
	                      }`}
	                    >
	                      <Upload className="h-3.5 w-3.5" />
	                      Upload
	                    </button>
	                    {hasProjectImagePicker && (
	                      <button
	                        type="button"
	                        onClick={() => setBaseImageSourceMode('project')}
	                        className={`inline-flex items-center gap-2 px-3 py-2 border font-mono text-[10px] uppercase tracking-widest ${
	                          baseImageSourceMode === 'project'
	                            ? 'border-black bg-black text-white'
	                            : 'border-gray-300 bg-white text-gray-700 hover:border-black'
	                        }`}
	                      >
	                        <ImageDown className="h-3.5 w-3.5" />
	                        From Project
	                      </button>
	                    )}
	                  </div>
	                  {baseImageSourceMode === 'upload' ? (
	                    <>
	                      <input
	                        ref={baseFileInputRef}
	                        type="file"
	                        accept="image/*"
	                        onChange={onBaseFileInputChange}
	                        className="text-sm font-sans file:mr-3 file:rounded-none file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-[11px] file:uppercase file:tracking-widest file:font-mono file:text-gray-700 file:hover:bg-gray-50"
	                      />
	                      <p className="font-sans text-sm text-gray-600">
	                        Upload one image to use as the base for the next render. Uploading a new image replaces the current one. Line drawings and sketches will give the best results.
	                      </p>
	                    </>
	                  ) : (
	                    renderProjectPickerState('base')
	                  )}
	                  {uploadedImage && (
	                    <div className="border border-gray-200 bg-white p-2 max-w-sm">
	                      <div className="aspect-[4/3] overflow-hidden bg-gray-100">
	                        <img src={uploadedImage.dataUrl} alt={uploadedImage.name} className="w-full h-full object-cover" />
	                      </div>
	                      <div className="mt-2 flex items-center justify-between gap-3">
	                        <div className="min-w-0">
	                          <div className="font-mono text-[10px] uppercase tracking-widest text-gray-600 truncate">
	                            {uploadedImage.name}
	                          </div>
	                          <div className="mt-1 text-xs text-gray-500">
	                            {uploadedImage.sourceGenerationId ? 'Sourced from project render' : 'Uploaded file'}
	                          </div>
	                        </div>
	                        <div className="flex gap-2">
	                          <button
	                            type="button"
	                            onClick={openBaseFilePicker}
	                            className="px-2 py-1 border border-gray-300 font-mono text-[9px] uppercase tracking-widest text-gray-700 hover:border-black"
	                          >
	                            Replace
	                          </button>
	                          <button
	                            type="button"
	                            onClick={handleRemoveBaseImage}
	                            className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 font-mono text-[9px] uppercase tracking-widest text-gray-700 hover:border-black"
	                          >
	                            <X className="h-3 w-3" />
	                            Remove
	                          </button>
	                        </div>
	                      </div>
	                    </div>
	                  )}
	                </div>
	                <div className="space-y-3 border border-dashed border-gray-300 bg-gray-50 p-3">
	                  <div className="flex items-start justify-between gap-3">
	                    <div>
	                      <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
	                        Style Reference (Optional)
	                      </div>
	                      <p className="mt-1 text-sm text-gray-600">
	                        Influences lighting, atmosphere, and colour grade. Does not affect materials or geometry.
	                      </p>
	                    </div>
	                    <Sparkles className="h-4 w-4 text-gray-400" />
	                  </div>
	                  <div className="flex flex-wrap gap-2">
	                    <button
	                      type="button"
	                      onClick={() => setStyleReferenceSourceMode('upload')}
	                      className={`inline-flex items-center gap-2 px-3 py-2 border font-mono text-[10px] uppercase tracking-widest ${
	                        styleReferenceSourceMode === 'upload'
	                          ? 'border-black bg-black text-white'
	                          : 'border-gray-300 bg-white text-gray-700 hover:border-black'
	                      }`}
	                    >
	                      <Upload className="h-3.5 w-3.5" />
	                      Upload
	                    </button>
	                    {hasProjectImagePicker && (
	                      <button
	                        type="button"
	                        onClick={() => setStyleReferenceSourceMode('project')}
	                        className={`inline-flex items-center gap-2 px-3 py-2 border font-mono text-[10px] uppercase tracking-widest ${
	                          styleReferenceSourceMode === 'project'
	                            ? 'border-black bg-black text-white'
	                            : 'border-gray-300 bg-white text-gray-700 hover:border-black'
	                        }`}
	                      >
	                        <ImageDown className="h-3.5 w-3.5" />
	                        From Project
	                      </button>
	                    )}
	                  </div>
	                  {styleReferenceSourceMode === 'upload' ? (
	                    <input
	                      ref={styleReferenceFileInputRef}
	                      type="file"
	                      accept="image/*"
	                      onChange={onStyleReferenceFileInputChange}
	                      className="text-sm font-sans file:mr-3 file:rounded-none file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-[11px] file:uppercase file:tracking-widest file:font-mono file:text-gray-700 file:hover:bg-gray-50"
	                    />
	                  ) : (
	                    renderProjectPickerState('style')
	                  )}
	                  {styleReferenceImage ? (
	                    <div className="border border-dashed border-gray-300 bg-white p-2 max-w-xs">
	                      <div className="aspect-[4/3] overflow-hidden bg-gray-100">
	                        <img src={styleReferenceImage.dataUrl} alt={styleReferenceImage.name} className="w-full h-full object-cover" />
	                      </div>
	                      <div className="mt-2 flex items-center justify-between gap-3">
	                        <div className="min-w-0">
                          <div className="font-mono text-[10px] uppercase tracking-widest text-gray-600 truncate">
                            {styleReferenceImage.name}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {styleReferenceSourceLabel}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {styleReferenceHint}
                          </div>
                        </div>
	                        <button
	                          type="button"
	                          onClick={handleRemoveStyleReference}
	                          className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 font-mono text-[9px] uppercase tracking-widest text-gray-700 hover:border-black"
	                        >
	                          <X className="h-3 w-3" />
	                          Remove
	                        </button>
	                      </div>
	                    </div>
	                  ) : null}
	                </div>
	                <div className="space-y-2">
	                  <label className="font-mono text-[11px] uppercase tracking-widest text-gray-600 font-semibold">
	                    Custom render instructions (optional)
	                  </label>
	                  <textarea
	                    value={renderNote}
	                    onChange={(e) => setRenderNote(e.target.value)}
	                    placeholder="E.g., street-level exterior view at dusk with wet paving, or frontal elevation view with neutral lighting."
	                    className="w-full border border-gray-300 px-3 py-2 font-sans text-sm min-h-[80px] resize-vertical"
	                  />
	                </div>

                {/* Scene Controls Panel */}
                <div className="space-y-3 border border-gray-200 bg-white p-3">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600 font-semibold">
                    Scene Controls (Optional)
                  </div>

                  {/* Weather / Atmosphere */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="weather-enable"
                        checked={sceneControls.weather.enabled}
                        onChange={(e) => setSceneControls(prev => ({
                          ...prev,
                          weather: { ...prev.weather, enabled: e.target.checked }
                        }))}
                        className="h-3 w-3 border-gray-300 text-gray-900"
                      />
                      <label htmlFor="weather-enable" className="font-sans text-xs text-gray-700">
                        Weather / Atmosphere
                      </label>
                    </div>
                    {sceneControls.weather.enabled && (
                      <div className="ml-5 space-y-1">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                          {WEATHER_OPTIONS[sceneControls.weather.value]}
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={WEATHER_OPTIONS.length - 1}
                          step="1"
                          value={sceneControls.weather.value}
                          onChange={(e) => setSceneControls(prev => ({
                            ...prev,
                            weather: { ...prev.weather, value: parseInt(e.target.value) }
                          }))}
                          className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  {/* Activity Level */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="activity-enable"
                        checked={sceneControls.activity.enabled}
                        onChange={(e) => setSceneControls(prev => ({
                          ...prev,
                          activity: { ...prev.activity, enabled: e.target.checked }
                        }))}
                        className="h-3 w-3 border-gray-300 text-gray-900"
                      />
                      <label htmlFor="activity-enable" className="font-sans text-xs text-gray-700">
                        Activity Level
                      </label>
                    </div>
                    {sceneControls.activity.enabled && (
                      <div className="ml-5 space-y-1">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                          {ACTIVITY_OPTIONS[sceneControls.activity.value]}
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={ACTIVITY_OPTIONS.length - 1}
                          step="1"
                          value={sceneControls.activity.value}
                          onChange={(e) => setSceneControls(prev => ({
                            ...prev,
                            activity: { ...prev.activity, value: parseInt(e.target.value) }
                          }))}
                          className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  {/* Time of Day */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="time-enable"
                        checked={sceneControls.timeOfDay.enabled}
                        onChange={(e) => setSceneControls(prev => ({
                          ...prev,
                          timeOfDay: { ...prev.timeOfDay, enabled: e.target.checked }
                        }))}
                        className="h-3 w-3 border-gray-300 text-gray-900"
                      />
                      <label htmlFor="time-enable" className="font-sans text-xs text-gray-700">
                        Time of Day
                      </label>
                    </div>
                    {sceneControls.timeOfDay.enabled && (
                      <div className="ml-5 space-y-1">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                          {TIME_OPTIONS[sceneControls.timeOfDay.value]}
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={TIME_OPTIONS.length - 1}
                          step="1"
                          value={sceneControls.timeOfDay.value}
                          onChange={(e) => setSceneControls(prev => ({
                            ...prev,
                            timeOfDay: { ...prev.timeOfDay, value: parseInt(e.target.value) }
                          }))}
                          className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  {/* Season */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="season-enable"
                        checked={sceneControls.season.enabled}
                        onChange={(e) => setSceneControls(prev => ({
                          ...prev,
                          season: { ...prev.season, enabled: e.target.checked }
                        }))}
                        className="h-3 w-3 border-gray-300 text-gray-900"
                      />
                      <label htmlFor="season-enable" className="font-sans text-xs text-gray-700">
                        Season
                      </label>
                    </div>
                    {sceneControls.season.enabled && (
                      <div className="ml-5 space-y-1">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                          {SEASON_OPTIONS[sceneControls.season.value]}
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={SEASON_OPTIONS.length - 1}
                          step="1"
                          value={sceneControls.season.value}
                          onChange={(e) => setSceneControls(prev => ({
                            ...prev,
                            season: { ...prev.season, value: parseInt(e.target.value) }
                          }))}
                          className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

	                  {/* View Character */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="view-enable"
                        checked={sceneControls.viewCharacter.enabled}
                        onChange={(e) => setSceneControls(prev => ({
                          ...prev,
                          viewCharacter: { ...prev.viewCharacter, enabled: e.target.checked }
                        }))}
                        className="h-3 w-3 border-gray-300 text-gray-900"
                      />
                      <label htmlFor="view-enable" className="font-sans text-xs text-gray-700">
                        View Character
                      </label>
                    </div>
                    {sceneControls.viewCharacter.enabled && (
                      <div className="ml-5 space-y-1">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                          {VIEW_OPTIONS[sceneControls.viewCharacter.value]}
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={VIEW_OPTIONS.length - 1}
                          step="1"
                          value={sceneControls.viewCharacter.value}
                          onChange={(e) => setSceneControls(prev => ({
                            ...prev,
                            viewCharacter: { ...prev.viewCharacter, value: parseInt(e.target.value) }
                          }))}
                          className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}
	                  </div>
	                </div>
	                {styleReferenceImage && hasSceneControlsEnabled && (
	                  <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
	                    Scene controls will override the style reference where they conflict.
	                  </div>
	                )}
	                <button
	                  onClick={() => runApplyRender({ renderMode: 'upload-1k' })}
	                  disabled={status !== 'idle' || !board.length || renderMaterials.length === 0 || !canGenerate || !uploadedImage}
	                  className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
	                >
	                  {status === 'render' && renderingMode === 'upload-1k' ? (
	                    <>
	                      <Loader2 className="w-4 h-4 animate-spin" />
	                      Rendering with Upload
	                    </>
	                  ) : (
	                    <>
	                      <ImageDown className="w-4 h-4" />
	                      Render with Upload
	                    </>
	                  )}
	                </button>
	              </div>
            </div>

            {appliedRenderUrl && (
              <div className="space-y-4">
                <div className="border border-gray-200 p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
                      Applied Render
                    </div>
                  </div>
                  <div className="relative w-full border border-gray-200 bg-gray-50 flex items-center justify-center p-2">
                    <img
                      src={appliedRenderUrl}
                      alt="Applied render"
                      className={`max-h-[75vh] max-w-full h-auto w-auto object-contain transition-all duration-300 ${status === 'render' ? 'blur-sm opacity-70' : ''}`}
                    />
                    {status === 'render' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2 bg-white/80 px-4 py-3 rounded-lg shadow-sm">
                          <Loader2 className="w-6 h-6 animate-spin text-gray-700" />
                          <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">Generating...</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600 font-semibold">
                      Refine Your Render
                    </div>
                    <p className="font-sans text-sm text-gray-700">
                      Describe changes you'd like to make, or use the scene controls below to adjust lighting, weather, and activity.
                    </p>
                    <textarea
                      value={appliedEditPrompt}
                      onChange={(e) => setAppliedEditPrompt(e.target.value)}
                      placeholder="E.g., add people walking, change to evening atmosphere, include more vegetation and street furniture."
                      disabled={!canGenerate}
                      className="w-full border border-gray-300 px-3 py-2 font-sans text-sm min-h-[80px] resize-vertical disabled:bg-gray-100 disabled:text-gray-400"
                    />

                    {/* Scene Controls Panel for Edits */}
                    <div className="space-y-3 border border-gray-200 bg-white p-3">
                      <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600 font-semibold">
                        Scene Controls (Optional)
                      </div>

                      {/* Weather / Atmosphere */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="weather-enable-edit"
                            checked={sceneControls.weather.enabled}
                            onChange={(e) => setSceneControls(prev => ({
                              ...prev,
                              weather: { ...prev.weather, enabled: e.target.checked }
                            }))}
                            disabled={!canGenerate}
                            className="h-3 w-3 border-gray-300 text-gray-900 disabled:opacity-50"
                          />
                          <label htmlFor="weather-enable-edit" className="font-sans text-xs text-gray-700">
                            Weather / Atmosphere
                          </label>
                        </div>
                        {sceneControls.weather.enabled && (
                          <div className="ml-5 space-y-1">
                            <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                              {WEATHER_OPTIONS[sceneControls.weather.value]}
                            </div>
                            <input
                              type="range"
                              min="0"
                              max={WEATHER_OPTIONS.length - 1}
                              step="1"
                              value={sceneControls.weather.value}
                              onChange={(e) => setSceneControls(prev => ({
                                ...prev,
                                weather: { ...prev.weather, value: parseInt(e.target.value) }
                              }))}
                              disabled={!canGenerate}
                              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                            />
                          </div>
                        )}
                      </div>

                      {/* Activity Level */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="activity-enable-edit"
                            checked={sceneControls.activity.enabled}
                            onChange={(e) => setSceneControls(prev => ({
                              ...prev,
                              activity: { ...prev.activity, enabled: e.target.checked }
                            }))}
                            disabled={!canGenerate}
                            className="h-3 w-3 border-gray-300 text-gray-900 disabled:opacity-50"
                          />
                          <label htmlFor="activity-enable-edit" className="font-sans text-xs text-gray-700">
                            Activity Level
                          </label>
                        </div>
                        {sceneControls.activity.enabled && (
                          <div className="ml-5 space-y-1">
                            <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                              {ACTIVITY_OPTIONS[sceneControls.activity.value]}
                            </div>
                            <input
                              type="range"
                              min="0"
                              max={ACTIVITY_OPTIONS.length - 1}
                              step="1"
                              value={sceneControls.activity.value}
                              onChange={(e) => setSceneControls(prev => ({
                                ...prev,
                                activity: { ...prev.activity, value: parseInt(e.target.value) }
                              }))}
                              disabled={!canGenerate}
                              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                            />
                          </div>
                        )}
                      </div>

                      {/* Time of Day */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="time-enable-edit"
                            checked={sceneControls.timeOfDay.enabled}
                            onChange={(e) => setSceneControls(prev => ({
                              ...prev,
                              timeOfDay: { ...prev.timeOfDay, enabled: e.target.checked }
                            }))}
                            disabled={!canGenerate}
                            className="h-3 w-3 border-gray-300 text-gray-900 disabled:opacity-50"
                          />
                          <label htmlFor="time-enable-edit" className="font-sans text-xs text-gray-700">
                            Time of Day
                          </label>
                        </div>
                        {sceneControls.timeOfDay.enabled && (
                          <div className="ml-5 space-y-1">
                            <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                              {TIME_OPTIONS[sceneControls.timeOfDay.value]}
                            </div>
                            <input
                              type="range"
                              min="0"
                              max={TIME_OPTIONS.length - 1}
                              step="1"
                              value={sceneControls.timeOfDay.value}
                              onChange={(e) => setSceneControls(prev => ({
                                ...prev,
                                timeOfDay: { ...prev.timeOfDay, value: parseInt(e.target.value) }
                              }))}
                              disabled={!canGenerate}
                              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                            />
                          </div>
                        )}
                      </div>

                      {/* Season */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="season-enable-edit"
                            checked={sceneControls.season.enabled}
                            onChange={(e) => setSceneControls(prev => ({
                              ...prev,
                              season: { ...prev.season, enabled: e.target.checked }
                            }))}
                            disabled={!canGenerate}
                            className="h-3 w-3 border-gray-300 text-gray-900 disabled:opacity-50"
                          />
                          <label htmlFor="season-enable-edit" className="font-sans text-xs text-gray-700">
                            Season
                          </label>
                        </div>
                        {sceneControls.season.enabled && (
                          <div className="ml-5 space-y-1">
                            <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                              {SEASON_OPTIONS[sceneControls.season.value]}
                            </div>
                            <input
                              type="range"
                              min="0"
                              max={SEASON_OPTIONS.length - 1}
                              step="1"
                              value={sceneControls.season.value}
                              onChange={(e) => setSceneControls(prev => ({
                                ...prev,
                                season: { ...prev.season, value: parseInt(e.target.value) }
                              }))}
                              disabled={!canGenerate}
                              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                            />
                          </div>
                        )}
                      </div>

                      {/* View Character */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="view-enable-edit"
                            checked={sceneControls.viewCharacter.enabled}
                            onChange={(e) => setSceneControls(prev => ({
                              ...prev,
                              viewCharacter: { ...prev.viewCharacter, enabled: e.target.checked }
                            }))}
                            disabled={!canGenerate}
                            className="h-3 w-3 border-gray-300 text-gray-900 disabled:opacity-50"
                          />
                          <label htmlFor="view-enable-edit" className="font-sans text-xs text-gray-700">
                            View Character
                          </label>
                        </div>
                        {sceneControls.viewCharacter.enabled && (
                          <div className="ml-5 space-y-1">
                            <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                              {VIEW_OPTIONS[sceneControls.viewCharacter.value]}
                            </div>
                            <input
                              type="range"
                              min="0"
                              max={VIEW_OPTIONS.length - 1}
                              step="1"
                              value={sceneControls.viewCharacter.value}
                              onChange={(e) => setSceneControls(prev => ({
                                ...prev,
                                viewCharacter: { ...prev.viewCharacter, value: parseInt(e.target.value) }
                              }))}
                              disabled={!canGenerate}
                              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                            />
                          </div>
                        )}
	                      </div>
	                    </div>
	                    {styleReferenceImage && hasSceneControlsEnabled && (
	                      <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
	                        Scene controls will override the style reference where they conflict.
	                      </div>
	                    )}

	                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleAppliedEdit}
                        disabled={status !== 'idle' || !appliedRenderUrl || !canGenerate}
                        className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
                      >
                        {status === 'render' && renderingMode === 'edit' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Updating render
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4" />
                            Apply changes
                          </>
                        )}
                      </button>
                      <div className="relative group">
                        <button
                          onClick={handleRender4K}
                          disabled={status !== 'idle' || !appliedRenderUrl || !canUse4K}
                          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300"
                        >
                          {status === 'render' && renderingMode === 'upscale-4k' ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Rendering 4K
                            </>
                          ) : (
                            <>
                              <Wand2 className="w-4 h-4" />
                              Render 4K
                            </>
                          )}
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-mono uppercase tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {canUse4K ? 'Upscale current render to 4K. Costs 5 credits.' : fourKTooltip}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadImage(appliedRenderUrl, 'applied')}
                        disabled={downloadingId === 'applied' || status !== 'idle'}
                        className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        {downloadingId === 'applied' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <ImageDown className="w-4 h-4" />
                            Download Render
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
      </div>
    </div>
  );
};

export default ApplyMaterials;
