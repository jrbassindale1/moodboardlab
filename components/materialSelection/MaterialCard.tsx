import React from 'react';
import { Award, Bookmark, Box, ExternalLink, FileText, Leaf, Mail } from 'lucide-react';
import { MaterialOption } from '../../types';
import { getMaterialIconUrls } from '../../utils/materialIconUrls';
import { formatDescriptionForDisplay, formatFinishForDisplay } from '../../utils/materialDisplay';
import { buildMaterialFact } from '../../data/materialFacts';
import { CARBON_IMPACT_CLASSES, CARBON_IMPACT_LABELS } from '../../utils/materialCarbon';
import { trackMaterialInteraction } from '../../api';
import type { MaterialFact } from '../../data/materialFacts';

interface MaterialCardProps {
  mat: MaterialOption;
  showCategory: boolean;
  getCategoryDisplayName: (category: MaterialOption['category']) => string;
  onAdd: (mat: MaterialOption, customization?: undefined, skipModal?: undefined, el?: HTMLElement | null) => void;
  onShowSustainability: (material: MaterialOption, fact: MaterialFact) => void;
  onRequestSample?: (mat: MaterialOption) => void;
  accessToken?: string;
  isFavourite?: boolean;
  onToggleFavourite?: (mat: MaterialOption) => void;
}

const TIER_BADGE: Record<string, { label: string; classes: string }> = {
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
  onRequestSample,
  accessToken,
  isFavourite = false,
  onToggleFavourite,
}) => {
  const { webpUrl, pngUrl } = getMaterialIconUrls(mat);
  const tierBadge = mat.source ? TIER_BADGE[mat.source] : undefined;
  const isBranded = mat.source === 'verified-brand' || mat.source === 'partner-brand';
  const isGeneric = !mat.source || mat.source === 'generic';
  const hasQuickLinks = isBranded && (mat.productPageUrl || mat.specSheetUrl || mat.epdUrl || mat.bimObjectUrl);

  const handleSpecSheet = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackMaterialInteraction(mat, 'spec_sheet', accessToken);
  };

  const handleEpd = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackMaterialInteraction(mat, 'epd', accessToken);
  };

  const handleProductPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackMaterialInteraction(mat, 'product_page', accessToken);
  };

  const handleBim = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackMaterialInteraction(mat, 'bim', accessToken);
  };

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

        {/* Bookmark — top right */}
        {onToggleFavourite && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavourite(mat); }}
            className={`absolute top-2 right-2 p-1.5 border transition-all ${
              isFavourite
                ? 'bg-amber-50 border-amber-300 opacity-100'
                : 'bg-white/90 border-gray-200 opacity-0 group-hover:opacity-100'
            }`}
            title={isFavourite ? 'Remove from favourites' : 'Save to favourites'}
          >
            <Bookmark
              className={`w-3 h-3 ${isFavourite ? 'text-amber-600 fill-amber-600' : 'text-gray-500'}`}
            />
          </button>
        )}

        {/* Source badge — top left */}
        {tierBadge ? (
          <span className={`absolute top-2 left-2 inline-flex items-center border px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest ${tierBadge.classes}`}>
            {tierBadge.label}
          </span>
        ) : isGeneric ? (
          <span className="absolute top-2 left-2 inline-flex items-center border px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest bg-gray-50 text-gray-400 border-gray-200">
            AI estimate
          </span>
        ) : null}
      </div>

      {/* Brand attribution — only for branded */}
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
              onClick={(e) => { e.stopPropagation(); trackMaterialInteraction(mat, 'product_page', accessToken); }}
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

      {/* Certifications — branded only */}
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

      {/* Carbon */}
      {mat.carbonIntensity && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center border px-2 py-1 text-[10px] font-mono uppercase tracking-widest ${CARBON_IMPACT_CLASSES[mat.carbonIntensity]}`}>
              {CARBON_IMPACT_LABELS[mat.carbonIntensity]}
            </span>
            {mat.embodiedCarbonA1A3 != null && (
              <span className="text-[10px] font-mono text-gray-500">
                {mat.embodiedCarbonA1A3} kgCO₂e/kg
                {isGeneric && <span className="text-gray-400"> ~</span>}
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowSustainability(mat, buildMaterialFact(mat));
            }}
            className="p-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors group"
            title={isGeneric ? 'View AI-estimated sustainability data' : 'View verified sustainability credentials'}
          >
            <Leaf className="w-4 h-4 text-emerald-600 group-hover:text-emerald-700" />
          </button>
        </div>
      )}

      {/* AI data notice — generic only */}
      {isGeneric && (
        <p className="text-[9px] font-mono text-gray-400 leading-relaxed">
          Data AI-estimated. Not manufacturer verified.
        </p>
      )}

      {/* Quick links — branded only */}
      {hasQuickLinks && (
        <div className="flex gap-2">
          {mat.productPageUrl && (
            <a
              href={mat.productPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleProductPage}
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
              onClick={handleSpecSheet}
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
              onClick={handleEpd}
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
              onClick={handleBim}
              className="p-1.5 border border-gray-200 hover:border-black transition-colors"
              title="BIM object"
            >
              <Box className="w-3.5 h-3.5 text-gray-500" />
            </a>
          )}
          {/* Request sample — branded only */}
          {onRequestSample && mat.brandId && (
            <button
              onClick={(e) => { e.stopPropagation(); onRequestSample(mat); }}
              className="p-1.5 border border-gray-200 hover:border-black transition-colors ml-auto"
              title="Request sample"
            >
              <Mail className="w-3.5 h-3.5 text-gray-500" />
            </button>
          )}
        </div>
      )}

      {/* Request sample button — branded with no other links */}
      {!hasQuickLinks && isBranded && onRequestSample && mat.brandId && (
        <button
          onClick={(e) => { e.stopPropagation(); onRequestSample(mat); }}
          className="w-full py-2 text-xs font-mono uppercase tracking-widest border border-gray-200 hover:border-black transition-colors text-gray-600 hover:text-black"
        >
          Request sample
        </button>
      )}

      <button
        onClick={(e) => {
          trackMaterialInteraction(mat, 'add_to_board', accessToken);
          onAdd(mat, undefined, undefined, e.currentTarget);
        }}
        className="w-full py-3 text-xs font-mono uppercase tracking-widest transition-colors bg-arch-black text-white hover:bg-gray-900"
      >
        Add to board
      </button>
    </article>
  );
};

export default MaterialCard;
