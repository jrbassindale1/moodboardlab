import React, { useMemo, useState } from 'react';
import { ImageDown, Loader2, Wand2 } from 'lucide-react';
import { callGeminiImage, saveGeneration } from '../api';
import { MaterialOption, UploadedImage } from '../types';

interface ApplyMaterialsProps {
  onNavigate?: (page: string) => void;
  board: MaterialOption[];
  moodboardRenderUrl: string | null;
  appliedRenderUrl: string | null;
  onAppliedRenderUrlChange: (url: string | null) => void;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB limit
const MAX_UPLOAD_DIMENSION = 1000;
const RESIZE_QUALITY = 0.82;
const RESIZE_MIME = 'image/webp';

const dataUrlSizeBytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] || '';
  const padding = (base64.match(/=+$/)?.[0].length ?? 0);
  return Math.floor((base64.length * 3) / 4) - padding;
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
  moodboardRenderUrl,
  appliedRenderUrl,
  onAppliedRenderUrlChange
}) => {
  const [renderNote, setRenderNote] = useState('');
  const [appliedEditPrompt, setAppliedEditPrompt] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [status, setStatus] = useState<'idle' | 'render'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const summaryText = useMemo(() => {
    if (!board.length) return 'No materials selected yet.';
    const grouped = board.reduce((acc: Record<string, MaterialOption[]>, mat) => {
      acc[mat.category] = acc[mat.category] || [];
      acc[mat.category].push(mat);
      return acc;
    }, {});
    const lines = Object.entries(grouped).map(
      ([cat, items]) => `${cat}: ${items.map((i) => `${i.name} (${i.finish}) [color: ${i.tone}]`).join(', ')}`
    );
    return lines.join('\n');
  }, [board]);

  const buildMaterialKey = () => {
    if (!board.length) return 'No materials selected yet.';
    return board.map((item) => `${item.name} — ${item.finish}`).join('\n');
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

    try {
      await saveGeneration({
        prompt,
        imageDataUri,
        materials: metadata
      });
    } catch (err) {
      console.error('Failed to save generation to backend', err);
    }
  };

  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) => {
    const words = text.split(' ');
    let line = '';
    let cursorY = y;
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, cursorY);
        line = word;
        cursorY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, x, cursorY);
    return cursorY;
  };

  const formatCategoryLabel = (category: string) => {
    if (category === 'external') return 'External Envelope';
    return category
      ? category
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
      : '';
  };

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const handleDownloadBoard = async (url: string, renderId?: string) => {
    if (!url) return;
    setDownloadingId(renderId || null);
    try {
      const image = await loadImage(url);
      const padding = 32;
      const minPanelWidth = 400;
      const targetWidth = Math.max(
        Math.round(image.height * 1.414),
        image.width + minPanelWidth + padding * 3
      );
      const height = image.height + padding * 2;

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported in this browser.');

      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(0, 0, targetWidth, height);

      const imageX = padding;
      const imageY = (height - image.height) / 2;
      ctx.drawImage(image, imageX, imageY, image.width, image.height);

      const brand = 'created by moodboard-lab.com';
      ctx.font = '600 13px "Helvetica Neue", Arial, sans-serif';
      const brandMetrics = ctx.measureText(brand);
      const brandPadding = 8;
      const brandMargin = 16;
      const brandTextHeight =
        (brandMetrics.actualBoundingBoxAscent || 0) +
          (brandMetrics.actualBoundingBoxDescent || 0) ||
        14;
      const brandBoxWidth = brandMetrics.width + brandPadding * 2;
      const brandBoxHeight = brandTextHeight + brandPadding * 2;
      const brandX = imageX + brandMargin;
      const brandY = imageY + image.height - brandMargin - brandBoxHeight;
      ctx.fillStyle = 'rgba(17, 24, 39, 0.7)';
      ctx.fillRect(brandX, brandY, brandBoxWidth, brandBoxHeight);
      ctx.fillStyle = '#f9fafb';
      ctx.textBaseline = 'top';
      ctx.fillText(brand, brandX + brandPadding, brandY + brandPadding);
      ctx.textBaseline = 'alphabetic';

      const panelX = imageX + image.width + padding;
      const panelY = padding;
      const panelWidth = targetWidth - panelX - padding;
      const panelHeight = height - padding * 2;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
      ctx.strokeStyle = '#e5e7eb';
      ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

      ctx.fillStyle = '#111827';
      ctx.font = '700 22px "Helvetica Neue", Arial, sans-serif';
      ctx.fillText('MOODBOARD-LAB.COM', panelX + 20, panelY + 36);

      ctx.fillStyle = '#111827';
      ctx.font = '600 18px "Helvetica Neue", Arial, sans-serif';
      ctx.fillText('Material Key', panelX + 20, panelY + 68);

      const list = board.length
        ? board
        : buildMaterialKey()
            .split('\n')
            .filter(Boolean)
            .map((line, idx) => {
              const cleaned = line.replace(/^[0-9]+\\.\\s*/, '');
              const [rawName, rawFinish] = cleaned.split(' — ');
              return {
                id: `fallback-${idx}`,
                name: (rawName || cleaned).trim(),
                finish: (rawFinish || '').trim(),
                tone: '#e5e7eb',
                description: cleaned,
                keywords: [],
                category: 'finish' as MaterialOption['category']
              };
            });

      let cursorY = panelY + 96;
      const swatchX = panelX + 20;
      const swatchSize = 18;
      const textX = swatchX + swatchSize + 12;
      const textWidth = panelWidth - (textX - panelX) - 20;

      list.forEach((item) => {
        const centerY = cursorY - 6;
        ctx.fillStyle = item.tone;
        ctx.beginPath();
        ctx.arc(swatchX + swatchSize / 2, centerY, swatchSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#111827';
        ctx.font = '600 14px "Helvetica Neue", Arial, sans-serif';
        ctx.fillText(item.name, textX, cursorY);

        const sublineParts = [];
        if (item.finish) sublineParts.push(item.finish);
        if (item.category) sublineParts.push(formatCategoryLabel(item.category));
        const subline = sublineParts.join(' • ');

        if (subline) {
          ctx.fillStyle = '#4b5563';
          ctx.font = '12px "Helvetica Neue", Arial, sans-serif';
          const lastY = wrapText(ctx, subline, textX, cursorY + 16, textWidth, 16);
          cursorY = lastY + 28;
        } else {
          cursorY += 36;
        }
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'moodboard-sheet.png';
      link.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create download.');
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
  }) => {
    if (!board.length) {
      setError('Add materials to the moodboard first.');
      return;
    }
    const isEditingRender = Boolean(options?.editPrompt && options?.baseImageDataUrl);
    if (!isEditingRender && uploadedImages.length === 0) {
      setError('Upload at least one base image first.');
      return;
    }

    setStatus('render');
    setError(null);

    const materialsByCategory: Record<string, MaterialOption[]> = {};
    board.forEach((item) => {
      if (!materialsByCategory[item.category]) {
        materialsByCategory[item.category] = [];
      }
      materialsByCategory[item.category].push(item);
    });

    const perMaterialLines = Object.entries(materialsByCategory)
      .map(([category, items]) => {
        const categoryHeader = `\n[${category.toUpperCase()}]`;
        const itemLines = items.map((item) => {
          const finishHasColorInfo = item.finish.includes(' — ') ||
                                      item.finish.match(/\(#[0-9a-fA-F]{6}\)/) ||
                                      item.finish.toLowerCase().includes('colour') ||
                                      item.finish.toLowerCase().includes('color') ||
                                      item.finish.toLowerCase().includes('select');

          let colorInfo = '';
          if (finishHasColorInfo) {
            const labelMatch = item.finish.match(/ — ([^(]+)/);
            if (labelMatch) {
              colorInfo = ` | color: ${labelMatch[1].trim()}`;
            } else if (item.finish.match(/\(#[0-9a-fA-F]{6}\)/)) {
              colorInfo = ` | color: ${item.tone}`;
            }
          }

          return `- ${item.name} (${item.finish})${colorInfo} | description: ${item.description}`;
        }).join('\n');
        return `${categoryHeader}\n${itemLines}`;
      })
      .join('\n');

    const trimmedNote = renderNote.trim();
    const noTextRule =
      'CRITICAL REQUIREMENT - ABSOLUTELY NO TEXT WHATSOEVER in the image: no words, letters, numbers, labels, captions, logos, watermarks, signatures, stamps, or typographic marks of ANY kind. NO pseudo-text, NO scribbles, NO marks that resemble writing. This is a STRICT requirement that must be followed. The image must be completely free of all textual elements, letters, numbers, and symbols.';

    const prompt = isEditingRender
      ? `You are in a multi-turn render conversation. Use the provided previous render as the base image and update it while preserving the composition, camera, and lighting. Keep material assignments consistent with the list below and do not remove existing context unless explicitly requested.\n\n${noTextRule}\n\nMaterials to respect:\n${summaryText}\n\nNew instruction:\n${options?.editPrompt || ''}${trimmedNote ? `\nAdditional render note: ${trimmedNote}` : ''}`
      : `Transform the provided base image(s) into a PHOTOREALISTIC architectural render while applying the materials listed below. Materials are organized by their architectural category to help you understand where each should be applied. If the input is a line drawing, sketch, CAD export (SketchUp, Revit, AutoCAD), or diagram, you MUST convert it into a fully photorealistic visualization with realistic lighting, textures, depth, and atmosphere.\n\n${noTextRule}\n\nMaterials to apply (organized by category):\n${perMaterialLines}\n\nCRITICAL INSTRUCTIONS:\n- OUTPUT MUST BE PHOTOREALISTIC: realistic lighting, shadows, reflections, material textures, and depth of field\n- APPLY MATERIALS ACCORDING TO THEIR CATEGORIES: floors to horizontal surfaces, walls to vertical surfaces, ceilings to overhead surfaces, external materials to facades, etc.\n- If input is a line drawing/sketch/CAD export: interpret the geometry and convert to photorealistic render\n- If input is already photorealistic: enhance and apply materials while maintaining realism\n- Preserve the original composition, camera angle, proportions, and spatial relationships from the input\n- Apply materials accurately with realistic scale cues (joints, brick coursing, panel seams, wood grain direction)\n- Add realistic environmental lighting (natural daylight, ambient occlusion, soft shadows)\n- Include atmospheric effects: subtle depth haze, realistic sky, natural color grading\n- Materials must look tactile and realistic with proper surface properties (roughness, reflectivity, texture detail)\n- Maintain architectural accuracy while achieving photographic quality\n- White background not required; enhance or maintain contextual environment from base image\n${trimmedNote ? `- Additional requirements: ${trimmedNote}\n` : ''}`;

    try {
      let aspectRatio = '1:1';
      if (uploadedImages.length > 0) {
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
              ...(isEditingRender && options?.baseImageDataUrl
                ? [dataUrlToInlineData(options.baseImageDataUrl)]
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
          imageSize: '1K'
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
      void persistGeneration(newUrl, prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the Gemini image backend.');
    } finally {
      setStatus('idle');
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
    await runApplyRender({
      editPrompt: trimmed,
      baseImageDataUrl: appliedRenderUrl
    });
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="border border-gray-200 bg-white p-4 space-y-3">
                <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                  Current Moodboard
                </div>
                <div className="border border-gray-200 bg-gray-50 overflow-hidden max-h-[80vh] flex items-center justify-center">
                  <img
                    src={moodboardRenderUrl}
                    alt="Moodboard preview"
                    className="max-h-full max-w-full h-auto w-auto object-contain"
                  />
                </div>
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
                  Drag and drop an image to apply your own base on the next render.
                </p>
                <div className="space-y-2">
                  <label className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                    Custom render instructions (optional)
                  </label>
                  <textarea
                    value={renderNote}
                    onChange={(e) => setRenderNote(e.target.value)}
                    placeholder="E.g., set the building next to a river in a natural environment."
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
                      onClick={() => runApplyRender()}
                      disabled={status !== 'idle' || !board.length}
                      className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
                    >
                      {status === 'render' ? (
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadBoard(appliedRenderUrl, 'applied')}
                        disabled={downloadingId === 'applied'}
                        className="inline-flex items-center gap-2 px-3 py-1 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
                      >
                        {downloadingId === 'applied' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Preparing...
                          </>
                        ) : (
                          <>
                            <ImageDown className="w-4 h-4" />
                            Download
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="w-full border border-gray-200 bg-gray-50">
                    <img src={appliedRenderUrl} alt="Applied render" className="w-full h-auto object-contain" />
                  </div>
                  <div className="space-y-2">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                      Edit applied render (multi-turn)
                    </div>
                    <p className="font-sans text-sm text-gray-700">
                      Send another instruction to refine this render without losing the palette application.
                    </p>
                    <textarea
                      value={appliedEditPrompt}
                      onChange={(e) => setAppliedEditPrompt(e.target.value)}
                      placeholder="E.g., increase contrast and add dusk lighting."
                      className="w-full border border-gray-300 px-3 py-2 font-sans text-sm min-h-[80px] resize-vertical"
                    />
                    <button
                      onClick={handleAppliedEdit}
                      disabled={status !== 'idle' || !appliedRenderUrl}
                      className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
                    >
                      {status === 'render' ? (
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
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ApplyMaterials;
