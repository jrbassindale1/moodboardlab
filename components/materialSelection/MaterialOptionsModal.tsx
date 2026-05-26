import React from 'react';
import { X, ShoppingCart } from 'lucide-react';
import { RAL_COLOR_OPTIONS } from '../../constants';
import { MaterialOption } from '../../types';
import { getMaterialIconUrls } from '../../utils/materialIconUrls';
import { formatDescriptionForDisplay, formatFinishForDisplay } from '../../utils/materialDisplay';

type ColorSelectionMode = 'none' | 'curated' | 'ral';

interface MaterialOptionsModalProps {
  material: MaterialOption;
  selectedVariety: string | null;
  selectedFinishOption: string | null;
  selectedColorOption: { label: string; tone: string } | null;
  colorSelectionMode: ColorSelectionMode;
  onClose: () => void;
  onSelectVariety: (variety: string) => void;
  onSelectFinish: (finish: string) => void;
  onSelectColor: (color: { label: string; tone: string }) => void;
}

const MaterialOptionsModal: React.FC<MaterialOptionsModalProps> = ({
  material,
  selectedVariety,
  selectedFinishOption,
  selectedColorOption,
  colorSelectionMode,
  onClose,
  onSelectVariety,
  onSelectFinish,
  onSelectColor,
}) => {
  const hasVarietyOptions = Boolean(material.varietyOptions?.length);
  const hasFinishOptions = Boolean(material.finishOptions?.length);
  const hasFreeColor = colorSelectionMode === 'ral';
  const hasCuratedColourStep = colorSelectionMode === 'curated' && Boolean(material.colorOptions?.length);
  const hasColourStep = hasCuratedColourStep || hasFreeColor;

  const needsVarietySelection = hasVarietyOptions && !selectedVariety;
  const needsFinishSelection = hasFinishOptions && !selectedFinishOption;
  const needsColourSelection = hasColourStep && !selectedColorOption;

  const canSelectFinish = !needsVarietySelection;
  const canSelectColour = !needsVarietySelection && (!hasFinishOptions || !needsFinishSelection);

  const instructionText = needsVarietySelection
    ? 'Select a material variety.'
    : needsFinishSelection
    ? 'Select a finish option.'
    : needsColourSelection
    ? 'Select a colour option.'
    : 'This material is added automatically.';

  const { webpUrl, pngUrl } = getMaterialIconUrls(material);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 px-4 py-4 sm:py-6 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white shadow-2xl my-auto">
        <div className="max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 border-b border-arch-line pb-4">
            <ShoppingCart className="w-5 h-5" />
            <div className="font-display uppercase tracking-widest text-base">Select Options</div>
          </div>

          <div className="space-y-4">
            {/* Material preview */}
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 border border-arch-line overflow-hidden bg-arch-gray flex-shrink-0">
                {material.customImage ? (
                  <img src={material.customImage} alt={material.name} className="w-full h-full object-cover" />
                ) : (
                  <picture>
                    <source srcSet={webpUrl} type="image/webp" />
                    <img
                      src={pngUrl}
                      alt={material.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const fallback = target.parentElement?.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = 'block';
                      }}
                    />
                  </picture>
                )}
                <div className="w-full h-full hidden" style={{ backgroundColor: material.tone }} />
              </div>
              <div className="flex-1">
                <div className="font-display uppercase tracking-wide text-sm">{material.name}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-gray-600 mt-1">
                  {formatFinishForDisplay(material.finish)}
                </div>
                {material.description && (
                  <p className="font-sans text-xs text-gray-600 mt-2">
                    {formatDescriptionForDisplay(material.description)}
                  </p>
                )}
              </div>
            </div>

            {/* Instruction */}
            <div className="bg-gray-50 border border-gray-200 p-3">
              <p className="font-sans text-xs text-gray-700">{instructionText}</p>
            </div>

            {/* Variety options */}
            {hasVarietyOptions && (
              <div className="border-t border-arch-line pt-4">
                <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                  Material Variety
                </label>
                <div className="flex flex-wrap gap-2">
                  {material.varietyOptions?.map((variety, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectVariety(variety)}
                      className={`border px-3 py-2 transition-colors ${
                        selectedVariety === variety
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 hover:border-black'
                      }`}
                    >
                      <span className="font-sans text-xs">{variety}</span>
                    </button>
                  ))}
                </div>
                {selectedVariety && (
                  <p className="font-sans text-xs text-emerald-600 mt-2">Selected: {selectedVariety}</p>
                )}
              </div>
            )}

            {/* Finish options */}
            {hasFinishOptions && (
              <div className="border-t border-arch-line pt-4">
                <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                  Finish Options
                </label>
                <div className={`flex flex-wrap gap-2 ${canSelectFinish ? '' : 'opacity-50 pointer-events-none'}`}>
                  {material.finishOptions?.map((finish, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectFinish(finish)}
                      className={`border px-3 py-2 transition-colors ${
                        selectedFinishOption === finish
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 hover:border-black'
                      }`}
                    >
                      <span className="font-sans text-xs">{finish}</span>
                    </button>
                  ))}
                </div>
                {!canSelectFinish && (
                  <p className="font-sans text-xs text-gray-500 mt-2">Select a material variety first.</p>
                )}
                {canSelectFinish && selectedFinishOption && (
                  <p className="font-sans text-xs text-emerald-600 mt-2">Selected: {selectedFinishOption}</p>
                )}
              </div>
            )}

            {/* Curated colour options */}
            {hasCuratedColourStep && (
              <div className="border-t border-arch-line pt-4">
                <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                  Colour Options
                </label>
                <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${canSelectColour ? '' : 'opacity-50 pointer-events-none'}`}>
                  {material.colorOptions?.map((colorOption, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectColor(colorOption)}
                      className="flex flex-col items-start gap-2 border border-gray-200 px-3 py-2 hover:border-black transition-colors text-left"
                      title={`Select ${colorOption.label}`}
                    >
                      <span
                        className="h-8 w-full border border-gray-200"
                        style={{ backgroundColor: colorOption.tone }}
                        aria-hidden
                      />
                      <span className="font-sans text-xs">{colorOption.label}</span>
                    </button>
                  ))}
                </div>
                {!canSelectColour && (
                  <p className="font-sans text-xs text-gray-500 mt-2">
                    {needsVarietySelection ? 'Select a material variety first.' : 'Select the finish option first.'}
                  </p>
                )}
                {canSelectColour && selectedColorOption && (
                  <p className="font-sans text-xs text-emerald-600 mt-2">Selected: {selectedColorOption.label}</p>
                )}
              </div>
            )}

            {/* RAL colour palette */}
            {hasFreeColor && (
              <div className="border-t border-arch-line pt-4">
                <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-2">
                  RAL Colour Options
                </label>
                <div className={`grid max-h-80 grid-cols-2 gap-3 overflow-y-auto pr-2 sm:grid-cols-3 ${canSelectColour ? '' : 'opacity-50 pointer-events-none'}`}>
                  {RAL_COLOR_OPTIONS.map((colorOption, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectColor(colorOption)}
                      className="flex flex-col items-start gap-2 border border-gray-200 px-3 py-2 hover:border-black transition-colors text-left"
                      title={`Select ${colorOption.label}`}
                    >
                      <span
                        className="h-8 w-full border border-gray-200"
                        style={{ backgroundColor: colorOption.tone }}
                        aria-hidden
                      />
                      <span className="font-sans text-xs">{colorOption.label}</span>
                    </button>
                  ))}
                </div>
                {!canSelectColour && (
                  <p className="font-sans text-xs text-gray-500 mt-2">
                    {needsVarietySelection ? 'Select a material variety first.' : 'Select the finish option first.'}
                  </p>
                )}
                {canSelectColour && selectedColorOption && (
                  <p className="font-sans text-xs text-emerald-600 mt-2">Selected: {selectedColorOption.label}</p>
                )}
                <p className="font-sans text-xs text-gray-500 mt-2">Select a colour to add this material.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaterialOptionsModal;
