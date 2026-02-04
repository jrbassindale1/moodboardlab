import React from 'react';
import { ShoppingCart, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { MaterialOption } from '../../types';
import { getMaterialIconId } from '../../utils/materialIconMapping';

interface ChosenMaterialsListProps {
  board: MaterialOption[];
  materialsAccordionOpen: boolean;
  setMaterialsAccordionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onNavigate?: (page: string) => void;
  onRemove: (idx: number) => void;
}

const ChosenMaterialsList: React.FC<ChosenMaterialsListProps> = ({
  board,
  materialsAccordionOpen,
  setMaterialsAccordionOpen,
  onNavigate,
  onRemove,
}) => {
  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setMaterialsAccordionOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 border border-black px-3 py-1 uppercase font-mono text-[11px] tracking-widest hover:bg-gray-50 transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          Chosen Materials
          {materialsAccordionOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          )}
        </button>
        <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
          {board.length} item{board.length === 1 ? '' : 's'} selected
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onNavigate?.('materials')}
            className="px-3 py-2 border border-gray-200 uppercase font-mono text-[11px] tracking-widest hover:border-black"
          >
            Edit materials
          </button>
        </div>
      </div>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: materialsAccordionOpen ? '2000px' : '0px',
          opacity: materialsAccordionOpen ? 1 : 0,
        }}
      >
        {board.length === 0 ? (
          <div className="border border-dashed border-gray-300 bg-gray-50 p-6 text-center space-y-3">
            <p className="font-sans text-gray-700 text-sm">
              No materials have been added yet. Head to the Materials page to curate your selection
              before building the board.
            </p>
            <button
              onClick={() => onNavigate?.('materials')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900"
            >
              Go to Materials
            </button>
          </div>
        ) : (
          <div className="space-y-0 border border-gray-200">
            {board.map((item, idx) => {
              const iconId = getMaterialIconId(item.id);
              return (
                <div
                  key={`${item.id}-${idx}`}
                  className="border-b border-gray-200 last:border-b-0 bg-white hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Material swatch/image */}
                    <div className="w-20 h-20 flex-shrink-0 border border-gray-200 overflow-hidden bg-gray-50">
                      {item.customImage ? (
                        <img
                          src={item.customImage}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : item.colorOptions ||
                        item.supportsColor ||
                        item.finish.includes('(#') ||
                        item.finish.includes('—') ? (
                        <div className="w-full h-full" style={{ backgroundColor: item.tone }} />
                      ) : (
                        <>
                          <picture>
                            <source srcSet={`/icons/${iconId}.webp`} type="image/webp" />
                            <img
                              src={`/icons/${iconId}.png`}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const fallback = target.parentElement?.parentElement?.querySelector(
                                  '.fallback-swatch'
                                ) as HTMLElement | null;
                                if (fallback) {
                                  fallback.style.display = 'block';
                                }
                              }}
                            />
                          </picture>
                          <div
                            className="w-full h-full fallback-swatch hidden"
                            style={{ backgroundColor: item.tone }}
                          />
                        </>
                      )}
                    </div>

                    {/* Material details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display text-sm uppercase tracking-wide text-gray-900 mb-1">
                        {item.name}
                      </h4>
                      <p className="font-mono text-[11px] uppercase tracking-widest text-gray-600 mb-1">
                        {item.finish}
                      </p>
                      {item.description && (
                        <p className="font-sans text-xs text-gray-500 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => onRemove(idx)}
                      className="flex-shrink-0 p-2 text-gray-400 hover:text-black opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default ChosenMaterialsList;
