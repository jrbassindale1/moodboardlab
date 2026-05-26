import React, { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { getBrandBySlug, type BrandSummary } from '../api';
import { MaterialOption } from '../types';
import MaterialCard from './materialSelection/MaterialCard';
import MaterialSustainabilityModal from './MaterialSustainabilityModal';
import SampleRequestModal from './SampleRequestModal';
import { buildMaterialFact, type MaterialFact } from '../data/materialFacts';

interface BrandPageProps {
  brandSlug: string;
  onNavigate: (page: string) => void;
}

const TIER_BADGE: Record<string, { label: string; classes: string }> = {
  partner: { label: 'Partner', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  verified: { label: 'Verified', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  standard: { label: 'Standard', classes: 'bg-gray-50 text-gray-600 border-gray-200' },
};

const BrandPage: React.FC<BrandPageProps> = ({ brandSlug, onNavigate }) => {
  const [brand, setBrand] = useState<BrandSummary | null>(null);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sustainabilityMaterial, setSustainabilityMaterial] = useState<{
    material: MaterialOption;
    fact: MaterialFact;
  } | null>(null);
  const [sampleRequestMat, setSampleRequestMat] = useState<MaterialOption | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setNotFound(false);
    getBrandBySlug(brandSlug)
      .then((result) => {
        if (!result) {
          setNotFound(true);
        } else {
          setBrand(result.brand);
          setMaterials(result.materials ?? []);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [brandSlug]);

  if (notFound) {
    return (
      <div className="w-full pt-20 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="font-mono text-sm uppercase tracking-widest text-gray-500">Brand not found</p>
          <button
            onClick={() => onNavigate('concept')}
            className="flex items-center gap-2 mx-auto text-sm font-mono uppercase tracking-widest text-gray-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !brand) {
    return (
      <div className="w-full pt-20 animate-pulse">
        <div className="max-w-screen-2xl mx-auto px-6 pt-6">
          <div className="h-4 w-16 bg-gray-100" />
        </div>
        <div className="border-b border-gray-100 py-12">
          <div className="max-w-screen-2xl mx-auto px-6 flex gap-6">
            <div className="w-16 h-16 bg-gray-100" />
            <div className="space-y-2 flex-1">
              <div className="h-8 w-48 bg-gray-100" />
              <div className="h-4 w-80 bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tierBadge = TIER_BADGE[brand.tier] ?? TIER_BADGE.standard;

  return (
    <div className="w-full pt-20 animate-in fade-in duration-500">
      {/* Back nav */}
      <div className="max-w-screen-2xl mx-auto px-6 pt-6">
        <button
          onClick={() => onNavigate('concept')}
          className="flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {/* Brand header */}
      <header className="border-b border-gray-200 py-12">
        <div className="max-w-screen-2xl mx-auto px-6 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="w-16 h-16 border border-gray-200 flex items-center justify-center bg-gray-50 flex-shrink-0">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-contain p-2" />
            ) : (
              <span className="font-display text-2xl font-bold uppercase">{brand.name.charAt(0)}</span>
            )}
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl md:text-4xl uppercase font-bold tracking-tight">
                {brand.name}
              </h1>
              <span className={`inline-flex items-center border px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest ${tierBadge.classes}`}>
                {tierBadge.label} — Manufacturer verified data
              </span>
            </div>
            {brand.tagline && (
              <p className="font-sans text-gray-600 text-lg leading-relaxed">{brand.tagline}</p>
            )}
            {materials.length > 0 && (
              <p className="font-mono text-xs text-gray-400 uppercase tracking-widest">
                {materials.length} products with verified specifications
              </p>
            )}
          </div>

          {brand.website && (
            <a
              href={brand.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 border border-gray-200 px-4 py-2 text-xs font-mono uppercase tracking-widest hover:border-black transition-colors flex-shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Visit website
            </a>
          )}
        </div>
      </header>

      {/* Materials */}
      <main className="max-w-screen-2xl mx-auto px-6 py-12 space-y-8">
        <div className="flex items-center gap-3">
          <span className="h-[1px] w-12 bg-black" />
          <p className="font-mono text-xs uppercase tracking-widest text-gray-600">Products</p>
        </div>

        {materials.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {materials.map((mat) => (
              <MaterialCard
                key={mat.id}
                mat={mat}
                showCategory={false}
                getCategoryDisplayName={() => ''}
                onAdd={() => onNavigate('materials')}
                onShowSustainability={(material, fact) =>
                  setSustainabilityMaterial({ material, fact })
                }
                onRequestSample={(m) => setSampleRequestMat(m)}
              />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-gray-200 py-16 text-center">
            <p className="font-sans text-gray-500 text-sm">
              Products from this brand are being added to the library.
            </p>
          </div>
        )}
      </main>

      {sustainabilityMaterial && (
        <MaterialSustainabilityModal
          material={sustainabilityMaterial.material}
          fact={sustainabilityMaterial.fact}
          onClose={() => setSustainabilityMaterial(null)}
        />
      )}

      {sampleRequestMat && (
        <SampleRequestModal
          mat={sampleRequestMat}
          onClose={() => setSampleRequestMat(null)}
        />
      )}
    </div>
  );
};

export default BrandPage;
