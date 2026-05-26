import React from 'react';
import { Award, Box, ExternalLink, FileText, Leaf } from 'lucide-react';
import { MaterialOption } from '../../types';
import { getMaterialIconUrls } from '../../utils/materialIconUrls';
import { formatDescriptionForDisplay, formatFinishForDisplay } from '../../utils/materialDisplay';
import { buildMaterialFact } from '../../data/materialFacts';
import { CARBON_IMPACT_CLASSES, CARBON_IMPACT_LABELS } from '../../utils/materialCarbon';
import type { MaterialFact } from '../../data/materialFacts';

interface MaterialCardProps {
  mat: MaterialOption;
  showCategory: boolean;
  getCategoryDisplayName: (category: MaterialOption['category']) => string;
  onAdd: (mat: MaterialOption, customization?: undefined, skipModal?: undefined, el?: HTMLElement | null) => void;
  onShowSustainability: (material: MaterialOption, fact: MaterialFact) => void;
}

const SOURCE_BADGE: Record<string, { label: string; classes: string }> = {
  'verified-brand': {
    label: 'Verified',
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  'partner-brand': {
    label: 'Partner',
    classes: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
};

const MaterialCard: React.FC<MaterialCardProps> = ({
  mat,
  showCategory,
  getCategoryDisplayName,
  onAdd,
  onShowSustainability,
}) => {
  const { webpUrl, pngUrl } = getMaterialIconUrls(mat);
  const sourceBadge = mat.source ? SOURCE_BADGE[mat.source] : undefined;
  const isBranded = mat.source === 'verified-brand' || mat.source === 'partner-brand';
  const hasQuickLinks = isBranded && (mat.productPageUrl || mat.specSheetUrl || mat.epdUrl || mat.bimObjectUrl);

  return (
    <article className="group space-y-3">
      {/* Image / swatch */}
      <div className="aspect-square bg-arch-gray relative overflow-hidden border border-arch-line">
        {mat.customImage ? (
          <img src={mat.customImage} alt={mat.name} className="w-full h-full object-cover" />
        ) : (
          <picture>
            <source srcSet={webpUrl} type="image/webp" />
            <img
              src={pngUrl}
              alt={mat.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const fallback = target.parentElement?.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = 'block';
              }}
            />
          </picture>
        )}
        <div className="w-full h-full hidden" style={{ backgroundColor: mat.tone }} />

        {sourceBadge && (
          <span className={`absolute top-2 left-2 inline-flex items-center border px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest ${sourceBadge.classes}`}>
            {sourceBadge.label}
          </span>
        )}
      </div>

      {/* Brand attribution */}
      {isBranded && mat.brandName && (
        <div className="flex items-center gap-2">
          {mat.brandLogoUrl && (
            <img src={mat.brandLogoUrl} alt={mat.brandName} className="h-4 w-auto object-contain flex-shrink-0" />
          )}
          {mat.brandWebsite ? (
            <a
              href={mat.brandWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono uppercase tracking-widest text-gray-500 hover:text-black truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {mat.brandName}
            </a>
          ) : (
            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500 truncate">
              {mat.brandName}
            </span>
          )}
        </div>
      )}

      {/* Product info */}
      <div className="space-y-2">
        {showCategory && (
          <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500">
            {getCategoryDisplayName(mat.category)}
          </p>
        )}
        <h3 className="font-display uppercase tracking-wide text-sm">{mat.name}</h3>
        <p className="text-xs text-gray-600 font-sans line-clamp-2">
          {formatFinishForDisplay(mat.finish)}
        </p>
        {isBranded && mat.productCode && (
          <p className="text-[10px] font-mono text-gray-400">{mat.productCode}</p>
        )}
        {mat.description && (
          <p className="text-xs text-gray-500 font-sans line-clamp-2">
            {formatDescriptionForDisplay(mat.description)}
          </p>
        )}
      </div>

      {/* Certifications */}
      {isBranded && mat.certifications && mat.certifications.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {mat.certifications.map((cert) => (
            <span
              key={cert}
              className="inline-flex items-center border px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest border-gray-300 text-gray-600 bg-gray-50"
            >
              {cert}
            </span>
          ))}
        </div>
      )}

      {/* Carbon — only shown for branded materials */}
      {isBranded && mat.carbonIntensity && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center border px-2 py-1 text-[10px] font-mono uppercase tracking-widest ${CARBON_IMPACT_CLASSES[mat.carbonIntensity]}`}
            >
              {CARBON_IMPACT_LABELS[mat.carbonIntensity]}
            </span>
            {mat.embodiedCarbonA1A3 != null && (
              <span className="text-[10px] font-mono text-gray-500">
                {mat.embodiedCarbonA1A3} kgCO₂e/kg
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowSustainability(mat, buildMaterialFact(mat));
            }}
            className="p-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors group"
            title="View sustainability credentials"
          >
            <Leaf className="w-4 h-4 text-emerald-600 group-hover:text-emerald-700" />
          </button>
        </div>
      )}

      {/* Quick links */}
      {hasQuickLinks && (
        <div className="flex gap-2">
          {mat.productPageUrl && (
            <a
              href={mat.productPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 border border-gray-200 hover:border-black transition-colors"
              title="View product"
            >
              <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
            </a>
          )}
          {mat.specSheetUrl && (
            <a
              href={mat.specSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 border border-gray-200 hover:border-black transition-colors"
              title="Spec sheet"
            >
              <FileText className="w-3.5 h-3.5 text-gray-500" />
            </a>
          )}
          {mat.epdUrl && (
            <a
              href={mat.epdUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 border border-gray-200 hover:border-black transition-colors"
              title="EPD"
            >
              <Award className="w-3.5 h-3.5 text-gray-500" />
            </a>
          )}
          {mat.bimObjectUrl && (
            <a
              href={mat.bimObjectUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 border border-gray-200 hover:border-black transition-colors"
              title="BIM object"
            >
              <Box className="w-3.5 h-3.5 text-gray-500" />
            </a>
          )}
        </div>
      )}

      <button
        onClick={(e) => onAdd(mat, undefined, undefined, e.currentTarget)}
        className="w-full py-3 text-xs font-mono uppercase tracking-widest transition-colors bg-arch-black text-white hover:bg-gray-900"
      >
        Add to board
      </button>
    </article>
  );
};

export default MaterialCard;
