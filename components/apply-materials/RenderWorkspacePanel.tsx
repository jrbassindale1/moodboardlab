import type { ReactNode } from 'react';
import { ImageDown, Loader2, Upload, Wand2 } from 'lucide-react';

interface RenderWorkspacePanelProps {
  appliedRenderUrl: string | null;
  uploadedImageAvailable: boolean;
  workspaceImageUrl: string | null;
  workspaceDisplayUrl: string | null;
  workspaceImageAlt: string;
  canCompareBeforeAfter: boolean;
  compareSplitPercent: number;
  onCompareSplitPercentChange: (value: number) => void;
  comparisonBaseImageUrl: string | null;
  status: 'idle' | 'render';
  renderingMode: 'upload-1k' | 'upscale-4k' | 'edit' | null;
  onOpenPreview: () => void;
  onChooseBaseImage: () => void;
  appliedEditPrompt: string;
  onAppliedEditPromptChange: (value: string) => void;
  effectiveCanGenerate: boolean;
  refineSceneControls: ReactNode;
  showSceneControlsOverrideNotice: boolean;
  onApplyChanges: () => void;
  onRender4K: () => void;
  canUse4K: boolean;
  fourKTooltip: string;
  onDownloadRender: () => void;
  isDownloadingApplied: boolean;
}

const RenderWorkspacePanel = ({
  appliedRenderUrl,
  uploadedImageAvailable,
  workspaceImageUrl,
  workspaceDisplayUrl,
  workspaceImageAlt,
  canCompareBeforeAfter,
  compareSplitPercent,
  onCompareSplitPercentChange,
  comparisonBaseImageUrl,
  status,
  renderingMode,
  onOpenPreview,
  onChooseBaseImage,
  appliedEditPrompt,
  onAppliedEditPromptChange,
  effectiveCanGenerate,
  refineSceneControls,
  showSceneControlsOverrideNotice,
  onApplyChanges,
  onRender4K,
  canUse4K,
  fourKTooltip,
  onDownloadRender,
  isDownloadingApplied,
}: RenderWorkspacePanelProps) => {
  return (
    <div className="space-y-4">
      <div className="border border-gray-200 p-4 bg-white space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[14px] uppercase tracking-widest text-gray-600 font-bold">
              {appliedRenderUrl ? 'Applied Render' : 'Render Workspace'}
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {appliedRenderUrl
                ? 'Review the current render, then refine, upscale, or download it.'
                : uploadedImageAvailable
                ? 'Your base image is staged here. Generate the render to see the materialised output.'
                : 'Upload or select a base image to start generating a render.'}
            </p>
          </div>
        </div>
        {canCompareBeforeAfter && (
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={compareSplitPercent}
            onChange={(event) => onCompareSplitPercentChange(parseInt(event.target.value, 10))}
            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        )}

        {workspaceImageUrl ? (
          <div className="relative w-full min-h-[420px] 2xl:min-h-[560px] border border-gray-200 bg-gray-50 flex items-center justify-center p-3">
            {canCompareBeforeAfter ? (
              <button
                type="button"
                onClick={onOpenPreview}
                className="group relative flex max-h-full max-w-full cursor-zoom-in items-center justify-center"
                aria-label="Open render preview"
              >
                <div className="relative">
                  <img
                    src={comparisonBaseImageUrl || ''}
                    alt={appliedRenderUrl ? 'Previous render' : 'Base image'}
                    className="max-h-[75vh] max-w-full h-auto w-auto object-contain"
                  />
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - compareSplitPercent}% 0 0)` }}
                  >
                    <img
                      src={workspaceDisplayUrl || workspaceImageUrl}
                      alt={workspaceImageAlt}
                      className={`max-h-[75vh] max-w-full h-auto w-auto object-contain transition-all duration-300 ${status === 'render' ? 'blur-sm opacity-70' : ''}`}
                    />
                  </div>
                  <div
                    className="pointer-events-none absolute inset-y-0"
                    style={{ left: `${compareSplitPercent}%` }}
                  >
                    <div className="h-full w-[2px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
                  </div>
                </div>
                <span className="absolute right-3 top-3 bg-white/90 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-gray-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                  Open
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenPreview}
                className="group relative flex max-h-full max-w-full cursor-zoom-in items-center justify-center"
                aria-label="Open render preview"
              >
                <img
                  src={workspaceDisplayUrl || workspaceImageUrl}
                  alt={workspaceImageAlt}
                  className={`max-h-[75vh] max-w-full h-auto w-auto object-contain transition-all duration-300 ${status === 'render' ? 'blur-sm opacity-70' : ''}`}
                />
                <span className="absolute right-3 top-3 bg-white/90 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-gray-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                  Open
                </span>
              </button>
            )}
            {status === 'render' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 bg-white/80 px-4 py-3 rounded-lg shadow-sm">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-700" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">Generating...</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[420px] items-center justify-center border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <div className="space-y-3 max-w-md">
              <p className="font-sans text-sm text-gray-600">
                The render output will appear here once you upload a base image and generate.
              </p>
              <button
                onClick={onChooseBaseImage}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 bg-white font-mono text-[10px] uppercase tracking-widest hover:border-black"
              >
                <Upload className="h-3.5 w-3.5" />
                Choose Base Image
              </button>
            </div>
          </div>
        )}

        {appliedRenderUrl ? (
          <div className="space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600 font-semibold">
              Refine Your Render
            </div>
            <p className="font-sans text-sm text-gray-700">
              Describe changes you'd like to make, or use the scene controls below to adjust lighting, weather, and activity.
            </p>
            <textarea
              value={appliedEditPrompt}
              onChange={(event) => onAppliedEditPromptChange(event.target.value)}
              placeholder="E.g., add people walking, change to evening atmosphere, include more vegetation and street furniture."
              disabled={!effectiveCanGenerate}
              className="w-full border border-gray-300 px-3 py-2 font-sans text-sm min-h-[80px] resize-vertical disabled:bg-gray-100 disabled:text-gray-400"
            />

            {refineSceneControls}
            {showSceneControlsOverrideNotice && (
              <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                Scene controls will override the style reference where they conflict.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={onApplyChanges}
                disabled={status !== 'idle' || !appliedRenderUrl || !effectiveCanGenerate}
                className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
              >
                {status === 'render' && renderingMode === 'edit' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating render
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Apply changes
                  </>
                )}
              </button>
              <div className="relative group">
                <button
                  onClick={onRender4K}
                  disabled={status !== 'idle' || !appliedRenderUrl || !canUse4K}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300"
                >
                  {status === 'render' && renderingMode === 'upscale-4k' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Finalising...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Finalise (4K)
                    </>
                  )}
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-mono uppercase tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {canUse4K ? 'Create 4K final output from sketch. Costs 5 credits.' : fourKTooltip}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
              <button
                onClick={onDownloadRender}
                disabled={isDownloadingApplied || status !== 'idle'}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black disabled:bg-gray-100 disabled:text-gray-400"
              >
                {isDownloadingApplied ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <ImageDown className="w-4 h-4" />
                    Download Render
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            {uploadedImageAvailable
              ? 'The base image is ready. Use the setup panel to the left to fine-tune the input, then generate the render.'
              : 'Choose a base image and the generated render will appear here.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default RenderWorkspacePanel;
