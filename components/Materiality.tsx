import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Loader2, Sparkles } from 'lucide-react';
import {
  DEFAULT_MATERIAL_PROMPT,
  MATERIAL_BASE_IMAGE,
  MATERIAL_PALETTE,
  STRUCTURE_BASE_IMAGES
} from '../constants';
import { MaterialOption } from '../types';

const BASE_RENDER_PROMPT =
  'Generate a Photo-realistic super detailed vray rendering showing contemporary architecture design with super realistic details and soft shadows, atmospheric lighting, extremely detailed materials, soft shadows, atmospheric depth. No illustration, no linework, no cartoon style. Match the realism and style of a vray, photograpghic render.';

const Materiality: React.FC = () => {
  const [floorMaterial, setFloorMaterial] = useState<string | null>(null);
  const [structureMaterial, setStructureMaterial] = useState<string | null>(null);
  const [finishMaterial, setFinishMaterial] = useState<string | null>(null);
  const [externalMaterial, setExternalMaterial] = useState<string | null>(null);
  const [steelColor, setSteelColor] = useState<string>('#ffffff');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moodboardApplied, setMoodboardApplied] = useState<
    { name: string; finish: string; category: string }[]
  >([]);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [carbonDropdowns, setCarbonDropdowns] = useState<{
    structure: boolean;
    floor: boolean;
    finish: boolean;
    external: boolean;
  }>({ structure: false, floor: false, finish: false, external: false });
  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = 'materiality-render.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedMaterialIds = useMemo(
    () =>
      [floorMaterial, structureMaterial, finishMaterial, externalMaterial].filter(Boolean) as string[],
    [floorMaterial, structureMaterial, finishMaterial, externalMaterial]
  );

  const selectedMaterialObjects = useMemo(
    () => MATERIAL_PALETTE.filter((mat) => selectedMaterialIds.includes(mat.id)),
    [selectedMaterialIds]
  );
  const hasRequiredSelection = useMemo(
    () => Boolean(floorMaterial && structureMaterial && (finishMaterial || externalMaterial)),
    [floorMaterial, structureMaterial, finishMaterial, externalMaterial]
  );

  const floorMat = useMemo(
    () => selectedMaterialObjects.find((mat) => mat.category === 'floor') || null,
    [selectedMaterialObjects]
  );
  const structureMat = useMemo(
    () => selectedMaterialObjects.find((mat) => mat.category === 'structure') || null,
    [selectedMaterialObjects]
  );
  const finishMat = useMemo(
    () => selectedMaterialObjects.find((mat) => mat.category === 'finish') || null,
    [selectedMaterialObjects]
  );
  const externalMat = useMemo(
    () => selectedMaterialObjects.find((mat) => mat.category === 'external') || null,
    [selectedMaterialObjects]
  );

  const materialsByCategory = useMemo(
    () => ({
      floor: MATERIAL_PALETTE.filter((mat) => mat.category === 'floor'),
      structure: MATERIAL_PALETTE.filter((mat) => mat.category === 'structure'),
      finishInternal: MATERIAL_PALETTE.filter((mat) => mat.category === 'finish'),
      external: MATERIAL_PALETTE.filter((mat) => mat.category === 'external')
    }),
    []
  );
  const groupedByCarbon = useMemo(() => {
    const split = (list: MaterialOption[]) => ({
      primary: list.filter((mat) => mat.carbonIntensity !== 'high'),
      carbon: list.filter((mat) => mat.carbonIntensity === 'high')
    });
    return {
      structure: split(materialsByCategory.structure),
      floor: split(materialsByCategory.floor),
      finish: split(materialsByCategory.finishInternal),
      external: split(materialsByCategory.external)
    };
  }, [materialsByCategory]);

  const selectedBaseImage = structureMaterial
    ? STRUCTURE_BASE_IMAGES[structureMaterial] || MATERIAL_BASE_IMAGE
    : MATERIAL_BASE_IMAGE;

  const handleCategorySelect = (
    category: 'floor' | 'structure' | 'finish' | 'external',
    id: string
  ) => {
    if (category === 'floor') setFloorMaterial(id);
    if (category === 'structure') {
      setStructureMaterial(id);
      if (id !== 'steel-frame') {
        setSteelColor('#ffffff');
      }
    }
    if (category === 'finish') setFinishMaterial(id);
    if (category === 'external') setExternalMaterial(id);
  };

  useEffect(() => {
    const stored = localStorage.getItem('materialitySelection');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed.appliedMaterials) {
        setMoodboardApplied(parsed.appliedMaterials);
      }

      const pickLowCarbon = (category: MaterialOption['category']) =>
        MATERIAL_PALETTE.find((m) => m.category === category && m.carbonIntensity !== 'high')?.id ||
        MATERIAL_PALETTE.find((m) => m.category === category)?.id ||
        null;

      const fallbackStructure = pickLowCarbon('structure');
      const fallbackFloor = pickLowCarbon('floor');
      const fallbackFinishInternal = pickLowCarbon('finish');
      const fallbackExternal = pickLowCarbon('external');

      setFloorMaterial(parsed.floorId || fallbackFloor);
      setStructureMaterial(parsed.structureId || fallbackStructure);
      if ((parsed.structureId || fallbackStructure) === 'steel-frame' && parsed.steelColor) {
        setSteelColor(parsed.steelColor);
      }

      const parsedFinishId = parsed.finishId || null;
      if (parsedFinishId) {
        const match = MATERIAL_PALETTE.find((m) => m.id === parsedFinishId);
        if (match?.category === 'external') {
          setExternalMaterial(parsedFinishId);
          setFinishMaterial(fallbackFinishInternal);
        } else if (match?.category === 'finish') {
          setFinishMaterial(parsedFinishId);
          setExternalMaterial(fallbackExternal);
        } else {
          setFinishMaterial(fallbackFinishInternal);
          setExternalMaterial(fallbackExternal);
        }
      } else {
        setFinishMaterial(fallbackFinishInternal);
        setExternalMaterial(fallbackExternal);
      }

      setAutoGenerate(true);
    } catch {
      // ignore malformed
    } finally {
      localStorage.removeItem('materialitySelection');
    }
  }, []);

  useEffect(() => {
    if (autoGenerate && floorMaterial && structureMaterial && (finishMaterial || externalMaterial)) {
      handleGenerate();
      setAutoGenerate(false);
    }
  }, [autoGenerate, floorMaterial, structureMaterial, finishMaterial, externalMaterial]);

  // Convert the shared base image into base64 so Gemini can accept it inline.
  const imageUrlToBase64 = async (url: string): Promise<{ data: string; mimeType: string }> => {
    const response = await fetch(url, { cache: 'no-cache' });
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve({ data: base64Data, mimeType: blob.type || 'image/png' });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleGenerate = async () => {
    const hasFinish = Boolean(finishMaterial || externalMaterial);
    if (!floorMaterial || !structureMaterial || !hasFinish) {
      setError('Select one floor, one structural material, and at least one finish (internal/external).');
      return;
    }
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    const apiKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
    const endpoint =
      import.meta.env.VITE_GEMINI_ENDPOINT ||
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

    if (!apiKey) {
      setError('Gemini API key missing; set VITE_GEMINI_API_KEY in your env file.');
      setIsLoading(false);
      return;
    }
    // Guard: endpoint must target an image-capable model.
    if (!endpoint.includes('image')) {
      setError(
        'The Gemini endpoint is not an image model. Set VITE_GEMINI_ENDPOINT to gemini-2.5-flash-image:generateContent.'
      );
      setIsLoading(false);
      return;
    }

    try {
      if (!floorMat || !structureMat || (!finishMat && !externalMat)) {
        throw new Error('Select one floor, one structural, and at least one finish material.');
      }

      const { data: base64Data, mimeType } = await imageUrlToBase64(selectedBaseImage);

      const structureLine =
        structureMat?.id === 'steel-frame'
          ? `${structureMat?.name} (${structureMat?.finish}) painted ${steelColor}`
          : `${structureMat?.name} (${structureMat?.finish})`;

      const finishLines: string[] = [];
      if (finishMat) {
        finishLines.push(`- Internal finish: ${finishMat?.name} (${finishMat?.finish})`);
      }
      if (externalMat) {
        finishLines.push(`- External finish: ${externalMat?.name} (${externalMat?.finish})`);
      }

      const moodboardText =
        moodboardApplied.length > 0
          ? `Additional materials from moodboard:\n${moodboardApplied
              .map((m) => `- ${m.category}: ${m.name} (${m.finish})`)
              .join('\n')}\nUse them where appropriate.`
          : '';

      const promptText = `${BASE_RENDER_PROMPT}\n\n${DEFAULT_MATERIAL_PROMPT}\n\nMaterials to apply:\n- Floor: ${floorMat?.name} (${floorMat?.finish})\n- Structure: ${structureLine}\n${finishLines.join('\n')}\n${moodboardText}\nApply internal finishes only to interior walls/ceilings and external finishes only to facades/rainscreens—do not swap their locations. Keep the perspective and composition of the provided image and only change the finishes and render style. Do not alter any glazing or glass areas; leave all glass untouched. Keep the structural system exactly as shown in the base image (no structural swaps). Render as a photorealistic V-Ray/CGI still—no illustration, no outlines, no cartoon style. Return a photorealistic image render.`;

      // Debug: log the exact prompt being sent.
      console.debug('Gemini prompt (text):', promptText);

      const requestPayload = {
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          candidateCount: 1
        }
      };

      const response = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Gemini returned an error.');
      }

      const data = await response.json();

      let imageData: string | null = null;
      let imageMime: string | null = null;
      let textFallback: string | null = null;
      let finishSummary: string | null = null;

      // Capture safety or block reasons for better debugging.
      const blockReason =
        data?.promptFeedback?.blockReason ||
        data?.promptFeedback?.block_reason ||
        data?.prompt_feedback?.block_reason;
      const blockMessage = blockReason ? `Gemini safety block: ${blockReason}` : null;

      const candidates = data?.candidates || [];
      for (const candidate of candidates) {
        if (!finishSummary && (candidate?.finishMessage || candidate?.finishReason)) {
          const msg = candidate.finishMessage || candidate.finishReason;
          finishSummary = typeof msg === 'string' ? msg : JSON.stringify(msg);
        }
        const parts = candidate?.content?.parts || candidate?.parts || [];
        for (const part of parts) {
          const inline =
            part.inline_data ||
            part.inlineData ||
            part.inlineRaw ||
            part.inline_raw ||
            part.blob ||
            part.data;
          const fileData =
            part.fileData || part.file_data || part.file || part.media || part.image || part.uri;
          if (inline?.data) {
            imageData = inline.data;
            imageMime = inline.mimeType || inline.mime_type || inline.type || 'image/png';
            break;
          }
          if (fileData?.fileUri || fileData?.uri) {
            imageData = fileData.fileUri || fileData.uri;
            imageMime = fileData.mimeType || fileData.mime_type || 'image/png';
            break;
          }
          if (part.text && !textFallback) {
            textFallback = part.text;
          }
          if ((part.finishMessage || part.finish_message) && !textFallback) {
            textFallback = part.finishMessage || part.finish_message;
          }
        }
        if (imageData) break;
      }

      if (!imageData) {
        console.error('Gemini response (no image found):', data);
        const readableError =
          blockMessage ||
          finishSummary ||
          textFallback ||
          'Gemini did not return an image payload.';
        throw new Error(readableError);
      }

      setGeneratedImage(`data:${imageMime || 'image/png'};base64,${imageData}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — ensure your endpoint points to an image-capable Gemini model (e.g., gemini-2.5-flash-image) via VITE_GEMINI_ENDPOINT.`
          : 'Failed to generate image. Ensure the model supports image output.'
      );
      setGeneratedImage(null);
    } finally {
      setIsLoading(false);
    }
  };

  const renderCarbonSection = (
    key: keyof typeof carbonDropdowns,
    list: MaterialOption[],
    renderer: (mat: MaterialOption) => React.ReactNode
  ) => {
    if (!list.length) return null;
    return (
      <div className="border border-amber-200 bg-amber-50 p-3">
        <button
          onClick={() =>
            setCarbonDropdowns((prev) => ({ ...prev, [key]: !prev[key] }))
          }
          className="w-full flex items-center justify-between text-left"
        >
          <span className="font-mono text-[11px] uppercase tracking-widest text-amber-900">
            Carbon-intensive options (click to view)
          </span>
          <span className="font-mono text-xs text-amber-900">
            {carbonDropdowns[key] ? '−' : '+'}
          </span>
        </button>
        {carbonDropdowns[key] && <div className="space-y-3 mt-3">{list.map(renderer)}</div>}
      </div>
    );
  };

  const renderStructureChoice = (mat: MaterialOption) => {
    const isActive = structureMaterial === mat.id;
    return (
      <div key={mat.id} className="border border-gray-200">
        <button
          onClick={() => handleCategorySelect('structure', mat.id)}
          className={`w-full flex items-center justify-between p-4 text-left transition-all duration-300 ${
            isActive
              ? 'bg-black text-white border-b border-gray-700'
              : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className="w-8 h-8 rounded-full border border-gray-200 shadow-inner mt-1"
              style={{ backgroundColor: mat.tone }}
              aria-hidden
            />
            <div>
              <div className="font-display uppercase tracking-wide text-sm">
                {mat.name}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-widest">
                {mat.finish}
              </div>
              <p className="font-sans text-sm text-gray-600 mt-1">
                {mat.description}
              </p>
            </div>
          </div>
          {isActive && <Check className="w-4 h-4" />}
        </button>
        {mat.id === 'steel-frame' && isActive && (
          <div className="p-4 bg-white flex flex-col gap-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                Steel Colour
              </span>
              <div className="flex items-center gap-2">
                {[
                  { label: 'White', value: '#ffffff' },
                  { label: 'Charcoal', value: '#333333' },
                  { label: 'Oxide Red', value: '#7a2c20' }
                ].map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setSteelColor(preset.value)}
                    className={`px-3 py-1 border text-xs font-mono uppercase tracking-widest ${
                      steelColor.toLowerCase() === preset.value.toLowerCase()
                        ? 'border-black bg-black text-white'
                        : 'border-gray-200 hover:border-black'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={steelColor}
                onChange={(e) => setSteelColor(e.target.value)}
                className="w-12 h-10 border border-gray-300"
              />
              <input
                type="text"
                value={steelColor}
                onChange={(e) => setSteelColor(e.target.value)}
                className="flex-1 border border-gray-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <p className="font-mono text-[11px] text-gray-500 uppercase tracking-widest">
              Finish: painted steel — select colour (white / charcoal / oxide red / custom RAL).
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderStandardChoice = (
    mat: MaterialOption,
    category: 'floor' | 'finish' | 'external'
  ) => {
    const isActive =
      (category === 'floor' && floorMaterial === mat.id) ||
      (category === 'finish' && finishMaterial === mat.id) ||
      (category === 'external' && externalMaterial === mat.id);
    return (
      <button
        key={mat.id}
        onClick={() => handleCategorySelect(category, mat.id)}
        className={`flex items-center justify-between p-4 border transition-all duration-300 text-left group ${
          isActive
            ? 'border-black bg-black text-white'
            : 'border-gray-200 hover:border-black text-gray-700'
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className="w-8 h-8 rounded-full border border-gray-200 shadow-inner mt-1"
            style={{ backgroundColor: mat.tone }}
            aria-hidden
          />
          <div>
            <div className="font-display uppercase tracking-wide text-sm">
              {mat.name}
            </div>
            <div className="font-mono text-[11px] uppercase tracking-widest">
              {mat.finish}
            </div>
            <p className="font-sans text-sm text-gray-600 mt-1">
              {mat.description}
            </p>
          </div>
        </div>
        {isActive && <Check className="w-4 h-4" />}
      </button>
    );
  };

  return (
    <div className="w-full min-h-screen pt-20 bg-white animate-in fade-in duration-500">
      <div className="max-w-screen-2xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 border-b border-gray-200 pb-8">
          <div>
            <h2 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-4">
              Material Lab
            </h2>
              <p className="font-sans text-gray-600 max-w-xl">
                Select one floor, one structural, and one finish material to reimagine the same base
                image. Gemini keeps the perspective locked while swapping the material palette.
              </p>
          </div>
          <div className="hidden md:block text-right">
            <p className="font-mono text-xs text-gray-400 uppercase tracking-widest mb-1">
              Powered by
            </p>
            <p className="font-display font-bold uppercase">Gemini 2.5 Flash Image</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Control Panel */}
          <div className="lg:col-span-4 flex flex-col gap-8 order-2 lg:order-1">
            <div className="space-y-10">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-gray-500">
                    Structural Materials
                  </h3>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                    Pick one
                  </span>
                </div>
                <div className="space-y-3">
                  {groupedByCarbon.structure.primary.map(renderStructureChoice)}
                  {renderCarbonSection('structure', groupedByCarbon.structure.carbon, renderStructureChoice)}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-gray-500">
                    Floor Materials
                  </h3>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                    Pick one
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {groupedByCarbon.floor.primary.map((mat) => renderStandardChoice(mat, 'floor'))}
                  {renderCarbonSection('floor', groupedByCarbon.floor.carbon, (mat) =>
                    renderStandardChoice(mat, 'floor')
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-gray-500">
                    Internal Finish Materials
                  </h3>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                    Pick one
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {groupedByCarbon.finish.primary.map((mat) => renderStandardChoice(mat, 'finish'))}
                  {renderCarbonSection('finish', groupedByCarbon.finish.carbon, (mat) =>
                    renderStandardChoice(mat, 'finish')
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3 mt-6">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-gray-500">
                    External Envelope Materials
                  </h3>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                    Pick one
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {groupedByCarbon.external.primary.map((mat) => renderStandardChoice(mat, 'external'))}
                  {renderCarbonSection('external', groupedByCarbon.external.carbon, (mat) =>
                    renderStandardChoice(mat, 'external')
                  )}
                </div>
              </div>

              <p className="font-mono text-[11px] text-gray-500 mt-3 uppercase tracking-widest">
                Pick one structure, one floor, and at least one finish (internal or external). The base image stays the same every run.
              </p>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!hasRequiredSelection || isLoading}
              className="w-full py-6 bg-black text-white font-mono uppercase tracking-widest text-sm hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Visualization</span>
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-700 text-sm font-mono flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-[2px]" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Visualizer Area */}
          <div className="lg:col-span-8 order-1 lg:order-2">
            <div className="sticky top-28">
              <h3 className="font-mono text-xs uppercase tracking-widest text-gray-500 mb-6">
                {generatedImage ? 'Generated Proposal' : 'Base Concept Model'}
              </h3>

              <div className="relative aspect-[16/9] w-full bg-arch-gray overflow-hidden border border-gray-200 shadow-xl group">
                <img
                  src={generatedImage || selectedBaseImage}
                  alt="Materiality visualization"
                  className={`w-full h-full object-cover transition-opacity duration-500 ${
                    isLoading ? 'opacity-50 blur-sm' : generatedImage ? 'opacity-100' : 'grayscale'
                  }`}
                />

                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/90 backdrop-blur px-6 py-4 border border-gray-200 shadow-sm">
                      <p className="font-mono text-xs uppercase tracking-widest animate-pulse">
                        Rendering...
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {generatedImage && (
                <div className="mt-6">
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-800"
                  >
                    Download Image
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Materiality;
