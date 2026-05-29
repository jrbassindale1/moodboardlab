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
  activeWorkspaceTab: 'render' | 'translation';
  onWorkspaceTabChange: (tab: 'render' | 'translation') => void;
  onTranslateToProducts: () => void;
  isTranslatingToProducts: boolean;
  hasMaterialTranslation: boolean;
  canTranslateToProducts: boolean;
  translateToProductsHint?: string | null;
  materialTranslationPanel?: ReactNode;
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
  activeWorkspaceTab,
  onWorkspaceTabChange,
  onTranslateToProducts,
  isTranslatingToProducts,
  hasMaterialTranslation,
  canTranslateToProducts,
  translateToProductsHint,
  materialTranslationPanel,
}: RenderWorkspacePanelProps) => {
  const specificationTooltipText = translateToProductsHint
    ? `Translate this render into buildable systems and material options. ${translateToProductsHint}`
    : 'Translate this render into buildable systems and material options';
  const isSpecificationView = Boolean(appliedRenderUrl && activeWorkspaceTab === 'translation');
  const shouldShowComparison = canCompareBeforeAfter && !isSpecificationView;
  const imageViewportClass = isSpecificationView
    ? 'min-h-[300px] 2xl:min-h-[360px]'
    : 'min-h-[420px] 2xl:min-h-[560px]';
  const imageClass = isSpecificationView
    ? `max-h-[52vh] max-w-full h-auto w-auto object-contain transition-all duration-300 ${status === 'render' ? 'blur-sm opacity-70' : ''}`
    : `max-h-[75vh] max-w-full h-auto w-auto object-contain transition-all duration-300 ${status === 'render' ? 'blur-sm opacity-70' : ''}`;

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 p-4 bg-white space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[14px] uppercase tracking-widest text-gray-600 font-bold">
              {appliedRenderUrl ? 'Applied Materials Render' : 'Project Render'}
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {appliedRenderUrl
                ? 'Review the current render, then refine, upscale, or download it.'
                : uploadedImageAvailable
                ? 'Your project image is staged here. Generate the render to apply the selected materials.'
                : 'Upload or select a project image to start applying the selected materials.'}
            </p>
          </div>
          {appliedRenderUrl && (
            <div className="space-y-1 sm:text-right">
              <button
                onClick={onTranslateToProducts}
                disabled={status !== 'idle' || !appliedRenderUrl || isTranslatingToProducts || !canTranslateToProducts}
                title={specificationTooltipText}
                aria-label={hasMaterialTranslation ? 'Open specification pathways' : 'Create specification pathways'}
                className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
              >
                {isTranslatingToProducts ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Translating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Specification pathways
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        {appliedRenderUrl && (
          <div className="border-b border-gray-200 flex gap-0 overflow-x-auto">
            <button
              onClick={() => onWorkspaceTabChange('render')}
              className={`px-4 py-3 font-mono text-[11px] uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeWorkspaceTab === 'render'
                  ? 'border-b-black text-gray-900'
                  : 'border-b-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              Render Controls
              {appliedRenderUrl && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>
            <button
              onClick={() => onWorkspaceTabChange('translation')}
              className={`px-4 py-3 font-mono text-[11px] uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeWorkspaceTab === 'translation'
                  ? 'border-b-black text-gray-900'
                  : 'border-b-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              Specification pathways
              {hasMaterialTranslation && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>
          </div>
        )}
        {shouldShowComparison && (
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                Compare Before / After
              </p>
              <p className="text-xs text-gray-600">
                Drag the slider to compare the project image and applied materials render.
              </p>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={compareSplitPercent}
              onChange={(event) => onCompareSplitPercentChange(parseInt(event.target.value, 10))}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        )}

        {workspaceImageUrl ? (
          <div className={`relative w-full border border-gray-200 bg-gray-50 flex items-center justify-center p-3 ${imageViewportClass}`}>
            {shouldShowComparison ? (
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
                      className={imageClass}
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
                  className={imageClass}
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
            <div className="max-w-md space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center border border-gray-300 bg-white">
                <Upload className="h-5 w-5 text-gray-500" />
              </div>
              <div className="space-y-2">
                <p className="font-display text-lg uppercase tracking-wide text-gray-950">
                  Choose a project image
                </p>
                <p className="font-sans text-sm leading-relaxed text-gray-600">
                  Upload a sketch, photograph, model view, or drawing. The selected material palette will be applied to this image.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-widest text-gray-400">
                <span>JPG</span>
                <span>/</span>
                <span>PNG</span>
                <span>/</span>
                <span>WebP</span>
              </div>
              <p className="font-sans text-sm text-gray-600">
                The render will appear here once you choose a project image and generate.
              </p>
              <button
                onClick={onChooseBaseImage}
                className="inline-flex items-center gap-2 border border-black bg-black px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-white hover:bg-gray-900"
              >
                <Upload className="h-3.5 w-3.5" />
                Choose Project Image
              </button>
            </div>
          </div>
        )}

        {appliedRenderUrl ? (
          <div className="space-y-3">
            {activeWorkspaceTab === 'render' ? (
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
                          Final Quality (4K)
                        </>
                      )}
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-mono uppercase tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {canUse4K ? 'Create 4K final output from this render. Costs 5 credits.' : fourKTooltip}
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
              <div className="space-y-2">
                {!canTranslateToProducts && translateToProductsHint && (
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                    {translateToProductsHint}
                  </p>
                )}
                {materialTranslationPanel}
              </div>
            )}
          </div>
        ) : (
          <div className="border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            {uploadedImageAvailable
              ? 'The project image is ready. Use the setup panel to fine-tune the input, then generate the render.'
              : 'Choose a project image and the generated render will appear here.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default RenderWorkspacePanel;
