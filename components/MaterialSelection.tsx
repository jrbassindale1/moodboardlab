import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search, ShoppingCart, X, Upload, FileText } from 'lucide-react';
import { MATERIAL_PALETTE } from '../constants';
import { MaterialOption } from '../types';
import { CATEGORIES } from '../data/categories';
import { migrateAllMaterials } from '../data/categoryMigration';

interface MaterialSelectionProps {
  onNavigate: (page: string) => void;
  board: MaterialOption[];
  onBoardChange: (items: MaterialOption[]) => void;
}

type CustomMaterialMode = 'upload' | 'describe' | null;

const MaterialSelection: React.FC<MaterialSelectionProps> = ({ onNavigate, board, onBoardChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [recentlyAdded, setRecentlyAdded] = useState<MaterialOption | null>(null);
  const [sortBy, setSortBy] = useState<'featured' | 'name'>('featured');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customMaterialMode, setCustomMaterialMode] = useState<CustomMaterialMode>(null);
  const [customMaterialName, setCustomMaterialName] = useState('');
  const [customMaterialDescription, setCustomMaterialDescription] = useState('');
  const [customMaterialImage, setCustomMaterialImage] = useState<string | null>(null);

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
        ...(mat.tags || []),
        ...(mat.colorOptions?.map((c) => c.label) || []),
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
  }, [normalizedSearch, materialsByPath]);

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

  const handleAdd = (material: MaterialOption) => {
    onBoardChange([...board, material]);
    setRecentlyAdded(material);
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

  const isCustomCategory = selectedCategory?.startsWith('Custom>');

  return (
    <div className="min-h-screen bg-white">
      {/* Header with breadcrumb */}
      <div className="border-b border-arch-line bg-white pt-24">
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
              <h3 className="font-display text-sm uppercase tracking-widest mb-3">Category</h3>
              {CATEGORIES.map((section) => (
                <div key={section.id} className="space-y-1">
                  <h4 className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mt-4 mb-2">
                    {section.label}
                  </h4>
                  {(section.children || []).map((child) => {
                    const path = `${section.label}>${child.label}`;
                    const count = (filteredMaterialsByPath[path] || []).length;
                    if (count === 0 && normalizedSearch) return null;

                    return (
                      <button
                        key={child.id}
                        onClick={() => setSelectedCategory(path)}
                        className={`block w-full text-left px-2 py-1.5 text-sm font-sans hover:underline ${
                          selectedCategory === path ? 'font-medium' : ''
                        }`}
                      >
                        {child.label}
                      </button>
                    );
                  })}
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
            {/* Page title and sort */}
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

            {/* Custom Material Creation */}
            {isCustomCategory ? (
              <div className="space-y-6">
                {!customMaterialMode ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Upload Image Option */}
                    <button
                      onClick={() => setCustomMaterialMode('upload')}
                      className="border-2 border-dashed border-gray-300 p-8 hover:border-black transition-colors text-left"
                    >
                      <Upload className="w-12 h-12 mb-4 text-gray-400" />
                      <h3 className="font-display uppercase tracking-wide text-base mb-2">Upload Image</h3>
                      <p className="text-sm text-gray-600 font-sans">
                        Upload a material sample image with an optional description
                      </p>
                    </button>

                    {/* Describe Material Option */}
                    <button
                      onClick={() => setCustomMaterialMode('describe')}
                      className="border-2 border-dashed border-gray-300 p-8 hover:border-black transition-colors text-left"
                    >
                      <FileText className="w-12 h-12 mb-4 text-gray-400" />
                      <h3 className="font-display uppercase tracking-wide text-base mb-2">Describe Material</h3>
                      <p className="text-sm text-gray-600 font-sans">
                        Create a material card with a description and optional image
                      </p>
                    </button>
                  </div>
                ) : (
                  /* Custom Material Form */
                  <div className="max-w-2xl space-y-6 border border-arch-line p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display uppercase tracking-widest text-lg">
                        {customMaterialMode === 'upload' ? 'Upload Image' : 'Describe Material'}
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
              /* Empty state when no category selected */
              <div className="text-center py-16">
                <h2 className="text-2xl font-display uppercase tracking-tight mb-4">Select a Category</h2>
                <p className="text-gray-600 font-sans">Choose a category from the sidebar to browse materials.</p>
              </div>
            ) : (
              <>
                {/* Product Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedMaterials.map((mat) => (
                    <article key={mat.id} className="group space-y-3">
                      {/* Product image/swatch */}
                      <div className="aspect-[3/4] bg-arch-gray relative overflow-hidden border border-arch-line">
                        {mat.customImage ? (
                          <img src={mat.customImage} alt={mat.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full" style={{ backgroundColor: mat.tone }} />
                        )}
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
              <div className="font-display uppercase tracking-widest text-base">Added to board</div>
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

              {/* Color options if available */}
              {recentlyAdded.colorOptions && recentlyAdded.colorOptions.length > 0 && (
                <div className="border-t border-arch-line pt-4">
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                    Color Options
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {recentlyAdded.colorOptions.map((colorOption, idx) => (
                      <button
                        key={idx}
                        className="flex items-center gap-2 border border-gray-200 px-3 py-2 hover:border-black transition-colors"
                        title={colorOption.label}
                      >
                        <span className="w-6 h-6 border border-gray-200" style={{ backgroundColor: colorOption.tone }} />
                        <span className="font-sans text-xs">{colorOption.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="font-sans text-xs text-gray-500 mt-2">
                    Color attributes can be adjusted in the Moodboard Lab after adding to your board.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setRecentlyAdded(null)}
                className="flex-1 px-4 py-3 border border-gray-200 uppercase font-mono text-[11px] tracking-widest hover:border-black transition-colors"
              >
                Add more materials
              </button>
              <button
                onClick={() => {
                  setRecentlyAdded(null);
                  onNavigate('moodboard');
                }}
                className="flex-1 px-4 py-3 bg-arch-black text-white uppercase font-mono text-[11px] tracking-widest hover:bg-gray-900 transition-colors"
              >
                Go to moodboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialSelection;
