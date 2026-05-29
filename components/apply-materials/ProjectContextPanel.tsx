import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type { MaterialOption } from '../../types';
import { formatFinishForDisplay } from '../../utils/materialDisplay';

interface ProjectContextPanelProps {
  moodboardRenderUrl: string | null;
  restoredWithoutMoodboard?: boolean;
  onClearRestoredFlag?: () => void;
  onNavigate?: (page: string) => void;
  renderMaterialsCount: number;
  board: MaterialOption[];
  excludedCount: number;
  onToggleExclude: (index: number, value: boolean) => void;
  collapseMoodboardByDefault?: boolean;
}

const ProjectContextPanel = ({
  moodboardRenderUrl,
  restoredWithoutMoodboard,
  onClearRestoredFlag,
  onNavigate,
  renderMaterialsCount,
  board,
  excludedCount,
  onToggleExclude,
  collapseMoodboardByDefault,
}: ProjectContextPanelProps) => {
  const [isMoodboardOpen, setIsMoodboardOpen] = useState(!collapseMoodboardByDefault);

  useEffect(() => {
    setIsMoodboardOpen(!collapseMoodboardByDefault);
  }, [collapseMoodboardByDefault]);

  return (
    <div className="border border-gray-200 bg-white p-4 space-y-4">
      <div className="font-mono text-[14px] uppercase tracking-widest text-gray-600 font-bold">
        Project Context
      </div>

      <div className="space-y-4">
        <div className="space-y-3 border-b border-gray-200 pb-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsMoodboardOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 font-mono text-[12px] font-bold uppercase tracking-widest text-gray-600 hover:text-black"
            >
              {isMoodboardOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {moodboardRenderUrl ? 'Moodboard' : 'Moodboard Preview'}
            </button>
            <div className="flex items-center gap-3">
              {!isMoodboardOpen && moodboardRenderUrl ? (
                <span className="font-mono text-[10px] uppercase tracking-widest text-gray-400">
                  Saved
                </span>
              ) : null}
              {moodboardRenderUrl ? (
                <button
                  type="button"
                  onClick={() => onNavigate?.('moodboard')}
                  className="font-mono text-[10px] uppercase tracking-widest text-gray-500 hover:text-black"
                >
                  Open Moodboard
                </button>
              ) : null}
            </div>
          </div>
          {isMoodboardOpen && moodboardRenderUrl ? (
            <button
              type="button"
              onClick={() => onNavigate?.('moodboard')}
              className="group block w-full overflow-hidden border border-gray-200 bg-gray-50 text-left"
            >
              <div className="flex items-center justify-center p-2">
                <img
                  src={moodboardRenderUrl}
                  alt="Moodboard preview"
                  className="max-h-40 max-w-full h-auto w-auto object-contain"
                />
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 bg-white px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                  Open Moodboard
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-gray-700 opacity-0 transition-opacity group-hover:opacity-100">
                  Open
                </span>
              </div>
            </button>
          ) : isMoodboardOpen ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center space-y-3">
              <p className="font-sans text-sm text-gray-600">
                {restoredWithoutMoodboard
                  ? 'No moodboard is saved with this render.'
                  : 'No moodboard generated yet.'}
              </p>
              <button
                onClick={() => {
                  onClearRestoredFlag?.();
                  onNavigate?.('moodboard');
                }}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 bg-white font-mono text-[10px] uppercase tracking-widest hover:border-black"
              >
                Open Moodboard
              </button>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-[12px] uppercase tracking-widest text-gray-600 font-bold">
              Material Palette
            </div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
              {renderMaterialsCount}/{board.length} included
            </div>
          </div>
          <p className="font-sans text-xs text-gray-600">
            These materials will be applied to the project image. Untick anything you want to leave out of this render only.
          </p>
          {board.length === 0 ? (
            <div className="border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
              No materials selected yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {board.map((item, index) => (
                <label
                  key={`${item.id}-${index}`}
                  className={`flex items-start gap-3 border border-gray-200 p-2 bg-white hover:bg-gray-50 ${
                    item.excludeFromMoodboardRender ? 'opacity-70' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!item.excludeFromMoodboardRender}
                    onChange={(event) => onToggleExclude(index, !event.target.checked)}
                    className="mt-1 h-3 w-3 border-gray-300 text-gray-900"
                    aria-label={`Include ${item.name} in render`}
                  />
                  <div className="w-8 h-8 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: item.tone }} />
                  <div className="min-w-0">
                    <div className="font-sans text-sm text-gray-900 truncate">{item.name}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500 truncate">
                      {formatFinishForDisplay(item.finish)}
                    </div>
                    {(item.brandName || item.productRange || item.productCode) && (
                      <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-gray-400 truncate">
                        {[item.brandName, item.productRange, item.productCode ? `SKU ${item.productCode}` : ''].filter(Boolean).join(' / ')}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
          {excludedCount > 0 && (
            <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
              {excludedCount} excluded from render
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectContextPanel;
