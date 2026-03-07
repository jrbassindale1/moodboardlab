import React, { useMemo, useState } from 'react';
import { ShoppingCart, ChevronUp, ChevronDown, Trash2, StickyNote } from 'lucide-react';
import { MaterialOption, MaterialCategory } from '../../types';
import { getMaterialIconUrls } from '../../utils/materialIconUrls';
import { formatDescriptionForDisplay, formatFinishForDisplay } from '../../utils/materialDisplay';
import { getCachedColoredIcon } from '../../hooks/useColoredIconGenerator';

interface ChosenMaterialsListProps {
  board: MaterialOption[];
  materialsAccordionOpen: boolean;
  setMaterialsAccordionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onNavigate?: (page: string) => void;
  onRemove: (idx: number) => void;
  onToggleExclude: (idx: number, value: boolean) => void;
  onNoteChange?: (idx: number, note: string) => void;
}

// Category display order and labels
const CATEGORY_ORDER: MaterialCategory[] = [
  'structure',
  'floor',
  'wall-internal',
  'ceiling',
  'external',
  'roof',
  'window',
  'door',
  'soffit',
  'finish',
  'paint-wall',
  'paint-ceiling',
  'plaster',
  'microcement',
  'timber-panel',
  'tile',
  'wallpaper',
  'acoustic-panel',
  'timber-slat',
  'exposed-structure',
  'joinery',
  'fixture',
  'balustrade',
  'furniture',
  'landscape',
  'external-ground',
  'insulation',
];

const formatCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    'floor': 'Floor',
    'structure': 'Structure',
    'finish': 'Finish',
    'wall-internal': 'Internal Walls',
    'external': 'External Envelope',
    'soffit': 'Soffit',
    'ceiling': 'Ceiling',
    'window': 'Windows',
    'roof': 'Roof',
    'paint-wall': 'Wall Paint',
    'paint-ceiling': 'Ceiling Paint',
    'plaster': 'Plaster',
    'microcement': 'Microcement',
    'timber-panel': 'Timber Panels',
    'tile': 'Tiles',
    'wallpaper': 'Wallpaper',
    'acoustic-panel': 'Acoustic Panels',
    'timber-slat': 'Timber Slats',
    'exposed-structure': 'Exposed Structure',
    'joinery': 'Joinery',
    'fixture': 'Fixtures',
    'landscape': 'Landscape',
    'insulation': 'Insulation',
    'door': 'Doors',
    'balustrade': 'Balustrades',
    'external-ground': 'External Ground',
    'furniture': 'Furniture',
  };
  return labels[category] || category
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const ChosenMaterialsList: React.FC<ChosenMaterialsListProps> = ({
  board,
  materialsAccordionOpen,
  setMaterialsAccordionOpen,
  onNavigate,
  onRemove,
  onToggleExclude,
  onNoteChange,
}) => {
  const [expandedNoteIdx, setExpandedNoteIdx] = useState<number | null>(null);

  const helperCopy =
    board.length < 5
      ? 'Adding more materials will help Ai produce a better moodboard.'
      : board.length > 12
      ? 'Fewer materials will help Ai produce a better moodboard.'
      : '';

  // Group and sort materials by category
  const groupedMaterials = useMemo(() => {
    const groups: { category: MaterialCategory; items: { item: MaterialOption; originalIdx: number }[] }[] = [];
    const categoryMap = new Map<MaterialCategory, { item: MaterialOption; originalIdx: number }[]>();

    board.forEach((item, idx) => {
      const category = item.category;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push({ item, originalIdx: idx });
    });

    // Sort categories by predefined order
    const sortedCategories = [...categoryMap.keys()].sort((a, b) => {
      const aIdx = CATEGORY_ORDER.indexOf(a);
      const bIdx = CATEGORY_ORDER.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });

    sortedCategories.forEach((category) => {
      groups.push({
        category,
        items: categoryMap.get(category)!,
      });
    });

    return groups;
  }, [board]);

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
          {board.length} material{board.length === 1 ? '' : 's'} selected
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onNavigate?.('materials')}
            className="px-3 py-2 border border-gray-200 uppercase font-mono text-[11px] tracking-widest hover:border-black"
          >
            Back to materials list
          </button>
        </div>
      </div>
      {helperCopy ? (
        <p className="mt-2 font-sans text-xs text-gray-500">{helperCopy}</p>
      ) : null}

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
            {groupedMaterials.map((group) => (
              <div key={group.category}>
                {/* Category header */}
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                  <h3 className="font-mono text-[11px] uppercase tracking-widest text-gray-700 font-semibold">
                    {formatCategoryLabel(group.category)}
                    <span className="ml-2 text-gray-500 font-normal">
                      ({group.items.length})
                    </span>
                  </h3>
                </div>
                {group.items.map(({ item, originalIdx }) => {
                  const { webpUrl, pngUrl } = getMaterialIconUrls(item);
                  const coloredIconDataUri = item.coloredIconBlobUrl?.startsWith('data:')
                    ? item.coloredIconBlobUrl
                    : (item.colorVariantId ? getCachedColoredIcon(item.colorVariantId) : null);
                  const isNoteExpanded = expandedNoteIdx === originalIdx;
                  return (
                    <div
                      key={`${item.id}-${originalIdx}`}
                      className="border-b border-gray-200 last:border-b-0 bg-white hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-center gap-4 p-4">
                        {/* Material swatch/image */}
                        <div className="w-20 h-20 flex-shrink-0 border border-gray-200 overflow-hidden bg-gray-50">
                          {coloredIconDataUri ? (
                            <img
                              src={coloredIconDataUri}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : item.customImage ? (
                            <img
                              src={item.customImage}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : item.colorOptions ||
                            item.supportsColor ||
                            item.colorLabel ||
                            item.finish.includes('—') ? (
                            <div className="w-full h-full" style={{ backgroundColor: item.tone }} />
                          ) : (
                            <>
                              <picture>
                                <source srcSet={webpUrl} type="image/webp" />
                                <img
                                  src={pngUrl}
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
                            {formatFinishForDisplay(item.finish)}
                          </p>
                          {item.description && (
                            <p className="font-sans text-xs text-gray-500 line-clamp-2">
                              {formatDescriptionForDisplay(item.description)}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <label className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-gray-500">
                              <input
                                type="checkbox"
                                checked={Boolean(item.excludeFromMoodboardRender)}
                                onChange={(e) => onToggleExclude(originalIdx, e.target.checked)}
                                className="h-3 w-3 border-gray-300 text-gray-900"
                                aria-label={`Exclude ${item.name} from moodboard image`}
                              />
                              Exclude from Moodboard Image
                            </label>
                            <button
                              onClick={() => setExpandedNoteIdx(isNoteExpanded ? null : originalIdx)}
                              className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                                item.note ? 'text-amber-600 hover:text-amber-700' : 'text-gray-500 hover:text-gray-700'
                              }`}
                              aria-label={`${isNoteExpanded ? 'Hide' : 'Add'} note for ${item.name}`}
                            >
                              <StickyNote className="w-3 h-3" />
                              {item.note ? 'Edit Note' : 'Add Note'}
                            </button>
                          </div>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => onRemove(originalIdx)}
                          className="flex-shrink-0 p-2 text-gray-400 hover:text-black opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Note input */}
                      {isNoteExpanded && (
                        <div className="px-4 pb-4 pt-0">
                          <div className="ml-24 pl-4">
                            <textarea
                              value={item.note || ''}
                              onChange={(e) => onNoteChange?.(originalIdx, e.target.value)}
                              placeholder="Add a note for this material (e.g., supplier info, specifications, location)..."
                              className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-sans text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 resize-none"
                              rows={2}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default ChosenMaterialsList;
