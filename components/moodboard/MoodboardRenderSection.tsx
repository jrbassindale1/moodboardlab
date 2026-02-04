import React from 'react';
import { Loader2, ImageDown, Wand2 } from 'lucide-react';

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
}) => {
  return (
    <div className="space-y-4">
      <div className="border border-gray-200 p-4 bg-white space-y-3">
        <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
          Moodboard Render
        </div>
        <div className="w-full border border-gray-200 bg-gray-50 relative flex items-center justify-center">
          <img
            src={moodboardRenderUrl}
            alt="Moodboard"
            className={`max-h-[80vh] max-w-full h-auto w-auto object-contain transition ${
              isRenderInFlight ? 'opacity-40 grayscale' : ''
            }`}
          />
          {isRenderInFlight && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60">
              <Loader2 className="w-12 h-12 animate-spin text-gray-700" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-gray-700">
                Updating moodboard…
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => onDownloadBoard(moodboardRenderUrl, 'moodboard')}
          disabled={downloadingId === 'moodboard'}
          className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
        >
          {downloadingId === 'moodboard' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Preparing...
            </>
          ) : (
            <>
              <ImageDown className="w-4 h-4" />
              Download
            </>
          )}
        </button>
        <button
          onClick={() => onNavigate?.('apply')}
          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black"
        >
          <Wand2 className="w-4 h-4" />
          Apply your materials
        </button>
      </div>
      <div className="border border-gray-200 p-4 bg-white space-y-2">
        <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
          Edit moodboard render (multi-turn)
        </div>
        <p className="font-sans text-sm text-gray-700">
          Provide new text instructions to adjust the latest moodboard image while keeping
          composition and materials consistent.
        </p>
        <textarea
          value={moodboardEditPrompt}
          onChange={(e) => setMoodboardEditPrompt(e.target.value)}
          placeholder="E.g., warm up the lighting and add a softer vignette."
          className="w-full border border-gray-300 px-3 py-2 font-sans text-sm min-h-[80px] resize-vertical"
        />
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
      </div>
    </div>
  );
};

export default MoodboardRenderSection;
