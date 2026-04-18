import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ImageDown, Loader2, Sparkles, Upload, Wand2, X } from 'lucide-react';
import { callGeminiImage, saveGenerationAuth, checkQuota, consumeCredits, CREDIT_COSTS, GenerationType, getGenerations, type Generation } from '../api';
import { MaterialOption, UploadedImage, StyleReferenceSource } from '../types';
import { isAuthBypassEnabled, useAuth, useUsage } from '../auth';
import {
  DrawingType,
  getDrawingTypePromptDirectives,
  getRenderViewGuidanceForDrawingType,
  getRenderViewGuidance,
  inferDrawingType,
} from '../utils/renderViewGuidance';
import { formatFinishForDisplay } from '../utils/materialDisplay';
import { trackEvent } from '../utils/analytics';
import { IMAGE_MODEL_FALLBACK_WARNING, isImageModelFallbackUsed } from '../utils/imageModelFallback';
import { resolveImageSourceToDataUrl } from '../utils/imageUtils';

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
const RECENT_STYLE_REFERENCE_LIMIT = 8;
const dataUrlSizeBytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] || '';
  const padding = (base64.match(/=+$/)?.[0].length ?? 0);
  return Math.floor((base64.length * 3) / 4) - padding;
};

const isDataUri = (value: string) => value.startsWith('data:');

const getMimeTypeFromDataUrl = (dataUrl: string): string =>
  dataUrl.match(/^data:([^;]+);base64,/i)?.[1] || 'image/png';

const getExtensionFromMimeType = (mimeType?: string | null): string => {
  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('avif')) return 'avif';
  if (mime.includes('svg')) return 'svg';
  return 'png';
};

const getExtensionFromImageSource = (source: string): string => {
  if (!source) return 'png';
  if (isDataUri(source)) {
    return getExtensionFromMimeType(getMimeTypeFromDataUrl(source));
  }
  try {
    const withoutQuery = source.split('?')[0];
    const lastSegment = withoutQuery.split('/').pop() || '';
    const ext = lastSegment.split('.').pop() || '';
    return ext.trim().toLowerCase() || 'png';
  } catch {
    return 'png';
  }
};

const sanitizeFilenameStem = (value: string): string => {
  const stem = value
    .trim()
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return stem || 'image';
};

const buildTimestampedFilename = (stem: string, source: string): string => {
  const ext = getExtensionFromImageSource(source);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${sanitizeFilenameStem(stem)}-${timestamp}.${ext}`;
};

const buildPreservedFilename = (name: string, source: string): string => {
  const ext = getExtensionFromImageSource(source);
  const stem = sanitizeFilenameStem(name);
  return `${stem}.${ext}`;
};

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

const createNamedObjectUrlFromSource = async (source: string, filename: string): Promise<string> => {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error('Could not prepare image for browser preview.');
  }
  const blob = await response.blob();
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  return URL.createObjectURL(file);
};

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

type PostProcessControls = {
  exposure: number;
  whiteBalance: number;
  contrast: number;
  saturation: number;
  sharpening: number;
};

const DEFAULT_POST_PROCESS_CONTROLS: PostProcessControls = {
  exposure: 0,
  whiteBalance: 0,
  contrast: 0,
  saturation: 0,
  sharpening: 0,
};

const hasPostProcessAdjustments = (controls: PostProcessControls) =>
  controls.exposure !== 0 ||
  controls.whiteBalance !== 0 ||
  controls.contrast !== 0 ||
  controls.saturation !== 0 ||
  controls.sharpening !== 0;

const clampByte = (value: number) => Math.max(0, Math.min(255, value));

const applyPostProcessToImage = async (source: string, controls: PostProcessControls): Promise<string> => {
  const image = await loadImage(source, false);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas not available for post-processing.');
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const exposureFactor = 1 + controls.exposure / 100;
  const contrastFactor = 1 + controls.contrast / 100;
  const saturationFactor = 1 + controls.saturation / 100;
  const temperature = controls.whiteBalance;

  for (let index = 0; index < data.length; index += 4) {
    let red = data[index];
    let green = data[index + 1];
    let blue = data[index + 2];

    red *= exposureFactor;
    green *= exposureFactor;
    blue *= exposureFactor;

    red = (red - 128) * contrastFactor + 128;
    green = (green - 128) * contrastFactor + 128;
    blue = (blue - 128) * contrastFactor + 128;

    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    red = luminance + (red - luminance) * saturationFactor;
    green = luminance + (green - luminance) * saturationFactor;
    blue = luminance + (blue - luminance) * saturationFactor;

    red += temperature * 0.8;
    blue -= temperature * 0.8;

    data[index] = clampByte(red);
    data[index + 1] = clampByte(green);
    data[index + 2] = clampByte(blue);
  }

  if (controls.sharpening > 0) {
    const sharpenStrength = Math.min(1.25, controls.sharpening / 80);
    const src = new Uint8ClampedArray(data);
    const width = canvas.width;
    const height = canvas.height;
    const offsets = [-width, -1, 0, 1, width];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          const center = src[idx + channel];
          const top = src[(idx + offsets[0] * 4) + channel];
          const left = src[(idx + offsets[1] * 4) + channel];
          const right = src[(idx + offsets[3] * 4) + channel];
          const bottom = src[(idx + offsets[4] * 4) + channel];
          const sharpened = center * (1 + 4 * sharpenStrength) - (top + left + right + bottom) * sharpenStrength;
          data[idx + channel] = clampByte(sharpened);
        }
      }
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
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
  const [variantCount, setVariantCount] = useState<1 | 2 | 3 | 4>(1);
  const [isVariantConfirmModalOpen, setIsVariantConfirmModalOpen] = useState(false);
  const [renderVariants, setRenderVariants] = useState<string[]>([]);
  const [compareSplitPercent, setCompareSplitPercent] = useState(100);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [previousRenderUrl, setPreviousRenderUrl] = useState<string | null>(null);
  const [workspaceDisplayUrl, setWorkspaceDisplayUrl] = useState<string | null>(null);
  const [workspaceDisplayFilename, setWorkspaceDisplayFilename] = useState<string>('render.png');
  const [isWorkspaceImageModalOpen, setIsWorkspaceImageModalOpen] = useState(false);
  const [postProcessControls, setPostProcessControls] = useState<PostProcessControls>(DEFAULT_POST_PROCESS_CONTROLS);
  const [processedModalImageUrl, setProcessedModalImageUrl] = useState<string | null>(null);
  const [isPostProcessingModalImage, setIsPostProcessingModalImage] = useState(false);
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
    setRenderVariants([]);
    setIsCompareMode(false);
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
    () => (Object.values(sceneControls) as SceneControl[]).some((control) => control.enabled),
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
  const styleReferenceHint = effectiveStyleReferenceSource === 'project'
    ? 'Will match material expression for visual consistency across this project.'
    : 'Will influence lighting and atmosphere only. Materials come from your palette.';
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

    if (!appliedRenderUrl && variantCount > 1) {
      const total = CREDIT_COSTS.RENDER_GENERATION * variantCount;
      warnings.push(`Generating ${variantCount} variants uses ${total} credits at 1K (same base resolution).`);
    }

    return warnings;
  }, [
    uploadedImage?.width,
    uploadedImage?.height,
    renderMaterials,
    styleReferenceImage,
    hasSceneControlsEnabled,
    appliedRenderUrl,
    variantCount,
  ]);

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
      setWorkspaceDisplayFilename('render.png');
      return;
    }

    const filename = appliedRenderUrl
      ? buildTimestampedFilename('applied-render', workspaceImageUrl)
      : uploadedImage
      ? buildPreservedFilename(uploadedImage.name, workspaceImageUrl)
      : buildTimestampedFilename('render', workspaceImageUrl);

    setWorkspaceDisplayFilename(filename);

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
    if (!isWorkspaceImageModalOpen) {
      setPostProcessControls(DEFAULT_POST_PROCESS_CONTROLS);
      setProcessedModalImageUrl(null);
      setIsPostProcessingModalImage(false);
    }
  }, [isWorkspaceImageModalOpen]);

  useEffect(() => {
    if (!isWorkspaceImageModalOpen || !workspaceImageUrl) {
      setProcessedModalImageUrl(null);
      return;
    }

    if (!hasPostProcessAdjustments(postProcessControls)) {
      setProcessedModalImageUrl(null);
      setIsPostProcessingModalImage(false);
      return;
    }

    let isCancelled = false;
    const source = workspaceDisplayUrl || workspaceImageUrl;

    setIsPostProcessingModalImage(true);
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const processed = await applyPostProcessToImage(source, postProcessControls);
          if (!isCancelled) {
            setProcessedModalImageUrl(processed);
          }
        } catch (err) {
          if (!isCancelled) {
            setError(err instanceof Error ? err.message : 'Could not apply post-process controls.');
            setProcessedModalImageUrl(null);
          }
        } finally {
          if (!isCancelled) {
            setIsPostProcessingModalImage(false);
          }
        }
      })();
    }, 80);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isWorkspaceImageModalOpen, postProcessControls, workspaceDisplayUrl, workspaceImageUrl]);

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
    variantCount?: 1 | 2 | 3 | 4;
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
    const requestedVariantCount = generationMode === 'standard'
      ? (options?.variantCount ?? 1)
      : 1;
    const totalRequiredCredits = requiredCredits * requestedVariantCount;
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
            setError('Render 4K requires at least 5 purchased credits.');
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
    const humanFigureInstruction = [
      'HUMAN FIGURE FIDELITY:',
      '- If human figures appear, render them with natural anatomy, coherent eyes and mouths, realistic proportions, and clean silhouettes.',
      '- Avoid distorted faces, duplicate limbs, malformed hands, and crowd artifacts.',
      '- For distant figures, use subtle believable facial detail rather than over-sharpened invented features.',
      '- Preserve any human figures already present in the base image, especially foreground figures. Do not remove, replace, relocate, or materially redesign them unless explicitly requested.'
    ].join('\n');

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
    // Default unresolved auto-detection to perspective.
    // Orthographic protection remains in the explicit elevation/section/plan branches.
    const shouldPreserveSourceView = false;
    const viewGuidance = shouldPreserveSourceView
      ? {
          intent: 'unknown' as const,
          isTechnicalView: true,
          styleDirective:
            'Preserve the source projection and architectural placement. Do not reinterpret an orthographic drawing as a perspective scene, and do not flatten a perspective image.',
          cameraDirective:
            'Keep the same projection, viewpoint, framing, and architectural placement as the base image.',
          antiDriftDirective:
            'When the view type is ambiguous, preserve projection and framing rather than inventing a new camera; unresolved placeholder regions may still be fully completed.',
        }
      : getRenderViewGuidanceForDrawingType(drawingType);
    const representationDirectives = shouldPreserveSourceView
      ? [
          'REPRESENTATION TYPE: preserve-source-view (auto fallback).',
          'Do not guess a new view type from ambiguous input; preserve the source projection and camera.',
          'If the input reads as elevation, section, plan, axonometric, or another orthographic drawing, keep it orthographic with no perspective distortion.',
          'If the input reads as perspective, keep the same perspective and framing.',
          'Complete unresolved/blank placeholder regions in a way that is consistent with the preserved view; do not preserve flat grey unfinished areas literally.',
        ]
      : getDrawingTypePromptDirectives({
          drawingType,
          userInstruction: `${options?.editPrompt || ''}\n${trimmedNote}`,
          allowUserDrivenPerspectiveConversion: true,
        });
    const resolvedDrawingTypeLabel = shouldPreserveSourceView ? 'preserve-source-view' : drawingType;
    const representationControlText = [
      'REPRESENTATION CONTROL:',
      `- requested drawingType: ${requestedDrawingType}`,
      `- resolved drawingType: ${resolvedDrawingTypeLabel} (source: ${drawingTypeResolution.source})`,
      ...representationDirectives.map((line) => `- ${line}`),
    ].join('\n');

    if (requestedDrawingType === 'auto') {
      console.log('[Apply Render] drawingType auto resolution', {
        requestedDrawingType,
        resolvedDrawingType: drawingType,
        source: drawingTypeResolution.source,
      });
    }

    const atmosphereInstruction = shouldPreserveSourceView
      ? '- Preserve the source view with restrained architectural lighting. Do not introduce cinematic effects or atmospheric staging that would change how the drawing reads, but do complete unresolved foreground/background placeholder regions coherently.'
      : (viewGuidance.isTechnicalView || drawingType !== 'perspective')
      ? '- Use neutral, even lighting and keep edges/cut geometry crisp; avoid cinematic haze, vignette, and dramatic color grading.'
      : '- Include atmospheric effects: subtle depth haze, realistic sky, natural color grading. The sky, ground plane, foreground, and all site context must be fully rendered — do NOT leave landscape, terrain, vegetation, water, or background regions incomplete, faded, or unresolved. Every element of the scene must be photorealistic and complete to the edges of the image.';
    const lineDrawingInstruction = shouldPreserveSourceView
      ? '- If input is a line drawing, sketch, or CAD export: preserve its existing projection and architectural placement. Do not reinterpret it into a different view type. You may fully resolve unfinished/blank regions consistent with that same view.'
      : drawingType === 'perspective'
      ? '- If input is a line drawing/sketch/CAD export: interpret the geometry and convert to a photorealistic perspective render while preserving source framing.'
      : `- If input is a line drawing/sketch/CAD export: preserve the ${drawingType} projection and convert it into a materialised orthographic ${drawingType} presentation drawing without introducing perspective drift.`;
    const presentationConventionInstruction = shouldPreserveSourceView
      ? '- PRESENTATION CONVENTION: preserve the source drawing/view convention exactly. If it is orthographic, keep parallel lines and datum logic. If it is perspective, keep the existing camera and framing.'
      : drawingType === 'elevation'
      ? '- ELEVATION PRESENTATION CONVENTIONS: keep a crisp continuous ground line/datum, a flat frontal facade reading, no visible perspective depth, and only a restrained elevation-style backdrop.'
      : drawingType === 'section'
      ? '- SECTION PRESENTATION CONVENTIONS: keep cut geometry legible, maintain the cut datum, and avoid immersive perspective staging.'
      : drawingType === 'plan'
      ? '- PLAN PRESENTATION CONVENTIONS: keep a flat top-down drawing reading with no horizon, no eye-level depth, and no oblique scene effects.'
      : '';
    const orthographicRealismInstruction = shouldPreserveSourceView
      ? '- PRESENTATION QUALITY: add material realism without altering the underlying representation or composition.'
      : drawingType === 'elevation'
      ? '- ELEVATION PRESENTATION QUALITY: use material realism through texture hierarchy and tonal control, with restrained reflections and minimal depth effects, while keeping the output a flat orthographic elevation plate.'
      : drawingType === 'section'
      ? '- SECTION PRESENTATION QUALITY: emphasise section legibility with clear cut-versus-beyond contrast, restrained material tonality, minimal depth effects, and no cutaway rendering style.'
      : drawingType === 'plan'
      ? '- PLAN PRESENTATION QUALITY: use realistic top-down material expression with restrained tonality and no spatial depth cues, keeping the plan flat, clear, and fully orthographic.'
      : '';
    const orthographicMaterialAssignmentInstruction = shouldPreserveSourceView
      ? '- MATERIAL MAPPING (STRICT): apply the listed materials accurately while preserving the exact geometry and representation shown in the base image.'
      : drawingType === 'section'
      ? '- SECTION MATERIAL MAPPING (STRICT): assign materials with explicit hierarchy: cut structure/poche first, seen-beyond structure second, then cladding, glazing, internal finishes, ground/earth, and finally objects beyond the cut plane. Keep these categories visually distinct.'
      : drawingType === 'elevation'
      ? '- ELEVATION MATERIAL MAPPING (STRICT): keep structure, cladding, glazing, and infill legible as separate systems with consistent tonal hierarchy and no scene-style blending.'
      : drawingType === 'plan'
      ? '- PLAN MATERIAL MAPPING (STRICT): distinguish structure, floor finishes, glazing lines, and external/ground zones clearly, with no perspective-style overlap or depth staging.'
      : '';
    const projectionConstraint = shouldPreserveSourceView
      ? '\n*** CRITICAL SOURCE-VIEW CONSTRAINT ***\nThe source view is ambiguous, so preserve projection, camera, framing, and architectural placement.\n- Do NOT invent a new camera, horizon, or angle\n- If the input is orthographic, keep it orthographic with zero perspective distortion\n- If the input is perspective, keep the same perspective and framing\n- When uncertain, preserve the input projection rather than reinterpreting it\n- Unresolved/blank placeholder regions may be completed, but must stay consistent with the preserved view\n***'
      : drawingType !== 'perspective'
      ? `\n*** CRITICAL ORTHOGRAPHIC CONSTRAINT ***\nThis is an ORTHOGRAPHIC ${drawingType.toUpperCase()} - DO NOT CONVERT TO PERSPECTIVE.\n- ZERO perspective distortion allowed\n- Maintain parallel lines and equal scaling across the view\n- No eye-level rotation or angular viewpoints\n- Camera must be perpendicular to the plane of the ${drawingType} (${drawingType === 'plan' ? 'looking straight down from above' : drawingType === 'elevation' ? 'looking straight at the facade' : 'looking perpendicular at the cut plane'})\n- The output MUST read as a presentation ${drawingType}, not as a frontal render or immersive scene\n- Do not introduce environmental depth staging, foreground framing, or perspective ground planes\n- Preserve or restate the primary datum/ground line where applicable\n***`
      : '';
    const renderTargetInstruction = shouldPreserveSourceView
      ? 'Transform the provided base image into a photorealistic architectural render while preserving the source projection, camera, framing, and architectural placement. Complete unresolved placeholder regions where needed, without changing the representation type.'
      : drawingType === 'perspective'
      ? `Transform the provided base image into a PHOTOREALISTIC architectural render while applying the materials listed below.\n\nPHOTOREALISM MANDATE: The output must be a fully resolved, camera-quality photorealistic architectural visualisation. Every part of the image — building, landscape, sky, ground, foreground, background, and edges — must be rendered to completion. Do NOT leave any region sketchy, diagrammatic, faded, soft-focus to the point of incompleteness, or unresolved. Treat every pixel of the output as equally important. The image must read as a professional CGI render or high-end architectural photograph — not a sketch, moodboard, or partial illustration.`
      : `Render this as a flat 2D orthographic ${drawingType} presentation drawing with materialised architectural finishes. Do NOT convert to 3D perspective. Apply the materials listed below while maintaining the exact orthographic projection of the input.`;
    const projectionPreservationInstruction = shouldPreserveSourceView
      ? '- OUTPUT MUST PRESERVE SOURCE VIEW: keep projection, camera, framing, and architectural placement from the base image; unresolved placeholder regions may be fully resolved.'
      : drawingType === 'perspective'
      ? '- OUTPUT MUST MAINTAIN SOURCE PERSPECTIVE: preserve the existing camera angle, lens feel, framing, and spatial reading of the base image.'
      : '- OUTPUT MUST MAINTAIN ORTHOGRAPHIC PROJECTION: material detail must be realistic and tactile, but geometry must remain flat 2D with no perspective distortion';
    const photorealInputInstruction = shouldPreserveSourceView
      ? '- If input is already photorealistic: preserve its existing projection and camera while applying the material palette.'
      : drawingType === 'perspective'
      ? '- If input is already photorealistic: preserve its existing perspective, camera, and composition while applying the material palette.'
      : '- If input is already photorealistic: reinterpret as a materialised orthographic presentation drawing while preserving geometry';
    const projectionLockInstruction = shouldPreserveSourceView
      ? '- LOCK PROJECTION AND FRAMING: Keep source projection and framing of the base image; do not reinterpret the view type. Completing unresolved placeholder regions is allowed if representation stays consistent.'
      : drawingType === 'perspective'
      ? '- LOCK CAMERA AND FRAMING: Keep the exact perspective, viewpoint, lens feel, and framing of the base image.'
      : '- LOCK PROJECTION AND FRAMING: Keep the exact orthographic orientation and framing of the base image; do not introduce perspective logic';
    const contextInstruction = shouldPreserveSourceView
      ? '- Preserve context in a restrained way that matches the source representation; do not invent immersive staging, but do resolve unfinished context areas so the image is complete.'
      : drawingType === 'perspective'
      ? '- Preserve site context and atmospheric depth only insofar as they already belong to the source view; do not invent a new scene composition.'
      : '- For orthographic drawings, do not preserve or enhance immersive site context; prefer a restrained backdrop and clear datum reading';
    const lightingInstruction = drawingType === 'perspective'
      ? '- Use realistic architectural lighting with coherent shadows, reflections, and depth while preserving source camera and geometry.'
      : '- Use restrained, even presentation-drawing lighting with crisp edges and minimal atmospheric effects';
    const outputQualityInstruction = drawingType === 'perspective'
      ? '- Keep output quality as a fully resolved photorealistic architectural image: clear hierarchy, coherent tonality, and complete scene coverage.'
      : '- Keep output quality as a composed architectural plate: clear hierarchy, restrained tonality, and no immersive scene composition';

    const basePrompt = isUpscalingRender
      ? `Create a 4K upscaled version of the provided architectural render. Preserve the exact composition, camera position, geometry, materials, entourage, and lighting from the source image. Do not redesign or reinterpret the image. Increase resolution, sharpen material detail, and improve fine-grain realism only.\n\n${humanFigureInstruction}`
      : isEditingRender
      ? `You are in a multi-turn render conversation. Use the provided previous render as the base image and update it while preserving the composition, camera, and lighting. Keep material assignments consistent with the list below and do not remove existing context unless explicitly requested.\n\n${noTextRule}\n\nVIEW CONTROL:\n- ${viewGuidance.styleDirective}\n- ${viewGuidance.cameraDirective}\n- ${viewGuidance.antiDriftDirective}\n\n${representationControlText}\n\nMaterials to respect:\n${summaryText}\n\nNew instruction:\nBEFORE MAKING ANY CHANGES - CRITICAL CONSTRAINTS TO PRESERVE:\n- GEOMETRY: Keep ALL building forms, volumes, floor plans, and structural massing EXACTLY as shown - pixel-accurate preservation required\n- CAMERA: Use EXACT same viewpoint, angle, height, focal length, framing - no perspective shifts allowed\n- LANDSCAPE: Preserve ALL terrain, topography, water bodies, ground plane, site context - if water exists keep it, if hills exist keep them, do NOT change landscape type\n- ARCHITECTURE: Do NOT add, remove, resize, or relocate any windows, doors, walls, roofs, or structural elements\n- SITE: Keep all paths, decking, paving, retaining walls, and site infrastructure exactly as shown\n- ONLY ADJUST: Atmosphere (sky, clouds, weather), lighting quality (sun angle, shadows), entourage (people, vegetation appearance within existing landscape), and surface material finishes\n\n${options?.editPrompt || ''}${sceneControlsText ? `\n${sceneControlsText}` : ''}${trimmedNote ? `\nAdditional render note: ${trimmedNote}` : ''}`
      : drawingType === 'perspective'
      ? `Transform the provided base image into a PHOTOREALISTIC architectural render while applying the materials listed below. Materials are organized by their architectural category to help you understand where each should be applied. If the input is a line drawing, sketch, CAD export (SketchUp, Revit, AutoCAD), or diagram, you MUST convert it into a fully photorealistic visualization with realistic lighting, textures, depth, and atmosphere.\n\n${noTextRule}\n\nMaterials to apply (organized by category):\n${perMaterialLines}\n\nCRITICAL INSTRUCTIONS:\n- VIEW CONTROL:\n- ${viewGuidance.styleDirective}\n- ${viewGuidance.cameraDirective}\n- ${viewGuidance.antiDriftDirective}\n- OUTPUT MUST BE PHOTOREALISTIC: realistic lighting, shadows, reflections, material textures, and depth of field\n- APPLY MATERIALS ACCORDING TO THEIR CATEGORIES: floors to horizontal surfaces, walls to vertical surfaces, ceilings to overhead surfaces, external materials to facades, etc.\n- If input is a line drawing/sketch/CAD export: interpret the geometry and convert to photorealistic render\n- If input is already photorealistic: enhance and apply materials while maintaining realism\n\nGEOMETRY PRESERVATION - CRITICAL:\n- STRICT ADHERENCE TO INPUT GEOMETRY: Do NOT alter, modify, reshape, or reinterpret the building forms, volumes, or spatial layout from the base image\n- PRESERVE EXACT BUILDING FOOTPRINT: Maintain the precise floor plan, building outline, and structural massing shown in the input\n- LOCK CAMERA POSITION: Use the EXACT camera angle, viewpoint height, focal length, and framing from the base image - do not shift perspective or change the view\n- MAINTAIN PROPORTIONS: Keep all dimensional relationships, floor heights, window-to-wall ratios, and scale relationships identical to the input\n- RESPECT ARCHITECTURAL ELEMENTS: Do not add, remove, resize, or relocate windows, doors, columns, walls, roofs, or structural components\n- PRESERVE SPATIAL RELATIONSHIPS: Maintain distances between buildings, relationship to ground plane, and overall site composition\n- DO NOT INVENT NEW BUILDING MASS: preserve intentional open gaps, courtyards, voids, setbacks, undercrofts, terraces, and spaces between volumes as designed in the source image\n- Unresolved regions may be completed as ground, paving, planting, shadow, sky, or contextual environment, but not as additional architecture unless clearly indicated in the source\n- NO GEOMETRY DRIFT: The building shape, form, and layout must remain pixel-accurate to the input - only materials, lighting, and surface finishes should change\n\n- Apply materials accurately with realistic scale cues (joints, brick coursing, panel seams, wood grain direction)\n- Add realistic environmental lighting (natural daylight, ambient occlusion, soft shadows)\n${atmosphereInstruction}\n- Materials must look tactile and realistic with proper surface properties (roughness, reflectivity, texture detail)\n- Maintain architectural accuracy while achieving photographic quality\n- White background not required; enhance or maintain contextual environment from base image\n${sceneControlsText ? `- ${sceneControlsText}\n` : ''}${trimmedNote ? `- Additional requirements: ${trimmedNote}\n` : ''}`
      : `${projectionConstraint ? `${projectionConstraint}\n\n` : ''}${renderTargetInstruction} Materials are organized by their architectural category to help you understand where each should be applied.\n\n${noTextRule}\n\nMaterials to apply (organized by category):\n${perMaterialLines}\n\nCRITICAL INSTRUCTIONS:\n- VIEW CONTROL:\n- ${viewGuidance.styleDirective}\n- ${viewGuidance.cameraDirective}\n- ${viewGuidance.antiDriftDirective}\n${representationControlText}\n${projectionPreservationInstruction}\n${orthographicMaterialAssignmentInstruction}\n${presentationConventionInstruction}\n${orthographicRealismInstruction}\n${lineDrawingInstruction}\n${photorealInputInstruction}\n\nGEOMETRY PRESERVATION - CRITICAL:\n- STRICT ADHERENCE TO INPUT GEOMETRY: Do NOT alter, modify, reshape, or reinterpret the building forms, volumes, or spatial layout from the base image\n- PRESERVE EXACT BUILDING FOOTPRINT: Maintain the precise floor plan, building outline, and structural massing shown in the input\n${projectionLockInstruction}\n- MAINTAIN PROPORTIONS: Keep all dimensional relationships, floor heights, window-to-wall ratios, and scale relationships identical to the input\n- RESPECT ARCHITECTURAL ELEMENTS: Do not add, remove, resize, or relocate windows, doors, columns, walls, roofs, or any structural components\n- PRESERVE SPATIAL RELATIONSHIPS: Maintain relationships to datum lines and overall orthographic composition exactly as shown\n- NO GEOMETRY DRIFT: The building shape, form, and layout must remain pixel-accurate to the input - only materials, tonal hierarchy, and restrained shading should change\n\n- Apply materials accurately with realistic scale cues (joints, brick coursing, panel seams, wood grain direction)\n${lightingInstruction}\n${atmosphereInstruction}\n${outputQualityInstruction}\n${contextInstruction}\n${sceneControlsText ? `- ${sceneControlsText}\n` : ''}${trimmedNote ? `- Additional requirements: ${trimmedNote}\n` : ''}`;
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

      const generatedImages: string[] = [];
      let fallbackUsed = false;
      let modelUsed: string | undefined;

      for (let variantIndex = 0; variantIndex < requestedVariantCount; variantIndex++) {
        const data = await callGeminiImage(singlePayload);
        if (variantIndex === 0) {
          fallbackUsed = isImageModelFallbackUsed(data);
          modelUsed = typeof data?.imageModelUsed === 'string' ? data.imageModelUsed : undefined;
        }
        const extracted = extractImageFromResponse(data);
        if (!extracted) throw new Error('Gemini did not return an image payload.');
        generatedImages.push(extracted);
      }

      setImageModelFallbackWarning(fallbackUsed ? IMAGE_MODEL_FALLBACK_WARNING : null);
      const newUrl = generatedImages[0];

      if (isAuthenticated) {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Please sign in to continue.');
        }

        await consumeCredits(token, {
          generationType: billedGenerationType,
          generationMode,
          credits: totalRequiredCredits,
          reason:
            generationMode === '4k'
              ? 'apply-render-4k'
              : generationMode === 'iterative'
              ? 'apply-render-edit'
              : requestedVariantCount > 1
              ? `apply-render-standard-${requestedVariantCount}x`
              : 'apply-render-standard',
        });
        await refreshUsage();
      } else {
        incrementLocalUsage(totalRequiredCredits, billedGenerationType);
      }

      setPreviousRenderUrl(appliedRenderUrl);
      onAppliedRenderUrlChange(newUrl);
      setRenderVariants(generatedImages);
      setIsCompareMode(false);

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
      renderMode: 'edit',
      drawingType
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
      isTestingEnvironment
        ? 'Render 4K will upscale the current image. Continue?'
        : 'Render 4K will upscale the current image and cost 5 credits. Continue?'
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
    ? 'Generate a 4K upscale of the current render'
    : canUse4K
    ? 'Generate a 4K upscale of the current render'
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

  const renderSceneControlsSection = ({
    contextLabel,
    idPrefix,
    disabled,
    isOpen,
    onToggleOpen,
  }: {
    contextLabel: 'setup' | 'refine';
    idPrefix: string;
    disabled: boolean;
    isOpen: boolean;
    onToggleOpen: () => void;
  }) => (
    <div className="space-y-3 border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600 font-semibold">
            {contextLabel === 'setup' ? 'Setup Scene Controls (Optional)' : 'Refine Scene Controls (Optional)'}
          </div>
          <p className="mt-1 text-xs text-gray-600">
            {contextLabel === 'setup'
              ? 'Use only if you want to steer mood before first render.'
              : 'Use only when refining the generated render.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleOpen}
          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 bg-white font-mono text-[9px] uppercase tracking-widest text-gray-700 hover:border-black"
          disabled={disabled}
        >
          {isOpen ? 'Hide controls' : 'Show controls'}
        </button>
      </div>

      {isOpen ? (
        <>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`${idPrefix}-weather-enable`}
                checked={sceneControls.weather.enabled}
                onChange={(e) => setSceneControls(prev => ({
                  ...prev,
                  weather: { ...prev.weather, enabled: e.target.checked }
                }))}
                disabled={disabled}
                className="h-3 w-3 border-gray-300 text-gray-900 disabled:opacity-50"
              />
              <label htmlFor={`${idPrefix}-weather-enable`} className="font-sans text-xs text-gray-700">
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
                    weather: { ...prev.weather, value: parseInt(e.target.value, 10) }
                  }))}
                  disabled={disabled}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`${idPrefix}-activity-enable`}
                checked={sceneControls.activity.enabled}
                onChange={(e) => setSceneControls(prev => ({
                  ...prev,
                  activity: { ...prev.activity, enabled: e.target.checked }
                }))}
                disabled={disabled}
                className="h-3 w-3 border-gray-300 text-gray-900 disabled:opacity-50"
              />
              <label htmlFor={`${idPrefix}-activity-enable`} className="font-sans text-xs text-gray-700">
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
                    activity: { ...prev.activity, value: parseInt(e.target.value, 10) }
                  }))}
                  disabled={disabled}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`${idPrefix}-time-enable`}
                checked={sceneControls.timeOfDay.enabled}
                onChange={(e) => setSceneControls(prev => ({
                  ...prev,
                  timeOfDay: { ...prev.timeOfDay, enabled: e.target.checked }
                }))}
                disabled={disabled}
                className="h-3 w-3 border-gray-300 text-gray-900 disabled:opacity-50"
              />
              <label htmlFor={`${idPrefix}-time-enable`} className="font-sans text-xs text-gray-700">
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
                    timeOfDay: { ...prev.timeOfDay, value: parseInt(e.target.value, 10) }
                  }))}
                  disabled={disabled}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`${idPrefix}-season-enable`}
                checked={sceneControls.season.enabled}
                onChange={(e) => setSceneControls(prev => ({
                  ...prev,
                  season: { ...prev.season, enabled: e.target.checked }
                }))}
                disabled={disabled}
                className="h-3 w-3 border-gray-300 text-gray-900 disabled:opacity-50"
              />
              <label htmlFor={`${idPrefix}-season-enable`} className="font-sans text-xs text-gray-700">
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
                    season: { ...prev.season, value: parseInt(e.target.value, 10) }
                  }))}
                  disabled={disabled}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`${idPrefix}-view-enable`}
                checked={sceneControls.viewCharacter.enabled}
                onChange={(e) => setSceneControls(prev => ({
                  ...prev,
                  viewCharacter: { ...prev.viewCharacter, enabled: e.target.checked }
                }))}
                disabled={disabled}
                className="h-3 w-3 border-gray-300 text-gray-900 disabled:opacity-50"
              />
              <label htmlFor={`${idPrefix}-view-enable`} className="font-sans text-xs text-gray-700">
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
                    viewCharacter: { ...prev.viewCharacter, value: parseInt(e.target.value, 10) }
                  }))}
                  disabled={disabled}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
  const projectContextPanel = (
    <div className="border border-gray-200 bg-white p-4 space-y-4">
      <div className="font-mono text-[12px] uppercase tracking-widest text-gray-600 font-bold">
        Render Context
      </div>

      <div className="space-y-4">
        <div className="space-y-3 border-b border-gray-200 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-[12px] uppercase tracking-widest text-gray-600 font-bold">
              {moodboardRenderUrl ? 'Moodboard' : 'Moodboard Preview'}
            </div>
            {moodboardRenderUrl ? (
              <button
                type="button"
                onClick={() => onNavigate?.('moodboard')}
                className="font-mono text-[10px] uppercase tracking-widest text-gray-500 hover:text-black"
              >
                Open Workspace
              </button>
            ) : null}
          </div>
          {moodboardRenderUrl ? (
            <button
              type="button"
              onClick={() => onNavigate?.('moodboard')}
              className="group block w-full overflow-hidden border border-gray-200 bg-gray-50 text-left"
            >
              <div className="flex items-center justify-center p-2">
                <img
                  src={moodboardRenderUrl}
                  alt="Moodboard preview"
                  className="max-h-40 max-w-full h-auto w-auto object-contain"
                />
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 bg-white px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                  View full moodboard
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-gray-700 opacity-0 transition-opacity group-hover:opacity-100">
                  Open
                </span>
              </div>
            </button>
          ) : (
            <div className="flex flex-col items-center justify-center border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center space-y-3">
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
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-[12px] uppercase tracking-widest text-gray-600 font-bold">
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
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
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
      </div>
    </div>
  );

  const renderSetupPanel = (
    <div className="space-y-3 border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-mono text-[12px] uppercase tracking-widest text-gray-600 font-bold">
            Render Setup
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Base image, style reference, and optional controls.
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-end gap-2">
            <label className="font-mono text-[9px] uppercase tracking-widest text-gray-500">Variants</label>
            <select
              value={variantCount}
              onChange={(event) => setVariantCount(Number(event.target.value) as 1 | 2 | 3 | 4)}
              disabled={status !== 'idle'}
              className="border border-gray-300 bg-white px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-gray-700"
            >
              <option value={1}>1 (default)</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
          <button
            onClick={() => {
              if (variantCount > 1) {
                setIsVariantConfirmModalOpen(true);
              } else {
                runApplyRender({ renderMode: 'upload-1k', drawingType, variantCount });
              }
            }}
            disabled={!canStartRender}
            className="inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
          >
            {isGeneratingBaseRender ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rendering
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate Render
              </>
            )}
          </button>
        </div>
      </div>
      {!canStartRender && unmetRenderRequirements.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 px-3 py-2 font-sans text-xs text-amber-800">
          {unmetRenderRequirements.join(' ')}
        </div>
      )}
      {renderDiagnostics.length > 0 && (
        <div className="space-y-1 border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-amber-800">Render Diagnostics</div>
          {renderDiagnostics.map((warning, index) => (
            <p key={`render-diagnostic-${index}`} className="font-sans text-xs text-amber-800">
              {warning}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-3 border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[12px] uppercase tracking-widest text-gray-600 font-bold">
              Base Image
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Sets the view and geometry.
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
        <div className="space-y-3">
          <div className="min-w-0 space-y-3">
            {baseImageSourceMode === 'upload' ? (
              <div className="space-y-2">
                <input
                  ref={baseFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onBaseFileInputChange}
                  className="w-full text-sm font-sans file:mr-3 file:rounded-none file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-[11px] file:uppercase file:tracking-widest file:font-mono file:text-gray-700 file:hover:bg-gray-50"
                />
              </div>
            ) : (
              renderProjectPickerState('base')
            )}
            {uploadedImage && (
              <div className="flex items-center justify-between gap-3 border border-gray-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-gray-600 truncate">
                    {uploadedImage.name}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {uploadedImage.sourceGenerationId ? 'Sourced from project render' : 'Uploaded file'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveBaseImage}
                  className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 font-mono text-[9px] uppercase tracking-widest text-gray-700 hover:border-black"
                >
                  <X className="h-3 w-3" />
                  Remove
                </button>
              </div>
            )}
            {uploadedImage && (
              <div className="border border-gray-200 bg-gray-50 p-3 space-y-3">
                <div className="space-y-1">
                  <div className="font-mono text-[12px] uppercase tracking-widest text-gray-700 font-bold">
                    Render Controls (Optional)
                  </div>
                </div>
                <div className="space-y-1 pt-1">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-gray-700 font-semibold">
                    Drawing Type
                  </div>
                  <p className="text-sm text-gray-600">Preserve the source view.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['auto', 'perspective', 'elevation', 'section', 'plan'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDrawingType(type)}
                      className={`px-3 py-2 border font-mono text-[10px] uppercase tracking-widest transition-colors ${
                        drawingType === type
                          ? 'border-black bg-black text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-black'
                      }`}
                    >
                      {type === 'auto'
                        ? 'Auto'
                        : type === 'perspective'
                        ? '3D / Perspective'
                        : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="space-y-2 pt-1">
                  <label className="font-mono text-[12px] uppercase tracking-widest text-gray-600 font-bold">
                    Custom render instructions (optional)
                  </label>
                  <textarea
                    value={renderNote}
                    onChange={(e) => setRenderNote(e.target.value)}
                    placeholder="E.g., street-level exterior view at dusk with wet paving, or frontal elevation view with neutral lighting."
                    className="w-full border border-gray-300 px-3 py-2 font-sans text-sm min-h-[80px] resize-vertical bg-white"
                  />
                </div>
                <div className="pt-1">
                  {renderSceneControlsSection({
                    contextLabel: 'setup',
                    idPrefix: 'setup',
                    disabled: false,
                    isOpen: isSetupSceneControlsOpen,
                    onToggleOpen: () => setIsSetupSceneControlsOpen((prev) => !prev),
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 border border-dashed border-gray-300 bg-gray-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[12px] uppercase tracking-widest text-gray-600 font-bold">
              Style Reference (Optional)
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Optional mood and lighting reference.
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

      {styleReferenceImage && hasSceneControlsEnabled && (
        <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          Scene controls will override the style reference where they conflict.
        </div>
      )}
    </div>
  );

  const renderWorkspacePanel = (
    <div className="space-y-4">
      <div className="border border-gray-200 p-4 bg-white space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[12px] uppercase tracking-widest text-gray-600 font-bold">
              {appliedRenderUrl ? 'Applied Render' : 'Render Workspace'}
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {appliedRenderUrl
                ? 'Review the current render, then refine, upscale, or download it.'
                : uploadedImage
                ? 'Your base image is staged here. Generate the render to see the materialised output.'
                : 'Upload or select a base image to start generating a render.'}
            </p>
          </div>

        </div>
        {canCompareBeforeAfter && (
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={compareSplitPercent}
            onChange={(event) => setCompareSplitPercent(parseInt(event.target.value, 10))}
            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        )}

        {workspaceImageUrl ? (
          <div className="relative w-full min-h-[420px] 2xl:min-h-[560px] border border-gray-200 bg-gray-50 flex items-center justify-center p-3">
            {canCompareBeforeAfter ? (
              <button
                type="button"
                onClick={() => setIsWorkspaceImageModalOpen(true)}
                className="group relative flex max-h-full max-w-full cursor-zoom-in items-center justify-center"
                aria-label="Open render preview"
              >
                <div className="relative">
                  <img
                    src={previousRenderUrl ?? uploadedImage?.dataUrl}
                    alt={previousRenderUrl ? 'Previous render' : 'Base image'}
                    className="max-h-[75vh] max-w-full h-auto w-auto object-contain"
                  />
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - compareSplitPercent}% 0 0)` }}
                  >
                    <img
                      src={workspaceDisplayUrl || workspaceImageUrl}
                      alt={workspaceImageAlt}
                      className={`max-h-[75vh] max-w-full h-auto w-auto object-contain transition-all duration-300 ${status === 'render' ? 'blur-sm opacity-70' : ''}`}
                    />
                  </div>
                  <div
                    className="pointer-events-none absolute inset-y-0"
                    style={{ left: `${compareSplitPercent}%` }}
                  >
                    <div className="h-full w-[2px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
                  </div>
                </div>
                <span className="absolute right-3 top-3 bg-white/90 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-gray-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                  Open
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsWorkspaceImageModalOpen(true)}
                className="group relative flex max-h-full max-w-full cursor-zoom-in items-center justify-center"
                aria-label="Open render preview"
              >
                <img
                  src={workspaceDisplayUrl || workspaceImageUrl}
                  alt={workspaceImageAlt}
                  className={`max-h-[75vh] max-w-full h-auto w-auto object-contain transition-all duration-300 ${status === 'render' ? 'blur-sm opacity-70' : ''}`}
                />
                <span className="absolute right-3 top-3 bg-white/90 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-gray-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                  Open
                </span>
              </button>
            )}
            {status === 'render' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 bg-white/80 px-4 py-3 rounded-lg shadow-sm">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-700" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">Generating...</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[420px] items-center justify-center border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <div className="space-y-3 max-w-md">
              <p className="font-sans text-sm text-gray-600">
                The render output will appear here once you upload a base image and generate.
              </p>
              <button
                onClick={openBaseFilePicker}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 bg-white font-mono text-[10px] uppercase tracking-widest hover:border-black"
              >
                <Upload className="h-3.5 w-3.5" />
                Choose Base Image
              </button>
            </div>
          </div>
        )}

        {renderVariants.length > 1 && (
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
              Render Variants
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {renderVariants.map((variantUrl, index) => {
                const isActive = appliedRenderUrl === variantUrl;
                return (
                  <button
                    key={`variant-${index}`}
                    type="button"
                    onClick={() => onAppliedRenderUrlChange(variantUrl)}
                    className={`border p-1 text-left transition-colors ${
                      isActive ? 'border-black bg-gray-50' : 'border-gray-200 bg-white hover:border-black'
                    }`}
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                      <img src={variantUrl} alt={`Render variant ${index + 1}`} className="h-full w-full object-cover" />
                    </div>
                    <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-gray-600">Variant {index + 1}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {appliedRenderUrl ? (
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
              disabled={!effectiveCanGenerate}
              className="w-full border border-gray-300 px-3 py-2 font-sans text-sm min-h-[80px] resize-vertical disabled:bg-gray-100 disabled:text-gray-400"
            />

            {renderSceneControlsSection({
              contextLabel: 'refine',
              idPrefix: 'refine',
              disabled: !effectiveCanGenerate,
              isOpen: isRefineSceneControlsOpen,
              onToggleOpen: () => setIsRefineSceneControlsOpen((prev) => !prev),
            })}
            {styleReferenceImage && hasSceneControlsEnabled && (
              <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                Scene controls will override the style reference where they conflict.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleAppliedEdit}
                disabled={status !== 'idle' || !appliedRenderUrl || !effectiveCanGenerate}
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
        ) : (
          <div className="border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            {uploadedImage
              ? 'The base image is ready. Use the setup panel to the left to fine-tune the input, then generate the render.'
              : 'Choose a base image and the generated render will appear here.'}
          </div>
        )}
      </div>
    </div>
  );

  const modalPreviewUrl = processedModalImageUrl || workspaceDisplayUrl || workspaceImageUrl;

  const workspaceImageModal = isWorkspaceImageModalOpen && workspaceImageUrl ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={() => setIsWorkspaceImageModalOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Render preview"
    >
      <div
        className="flex max-h-full w-full max-w-[96vw] flex-col gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 text-white">
          <div className="font-mono text-[11px] uppercase tracking-widest">
            {appliedRenderUrl ? 'Render Preview' : 'Image Preview'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDownloadImage(modalPreviewUrl, 'modal-preview')}
              disabled={downloadingId === 'modal-preview' || isPostProcessingModalImage}
              className="inline-flex items-center gap-2 border border-white/30 bg-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-white/20"
            >
              <ImageDown className="h-3.5 w-3.5" />
              {downloadingId === 'modal-preview' ? 'Downloading...' : 'Download'}
            </button>
            <button
              type="button"
              onClick={() => setIsWorkspaceImageModalOpen(false)}
              className="inline-flex items-center gap-2 border border-white/30 bg-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-h-0 items-center justify-center overflow-auto rounded-sm bg-black/40 p-2">
            <img
              src={modalPreviewUrl}
              alt={workspaceImageAlt}
              className="max-h-[88vh] max-w-full h-auto w-auto object-contain"
            />
          </div>
          <div className="space-y-3 overflow-y-auto rounded-sm border border-white/15 bg-black/30 p-3 text-white">
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/80">
              Post-Process Controls
            </div>
            <p className="text-xs text-white/75">
              Fine-tune this preview without spending extra render credits.
            </p>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span>Exposure</span>
                <span>{postProcessControls.exposure}</span>
              </div>
              <input
                type="range"
                min="-40"
                max="40"
                step="1"
                value={postProcessControls.exposure}
                onChange={(event) => setPostProcessControls((prev) => ({ ...prev, exposure: parseInt(event.target.value, 10) }))}
                className="w-full"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span>White Balance</span>
                <span>{postProcessControls.whiteBalance}</span>
              </div>
              <input
                type="range"
                min="-40"
                max="40"
                step="1"
                value={postProcessControls.whiteBalance}
                onChange={(event) => setPostProcessControls((prev) => ({ ...prev, whiteBalance: parseInt(event.target.value, 10) }))}
                className="w-full"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span>Contrast</span>
                <span>{postProcessControls.contrast}</span>
              </div>
              <input
                type="range"
                min="-40"
                max="40"
                step="1"
                value={postProcessControls.contrast}
                onChange={(event) => setPostProcessControls((prev) => ({ ...prev, contrast: parseInt(event.target.value, 10) }))}
                className="w-full"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span>Saturation</span>
                <span>{postProcessControls.saturation}</span>
              </div>
              <input
                type="range"
                min="-40"
                max="40"
                step="1"
                value={postProcessControls.saturation}
                onChange={(event) => setPostProcessControls((prev) => ({ ...prev, saturation: parseInt(event.target.value, 10) }))}
                className="w-full"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span>Sharpening</span>
                <span>{postProcessControls.sharpening}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={postProcessControls.sharpening}
                onChange={(event) => setPostProcessControls((prev) => ({ ...prev, sharpening: parseInt(event.target.value, 10) }))}
                className="w-full"
              />
            </div>

            <button
              type="button"
              onClick={() => setPostProcessControls(DEFAULT_POST_PROCESS_CONTROLS)}
              className="inline-flex items-center gap-2 border border-white/30 bg-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-white/20"
            >
              Reset Controls
            </button>
            {isPostProcessingModalImage && (
              <div className="text-xs text-white/75">Updating preview...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="w-full min-h-screen pt-20 bg-white">
      <div className="mx-auto max-w-[1800px] px-6 md:px-8 xl:px-10 2xl:px-12 py-6 space-y-6">
        <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate?.('moodboard')}
              className="px-3 py-2 border border-gray-200 uppercase font-mono text-[10px] tracking-widest hover:border-black"
            >
              Back to workspace
            </button>
            <span className="hidden h-4 w-px bg-gray-200 sm:block" />
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
              Render Workspace
            </div>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400">
            Costs: {CREDIT_COSTS.MOODBOARD_GENERATION} moodboard / {CREDIT_COSTS.RENDER_GENERATION} edits+renders / {CREDIT_COSTS.FOUR_K_GENERATION} 4K
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
            {renderSetupPanel}
            {projectContextPanel}
          </aside>
          {renderWorkspacePanel}
        </div>
      </div>
      {workspaceImageModal}
      {isVariantConfirmModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsVariantConfirmModalOpen(false)}
        >
          <div
            className="bg-white p-6 max-w-sm w-full space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-mono text-[11px] uppercase tracking-widest font-semibold text-gray-900">
              Confirm credit usage
            </h2>
            <p className="text-sm text-gray-700">
              Generating <span className="font-semibold">{variantCount} variants</span> will use{' '}
              <span className="font-semibold">{CREDIT_COSTS.RENDER_GENERATION * variantCount} credits</span>{' '}
              ({CREDIT_COSTS.RENDER_GENERATION} per render). Each variant is generated separately.
            </p>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsVariantConfirmModalOpen(false)}
                className="font-mono text-[10px] uppercase tracking-widest text-gray-500 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsVariantConfirmModalOpen(false);
                  runApplyRender({ renderMode: 'upload-1k', drawingType, variantCount });
                }}
                className="border border-black bg-black px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-gray-900"
              >
                Generate {variantCount} variants
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplyMaterials;
