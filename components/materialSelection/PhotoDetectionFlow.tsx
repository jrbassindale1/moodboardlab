import React from 'react';
import { Camera, X } from 'lucide-react';
import { MaterialOption, UploadedImage } from '../../types';
import { formatDescriptionForDisplay, formatFinishForDisplay } from '../../utils/materialDisplay';
import { isFreeCreditsBlockedForNetwork } from '../../utils/freeCreditSupport';
import FreeCreditsBlockedNotice from '../FreeCreditsBlockedNotice';

interface PhotoDetectionFlowProps {
  isAuthenticated: boolean;
  detectionImage: UploadedImage | null;
  detectedMaterials: MaterialOption[];
  selectedMaterialIds: Set<string>;
  isDetecting: boolean;
  detectionError: string | null;
  onUpload: (files: FileList | null) => void;
  onClearImage: () => void;
  onStartDetection: () => void;
  onToggleMaterial: (id: string) => void;
  onToggleSelectAll: () => void;
  onCancel: () => void;
  onAddSelected: (selected: MaterialOption[]) => void;
}

const PhotoDetectionFlow: React.FC<PhotoDetectionFlowProps> = ({
  isAuthenticated,
  detectionImage,
  detectedMaterials,
  selectedMaterialIds,
  isDetecting,
  detectionError,
  onUpload,
  onClearImage,
  onStartDetection,
  onToggleMaterial,
  onToggleSelectAll,
  onCancel,
  onAddSelected,
}) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onUpload(e.dataTransfer.files);
  };

  return (
    <div className="max-w-2xl space-y-6 border border-arch-line p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display uppercase tracking-widest text-lg">Analyze Photo</h3>
          <p className="text-xs text-gray-500 font-sans mt-1">Uses 2 credits</p>
        </div>
        <button onClick={onCancel} className="text-sm text-gray-600 hover:text-black">
          Cancel
        </button>
      </div>

      {/* Upload area */}
      <label
        className="border-2 border-dashed border-gray-300 p-12 hover:border-black transition-colors cursor-pointer flex flex-col items-center"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Camera className="w-16 h-16 mb-4 text-gray-400" />
        <span className="text-base font-display uppercase tracking-wide mb-2">Upload Photo</span>
        <span className="text-sm text-gray-600 font-sans">Click to select or drag and drop an image</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onUpload(e.target.files)}
        />
      </label>

      {/* Image preview */}
      {detectionImage && (
        <div className="relative border border-arch-line">
          <img src={detectionImage.dataUrl} alt="Uploaded" className="w-full h-64 object-cover" />
          <button
            onClick={onClearImage}
            className="absolute top-2 right-2 bg-white p-2 border border-gray-200 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Analyse button */}
      {detectionImage && (
        <button
          onClick={onStartDetection}
          disabled={isDetecting}
          className="w-full bg-arch-black text-white py-3 text-xs font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDetecting ? 'Analysing...' : 'Analyse Photo'}
        </button>
      )}

      {/* Error */}
      {detectionError && (
        isFreeCreditsBlockedForNetwork({ message: detectionError }) ? (
          <FreeCreditsBlockedNotice
            isAuthenticated={isAuthenticated}
            className="border border-amber-300 bg-amber-50 p-4"
          />
        ) : (
          <div className="bg-red-50 border border-red-200 p-4">
            <p className="text-sm font-sans text-red-800">{detectionError}</p>
          </div>
        )
      )}

      {/* Detected materials list */}
      {detectedMaterials.length > 0 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-display uppercase tracking-widest text-sm">
                Found {detectedMaterials.length} Material{detectedMaterials.length !== 1 ? 's' : ''}
              </h4>
              <button onClick={onToggleSelectAll} className="text-xs font-sans text-blue-700 hover:underline">
                {selectedMaterialIds.size === detectedMaterials.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <p className="text-sm font-sans text-gray-700">
              Select materials to add to your board ({selectedMaterialIds.size} selected)
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {detectedMaterials.map((mat) => (
              <div
                key={mat.id}
                className={`border p-4 cursor-pointer transition-colors ${
                  selectedMaterialIds.has(mat.id)
                    ? 'border-black bg-gray-50'
                    : 'border-arch-line hover:border-gray-400'
                }`}
                onClick={() => onToggleMaterial(mat.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedMaterialIds.has(mat.id)}
                    onChange={() => onToggleMaterial(mat.id)}
                    className="mt-1 w-4 h-4 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="w-12 h-12 border border-arch-line flex-shrink-0" style={{ backgroundColor: mat.tone }} />
                  <div className="flex-1">
                    <h5 className="font-display uppercase tracking-wide text-sm">{mat.name}</h5>
                    <p className="text-xs text-gray-600 font-sans">{formatFinishForDisplay(mat.finish)}</p>
                    {mat.description && (
                      <p className="text-xs text-gray-500 font-sans mt-1">
                        {formatDescriptionForDisplay(mat.description)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 border border-gray-200 py-3 text-xs font-mono uppercase tracking-widest hover:border-black transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onAddSelected(detectedMaterials.filter((m) => selectedMaterialIds.has(m.id)))}
              disabled={selectedMaterialIds.size === 0}
              className="flex-1 py-3 text-xs font-mono uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-arch-black text-white hover:bg-gray-900"
            >
              Add Selected to Board
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoDetectionFlow;
