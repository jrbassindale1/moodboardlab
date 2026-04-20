import type { ChangeEventHandler, ReactNode, RefObject } from 'react';
import { ImageDown, Loader2, Sparkles, Upload, Wand2, X } from 'lucide-react';
import type { UploadedImage } from '../../types';
import type { DrawingType } from '../../utils/renderViewGuidance';
import type { ImageSourceMode } from './types';

interface RenderSetupPanelProps {
  canStartRender: boolean;
  onGenerateRender: () => void;
  isGeneratingBaseRender: boolean;
  unmetRenderRequirements: string[];
  renderDiagnostics: string[];
  baseImageSourceMode: ImageSourceMode;
  onBaseImageSourceModeChange: (mode: ImageSourceMode) => void;
  hasProjectImagePicker: boolean;
  baseFileInputRef: RefObject<HTMLInputElement | null>;
  onBaseFileInputChange: ChangeEventHandler<HTMLInputElement>;
  baseProjectPicker: ReactNode;
  uploadedImage: UploadedImage | null;
  onRemoveBaseImage: () => void;
  drawingType: DrawingType;
  onDrawingTypeChange: (type: DrawingType) => void;
  renderNote: string;
  onRenderNoteChange: (value: string) => void;
  setupSceneControls: ReactNode;
  styleReferenceSourceMode: ImageSourceMode;
  onStyleReferenceSourceModeChange: (mode: ImageSourceMode) => void;
  styleReferenceFileInputRef: RefObject<HTMLInputElement | null>;
  onStyleReferenceFileInputChange: ChangeEventHandler<HTMLInputElement>;
  styleProjectPicker: ReactNode;
  styleReferenceImage: UploadedImage | null;
  styleReferenceSourceLabel: string;
  onRemoveStyleReference: () => void;
  showSceneControlsOverrideNotice: boolean;
}

const RenderSetupPanel = ({
  canStartRender,
  onGenerateRender,
  isGeneratingBaseRender,
  unmetRenderRequirements,
  renderDiagnostics,
  baseImageSourceMode,
  onBaseImageSourceModeChange,
  hasProjectImagePicker,
  baseFileInputRef,
  onBaseFileInputChange,
  baseProjectPicker,
  uploadedImage,
  onRemoveBaseImage,
  drawingType,
  onDrawingTypeChange,
  renderNote,
  onRenderNoteChange,
  setupSceneControls,
  styleReferenceSourceMode,
  onStyleReferenceSourceModeChange,
  styleReferenceFileInputRef,
  onStyleReferenceFileInputChange,
  styleProjectPicker,
  styleReferenceImage,
  styleReferenceSourceLabel,
  onRemoveStyleReference,
  showSceneControlsOverrideNotice,
}: RenderSetupPanelProps) => {
  return (
    <div className="space-y-3 border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-mono text-[14px] uppercase tracking-widest text-gray-600 font-bold">
            Render Setup
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Select Base Image and optional controls.
          </p>
        </div>
        <button
          onClick={onGenerateRender}
          disabled={!canStartRender}
          className="inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
        >
          {isGeneratingBaseRender ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Rendering
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate Sketch Render
            </>
          )}
        </button>
      </div>
      {!canStartRender && unmetRenderRequirements.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 px-3 py-2 font-sans text-xs text-amber-800">
          {unmetRenderRequirements.join(' ')}
        </div>
      )}
      {renderDiagnostics.length > 0 && (
        <div className="space-y-1 border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-amber-800">Render Diagnostics</div>
          {renderDiagnostics.map((warning, index) => (
            <p key={`render-diagnostic-${index}`} className="font-sans text-xs text-amber-800">
              {warning}
            </p>
          ))}
        </div>
      )}
      <div className="space-y-3 border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[12px] uppercase tracking-widest text-gray-600 font-bold">
              Base Image
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Sets the view and geometry.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onBaseImageSourceModeChange('upload')}
            className={`inline-flex items-center gap-2 px-3 py-2 border font-mono text-[10px] uppercase tracking-widest ${
              baseImageSourceMode === 'upload'
                ? 'border-black bg-black text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-black'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
          {hasProjectImagePicker && (
            <button
              type="button"
              onClick={() => onBaseImageSourceModeChange('project')}
              className={`inline-flex items-center gap-2 px-3 py-2 border font-mono text-[10px] uppercase tracking-widest ${
                baseImageSourceMode === 'project'
                  ? 'border-black bg-black text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-black'
              }`}
            >
              <ImageDown className="h-3.5 w-3.5" />
              From Project
            </button>
          )}
        </div>
        <div className="space-y-3">
          <div className="min-w-0 space-y-3">
            {baseImageSourceMode === 'upload' ? (
              <div className="space-y-2">
                <input
                  ref={baseFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onBaseFileInputChange}
                  className="w-full text-sm font-sans file:mr-3 file:rounded-none file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-[11px] file:uppercase file:tracking-widest file:font-mono file:text-gray-700 file:hover:bg-gray-50"
                />
              </div>
            ) : (
              baseProjectPicker
            )}
            {uploadedImage && (
              <div className="flex items-center justify-between gap-3 border border-gray-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-gray-600 truncate">
                    {uploadedImage.name}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {uploadedImage.sourceGenerationId ? 'Sourced from project render' : 'Uploaded file'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onRemoveBaseImage}
                  className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 font-mono text-[9px] uppercase tracking-widest text-gray-700 hover:border-black"
                >
                  <X className="h-3 w-3" />
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {uploadedImage && (
        <div className="border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="space-y-1">
            <div className="font-mono text-[12px] uppercase tracking-widest text-gray-700 font-bold">
              Render Controls (Optional)
            </div>
          </div>
          <div className="space-y-1">
            <div className="font-mono text-[12px] uppercase tracking-widest text-gray-700 font-bold">
              Drawing Type
            </div>
            <p className="text-sm text-gray-600">Preserve the source view.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['auto', 'perspective', 'elevation', 'section', 'plan'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onDrawingTypeChange(type)}
                className={`px-3 py-2 border font-mono text-[10px] uppercase tracking-widest transition-colors ${
                  drawingType === type
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-black'
                }`}
              >
                {type === 'auto'
                  ? 'Auto'
                  : type === 'perspective'
                  ? '3D / Perspective'
                  : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <label className="font-mono text-[12px] uppercase tracking-widest text-gray-600 font-bold">
              Custom render instructions
            </label>
            <textarea
              value={renderNote}
              onChange={(event) => onRenderNoteChange(event.target.value)}
              placeholder="E.g., street-level exterior view at dusk with wet paving, or frontal elevation view with neutral lighting."
              className="w-full border border-gray-300 px-3 py-2 font-sans text-sm min-h-[80px] resize-vertical bg-white"
            />
          </div>
          <div className="space-y-1">
            <div className="font-mono text-[12px] uppercase tracking-widest text-gray-700 font-bold">
              Setup Scene Controls
            </div>
            <p className="text-sm text-gray-600">Use only if you want to steer mood before first render.</p>
          </div>
          <div>{setupSceneControls}</div>

          <div className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[12px] uppercase tracking-widest text-gray-700 font-bold">
                  Style Reference
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Optional mood and lighting reference.
                </p>
              </div>
              <Sparkles className="h-4 w-4 text-gray-400" />
            </div>
          </div>

          <div className="space-y-3 border border-dashed border-gray-300 bg-gray-50 p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onStyleReferenceSourceModeChange('upload')}
                className={`inline-flex items-center gap-2 px-3 py-2 border font-mono text-[10px] uppercase tracking-widest ${
                  styleReferenceSourceMode === 'upload'
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-black'
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </button>
              {hasProjectImagePicker && (
                <button
                  type="button"
                  onClick={() => onStyleReferenceSourceModeChange('project')}
                  className={`inline-flex items-center gap-2 px-3 py-2 border font-mono text-[10px] uppercase tracking-widest ${
                    styleReferenceSourceMode === 'project'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-black'
                  }`}
                >
                  <ImageDown className="h-3.5 w-3.5" />
                  From Project
                </button>
              )}
            </div>
            {styleReferenceSourceMode === 'upload' ? (
              <input
                ref={styleReferenceFileInputRef}
                type="file"
                accept="image/*"
                onChange={onStyleReferenceFileInputChange}
                className="text-sm font-sans file:mr-3 file:rounded-none file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-[11px] file:uppercase file:tracking-widest file:font-mono file:text-gray-700 file:hover:bg-gray-50"
              />
            ) : (
              styleProjectPicker
            )}
            {styleReferenceImage ? (
              <div className="border border-dashed border-gray-300 bg-white p-2 max-w-xs">
                <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                  <img src={styleReferenceImage.dataUrl} alt={styleReferenceImage.name} className="w-full h-full object-cover" />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-gray-600 truncate">
                      {styleReferenceImage.name}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {styleReferenceSourceLabel}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onRemoveStyleReference}
                    className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 font-mono text-[9px] uppercase tracking-widest text-gray-700 hover:border-black"
                  >
                    <X className="h-3 w-3" />
                    Remove
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {showSceneControlsOverrideNotice && (
        <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          Scene controls will override the style reference where they conflict.
        </div>
      )}
    </div>
  );
};

export default RenderSetupPanel;
