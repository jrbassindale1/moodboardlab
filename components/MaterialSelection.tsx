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
  const [sortBy, setSortBy] = useState<'featured' | 'name'>('featured');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  // Get all materials for the selected category or all if none selected
  const displayedMaterials = useMemo(() => {
    if (!selectedCategory) {
      return Object.values(filteredMaterialsByPath).flat();
    }
    return filteredMaterialsByPath[selectedCategory] || [];
  }, [selectedCategory, filteredMaterialsByPath]);

  // Sort materials
  const sortedMaterials = useMemo(() => {
    const materials = [...displayedMaterials];
    if (sortBy === 'name') {
      return materials.sort((a, b) => a.name.localeCompare(b.name));
    }
    return materials; // featured is default order
  }, [displayedMaterials, sortBy]);

  // Get category label
  const getCategoryLabel = () => {
    if (!selectedCategory) return 'All Materials';
    const group = allGroups.find(g => g.path === selectedCategory);
    return group?.label || 'Materials';
  };

  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      {/* Header with breadcrumb */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-screen-2xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm font-sans">
            <button onClick={() => onNavigate('moodboard')} className="hover:underline">
              Home
            </button>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-600">Materials</span>
            {selectedCategory && (
              <>
                <ChevronRight className="w-4 h-4" />
                <span className="text-gray-600">{getCategoryLabel()}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main content area with sidebar + grid */}
      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Left Sidebar - Category filters */}
          <aside className="w-64 flex-shrink-0 space-y-6">
            {/* Back to category button */}
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="flex items-center gap-2 text-sm font-sans hover:underline mb-4"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Category
              </button>
            )}

            {/* Categories */}
            <div className="space-y-1">
              <h3 className="font-sans text-sm font-medium mb-3">Category</h3>
              {MATERIAL_TREE.map((section) => (
                <div key={section.id} className="space-y-1">
                  <h4 className="font-sans text-xs uppercase tracking-wider text-gray-500 mt-4 mb-2">{section.label}</h4>
                  {section.groups.map((group) => {
                    const count = (filteredMaterialsByPath[group.path] || []).length;
                    if (count === 0 && hasSearch) return null;
                    return (
                      <button
                        key={group.id}
                        onClick={() => setSelectedCategory(group.path)}
                        className={`block w-full text-left px-2 py-1.5 text-sm font-sans hover:underline ${
                          selectedCategory === group.path ? 'font-medium' : ''
                        }`}
                      >
                        {group.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Refine section (placeholder for future filters) */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-sans text-sm font-medium mb-3">Refine</h3>
              <div className="space-y-2">
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer text-sm font-sans py-1">
                    <span>Price</span>
                    <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                  </summary>
                </details>
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer text-sm font-sans py-1">
                    <span>Form</span>
                    <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                  </summary>
                </details>
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer text-sm font-sans py-1">
                    <span>Aroma</span>
                    <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                  </summary>
                </details>
              </div>
            </div>

            {/* Trolley summary */}
            <div className="border-t border-gray-200 pt-6">
              <button
                onClick={() => onNavigate('moodboard')}
                className="w-full flex items-center justify-between p-3 border border-gray-200 hover:border-black transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  <span className="text-sm font-sans">My cart</span>
                </div>
                <span className="text-xs font-sans text-gray-600">({board.length})</span>
              </button>
            </div>
          </aside>

          {/* Right side - Product grid */}
          <main className="flex-1 space-y-6">
            {/* Page title and sort */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-200">
              <div>
                <h1 className="text-3xl font-serif mb-2">{getCategoryLabel()}</h1>
                <p className="text-sm text-gray-600 font-sans">
                  {sortedMaterials.length} product{sortedMaterials.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 font-sans">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'featured' | 'name')}
                  className="border border-gray-200 px-3 py-1.5 text-sm font-sans focus:outline-none focus:border-black"
                >
                  <option value="featured">Featured</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full border-0 border-b border-gray-200 pl-10 pr-3 py-2 text-sm font-sans focus:outline-none focus:border-black"
              />
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedMaterials.map((mat) => (
                <article key={mat.id} className="group space-y-4">
                  {/* Product image/swatch */}
                  <div className="aspect-[3/4] bg-gray-100 relative overflow-hidden">
                    <div
                      className="w-full h-full"
                      style={{ backgroundColor: mat.tone }}
                    />
                    {/* Bookmark icon */}
                    <button className="absolute top-3 right-3 w-8 h-8 bg-white/80 hover:bg-white flex items-center justify-center">
                      <span className="text-lg">🔖</span>
                    </button>
                  </div>

                  {/* Product info */}
                  <div className="space-y-2">
                    <h3 className="font-serif text-base">{mat.name}</h3>
                    <p className="text-sm text-gray-600 font-sans line-clamp-2">
                      {mat.finish}
                    </p>
                    <p className="text-xs text-gray-500 font-sans">One size</p>
                    <p className="text-sm font-sans">£19.00</p>
                  </div>

                  {/* Add to cart button */}
                  <button
                    onClick={() => handleAdd(mat)}
                    className="w-full bg-[#252525] text-white py-3 text-sm font-sans hover:bg-black transition-colors"
                  >
                    Add to cart
                  </button>
                </article>
              ))}
            </div>

            {/* Empty state */}
            {sortedMaterials.length === 0 && (
              <div className="text-center py-16">
                <p className="text-gray-600 font-sans">No materials found.</p>
              </div>
            )}
          </main>
        </div>
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
