import React, { useEffect, useState, useMemo } from 'react';
import { ArrowRight, BadgeCheck, Building2, Factory, FileText, Leaf, Sparkles, Wand2 } from 'lucide-react';
import WorkflowStrip from './WorkflowStrip';
import heroMoodboard from '../images/moodboard-2.webp';
import { getPathForPage } from '../utils/siteSeo';
import { getFeaturedBrands, type BrandSummary } from '../api';

// Dynamically import all images from the recents folder for the carousel
// Any image added to images/recents/ will automatically be included
const recentImageModules = import.meta.glob<{ default: string }>(
  '../images/recents/*.{webp,png,jpg,jpeg}',
  { eager: true }
);

// Extract and sort images by filename
const recentImages = Object.entries(recentImageModules)
  .map(([path, module]) => ({
    path,
    url: module.default,
    filename: path.split('/').pop() || ''
  }))
  .sort((a, b) => a.filename.localeCompare(b.filename));

interface ConceptProps {
  onNavigate: (page: string) => void;
  onViewBrand: (slug: string) => void;
}

const sustainabilityHighlights = [
  {
    title: 'Real material data',
    copy: 'Specifications, finishes, and environmental context sit alongside the visual palette from the start.',
  },
  {
    title: 'Concept-stage decisions',
    copy: 'See carbon and circularity trade-offs while ideas are still flexible, not after key choices are locked.',
  },
  {
    title: 'One continuous workflow',
    copy: 'The same palette drives presentation visuals, applied renders, and downstream material handoff.',
  },
];

const heroProofPoints = [
  'Verified specifications',
  'Applied design renders',
  'Sustainability context',
];

const heroMaterials = [
  { name: 'Natural oak veneer', meta: 'FSC joinery panel', score: 'Low embodied carbon' },
  { name: 'Recycled aluminium', meta: 'Powder coated frame', score: 'EPD available' },
  { name: 'Limewash plaster', meta: 'Mineral wall finish', score: 'Low VOC' },
];

const audienceCards = [
  {
    eyebrow: 'For designers',
    title: 'Build palettes from real products, not loose inspiration.',
    copy: 'Select materials, compare specification and sustainability trade-offs, then generate moodboards, applied renders, and client-ready handoff material from the same palette.',
    action: 'Start designing',
    page: 'materials',
    icon: Building2,
  },
  {
    eyebrow: 'For manufacturers',
    title: 'Get specified where material decisions begin.',
    copy: 'Put verified finishes, EPDs, product imagery, and technical data inside the concept-stage workflow architects already use to explore palettes.',
    action: 'List products',
    page: 'brand-register',
    icon: Factory,
  },
];

const productOutcomes = [
  {
    title: 'Material library',
    copy: 'Real brands, finishes, colours, system notes, and environmental evidence in one searchable workflow.',
    icon: BadgeCheck,
  },
  {
    title: 'AI moodboard',
    copy: 'Generate clean palette visuals that show texture, adjacency, scale, and the product data behind each choice.',
    icon: Sparkles,
  },
  {
    title: 'Applied renders',
    copy: 'Upload a sketch, elevation, or reference image and test selected materials directly on a design before committing.',
    icon: Wand2,
  },
  {
    title: 'Specification handoff',
    copy: 'Carry the same selected materials into sustainability briefings, applied renders, and exportable project records.',
    icon: FileText,
  },
];

const featureCards = [
  {
    title: 'Curate',
    copy: 'Build a material palette with drag-and-drop selection, custom colours, real product data, and concise specification details.',
  },
  {
    title: 'Sustainability',
    copy: 'See environmental insight on every material in one click, with early guidance on carbon hotspots and better alternatives.',
  },
  {
    title: 'Render',
    copy: 'Generate photorealistic palette compositions that show texture, tone, and adjacency clearly for reviews and client presentations.',
  },
  {
    title: 'Apply',
    copy: 'Upload a sketch, elevation, or reference image and see your selected materials applied with context, light, and scale.',
  },
];

const outcomes = [
  'Present material choices to clients with real specifications, not just images.',
  'Show sustainability data at concept stage before design decisions are locked.',
  'Generate convincing visuals without a 3D visualiser or render artist.',
  'Test material palettes on your actual designs before committing.',
];

const Concept: React.FC<ConceptProps> = ({ onNavigate, onViewBrand }) => {
  const carouselImages = useMemo(() => recentImages.map(img => img.url), []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [featuredBrands, setFeaturedBrands] = useState<BrandSummary[]>([]);

  useEffect(() => {
    getFeaturedBrands().then(setFeaturedBrands).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % carouselImages.length);
    }, 4800);
    return () => clearInterval(timer);
  }, [carouselImages.length]);

  const handleNavigateClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    page: string
  ) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    onNavigate(page);
  };

  return (
    <div className="w-full pt-20 animate-in fade-in duration-700 bg-white">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-gray-200">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#ffffff_0%,#f7f8f4_46%,#eef3e7_100%)]" />
        <div className="relative max-w-screen-2xl mx-auto px-6 pt-10 pb-12 md:pt-16 md:pb-16 grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-center">
          <div className="lg:col-span-4 space-y-7">
            <div className="inline-flex items-center gap-3 border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <Leaf className="w-4 h-4 text-lime-700" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-700">Real materials. Real data. Real outputs.</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl xl:text-6xl font-bold uppercase tracking-tight leading-[0.92]">
              Specify real materials. Generate moodboards and applied renders.
            </h1>
            <p className="font-sans text-lg md:text-xl text-gray-700 max-w-2xl leading-relaxed">
              Moodboard Lab turns verified product data into visual material palettes, sustainability insight, and applied design renders for architecture and interior design teams.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href={getPathForPage('materials')}
                onClick={(event) => handleNavigateClick(event, 'materials')}
                className="bg-black text-white px-6 py-3 flex items-center gap-3 hover:bg-gray-900 transition-colors"
              >
                <Wand2 className="w-4 h-4" />
                <span className="font-mono text-xs uppercase tracking-widest">Start Free</span>
              </a>
              <a
                href={getPathForPage('brand-register')}
                onClick={(event) => handleNavigateClick(event, 'brand-register')}
                className="border border-gray-300 bg-white text-black px-6 py-3 flex items-center gap-3 hover:border-black transition-colors"
              >
                <Factory className="w-4 h-4" />
                <span className="font-mono text-xs uppercase tracking-widest">For Manufacturers</span>
              </a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {heroProofPoints.map((item) => (
                <div key={item} className="border-l border-gray-300 pl-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-8">
            <div className="relative overflow-hidden border border-gray-200 bg-white shadow-xl">
              <img
                src={heroMoodboard}
                alt="Material palette render preview"
                className="w-full h-[430px] md:h-[560px] lg:h-[620px] object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 grid grid-cols-1 md:grid-cols-[minmax(260px,0.9fr)_1fr] gap-0 border-t border-gray-200 bg-white/95 backdrop-blur">
                <div className="border-b md:border-b-0 md:border-r border-gray-200 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Palette output</p>
                  <p className="mt-2 font-display text-2xl uppercase leading-none">Specification plus visual proof.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3">
                  {heroMaterials.map((material) => (
                    <div key={material.name} className="border-b sm:border-b-0 sm:border-r last:border-r-0 border-gray-200 p-4">
                      <p className="font-display text-sm uppercase tracking-wide text-gray-950">{material.name}</p>
                      <p className="mt-1 font-sans text-xs text-gray-600">{material.meta}</p>
                      <p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-lime-700">{material.score}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Audience Value */}
      <section className="border-b border-gray-200 bg-white py-16">
        <div className="max-w-screen-2xl mx-auto px-6 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-5 space-y-3">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-gray-500">One workflow, two sides of the market</p>
              <h2 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight leading-[0.95]">
                A better meeting point for specification.
              </h2>
            </div>
            <p className="lg:col-span-7 font-sans text-lg md:text-xl text-gray-700 leading-relaxed">
              Designers need fast visual confidence without losing technical accuracy. Manufacturers need their verified product data to appear before choices are already fixed. Moodboard Lab connects both moments.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {audienceCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.eyebrow} className="border border-gray-200 bg-gray-50 p-6 md:p-8">
                  <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-4 max-w-2xl">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-gray-800" />
                        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gray-500">{card.eyebrow}</p>
                      </div>
                      <h3 className="font-display text-3xl md:text-4xl uppercase tracking-tight leading-none">{card.title}</h3>
                      <p className="font-sans text-gray-700 leading-relaxed">{card.copy}</p>
                    </div>
                    <a
                      href={getPathForPage(card.page)}
                      onClick={(event) => handleNavigateClick(event, card.page)}
                      className="inline-flex shrink-0 items-center gap-3 border border-gray-900 bg-white px-5 py-3 hover:bg-black hover:text-white transition-colors"
                    >
                      <span className="font-mono text-xs uppercase tracking-widest">{card.action}</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Product Outcomes */}
      <section className="border-b border-gray-200 bg-slate-950 text-white py-14">
        <div className="max-w-screen-2xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {productOutcomes.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="border border-white/15 p-6">
                <Icon className="w-5 h-5 text-lime-300" />
                <h3 className="mt-5 font-display text-2xl uppercase tracking-wide">{item.title}</h3>
                <p className="mt-3 font-sans text-sm leading-relaxed text-white/70">{item.copy}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sustainability */}
      <section className="border-b border-lime-200 bg-[linear-gradient(135deg,#f7f7ee_0%,#edf6dd_52%,#f5f2e9_100%)] py-16">
        <div className="max-w-screen-2xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-4">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-lime-900/70">Embedded from concept stage</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight leading-[0.95] text-slate-900">
              Sustainability starts with the first material.
            </h2>
          </div>
          <div className="lg:col-span-7 space-y-6">
            <p className="font-sans text-lg md:text-xl text-slate-800 max-w-4xl leading-relaxed">
              Your material palette is a specification, not a collage. Environmental data is embedded in every material choice at concept stage, so carbon, circularity, and practical trade-offs show up before a separate Stage 4 review.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sustainabilityHighlights.map((item) => (
                <div key={item.title} className="border border-lime-900/10 bg-white/80 backdrop-blur p-5 space-y-3 shadow-sm">
                  <p className="font-display text-lg uppercase tracking-wide text-slate-900">{item.title}</p>
                  <p className="font-sans text-sm leading-relaxed text-slate-700">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Strip */}
      <WorkflowStrip />

      {/* Partner Brands */}
      <section className="bg-white py-16 border-b border-gray-100">
        <div className="max-w-screen-2xl mx-auto px-6 space-y-10">
          <div className="flex items-center gap-3">
            <span className="h-[1px] w-12 bg-black" />
            <p className="font-mono text-xs uppercase tracking-widest text-gray-600">Partner brands</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-4 space-y-4">
              <h2 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight leading-[0.95]">
                Real product data from leading manufacturers.
              </h2>
              <p className="font-sans text-gray-600 leading-relaxed">
                Partner brands supply verified specifications, EPDs, and product imagery so architects see accurate data at concept stage.
              </p>
            </div>
            <div className="lg:col-span-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredBrands.length === 0 ? (
                  // Skeleton placeholders while loading
                  [0, 1, 2].map((i) => (
                    <div key={i} className="border border-gray-100 p-6 space-y-4 animate-pulse">
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 bg-gray-100" />
                        <div className="w-14 h-4 bg-gray-100" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-5 bg-gray-100 w-3/4" />
                        <div className="h-3 bg-gray-100 w-full" />
                        <div className="h-3 bg-gray-100 w-2/3" />
                      </div>
                    </div>
                  ))
                ) : (
                  featuredBrands.map((brand) => {
                    const tierClasses =
                      brand.tier === 'partner'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    return (
                      <article
                        key={brand.id}
                        className="border border-gray-200 p-6 flex flex-col gap-4 hover:border-black transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="w-10 h-10 border border-gray-200 flex items-center justify-center bg-gray-50 flex-shrink-0">
                            {brand.logoUrl ? (
                              <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-contain p-1" />
                            ) : (
                              <span className="font-display text-lg font-bold uppercase">{brand.name.charAt(0)}</span>
                            )}
                          </div>
                          <span className={`inline-flex items-center border px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest ${tierClasses}`}>
                            {brand.tier === 'partner' ? 'Partner' : 'Verified'}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-display text-xl uppercase tracking-wide">{brand.name}</h3>
                          <p className="font-sans text-sm text-gray-600 leading-relaxed line-clamp-2">{brand.tagline}</p>
                        </div>
                        {brand.materialCount != null && (
                          <span className="font-mono text-[10px] uppercase tracking-widest text-gray-400">
                            {brand.materialCount} products
                          </span>
                        )}
                        <button
                          onClick={() => onViewBrand(brand.slug)}
                          className="mt-auto w-full py-2.5 text-xs font-mono uppercase tracking-widest border border-gray-800 hover:bg-black hover:text-white transition-colors"
                        >
                          View products →
                        </button>
                      </article>
                    );
                  })
                )}
              </div>
              <p className="font-sans text-sm text-gray-500">
                Are you a manufacturer?{' '}
                <a
                  href={getPathForPage('brand-register')}
                  onClick={(e) => handleNavigateClick(e, 'brand-register')}
                  className="underline hover:text-black transition-colors"
                >
                  Get your products featured →
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Generations */}
      <section className="bg-white py-12 border-b border-gray-100">
        <div className="max-w-screen-2xl mx-auto px-6 space-y-6">
          <div className="flex items-center gap-3">
            <span className="h-[1px] w-12 bg-black" />
            <p className="font-mono text-xs uppercase tracking-widest text-gray-600">Recent generations</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <p className="font-sans text-gray-700 leading-relaxed">
                Recent generations created in Moodboard Lab. Each one shows how real material choices can become fast, presentation-ready visuals.
              </p>
            </div>
            <div className="lg:col-span-2">
              <div className="relative overflow-hidden border border-gray-200 bg-white shadow-md">
                <div
                  className="flex transition-transform duration-700"
                  style={{ transform: `translateX(-${activeIndex * 100}%)` }}
                >
                  {carouselImages.map((src, idx) => (
                    <div key={src} className="w-full shrink-0">
                      <img src={src} alt={`Palette render ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                  {carouselImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveIndex(idx)}
                      className={`w-2.5 h-2.5 rounded-full border border-white transition-colors ${
                        activeIndex === idx ? 'bg-white' : 'bg-transparent'
                      }`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-16 border-b border-gray-100">
        <div className="max-w-screen-2xl mx-auto px-6 space-y-10">
          <div className="flex items-center gap-3">
            <span className="h-[1px] w-12 bg-black" />
            <p className="font-mono text-xs uppercase tracking-widest text-gray-600">Features</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {featureCards.map((feature) => (
              <div key={feature.title} className="space-y-3 border border-gray-200 bg-gray-50 p-6">
                <h3 className="font-display text-2xl uppercase font-semibold">{feature.title}</h3>
                <p className="font-sans text-gray-700 leading-relaxed">{feature.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Outcomes */}
      <section className="bg-gray-50 py-16 border-b border-gray-200">
        <div className="max-w-screen-2xl mx-auto px-6 space-y-6">
          <div className="flex items-center gap-3">
            <span className="h-[1px] w-12 bg-black" />
            <p className="font-mono text-xs uppercase tracking-widest text-gray-600">Outcomes</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {outcomes.map((item, idx) => (
              <div key={idx} className="border border-gray-200 bg-white p-4">
                <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <p className="font-sans text-gray-800">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-black text-white py-16">
        <div className="max-w-screen-xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <h3 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight text-center md:text-left">
            Build your first material palette.
          </h3>
          <button
            onClick={() => onNavigate('materials')}
            className="bg-white text-black px-6 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-widest">Start Free</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default Concept;
