import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search, ShoppingCart, X, Upload, FileText, Camera } from 'lucide-react';
import { MATERIAL_PALETTE, RAL_COLOR_OPTIONS } from '../constants';
import { MaterialOption, UploadedImage } from '../types';
import { CATEGORIES } from '../data/categories';
import { migrateAllMaterials } from '../data/categoryMigration';
import { callGeminiText } from '../api';

interface MaterialSelectionProps {
  onNavigate: (page: string) => void;
  board: MaterialOption[];
  onBoardChange: (items: MaterialOption[]) => void;
}

type CustomMaterialMode = 'upload' | 'describe' | 'analyse' | null;

const MaterialSelection: React.FC<MaterialSelectionProps> = ({ onNavigate, board, onBoardChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [recentlyAdded, setRecentlyAdded] = useState<MaterialOption | null>(null);
  const [sortBy, setSortBy] = useState<'featured' | 'name'>('featured');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    CATEGORIES.forEach((section) => {
      initial[section.id] = false;
    });
    return initial;
  });
  const [customMaterialMode, setCustomMaterialMode] = useState<CustomMaterialMode>(null);
  const [customMaterialName, setCustomMaterialName] = useState('');
  const [customMaterialDescription, setCustomMaterialDescription] = useState('');
  const [customMaterialImage, setCustomMaterialImage] = useState<string | null>(null);
  const [detectionImage, setDetectionImage] = useState<UploadedImage | null>(null);
  const [detectedMaterials, setDetectedMaterials] = useState<MaterialOption[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const supportsFreeColor = (material?: MaterialOption | null) =>
    Boolean(material?.supportsColor && !material?.colorOptions?.length);

  // List of available videos
  const videos = useMemo(() => [
    '/videos/source.mp4',
    '/videos/source-2.mp4',
    '/videos/source-3.mp4',
    '/videos/source-4.mp4',
    '/videos/source-5.mp4',
    '/videos/20251218_1111_New Video_simple_compose_01kcrjfnqsfazsdbqetst98mdm.mp4',
    '/videos/Cinematic_Study_of_Architectural_Materials.mp4',
    '/videos/Cinematographic_Studies_of_Architectural_Materials.mp4',
    '/videos/Visual_Style_and_Materiality_Video.mp4',
  ], []);

  const [currentVideoIndex, setCurrentVideoIndex] = useState(() =>
    Math.floor(Math.random() * videos.length)
  );
  const [isVideoTransitioning, setIsVideoTransitioning] = useState(false);

  // Migrate materials to new category structure
  const migratedMaterials = useMemo(() => migrateAllMaterials(MATERIAL_PALETTE), []);

  // Organize materials by category path
  const materialsByPath = useMemo(() => {
    const map: Record<string, MaterialOption[]> = {};
    migratedMaterials.forEach((mat) => {
      const paths = mat.treePaths || [];
      paths.forEach((path) => {
        if (!map[path]) {
          map[path] = [];
        }
        map[path].push(mat);
      });
    });
    return map;
  }, [migratedMaterials]);

  // Get all category children as flat list
  const allCategories = useMemo(
    () =>
      CATEGORIES.flatMap((parent) =>
        (parent.children || []).map((child) => ({
          id: child.id,
          label: child.label,
          path: `${parent.label}>${child.label}`,
          parentId: parent.id,
        }))
      ),
    []
  );

  // Filter materials by search
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const ralColorLabels = useMemo(() => RAL_COLOR_OPTIONS.map((color) => color.label), []);

  const filteredMaterialsByPath: Record<string, MaterialOption[]> = useMemo(() => {
    const tokens = normalizedSearch.split(/\s+/).filter(Boolean);
    if (!tokens.length) return materialsByPath;

    const matchesSearch = (mat: MaterialOption) => {
      const hasRalChoices = supportsFreeColor(mat);
      const haystack = [
        mat.name,
        mat.finish,
        mat.description,
        mat.category,
        ...(mat.keywords || []),
        ...(mat.tags || []),
        ...(mat.colorOptions?.map((c) => c.label) || []),
        ...(hasRalChoices ? ralColorLabels : []),
      ]
        .join(' ')
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    };

    const next: Record<string, MaterialOption[]> = {};
    Object.entries(materialsByPath).forEach(([path, list]) => {
      const filtered = list.filter((item) => matchesSearch(item));
      if (filtered.length > 0) {
        next[path] = filtered;
      }
    });
    return next;
  }, [normalizedSearch, materialsByPath, ralColorLabels]);

  // Get materials for selected category only
  const displayedMaterials = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }
    return filteredMaterialsByPath[selectedCategory] || [];
  }, [selectedCategory, filteredMaterialsByPath]);

  // Sort materials
  const sortedMaterials = useMemo(() => {
    const materials = [...displayedMaterials];
    if (sortBy === 'name') {
      return materials.sort((a, b) => a.name.localeCompare(b.name));
    }
    return materials;
  }, [displayedMaterials, sortBy]);

  // Get category label
  const getCategoryLabel = () => {
    if (!selectedCategory) return 'All Materials';
    const category = allCategories.find((c) => c.path === selectedCategory);
    return category?.label || 'Materials';
  };

  const isDuplicateColorSelection = (candidate: MaterialOption) =>
    board.some((item) => {
      if (item.id !== candidate.id) return false;
      const itemTone = item.tone?.toLowerCase().trim() || '';
      const candidateTone = candidate.tone?.toLowerCase().trim() || '';
      return itemTone === candidateTone;
    });

  const handleAdd = (
    material: MaterialOption,
    customization?: { tone?: string; label?: string },
    skipModal?: boolean
  ) => {
    // Check if material has customization options
    const hasOptions =
      material.colorOptions?.length ||
      material.finishOptions?.length ||
      supportsFreeColor(material);

    // If material has options and no customization provided, just show modal
    if (hasOptions && !customization && !skipModal) {
      setRecentlyAdded(material);
      return;
    }

    // Otherwise, add to board
    let materialToAdd = material;

    // If customization is provided, create a new material with custom finish/tone
    if (customization) {
      const labelSuffix = customization.label ? ` — ${customization.label}` : '';
      const finishText = customization.tone
        ? `${material.finish}${labelSuffix} (${customization.tone})`
        : `${material.finish}${labelSuffix}`;

      materialToAdd = {
        ...material,
        tone: customization.tone || material.tone,
        finish: finishText,
      };
    }

    if (isDuplicateColorSelection(materialToAdd)) {
      return;
    }

    onBoardChange([...board, materialToAdd]);

    // Show modal after adding if no options (for simple confirmation) and not skipping modal
    if (!hasOptions && !skipModal) {
      setRecentlyAdded(materialToAdd);
    }
  };

  const handleCustomMaterialImageUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    setCustomMaterialImage(dataUrl);
  };

  const handleCreateCustomMaterial = () => {
    if (!customMaterialName.trim()) {
      alert('Please enter a material name');
      return;
    }

    const customMaterial: MaterialOption = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: customMaterialName,
      tone: '#e5e7eb',
      finish: 'Custom Material',
      description: customMaterialDescription || 'Custom user-created material',
      keywords: ['custom'],
      category: 'finish',
      treePaths: ['Custom>Upload Image'],
      isCustom: true,
      customImage: customMaterialImage || undefined,
      customDescription: customMaterialDescription || undefined,
    };

    handleAdd(customMaterial);

    // Reset form
    setCustomMaterialMode(null);
    setCustomMaterialName('');
    setCustomMaterialDescription('');
    setCustomMaterialImage(null);
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    setDetectionError(null);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const uploadedImg: UploadedImage = {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        dataUrl,
        mimeType: file.type,
        sizeBytes: file.size,
      };

      setDetectionImage(uploadedImg);
    } catch (err) {
      console.error('Could not process upload', err);
      setDetectionError(`Could not process "${file.name}".`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    handlePhotoUpload(files);
  };

  const startMaterialDetection = async () => {
    if (!detectionImage) return;

    setIsDetecting(true);
    setDetectionError(null);

    const prompt = `Analyze this image and identify all architectural materials visible. For each material, provide:
1. name: The specific material name (e.g., "Oak Timber Flooring", "Polished Concrete")
2. finish: The finish or surface treatment, INCLUDING the color in the description (e.g., "Oiled oak planks in warm honey tone", "Polished concrete slab in light grey")
3. description: A detailed 1-2 sentence description of the material and its characteristics
4. tone: A hex color code representing the EXACT dominant color of the material as seen in the photo (e.g., "#d8b185" for natural oak, "#c5c0b5" for light grey concrete). CRITICAL: Analyze the actual color in the image carefully.
5. category: One of these categories: floor, structure, finish, wall-internal, external, soffit, ceiling, window, roof, paint-wall, paint-ceiling, plaster, microcement, timber-panel, tile, wallpaper, acoustic-panel, timber-slat, exposed-structure, joinery, fixture, landscape, insulation, door, balustrade, external-ground
6. keywords: An array of 3-5 relevant keywords describing the material (e.g., ["timber", "flooring", "oak", "natural"])
7. carbonIntensity: Either "low" or "high" based on the material's embodied carbon (e.g., timber is "low", concrete is "high")

Return ONLY a JSON array with this structure (no markdown, no explanation):
{
  "materials": [
    {
      "name": "material name",
      "finish": "finish description with color mentioned",
      "description": "detailed description",
      "tone": "#hexcolor",
      "category": "category-name",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "carbonIntensity": "low or high"
    }
  ]
}

IMPORTANT:
- Analyze the ACTUAL colors in the image carefully and provide accurate hex codes
- Include color descriptions in the finish field (e.g., "White painted steel", "Charcoal powder-coated aluminum")
- Be specific and accurate. Only include materials you can clearly identify in the image.`;

    const payload = {
      model: 'gemini-2.0-flash-exp',
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: detectionImage.mimeType,
                data: detectionImage.dataUrl.split(',')[1],
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 4096,
      },
    };

    try {
      const data = await callGeminiText(payload);
      let textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Clean up the response to extract JSON
      textResult = textResult.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(textResult);
      const materials = parsed.materials || [];

      if (materials.length === 0) {
        setDetectionError('No materials detected in the image. Try a different photo.');
        return;
      }

      // Convert to MaterialOption format
      const detectedMats: MaterialOption[] = materials.map((mat: any, idx: number) => ({
        id: `detected-${Date.now()}-${idx}`,
        name: mat.name || 'Unknown Material',
        tone: mat.tone || '#cccccc',
        finish: mat.finish || '',
        description: mat.description || '',
        keywords: mat.keywords || [],
        category: (mat.category || 'finish') as any,
        carbonIntensity: mat.carbonIntensity,
        treePaths: ['Custom>Analyse Photo'],
      }));

      setDetectedMaterials(detectedMats);
      // Select all materials by default
      setSelectedMaterialIds(new Set(detectedMats.map(mat => mat.id)));
    } catch (err) {
      console.error('Material detection error:', err);
      setDetectionError('Failed to analyse materials. Please try again.');
    } finally {
      setIsDetecting(false);
    }
  };

  const toggleMaterialSelection = (materialId: string) => {
    setSelectedMaterialIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(materialId)) {
        newSet.delete(materialId);
      } else {
        newSet.add(materialId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedMaterialIds.size === detectedMaterials.length) {
      setSelectedMaterialIds(new Set());
    } else {
      setSelectedMaterialIds(new Set(detectedMaterials.map(mat => mat.id)));
    }
  };

  const isCustomCategory = selectedCategory?.startsWith('Custom>');
  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const hasColorOptions = Boolean(recentlyAdded?.colorOptions?.length);
  const hasFinishOptions = Boolean(recentlyAdded?.finishOptions?.length);
  const hasFreeColor = supportsFreeColor(recentlyAdded);
  const hasOptions = hasColorOptions || hasFinishOptions || hasFreeColor;

  return (
    <div className="min-h-screen bg-white">
      {/* Fixed board tracker */}
      <div className="fixed right-6 top-24 z-40">
        <div
          className="relative flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm"
          aria-live="polite"
        >
          <ShoppingCart className="h-4 w-4 text-gray-800" aria-hidden />
          <span className="font-mono text-[11px] uppercase tracking-widest text-gray-700">Board</span>
          <span className="min-w-[28px] rounded-full bg-black px-2 py-1 text-center font-mono text-[10px] font-semibold uppercase tracking-widest text-white">
            {board.length}
          </span>
        </div>
      </div>

      {/* Main content area with sidebar + grid */}
      <div className="max-w-screen-2xl mx-auto px-6 py-8 pt-24">
        <div className="flex gap-8">
          {/* Left Sidebar - Category filters */}
          <aside className="w-64 flex-shrink-0 space-y-6">
            {/* Categories */}
            <div className="space-y-1">
              <h3 className="font-display text-sm uppercase tracking-widest mb-3">Material Categories</h3>
              {CATEGORIES.map((section) => (
                <div key={section.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={Boolean(openSections[section.id])}
                    aria-controls={`category-section-${section.id}`}
                    className="w-full flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-gray-500 mt-4 mb-2 hover:text-gray-700"
                  >
                    <span>{section.label}</span>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${openSections[section.id] ? 'rotate-90' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {openSections[section.id] && (
                    <div id={`category-section-${section.id}`} className="space-y-0.5">
                      {(section.children || []).map((child) => {
                        const path = `${section.label}>${child.label}`;
                        const count = (filteredMaterialsByPath[path] || []).length;
                        if (count === 0 && normalizedSearch) return null;

                        return (
                          <button
                            key={child.id}
                            onClick={() => {
                              if (!selectedCategory) {
                                // From empty state to category
                                setIsFadingOut(true);
                                setTimeout(() => {
                                  setSelectedCategory(path);
                                  setIsFadingOut(false);
                                }, 400);
                              } else if (selectedCategory !== path) {
                                // Switching between categories
                                setIsFadingOut(true);
                                setTimeout(() => {
                                  setSelectedCategory(path);
                                  setIsFadingOut(false);
                                }, 400);
                              }
                            }}
                            className={`block w-full text-left px-2 py-1.5 text-sm font-sans hover:underline ${
                              selectedCategory === path ? 'font-medium' : ''
                            }`}
                          >
                            {child.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Board summary */}
            <div className="border-t border-gray-200 pt-6">
              <button
                onClick={() => onNavigate('moodboard')}
                className="w-full flex items-center justify-between p-3 border border-gray-200 hover:border-black transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  <span className="text-sm font-sans">My board</span>
                </div>
                <span className="text-xs font-sans text-gray-600">({board.length})</span>
              </button>
            </div>
          </aside>

          {/* Right side - Product grid or custom material form */}
          <main className="flex-1 space-y-6">
            {/* Page title and sort - only show when category is selected */}
            {selectedCategory && (
              <>
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-arch-line">
                  <div>
                    <h1 className="text-3xl font-display uppercase tracking-tight mb-2">{getCategoryLabel()}</h1>
                    {!isCustomCategory && (
                      <p className="text-sm text-gray-600 font-sans">
                        {sortedMaterials.length} product{sortedMaterials.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                  {!isCustomCategory && (
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-gray-600 font-mono uppercase tracking-widest text-[11px]">
                        Sort by
                      </label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'featured' | 'name')}
                        className="border border-gray-200 px-3 py-1.5 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-black"
                      >
                        <option value="featured">Featured</option>
                        <option value="name">Name</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Search bar */}
                {!isCustomCategory && (
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search materials..."
                      className="w-full border-0 border-b border-arch-line pl-10 pr-3 py-2 text-sm font-sans focus:outline-none focus:border-black"
                    />
                  </div>
                )}
              </>
            )}

            {/* Custom Material Creation */}
            {isCustomCategory ? (
              <div className="space-y-6">
                {!customMaterialMode ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Add Custom Material Option */}
                    <button
                      onClick={() => setCustomMaterialMode('describe')}
                      className="border-2 border-dashed border-gray-300 p-8 hover:border-black transition-colors text-left"
                    >
                      <FileText className="w-12 h-12 mb-4 text-gray-400" />
                      <h3 className="font-display uppercase tracking-wide text-base mb-2">Add Custom Material</h3>
                      <p className="text-sm text-gray-600 font-sans">
                        Create a material card with a description and optional image
                      </p>
                    </button>

                    {/* Analyze Photo Option */}
                    <button
                      onClick={() => setCustomMaterialMode('analyse')}
                      className="border-2 border-dashed border-gray-300 p-8 hover:border-black transition-colors text-left"
                    >
                      <Camera className="w-12 h-12 mb-4 text-gray-400" />
                      <h3 className="font-display uppercase tracking-wide text-base mb-2">Analyze Photo</h3>
                      <p className="text-sm text-gray-600 font-sans">
                        AI will identify all materials in a photo
                      </p>
                    </button>
                  </div>
                ) : customMaterialMode === 'analyse' ? (
                  /* AI Photo Analysis */
                  <div className="max-w-2xl space-y-6 border border-arch-line p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display uppercase tracking-widest text-lg">Analyze Photo</h3>
                      <button
                        onClick={() => {
                          setCustomMaterialMode(null);
                          setDetectionImage(null);
                          setDetectedMaterials([]);
                          setDetectionError(null);
                        }}
                        className="text-sm text-gray-600 hover:text-black"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Photo Upload */}
                    <label
                      className="border-2 border-dashed border-gray-300 p-12 hover:border-black transition-colors cursor-pointer flex flex-col items-center"
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      <Camera className="w-16 h-16 mb-4 text-gray-400" />
                      <span className="text-base font-display uppercase tracking-wide mb-2">Upload Photo</span>
                      <span className="text-sm text-gray-600 font-sans">Click to select or drag and drop an image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(e.target.files)}
                      />
                    </label>

                    {/* Uploaded Image Preview */}
                    {detectionImage && (
                      <div className="relative border border-arch-line">
                        <img
                          src={detectionImage.dataUrl}
                          alt="Uploaded"
                          className="w-full h-64 object-cover"
                        />
                        <button
                          onClick={() => {
                            setDetectionImage(null);
                            setDetectedMaterials([]);
                            setDetectionError(null);
                          }}
                          className="absolute top-2 right-2 bg-white p-2 border border-gray-200 hover:bg-gray-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Analyse Button */}
                    {detectionImage && (
                      <button
                        onClick={startMaterialDetection}
                        disabled={isDetecting}
                        className="w-full bg-arch-black text-white py-3 text-xs font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDetecting ? 'Analysing...' : 'Analyse Photo'}
                      </button>
                    )}

                    {/* Error Message */}
                    {detectionError && (
                      <div className="bg-red-50 border border-red-200 p-4">
                        <p className="text-sm font-sans text-red-800">{detectionError}</p>
                      </div>
                    )}

                    {/* Detected Materials - Ask user to add */}
                    {detectedMaterials.length > 0 && (
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-display uppercase tracking-widest text-sm">
                              Found {detectedMaterials.length} Material{detectedMaterials.length !== 1 ? 's' : ''}
                            </h4>
                            <button
                              onClick={toggleSelectAll}
                              className="text-xs font-sans text-blue-700 hover:underline"
                            >
                              {selectedMaterialIds.size === detectedMaterials.length ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                          <p className="text-sm font-sans text-gray-700">
                            Select materials to add to your board ({selectedMaterialIds.size} selected)
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          {detectedMaterials.map((mat) => (
                            <div
                              key={mat.id}
                              className={`border p-4 cursor-pointer transition-colors ${
                                selectedMaterialIds.has(mat.id)
                                  ? 'border-black bg-gray-50'
                                  : 'border-arch-line hover:border-gray-400'
                              }`}
                              onClick={() => toggleMaterialSelection(mat.id)}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={selectedMaterialIds.has(mat.id)}
                                  onChange={() => toggleMaterialSelection(mat.id)}
                                  className="mt-1 w-4 h-4 cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div
                                  className="w-12 h-12 border border-arch-line flex-shrink-0"
                                  style={{ backgroundColor: mat.tone }}
                                />
                                <div className="flex-1">
                                  <h5 className="font-display uppercase tracking-wide text-sm">{mat.name}</h5>
                                  <p className="text-xs text-gray-600 font-sans">{mat.finish}</p>
                                  {mat.description && (
                                    <p className="text-xs text-gray-500 font-sans mt-1">{mat.description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setDetectionImage(null);
                              setDetectedMaterials([]);
                              setSelectedMaterialIds(new Set());
                              setDetectionError(null);
                            }}
                            className="flex-1 border border-gray-200 py-3 text-xs font-mono uppercase tracking-widest hover:border-black transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              const selectedMaterials = detectedMaterials.filter(mat => selectedMaterialIds.has(mat.id));
                              selectedMaterials.forEach((mat) => handleAdd(mat, undefined, true));
                              setCustomMaterialMode(null);
                              setDetectionImage(null);
                              setDetectedMaterials([]);
                              setSelectedMaterialIds(new Set());
                            }}
                            disabled={selectedMaterialIds.size === 0}
                            className="flex-1 bg-arch-black text-white py-3 text-xs font-mono uppercase tracking-widest hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Add Selected to Board
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Custom Material Form */
                  <div className="max-w-2xl space-y-6 border border-arch-line p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display uppercase tracking-widest text-lg">
                        Add Custom Material
                      </h3>
                      <button
                        onClick={() => {
                          setCustomMaterialMode(null);
                          setCustomMaterialName('');
                          setCustomMaterialDescription('');
                          setCustomMaterialImage(null);
                        }}
                        className="text-sm text-gray-600 hover:text-black"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Material Name */}
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                        Material Name *
                      </label>
                      <input
                        type="text"
                        value={customMaterialName}
                        onChange={(e) => setCustomMaterialName(e.target.value)}
                        placeholder="e.g., Reclaimed Oak Flooring"
                        className="w-full border border-gray-200 px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>

                    {/* Image Upload */}
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                        Image {customMaterialMode === 'upload' ? '*' : '(Optional)'}
                      </label>
                      {customMaterialImage ? (
                        <div className="relative">
                          <img
                            src={customMaterialImage}
                            alt="Custom material"
                            className="w-full h-48 object-cover border border-gray-200"
                          />
                          <button
                            onClick={() => setCustomMaterialImage(null)}
                            className="absolute top-2 right-2 bg-white p-1 border border-gray-200 hover:bg-gray-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-gray-300 p-8 hover:border-black transition-colors cursor-pointer flex flex-col items-center">
                          <Upload className="w-8 h-8 mb-2 text-gray-400" />
                          <span className="text-sm text-gray-600 font-sans">Click to upload image</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleCustomMaterialImageUpload(e.target.files)}
                          />
                        </label>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                        Description {customMaterialMode === 'describe' ? '*' : '(Optional)'}
                      </label>
                      <textarea
                        value={customMaterialDescription}
                        onChange={(e) => setCustomMaterialDescription(e.target.value)}
                        placeholder="Describe the material, its properties, source, etc."
                        rows={4}
                        className="w-full border border-gray-200 px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>

                    {/* Create Button */}
                    <button
                      onClick={handleCreateCustomMaterial}
                      className="w-full bg-arch-black text-white py-3 text-xs font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors"
                    >
                      Create & Add to Board
                    </button>
                  </div>
                )}
              </div>
            ) : !selectedCategory ? (
              /* Empty state when no category selected - Video showcase */
              <div className={`${isFadingOut ? 'animate-fade-out' : ''}`}>
                {/* Material video showcase */}
                <div className="relative overflow-hidden rounded-lg bg-black aspect-square w-full max-w-2xl mx-auto">
                  <video
                    key={currentVideoIndex}
                    autoPlay
                    muted
                    playsInline
                    loop={false}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                      isVideoTransitioning ? 'opacity-0' : 'opacity-100'
                    }`}
                    style={{
                      objectPosition: 'center center',
                    }}
                    onLoadedData={(e: React.SyntheticEvent<HTMLVideoElement>) => {
                      const video = e.currentTarget;
                      video.playbackRate = 0.5;

                      // Force move to next video after 7 seconds
                      setTimeout(() => {
                        setIsVideoTransitioning(true);
                        setTimeout(() => {
                          const nextIndex = Math.floor(Math.random() * videos.length);
                          setCurrentVideoIndex(nextIndex);
                          setIsVideoTransitioning(false);
                        }, 1000);
                      }, 7000);
                    }}
                    onEnded={() => {
                      setIsVideoTransitioning(true);
                      setTimeout(() => {
                        const nextIndex = Math.floor(Math.random() * videos.length);
                        setCurrentVideoIndex(nextIndex);
                        setIsVideoTransitioning(false);
                      }, 1000);
                    }}
                  >
                    <source src={videos[currentVideoIndex]} type="video/mp4" />
                  </video>

                  {/* Overlay text */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-white font-sans text-lg text-center px-6">
                      Choose a category to browse materials
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Product Grid */}
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${isFadingOut ? 'animate-fade-out' : 'animate-fade-in'}`}>
                  {sortedMaterials.map((mat) => (
                    <article key={mat.id} className="group space-y-3">
                      {/* Product image/swatch */}
                      <div className="aspect-square bg-arch-gray relative overflow-hidden border border-arch-line">
                        {mat.customImage ? (
                          <img src={mat.customImage} alt={mat.name} className="w-full h-full object-cover" />
                        ) : (
                          <picture>
                            <source srcSet={`/icons/${mat.id}.webp`} type="image/webp" />
                            <img
                              src={`/icons/${mat.id}.png`}
                              alt={mat.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                // Fallback to color swatch if icon fails to load
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const fallback = target.parentElement?.nextElementSibling as HTMLElement | null;
                                if (fallback) {
                                  fallback.style.display = 'block';
                                }
                              }}
                            />
                          </picture>
                        )}
                        <div
                          className="w-full h-full hidden"
                          style={{ backgroundColor: mat.tone }}
                        />
                      </div>

                      {/* Product info */}
                      <div className="space-y-2">
                        <h3 className="font-display uppercase tracking-wide text-sm">{mat.name}</h3>
                        <p className="text-xs text-gray-600 font-sans line-clamp-2">{mat.finish}</p>
                        {mat.description && (
                          <p className="text-xs text-gray-500 font-sans line-clamp-2">{mat.description}</p>
                        )}
                        {mat.tags && mat.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {mat.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 bg-gray-100 text-gray-600"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add to board button */}
                      <button
                        onClick={() => handleAdd(mat)}
                        className="w-full bg-arch-black text-white py-3 text-xs font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors"
                      >
                        Add to board
                      </button>
                    </article>
                  ))}
                </div>

                {/* Empty state when no results */}
                {sortedMaterials.length === 0 && (
                  <div className="text-center py-16">
                    <p className="text-gray-600 font-sans">No materials found in this category.</p>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Added to board modal */}
      {recentlyAdded && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setRecentlyAdded(null)}
              className="absolute top-3 right-3 p-1 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-arch-line pb-4">
              <ShoppingCart className="w-5 h-5" />
              <div className="font-display uppercase tracking-widest text-base">
                {hasOptions ? 'Select Options' : 'Added to board'}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div
                  className="w-16 h-16 border border-arch-line flex-shrink-0"
                  style={{ backgroundColor: recentlyAdded.tone }}
                  aria-hidden
                />
                <div className="flex-1">
                  <div className="font-display uppercase tracking-wide text-sm">{recentlyAdded.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-gray-600 mt-1">
                    {recentlyAdded.finish}
                  </div>
                  {recentlyAdded.description && (
                    <p className="font-sans text-xs text-gray-600 mt-2">{recentlyAdded.description}</p>
                  )}
                </div>
              </div>

              {/* Show instruction if material has options */}
              {hasOptions && (
                <div className="bg-gray-50 border border-gray-200 p-3">
                  <p className="font-sans text-xs text-gray-700">
                    Select a colour or finish option below to add this material to your board.
                  </p>
                </div>
              )}

              {/* Curated color options */}
              {hasColorOptions && (
                <div className="border-t border-arch-line pt-4">
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                    Colour Options
                  </label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {recentlyAdded.colorOptions?.map((colorOption, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          handleAdd(recentlyAdded, { tone: colorOption.tone, label: colorOption.label });
                        }}
                        className="flex flex-col items-start gap-2 border border-gray-200 px-3 py-2 hover:border-black transition-colors text-left"
                        title={`Add ${colorOption.label}`}
                      >
                        <span
                          className="h-8 w-full border border-gray-200"
                          style={{ backgroundColor: colorOption.tone }}
                          aria-hidden
                        />
                        <span className="font-sans text-xs">{colorOption.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="font-sans text-xs text-gray-500 mt-2">
                    Click a colour to add that variation to your board.
                  </p>
                </div>
              )}

              {/* RAL palette for free color selection */}
              {hasFreeColor && (
                <div className="border-t border-arch-line pt-4">
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                    RAL Colour Options
                  </label>
                  <div className="grid max-h-80 grid-cols-2 gap-3 overflow-y-auto pr-2 sm:grid-cols-3">
                    {RAL_COLOR_OPTIONS.map((colorOption, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          handleAdd(recentlyAdded, { tone: colorOption.tone, label: colorOption.label });
                        }}
                        className="flex flex-col items-start gap-2 border border-gray-200 px-3 py-2 hover:border-black transition-colors text-left"
                        title={`Add ${colorOption.label}`}
                      >
                        <span
                          className="h-8 w-full border border-gray-200"
                          style={{ backgroundColor: colorOption.tone }}
                          aria-hidden
                        />
                        <span className="font-sans text-xs">{colorOption.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="font-sans text-xs text-gray-500 mt-2">
                    Click a RAL colour to add that variation to your board.
                  </p>
                </div>
              )}

              {/* Finish options if available */}
              {hasFinishOptions && (
                <div className="border-t border-arch-line pt-4">
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                    Finish Options
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {recentlyAdded.finishOptions.map((finish, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          handleAdd(recentlyAdded, { label: finish });
                        }}
                        className="border border-gray-200 px-3 py-2 hover:border-black transition-colors"
                      >
                        <span className="font-sans text-xs">{finish}</span>
                      </button>
                    ))}
                  </div>
                  <p className="font-sans text-xs text-gray-500 mt-2">
                    Click a finish to add that variation to your board.
                  </p>
                </div>
              )}

            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {/* Show "Add as-is" button if material has options but user wants default */}
              {hasOptions && (
                <button
                  onClick={() => {
                    // Add the base material without customization
                    onBoardChange([...board, recentlyAdded]);
                    setRecentlyAdded(null);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-200 uppercase font-mono text-[11px] tracking-widest hover:border-black transition-colors"
                >
                  Add as-is (no options)
                </button>
              )}
              <button
                onClick={() => setRecentlyAdded(null)}
                className="flex-1 px-4 py-3 border border-gray-200 uppercase font-mono text-[11px] tracking-widest hover:border-black transition-colors"
              >
                {hasOptions ? 'Cancel' : 'Add more materials'}
              </button>
              {/* Only show "Go to moodboard" if material was already added (no options) */}
              {!hasOptions && (
                <button
                  onClick={() => {
                    setRecentlyAdded(null);
                    onNavigate('moodboard');
                  }}
                  className="flex-1 px-4 py-3 bg-arch-black text-white uppercase font-mono text-[11px] tracking-widest hover:bg-gray-900 transition-colors"
                >
                  Go to moodboard
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialSelection;
