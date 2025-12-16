import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search, ShoppingCart, Sparkles, X } from 'lucide-react';
import { MATERIAL_PALETTE } from '../constants';
import { MaterialOption, UploadedImage } from '../types';

interface MaterialSelectionProps {
  onNavigate: (page: string) => void;
  board: MaterialOption[];
  onBoardChange: (items: MaterialOption[]) => void;
}

type MaterialTreeGroup = {
  id: string;
  label: string;
  path: string;
  description?: string;
};

const MATERIAL_TREE: { id: string; label: string; groups: MaterialTreeGroup[] }[] = [
  {
    id: 'structure',
    label: 'Structure',
    groups: [
      { id: 'primary-structure', label: 'Primary Structure', path: 'Structure>Primary Structure' },
      { id: 'secondary-structure', label: 'Secondary Structure', path: 'Structure>Secondary Structure' },
      { id: 'envelope-substructure', label: 'Envelope Substructure', path: 'Structure>Envelope Substructure' }
    ]
  },
  {
    id: 'external',
    label: 'External',
    groups: [
      { id: 'facade', label: 'Façade', path: 'External>Façade' },
      { id: 'glazing', label: 'Glazing', path: 'External>Glazing' },
      { id: 'roofing', label: 'Roofing', path: 'External>Roofing' },
      {
        id: 'landscape',
        label: 'External Ground / Landscaping',
        path: 'External>External Ground / Landscaping'
      },
      { id: 'insulation', label: 'Insulation', path: 'External>Insulation' }
    ]
  },
  {
    id: 'internal',
    label: 'Internal',
    groups: [
      { id: 'floors', label: 'Floors', path: 'Internal>Floors' },
      { id: 'walls', label: 'Walls', path: 'Internal>Walls' },
      { id: 'paint-standard', label: 'Paint – Standard', path: 'Internal>Paint – Standard' },
      { id: 'paint-custom', label: 'Paint – Custom Colour', path: 'Internal>Paint – Custom Colour' },
      { id: 'plaster', label: 'Plaster / Microcement', path: 'Internal>Plaster / Microcement' },
      { id: 'timber-panels', label: 'Timber Panels', path: 'Internal>Timber Panels' },
      { id: 'tiles', label: 'Tiles', path: 'Internal>Tiles' },
      { id: 'wallpaper', label: 'Wallpaper', path: 'Internal>Wallpaper' },
      { id: 'ceilings', label: 'Ceilings', path: 'Internal>Ceilings' },
      { id: 'acoustic-panels', label: 'Acoustic Panels', path: 'Internal>Acoustic Panels' },
      { id: 'timber-slats', label: 'Timber Slats', path: 'Internal>Timber Slats' },
      { id: 'exposed-structure', label: 'Exposed Structure', path: 'Internal>Exposed Structure' },
      { id: 'joinery', label: 'Joinery & Furniture', path: 'Internal>Joinery & Furniture' },
      { id: 'fixtures', label: 'Fixtures & Fittings', path: 'Internal>Fixtures & Fittings' },
      { id: 'doors', label: 'Doors', path: 'Internal>Doors' },
      { id: 'balustrade', label: 'Balustrade & Railings', path: 'Internal>Balustrade & Railings' }
    ]
  },
  {
    id: 'custom',
    label: 'Custom',
    groups: [
      { id: 'upload-image', label: 'Upload Image', path: 'Custom>Upload Image' },
      {
        id: 'brand-material',
        label: 'Brand / Supplier Material',
        path: 'Custom>Brand / Supplier Material'
      },
      { id: 'custom-finish', label: 'Custom Finish / Product Link', path: 'Custom>Custom Finish / Product Link' }
    ]
  }
];

const MaterialSelection: React.FC<MaterialSelectionProps> = ({ onNavigate, board, onBoardChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [recentlyAdded, setRecentlyAdded] = useState<MaterialOption | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const treePathFallbacks = useMemo(
    () => ({
      structure: ['Structure>Primary Structure', 'Internal>Exposed Structure'],
      floor: ['Internal>Floors', 'External>External Ground / Landscaping'],
      'wall-internal': ['Internal>Walls'],
      external: ['External>Façade'],
      ceiling: ['Internal>Ceilings'],
      soffit: ['Internal>Exposed Structure'],
      window: ['External>Glazing'],
      roof: ['External>Roofing'],
      finish: ['Internal>Timber Panels', 'Internal>Acoustic Panels', 'Internal>Timber Slats'],
      'paint-wall': ['Internal>Paint – Standard'],
      'paint-ceiling': ['Internal>Ceilings'],
      plaster: ['Internal>Plaster / Microcement'],
      microcement: ['Internal>Plaster / Microcement'],
      'timber-panel': ['Internal>Timber Panels'],
      tile: ['Internal>Tiles'],
      wallpaper: ['Internal>Wallpaper'],
      'acoustic-panel': ['Internal>Acoustic Panels'],
      'timber-slat': ['Internal>Timber Slats'],
      'exposed-structure': ['Internal>Exposed Structure'],
      joinery: ['Internal>Joinery & Furniture'],
      fixture: ['Internal>Fixtures & Fittings'],
      landscape: ['External>External Ground / Landscaping']
    }),
    []
  );

  const materialsByPath = useMemo(() => {
    const map: Record<string, MaterialOption[]> = {};
    MATERIAL_PALETTE.forEach((mat) => {
      const paths = mat.treePaths?.length ? mat.treePaths : treePathFallbacks[mat.category] || ['Unsorted>Other'];
      paths.forEach((path) => {
        map[path] = map[path] || [];
        map[path].push(mat);
      });
    });
    return map;
  }, [treePathFallbacks]);

  const allGroups = useMemo(() => MATERIAL_TREE.flatMap((section) => section.groups.map((g) => g)), []);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const acc: Record<string, boolean> = {};
    allGroups.forEach((group) => {
      acc[group.id] = false;
    });
    return acc;
  });

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredMaterialsByPath: Record<string, MaterialOption[]> = useMemo(() => {
    const tokens = normalizedSearch.split(/\s+/).filter(Boolean);
    if (!tokens.length) return materialsByPath;

    const matchesSearch = (mat: MaterialOption) => {
      const haystack = [
        mat.name,
        mat.finish,
        mat.description,
        mat.category,
        ...(mat.keywords || []),
        ...(mat.colorOptions?.map((c) => c.label) || [])
      ]
        .join(' ')
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    };

    const next: Record<string, MaterialOption[]> = {};
    Object.entries(materialsByPath).forEach(([path, list]) => {
      next[path] = list.filter((item) => matchesSearch(item));
    });
    return next;
  }, [normalizedSearch, materialsByPath]);

  const hasSearch = normalizedSearch.length > 0;

  useEffect(() => {
    if (!hasSearch) return;
    setOpenGroups((prev) => {
      const next = { ...prev };
      allGroups.forEach((group) => {
        next[group.id] = (filteredMaterialsByPath[group.path] || []).length > 0;
      });
      return next;
    });
  }, [hasSearch, filteredMaterialsByPath, allGroups]);

  useEffect(() => {
    if (hasSearch) return;
    setOpenGroups((prev) => {
      const anyOpen = allGroups.some((group) => prev[group.id]);
      if (!anyOpen) return prev;
      const next = { ...prev };
      allGroups.forEach((group) => {
        next[group.id] = false;
      });
      return next;
    });
  }, [hasSearch, allGroups]);

  const handleAdd = (material: MaterialOption) => {
    onBoardChange([...board, material]);
    setRecentlyAdded(material);
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;

    const uploads: UploadedImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      uploads.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        dataUrl,
        mimeType: file.type,
        sizeBytes: file.size
      });
    }

    if (uploads.length) {
      setUploadedImages((prev) => [...prev, ...uploads].slice(-12));
    }
  };

  const addUploadToTrolley = (image: UploadedImage) => {
    const materialFromUpload: MaterialOption = {
      id: `upload-${image.id}`,
      name: image.name,
      tone: '#e5e7eb',
      finish: 'Custom upload',
      description: 'User-uploaded material sample ready to add to your trolley.',
      keywords: ['upload', 'custom', 'image'],
      category: 'finish'
    };
    handleAdd(materialFromUpload);
  };

  return (
    <div className="pt-24 pb-16 bg-white animate-in fade-in duration-500">
      <div className="max-w-screen-2xl mx-auto px-6 space-y-10">
        <header className="flex flex-col gap-6 border-b border-gray-200 pb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 border border-black px-3 py-1 uppercase font-mono text-[11px] tracking-widest">
                Moodboard cart
              </div>
              <h1 className="font-display text-4xl md:text-5xl uppercase leading-[0.95]">
                Shop materials, then build the board.
              </h1>
              <p className="font-sans text-gray-700 max-w-3xl text-lg">
                Browse every category, add the finishes you need, then head to the Moodboard Lab to render and edit. Materials can only be
                chosen here.
              </p>
              <button
                onClick={() => onNavigate('moodboard')}
                className="inline-flex items-center gap-2 bg-black text-white px-5 py-3 font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 transition-colors"
              >
                Go to my materials
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="border border-gray-200 bg-gray-50 p-4 w-full md:w-80 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                <span className="font-display uppercase text-sm">Trolley</span>
                <span className="ml-auto font-mono text-[11px] uppercase tracking-widest">{board.length} items</span>
              </div>
              {board.length === 0 ? (
                <p className="font-sans text-sm text-gray-600">No materials yet. Add items to start your board.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {board.slice(-8).map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="flex items-center gap-2 border border-gray-200 bg-white px-2 py-1">
                      <span
                        className="w-4 h-4 rounded-full border border-gray-200"
                        style={{ backgroundColor: item.tone }}
                        aria-hidden
                      />
                      <span className="font-mono text-[11px] uppercase tracking-widest text-gray-700">{item.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 border border-black px-3 py-1 uppercase font-mono text-[11px] tracking-widest">
              <Sparkles className="w-4 h-4" />
              Full material catalogue
            </div>
            <div className="relative ml-auto w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by material, finish, or keyword"
                className="w-full border border-gray-200 pl-9 pr-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>

          <div className="space-y-8">
            {MATERIAL_TREE.map((section) => (
              <div key={section.id} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-2xl uppercase tracking-tight">{section.label}</h2>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-gray-500">Catalogue</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {section.groups.map((group) => {
                    const list = filteredMaterialsByPath[group.path] || [];
                    const isUpload = group.id === 'upload-image';
                    const hasResults = isUpload ? true : list.length > 0;
                    const optionCount = isUpload ? uploadedImages.length : list.length;
                    if (!isUpload && !hasResults && hasSearch) return null;

                    return (
                      <article key={group.id} className="border border-gray-200 bg-white shadow-sm">
                        <button
                          onClick={() =>
                            setOpenGroups((prev) => ({
                              ...prev,
                              [group.id]: !prev[group.id]
                            }))
                          }
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                        >
                          <div>
                            <div className="font-display uppercase tracking-wide text-base">{group.label}</div>
                            <p className="font-sans text-sm text-gray-600">
                              {group.description || 'Browse and add finishes into your trolley.'}
                            </p>
                          </div>
                          <span className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                            {optionCount} option{optionCount === 1 ? '' : 's'}
                          </span>
                        </button>

                        {openGroups[group.id] && (
                          <div className="border-t border-gray-200 p-4 space-y-4">
                            {isUpload ? (
                              <div className="space-y-4">
                                <div className="border border-dashed border-gray-300 p-4 bg-gray-50 flex flex-col gap-3">
                                  <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div>
                                      <div className="font-display uppercase tracking-wide text-base">Upload your own samples</div>
                                      <p className="font-sans text-sm text-gray-600">
                                        Add reference images to keep custom finishes with the rest of your materials.
                                      </p>
                                    </div>
                                    <label className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 uppercase font-mono text-[11px] tracking-widest cursor-pointer hover:bg-gray-900">
                                      Upload images
                                      <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => handleUploadFiles(e.target.files)}
                                      />
                                    </label>
                                  </div>
                                  <p className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                                    JPEG, PNG, or HEIC. Add multiple samples at once.
                                  </p>
                                </div>

                                {uploadedImages.length ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {uploadedImages.map((img) => (
                                      <div
                                        key={img.id}
                                        className="border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col"
                                      >
                                        <div className="aspect-video bg-gray-100 overflow-hidden">
                                          <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="p-3 space-y-2 flex-1 flex flex-col">
                                          <div className="font-display uppercase tracking-wide text-sm line-clamp-1" title={img.name}>
                                            {img.name}
                                          </div>
                                          <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
                                            {(img.sizeBytes ? Math.round(img.sizeBytes / 1024) : 0).toLocaleString()} KB
                                          </div>
                                          <button
                                            onClick={() => addUploadToTrolley(img)}
                                            className="mt-auto bg-black text-white px-3 py-2 uppercase font-mono text-[11px] tracking-widest hover:bg-gray-900"
                                          >
                                            Add to trolley
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="font-sans text-sm text-gray-600">
                                    Upload samples to see them here with quick add-to-trolley actions.
                                  </p>
                                )}
                              </div>
                            ) : hasResults ? (
                              list.map((mat) => (
                                <div key={mat.id} className="space-y-3 border border-gray-100 p-3">
                                  <div className="flex items-start gap-3">
                                    <span
                                      className="w-10 h-10 rounded-full border border-gray-200 shadow-inner"
                                      style={{ backgroundColor: mat.tone }}
                                      aria-hidden
                                    />
                                    <div className="space-y-1">
                                      <div className="font-display uppercase tracking-wide text-sm">{mat.name}</div>
                                      <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">{mat.finish}</div>
                                      <p className="font-sans text-sm text-gray-700 leading-relaxed">{mat.description}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1 border border-gray-200 px-2 py-1 uppercase font-mono text-[10px] tracking-widest">
                                      <Sparkles className="w-3 h-3" /> Low-carbon ready
                                    </span>
                                    {mat.carbonIntensity === 'high' && (
                                      <span className="font-mono text-[10px] uppercase tracking-widest text-amber-700">High embodied carbon</span>
                                    )}
                                  </div>
                                  <div className="flex gap-3">
                                    <button
                                      onClick={() => handleAdd(mat)}
                                      className="flex-1 bg-black text-white px-3 py-2 uppercase font-mono text-[11px] tracking-widest hover:bg-gray-900 transition-colors"
                                    >
                                      Add to trolley
                                    </button>
                                    <button
                                      onClick={() => onNavigate('moodboard')}
                                      className="px-3 py-2 border border-gray-200 uppercase font-mono text-[11px] tracking-widest hover:border-black"
                                    >
                                      My materials
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="font-sans text-sm text-gray-600">No materials found in this group.</p>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {recentlyAdded && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setRecentlyAdded(null)}
              className="absolute top-3 right-3 p-1 border border-gray-200 rounded-full hover:bg-gray-50"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5" />
              <div className="font-display uppercase text-lg">Added to trolley</div>
            </div>
            <div className="flex items-start gap-3">
              <span
                className="w-12 h-12 rounded-full border border-gray-200 shadow-inner"
                style={{ backgroundColor: recentlyAdded.tone }}
                aria-hidden
              />
              <div>
                <div className="font-display uppercase text-base">{recentlyAdded.name}</div>
                <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">{recentlyAdded.finish}</div>
                <p className="font-sans text-sm text-gray-700 mt-1">{recentlyAdded.description}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setRecentlyAdded(null)}
                className="flex-1 px-4 py-3 border border-gray-200 uppercase font-mono text-[11px] tracking-widest hover:border-black"
              >
                Add more materials
              </button>
              <button
                onClick={() => {
                  setRecentlyAdded(null);
                  onNavigate('moodboard');
                }}
                className="flex-1 px-4 py-3 bg-black text-white uppercase font-mono text-[11px] tracking-widest hover:bg-gray-900"
              >
                Go to my materials
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialSelection;
