import React, { useState } from 'react';
import { ExternalLink, ImageOff } from 'lucide-react';
import type { PrecedentResult } from '../../api';

interface PrecedentCardProps {
  precedent: PrecedentResult;
}

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  archdaily: { bg: 'bg-red-100', text: 'text-red-800' },
  dezeen: { bg: 'bg-gray-100', text: 'text-gray-800' },
  architizer: { bg: 'bg-blue-100', text: 'text-blue-800' },
  designboom: { bg: 'bg-orange-100', text: 'text-orange-800' },
  other: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

const PrecedentCard: React.FC<PrecedentCardProps> = ({ precedent }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const sourceStyle = SOURCE_COLORS[precedent.source] || SOURCE_COLORS.other;

  const handleOpenLink = () => {
    window.open(precedent.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="group flex flex-col border border-gray-200 bg-white hover:border-gray-400 transition-colors">
      {/* Image container */}
      <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
        {precedent.imageUrl && !imageError ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gray-200" />
            )}
            <img
              src={precedent.imageUrl}
              alt={precedent.title}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageOff className="w-8 h-8 text-gray-300" />
          </div>
        )}

        {/* Source badge */}
        <div
          className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${sourceStyle.bg} ${sourceStyle.text}`}
        >
          {precedent.sourceName}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col">
        <h3 className="font-sans text-sm font-medium text-gray-900 line-clamp-2 mb-2">
          {precedent.title}
        </h3>

        <p className="font-sans text-xs text-gray-600 line-clamp-3 flex-1">
          {precedent.description}
        </p>

        {/* Action button */}
        <button
          onClick={handleOpenLink}
          className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 font-mono text-[11px] uppercase tracking-widest hover:bg-black hover:text-white hover:border-black transition-colors"
        >
          <span>View Project</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default PrecedentCard;
