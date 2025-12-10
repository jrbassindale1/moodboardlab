import React, { useMemo, useState } from 'react';
import { AlertCircle, Check, Loader2, Sparkles } from 'lucide-react';
import { DEFAULT_MATERIAL_PROMPT, MATERIAL_BASE_IMAGE, MATERIAL_PALETTE } from '../constants';

const BASE_RENDER_PROMPT =
  'A super detailed, realistic V-Ray rendering of contemporary architecture with super realistic details, soft shadows, and atmospheric lighting.';

const Materiality: React.FC = () => {
  const [floorMaterial, setFloorMaterial] = useState<string | null>('polished-concrete');
  const [structureMaterial, setStructureMaterial] = useState<string | null>(null);
  const [finishMaterial, setFinishMaterial] = useState<string | null>(null);
  const [steelColor, setSteelColor] = useState<string>('#ffffff');
  const [prompt, setPrompt] = useState<string>(DEFAULT_MATERIAL_PROMPT);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMaterialIds = useMemo(
    () => [floorMaterial, structureMaterial, finishMaterial].filter(Boolean) as string[],
    [floorMaterial, structureMaterial, finishMaterial]
  );

  const selectedMaterialObjects = useMemo(
    () => MATERIAL_PALETTE.filter((mat) => selectedMaterialIds.includes(mat.id)),
    [selectedMaterialIds]
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

  const materialsByCategory = useMemo(
    () => ({
      floor: MATERIAL_PALETTE.filter((mat) => mat.category === 'floor'),
      structure: MATERIAL_PALETTE.filter((mat) => mat.category === 'structure'),
      finish: MATERIAL_PALETTE.filter((mat) => mat.category === 'finish')
    }),
    []
  );

  const handleCategorySelect = (category: 'floor' | 'structure' | 'finish', id: string) => {
    if (category === 'floor') setFloorMaterial(id);
    if (category === 'structure') {
      setStructureMaterial(id);
      if (id !== 'steel-frame') {
        setSteelColor('#ffffff');
      }
    }
    if (category === 'finish') setFinishMaterial(id);
  };

  // Convert the shared base image into base64 so Gemini can accept it inline.
  const imageUrlToBase64 = async (url: string): Promise<{ data: string; mimeType: string }> => {
    const response = await fetch(url);
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
    if (selectedMaterialIds.length !== 3) {
      setError('Select one floor, one structural, and one finish material.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    // Temporary local key (user provided). Prefer environment variable in production.
    const apiKey =
      import.meta.env.VITE_GEMINI_API_KEY ||
      'AIzaSyDayDxzY34remqo3mmDwiTqG-su91Mlg9c';
    const endpoint =
      import.meta.env.VITE_GEMINI_ENDPOINT ||
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

    if (!apiKey) {
      setError('Gemini API key missing; update the inline key or set VITE_GEMINI_API_KEY.');
      setIsLoading(false);
      return;
    }

    try {
      if (!floorMat || !structureMat || !finishMat) {
        throw new Error('Select one floor, one structural, and one finish material.');
      }

      const { data: base64Data, mimeType } = await imageUrlToBase64(MATERIAL_BASE_IMAGE);

      const structureLine =
        structureMat?.id === 'steel-frame'
          ? `${structureMat?.name} (${structureMat?.finish}) painted ${steelColor}`
          : `${structureMat?.name} (${structureMat?.finish})`;

      const promptText = `${BASE_RENDER_PROMPT}\n\n${prompt}\n\nMaterials to apply:\n- Floor: ${floorMat?.name} (${floorMat?.finish})\n- Structure: ${structureLine}\n- Finish: ${finishMat?.name} (${finishMat?.finish})\n\nKeep the perspective, lighting, and composition of the provided image and only change the finishes. Return a photorealistic image render.`;

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
        ]
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

      const candidates = data?.candidates || [];
      for (const candidate of candidates) {
        const parts = candidate?.content?.parts || candidate?.parts || [];
        for (const part of parts) {
          const inline = part.inlineData || part.inline_data;
          if (inline?.data) {
            imageData = inline.data;
            imageMime = inline.mimeType || inline.mime_type || 'image/png';
            break;
          }
        }
        if (imageData) break;
      }

      if (!imageData) {
        throw new Error('Gemini did not return an image payload.');
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

  return (
    <div className="w-full min-h-screen pt-20 bg-white animate-in fade-in duration-500">
      <div className="max-w-screen-2xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 border-b border-gray-200 pb-8">
          <div>
            <h2 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-4">
              Material
              <br />
              Lab
            </h2>
              <p className="font-sans text-gray-600 max-w-xl">
                Select one structural and one finish material (floor pre-selected) to reimagine the
                same base image. Gemini keeps the perspective locked while swapping the material
                palette.
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
                  {materialsByCategory.structure.map((mat) => {
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
                  })}
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
                  {materialsByCategory.floor.map((mat) => {
                    const isActive = floorMaterial === mat.id;
                    return (
                      <button
                        key={mat.id}
                        onClick={() => handleCategorySelect('floor', mat.id)}
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
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-gray-500">
                    Finish Materials
                  </h3>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                    Pick one
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {materialsByCategory.finish.map((mat) => {
                    const isActive = finishMaterial === mat.id;
                    return (
                      <button
                        key={mat.id}
                        onClick={() => handleCategorySelect('finish', mat.id)}
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
                  })}
                </div>
              </div>

              <p className="font-mono text-[11px] text-gray-500 mt-3 uppercase tracking-widest">
                Pick one per category. The base image stays the same every run.
              </p>
            </div>

            <div className="border border-gray-200 p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-base uppercase font-semibold">Prompt</h4>
                <span className="font-mono text-[11px] text-gray-500 uppercase tracking-widest">
                  Optional
                </span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full border border-gray-300 focus:border-black focus:ring-0 font-sans text-sm text-gray-800 p-3 min-h-[110px] resize-none"
                placeholder="Describe the material strategy..."
              />
              {selectedMaterialIds.length === 3 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {selectedMaterialObjects.map((mat) => (
                      <span
                        key={mat.id}
                        className="inline-flex items-center gap-2 px-3 py-1 border border-gray-200 bg-gray-50 font-mono text-[11px] uppercase tracking-widest text-gray-700"
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-gray-200"
                          style={{ backgroundColor: mat.tone }}
                        />
                        {mat.name} ({mat.category})
                      </span>
                    ))}
                  </div>
                  <p className="font-mono text-[11px] text-gray-600 uppercase tracking-widest">
                    Floor: {floorMat?.name} · Structure: {structureMat?.name}
                    {structureMat?.id === 'steel-frame' ? ` (colour ${steelColor})` : ''} · Finish: {finishMat?.name}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={selectedMaterialIds.length !== 3 || isLoading}
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
                  src={generatedImage || MATERIAL_BASE_IMAGE}
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

              {selectedMaterialObjects.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-3">
                  {selectedMaterialObjects.map((mat) => (
                    <div
                      key={mat.id}
                      className="flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white shadow-sm"
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-gray-200"
                        style={{ backgroundColor: mat.tone }}
                      />
                      <div className="font-mono text-[11px] uppercase tracking-widest text-gray-700">
                        {mat.name} ({mat.category})
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="font-mono text-[11px] text-gray-500 uppercase tracking-widest mt-3">
                Same base image sent every time for consistent framing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Materiality;
