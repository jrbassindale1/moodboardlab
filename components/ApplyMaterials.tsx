import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageDown, Loader2, Wand2 } from 'lucide-react';
import { callGeminiImage, saveGenerationAuth, checkQuota } from '../api';
import { MaterialOption, UploadedImage } from '../types';
import { isAuthBypassEnabled, useAuth, useUsage } from '../auth';
import { getRenderViewGuidance } from '../utils/renderViewGuidance';
import { formatFinishForDisplay } from '../utils/materialDisplay';
import UsageDisplay from './UsageDisplay';

interface ApplyMaterialsProps {
  onNavigate?: (page: string) => void;
  board: MaterialOption[];
  onBoardChange?: (items: MaterialOption[]) => void;
  moodboardRenderUrl: string | null;
  appliedRenderUrl: string | null;
  onAppliedRenderUrlChange: (url: string | null) => void;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB limit
const MAX_UPLOAD_DIMENSION = 1000;
const RESIZE_QUALITY = 0.82;
const RESIZE_MIME = 'image/webp';
const MAX_EDIT_TURNS = 3;

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

const resolveImageSourceToDataUrl = async (source: string): Promise<string> => {
  if (!source) throw new Error('Missing base image source.');
  if (isDataUri(source)) return source;

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Could not load base image (status ${response.status}).`);
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
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

const ApplyMaterials: React.FC<ApplyMaterialsProps> = ({
  onNavigate,
  board,
  onBoardChange,
  moodboardRenderUrl,
  appliedRenderUrl,
  onAppliedRenderUrlChange
}) => {
  // Auth and usage hooks
  const { isAuthenticated, getAccessToken } = useAuth();
  const { refreshUsage, incrementLocalUsage, isAnonymous, canGenerate } = useUsage();

  const [renderNote, setRenderNote] = useState('');
  const [appliedEditPrompt, setAppliedEditPrompt] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [status, setStatus] = useState<'idle' | 'render'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [renderingMode, setRenderingMode] = useState<'upload-1k' | 'upscale-4k' | 'edit' | null>(null);
  const [editTurnCount, setEditTurnCount] = useState(0);
  const prevMoodboardRef = useRef(moodboardRenderUrl);

  // Reset edit counter only when a NEW moodboard is generated
  useEffect(() => {
    if (moodboardRenderUrl && moodboardRenderUrl !== prevMoodboardRef.current) {
      setEditTurnCount(0);
      prevMoodboardRef.current = moodboardRenderUrl;
    }
  }, [moodboardRenderUrl]);

  const renderMaterials = useMemo(
    () => board.filter((item) => !item.excludeFromMoodboardRender),
    [board]
  );
  const excludedCount = board.length - renderMaterials.length;

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
    const grouped = renderMaterials.reduce((acc: Record<string, MaterialOption[]>, mat) => {
      acc[mat.category] = acc[mat.category] || [];
      acc[mat.category].push(mat);
      return acc;
    }, {});
    const lines = Object.entries(grouped).map(
      ([cat, items]) => `${cat}: ${items.map((i) => `${i.name} (${i.finish}) [color: ${i.tone}]`).join(', ')}`
    );
    return lines.join('\n');
  }, [renderMaterials]);

  const buildMaterialKey = () => {
    if (!renderMaterials.length) return 'No materials selected yet.';
    return renderMaterials.map((item) => `${item.name} — ${item.finish}`).join('\n');
  };

  const persistGeneration = async (imageDataUri: string, prompt: string) => {
    const trimmedNote = renderNote.trim();
    const metadata = {
      renderMode: 'apply-to-upload',
      materialKey: buildMaterialKey(),
      summary: summaryText,
      renderNote: trimmedNote || undefined,
      userNote: trimmedNote || undefined,
      generatedPrompt: prompt,
      board,
      uploads: uploadedImages.map((img) => ({
        id: img.id,
        name: img.name,
        mimeType: img.mimeType,
        sizeBytes: img.sizeBytes,
        originalSizeBytes: img.originalSizeBytes,
        width: img.width,
        height: img.height,
        dataUrl: img.dataUrl
      }))
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
        generationType: 'applyMaterials'
      }, token);
    } catch (err) {
      console.error('Authenticated save failed:', err);
    }
  };

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

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

  const handleFileInput = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list: UploadedImage[] = [];
    let errorMessage: string | null = null;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > MAX_UPLOAD_BYTES) {
        errorMessage = `Upload "${file.name}" is over the 5 MB limit.`;
        continue;
      }
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const resized = await downscaleImage(dataUrl);
        list.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          dataUrl: resized.dataUrl,
          mimeType: resized.mimeType,
          sizeBytes: resized.sizeBytes,
          originalSizeBytes: file.size,
          width: resized.width,
          height: resized.height
        });
      } catch (err) {
        console.error('Could not process upload', err);
        errorMessage = `Could not process "${file.name}".`;
      }
    }
    if (errorMessage) setError(errorMessage);
    if (list.length) setUploadedImages(list.slice(-3));
  };

  const onFileInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) =>
    handleFileInput(e.target.files);

  const runApplyRender = async (options?: {
    editPrompt?: string;
    baseImageDataUrl?: string;
    imageSize?: '1K' | '4K';
    renderMode?: 'upload-1k' | 'upscale-4k' | 'edit';
  }): Promise<boolean> => {
    // Check quota - server-side for authenticated users, shared local quota for anonymous users
    if (isAuthenticated) {
      // Refresh and check server-side quota
      try {
        const token = await getAccessToken();
        if (token) {
          const quotaCheck = await checkQuota(token);
          if (!quotaCheck.canGenerate) {
            setError('Monthly generation limit reached. Your quota resets on the 1st of next month.');
            return false;
          }
        }
      } catch (err) {
        console.error('Quota check failed:', err);
        // Continue with render if quota check fails (graceful degradation)
      }
    } else {
      if (!canGenerate) {
        setError('Monthly generation limit reached. Your quota resets on the 1st of next month.');
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
    const isEditingRender = Boolean(options?.editPrompt && options?.baseImageDataUrl);
    if (!isEditingRender && uploadedImages.length === 0) {
      setError('Upload at least one base image first.');
      return false;
    }

    setStatus('render');
    setRenderingMode(options?.renderMode ?? null);
    setError(null);

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
    const noTextRule =
      'CRITICAL REQUIREMENT - ABSOLUTELY NO TEXT WHATSOEVER in the image: no words, letters, numbers, labels, captions, logos, watermarks, signatures, stamps, or typographic marks of ANY kind. NO pseudo-text, NO scribbles, NO marks that resemble writing. This is a STRICT requirement that must be followed. The image must be completely free of all textual elements, letters, numbers, and symbols.';
    const viewGuidanceInput = `${options?.editPrompt || ''}\n${trimmedNote}`.trim();
    const viewGuidance = getRenderViewGuidance(viewGuidanceInput);
    const atmosphereInstruction = viewGuidance.isTechnicalView
      ? '- Use neutral, even lighting and keep edges/cut geometry crisp; avoid cinematic haze, vignette, and dramatic color grading.'
      : '- Include atmospheric effects: subtle depth haze, realistic sky, natural color grading.';

    const prompt = isEditingRender
      ? `You are in a multi-turn render conversation. Use the provided previous render as the base image and update it while preserving the composition, camera, and lighting. Keep material assignments consistent with the list below and do not remove existing context unless explicitly requested.\n\n${noTextRule}\n\nVIEW CONTROL:\n- ${viewGuidance.styleDirective}\n- ${viewGuidance.cameraDirective}\n- ${viewGuidance.antiDriftDirective}\n\nMaterials to respect:\n${summaryText}\n\nNew instruction:\n${options?.editPrompt || ''}${trimmedNote ? `\nAdditional render note: ${trimmedNote}` : ''}`
      : `Transform the provided base image(s) into a PHOTOREALISTIC architectural render while applying the materials listed below. Materials are organized by their architectural category to help you understand where each should be applied. If the input is a line drawing, sketch, CAD export (SketchUp, Revit, AutoCAD), or diagram, you MUST convert it into a fully photorealistic visualization with realistic lighting, textures, depth, and atmosphere.\n\n${noTextRule}\n\nMaterials to apply (organized by category):\n${perMaterialLines}\n\nCRITICAL INSTRUCTIONS:\n- VIEW CONTROL:\n- ${viewGuidance.styleDirective}\n- ${viewGuidance.cameraDirective}\n- ${viewGuidance.antiDriftDirective}\n- OUTPUT MUST BE PHOTOREALISTIC: realistic lighting, shadows, reflections, material textures, and depth of field\n- APPLY MATERIALS ACCORDING TO THEIR CATEGORIES: floors to horizontal surfaces, walls to vertical surfaces, ceilings to overhead surfaces, external materials to facades, etc.\n- If input is a line drawing/sketch/CAD export: interpret the geometry and convert to photorealistic render\n- If input is already photorealistic: enhance and apply materials while maintaining realism\n- Preserve the original composition, camera angle, proportions, and spatial relationships from the input\n- Apply materials accurately with realistic scale cues (joints, brick coursing, panel seams, wood grain direction)\n- Add realistic environmental lighting (natural daylight, ambient occlusion, soft shadows)\n${atmosphereInstruction}\n- Materials must look tactile and realistic with proper surface properties (roughness, reflectivity, texture detail)\n- Maintain architectural accuracy while achieving photographic quality\n- White background not required; enhance or maintain contextual environment from base image\n${trimmedNote ? `- Additional requirements: ${trimmedNote}\n` : ''}`;

    try {
      let baseImageDataUrl: string | null = options?.baseImageDataUrl ?? null;
      if (isEditingRender && baseImageDataUrl && !isDataUri(baseImageDataUrl)) {
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
      if (isEditingRender && baseImageDataUrl) {
        const inferredRatio = await inferAspectRatioFromDataUrl(baseImageDataUrl);
        if (inferredRatio) {
          aspectRatio = inferredRatio;
        }
      } else if (uploadedImages.length > 0) {
        const firstImage = uploadedImages[0];
        if (firstImage.width && firstImage.height) {
          aspectRatio = calculateAspectRatio(firstImage.width, firstImage.height);
        }
      }

      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              ...(isEditingRender && baseImageDataUrl
                ? [dataUrlToInlineData(baseImageDataUrl)]
                : uploadedImages.map((img) => dataUrlToInlineData(img.dataUrl)))
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
      onAppliedRenderUrlChange(newUrl);

      // Track apply materials generation in Google Analytics
      const eventLabel = options?.renderMode === 'upscale-4k' ? 'upscale' : 'applyMaterials';
      window.gtag?.('event', 'generate_image', {
        event_category: 'generation',
        event_label: eventLabel,
      });

      // Update quota tracking based on auth status
      if (isAuthenticated) {
        // Refresh server-side usage count
        await refreshUsage();
      } else {
        // Increment shared local anonymous usage count
        incrementLocalUsage();
      }

      void persistGeneration(newUrl, prompt);
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
    if (!appliedRenderUrl) {
      setError('Render with an upload first.');
      return;
    }
    if (!trimmed) {
      setError('Add text instructions to update the applied render.');
      return;
    }
    if (editTurnCount >= MAX_EDIT_TURNS) {
      setError(`Edit limit reached (${MAX_EDIT_TURNS} edits). Generate a new moodboard to get more edits.`);
      return;
    }
    const wasUpdated = await runApplyRender({
      editPrompt: trimmed,
      baseImageDataUrl: appliedRenderUrl,
      renderMode: 'edit'
    });
    if (wasUpdated) {
      setEditTurnCount((prev) => prev + 1);
      setAppliedEditPrompt('');
    }
  };


  return (
    <div className="w-full min-h-screen pt-20 bg-white">
      <div className="max-w-screen-2xl mx-auto px-6 md:px-8 lg:px-12 py-12 space-y-10">
        <div className="flex flex-col lg:flex-row gap-6 border-b border-gray-200 pb-6">
          <div>
            <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter">
              Apply Your Materials
            </h1>
            <p className="font-sans text-gray-600 max-w-2xl mt-3">
              Upload a base image and apply the materials from your moodboard to generate a new render.
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={() => onNavigate?.('moodboard')}
                className="px-4 py-2 border border-gray-200 uppercase font-mono text-[11px] tracking-widest hover:border-black"
              >
                Back to moodboard
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span>{error}</span>
          </div>
        )}

        <UsageDisplay variant="full" showSignUpPrompt={!isAuthBypassEnabled && isAnonymous} />

        {!moodboardRenderUrl ? (
          <div className="border border-dashed border-gray-300 bg-gray-50 p-6 text-center space-y-3">
            <p className="font-sans text-gray-700 text-sm">
              Generate a moodboard first, then return here to apply the palette to your own image.
            </p>
            <button
              onClick={() => onNavigate?.('moodboard')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900"
            >
              Go to Moodboard Lab
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1fr)]">
              <div className="border border-gray-200 bg-white p-4 space-y-3">
                <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
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

              <div className="border border-gray-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
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

              <div className="space-y-3 border-2 border-dashed border-gray-300 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                    Upload Base Image (JPG/PNG)
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={onFileInputChange}
                    className="text-sm font-sans file:mr-3 file:rounded-none file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-[11px] file:uppercase file:tracking-widest file:font-mono file:text-gray-700 file:hover:bg-gray-50"
                  />
                </div>
                <p className="font-sans text-sm text-gray-600">
                  Drag and drop an image to apply your own base on the next render. Line drawings and sketches will give the best results. 
                </p>
                <div className="space-y-2">
                  <label className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                    Custom render instructions (optional)
                  </label>
                  <textarea
                    value={renderNote}
                    onChange={(e) => setRenderNote(e.target.value)}
                    placeholder="E.g., street-level exterior view at dusk with wet paving, or frontal elevation view with neutral lighting."
                    className="w-full border border-gray-300 px-3 py-2 font-sans text-sm min-h-[80px] resize-vertical"
                  />
                </div>
                {uploadedImages.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {uploadedImages.map((img) => (
                        <div key={img.id} className="border border-gray-200 bg-white p-2">
                          <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                            <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-gray-600 mt-1 truncate">
                            {img.name}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => runApplyRender({ renderMode: 'upload-1k' })}
                      disabled={status !== 'idle' || !board.length || renderMaterials.length === 0 || !canGenerate}
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
                  </>
                )}
              </div>
            </div>

            {appliedRenderUrl && (
              <div className="space-y-4">
                <div className="border border-gray-200 p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                      Applied Render
                    </div>
                  </div>
                  <div className="w-full border border-gray-200 bg-gray-50 flex items-center justify-center p-2">
                    <img
                      src={appliedRenderUrl}
                      alt="Applied render"
                      className="max-h-[75vh] max-w-full h-auto w-auto object-contain"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                        Edit applied render (multi-turn)
                      </div>
                      <div className={`font-mono text-[11px] uppercase tracking-widest ${editTurnCount >= MAX_EDIT_TURNS ? 'text-red-500' : 'text-gray-500'}`}>
                        {MAX_EDIT_TURNS - editTurnCount} edit{MAX_EDIT_TURNS - editTurnCount !== 1 ? 's' : ''} remaining
                      </div>
                    </div>
                    <p className="font-sans text-sm text-gray-700">
                      Send another instruction to refine this render without losing the palette application.
                    </p>
                    {editTurnCount >= MAX_EDIT_TURNS && (
                      <div className="bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                        Edit limit reached. Generate a new moodboard to get more edits.
                      </div>
                    )}
                    <textarea
                      value={appliedEditPrompt}
                      onChange={(e) => setAppliedEditPrompt(e.target.value)}
                      placeholder="E.g., switch to an axonometric view and keep all materials unchanged."
                      disabled={editTurnCount >= MAX_EDIT_TURNS || !canGenerate}
                      className="w-full border border-gray-300 px-3 py-2 font-sans text-sm min-h-[80px] resize-vertical disabled:bg-gray-100 disabled:text-gray-400"
                    />
                    <button
                      onClick={handleAppliedEdit}
                      disabled={status !== 'idle' || !appliedRenderUrl || editTurnCount >= MAX_EDIT_TURNS || !canGenerate}
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
                          Apply text edit
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end items-center gap-3 pt-4 border-t border-gray-200">
                  <div className="relative group">
                    <button
                      disabled
                      className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 bg-gray-100 text-gray-400 font-mono text-[11px] uppercase tracking-widest cursor-not-allowed"
                    >
                      <Wand2 className="w-4 h-4" />
                      Render 4K
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-mono uppercase tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      Feature coming soon
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadImage(appliedRenderUrl, 'applied')}
                    disabled={downloadingId === 'applied' || status !== 'idle'}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
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
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ApplyMaterials;
