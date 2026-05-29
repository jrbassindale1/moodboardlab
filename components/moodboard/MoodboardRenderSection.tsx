import React from 'react';
import { Loader2, ImageDown, Wand2, RefreshCw, Maximize2 } from 'lucide-react';

interface MoodboardRenderSectionProps {
  moodboardRenderUrl: string;
  isRenderInFlight: boolean;
  isCreatingMoodboard: boolean;
  status: string;
  moodboardEditPrompt: string;
  setMoodboardEditPrompt: React.Dispatch<React.SetStateAction<string>>;
  downloadingId: string | null;
  onDownloadBoard: (url: string, renderId?: string) => void;
  onNavigate?: (page: string) => void;
  onMoodboardEdit: () => void;
  onRegenerateMoodboard?: () => void;
  onRender4K?: () => void;
  canUse4K?: boolean;
  fourKTooltip?: string;
  renderingMode?: string | null;
}

const MoodboardRenderSection: React.FC<MoodboardRenderSectionProps> = ({
  moodboardRenderUrl,
  isRenderInFlight,
  isCreatingMoodboard,
  status,
  moodboardEditPrompt,
  setMoodboardEditPrompt,
  downloadingId,
  onDownloadBoard,
  onNavigate,
  onMoodboardEdit,
  onRegenerateMoodboard,
  onRender4K,
  canUse4K,
  fourKTooltip,
  renderingMode,
}) => {
  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="border border-gray-200 p-4 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
            Moodboard Render
          </div>
          {onRegenerateMoodboard && (
            <button
              onClick={onRegenerateMoodboard}
              disabled={isCreatingMoodboard || status === 'all' || status === 'render'}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingMoodboard && (status === 'all' || status === 'render') ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </>
              )}
            </button>
          )}
        </div>
        <div className="relative mx-auto max-w-2xl border border-gray-200 bg-white flex items-center justify-center p-6 shadow-sm">
          <img
            src={moodboardRenderUrl}
            alt="Moodboard"
            className={`max-h-[80vh] max-w-full h-auto w-auto object-contain transition-all duration-300 ${
              isRenderInFlight ? 'blur-sm opacity-70' : ''
            }`}
          />
          {isRenderInFlight && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 bg-white/80 px-4 py-3 rounded-lg shadow-sm">
                <Loader2 className="w-6 h-6 animate-spin text-gray-700" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">Generating...</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="border border-gray-200 p-4 bg-white space-y-2">
        <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
          Refine Your Moodboard
        </div>
        <p className="font-sans text-sm text-gray-700">
          Describe changes you'd like to make to this moodboard. Your materials and composition will be preserved.
        </p>
        <textarea
          value={moodboardEditPrompt}
          onChange={(e) => setMoodboardEditPrompt(e.target.value)}
          placeholder="E.g., add people walking through the scene, change to dusk lighting with warm atmosphere, include plants and greenery."
          className="w-full border border-gray-300 px-3 py-2 font-sans text-sm min-h-[80px] resize-vertical"
        />
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onMoodboardEdit}
            disabled={isCreatingMoodboard || status !== 'idle' || !moodboardRenderUrl}
            className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
          >
            {status === 'render' && isCreatingMoodboard ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating render
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Apply text edit
              </>
            )}
          </button>
          <div className="relative group">
            <button
              onClick={onRender4K}
              disabled={status !== 'idle' || !moodboardRenderUrl || !canUse4K}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300"
            >
              {status === 'render' && renderingMode === 'upscale-4k' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finalising...
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  Final Quality (4K)
                </>
              )}
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-mono uppercase tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {canUse4K ? 'Create 4K final output. Costs 5 credits.' : fourKTooltip}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>
          <button
            onClick={() => onDownloadBoard(moodboardRenderUrl, 'moodboard')}
            disabled={downloadingId === 'moodboard'}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black disabled:bg-gray-100 disabled:text-gray-400"
          >
            {downloadingId === 'moodboard' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <ImageDown className="w-4 h-4" />
                Download sheet
              </>
            )}
          </button>
          <button
            onClick={() => onNavigate?.('apply')}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black"
          >
            <Wand2 className="w-4 h-4" />
            Apply palette to project image
          </button>
        </div>
        <p className="font-sans text-xs text-gray-500">
          Downloaded sheets include the material and brand key for attribution.
        </p>
      </div>
    </div>
  );
};

export default MoodboardRenderSection;
