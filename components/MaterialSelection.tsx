import React, { useMemo, useState } from 'react';
import { ChevronRight, Search, ShoppingCart, Sparkles, X } from 'lucide-react';
import { MATERIAL_PALETTE } from '../constants';
import { MaterialOption } from '../types';

interface MaterialSelectionProps {
  onNavigate: (page: string) => void;
  board: MaterialOption[];
  onBoardChange: (items: MaterialOption[]) => void;
}

const categories: { id: MaterialOption['category']; label: string }[] = [
  { id: 'structure', label: 'Structure' },
  { id: 'floor', label: 'Floors' },
  { id: 'finish', label: 'Internal finishes' },
  { id: 'external', label: 'External' }
];

const MaterialSelection: React.FC<MaterialSelectionProps> = ({ onNavigate, board, onBoardChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialOption['category']>('structure');
  const [recentlyAdded, setRecentlyAdded] = useState<MaterialOption | null>(null);

  const filteredMaterials = useMemo(() => {
    const normalized = searchTerm.toLowerCase();
    return MATERIAL_PALETTE.filter(
      (mat) =>
        mat.category === selectedCategory &&
        (mat.name.toLowerCase().includes(normalized) ||
          mat.description.toLowerCase().includes(normalized) ||
          mat.keywords.some((kw) => kw.toLowerCase().includes(normalized)))
    );
  }, [searchTerm, selectedCategory]);

  const handleAdd = (material: MaterialOption) => {
    onBoardChange([...board, material]);
    setRecentlyAdded(material);
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
                Add materials into your trolley first, then move into the Moodboard Lab to arrange, render, and edit.
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
          <div className="flex flex-wrap gap-3 items-center">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-2 border text-sm uppercase font-mono tracking-widest transition-colors ${
                  selectedCategory === cat.id ? 'bg-black text-white' : 'bg-white hover:border-black'
                }`}
              >
                {cat.label}
              </button>
            ))}
            <div className="relative ml-auto w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search materials"
                className="w-full border border-gray-200 pl-9 pr-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMaterials.map((mat) => (
              <article key={mat.id} className="border border-gray-200 bg-white p-5 space-y-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <span
                    className="w-12 h-12 rounded-full border border-gray-200 shadow-inner"
                    style={{ backgroundColor: mat.tone }}
                    aria-hidden
                  />
                  <div className="space-y-1">
                    <div className="font-display uppercase tracking-wide text-lg">{mat.name}</div>
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
              </article>
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
