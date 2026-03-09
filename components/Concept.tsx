import React, { useEffect, useState, useMemo } from 'react';
import { ArrowRight, Wand2 } from 'lucide-react';
import WorkflowStrip from './WorkflowStrip';
import heroMoodboard from '../images/moodboard-2.webp';

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

const Concept: React.FC<ConceptProps> = ({ onNavigate }) => {
  // Use all images from the recents folder for the carousel
  const carouselImages = useMemo(() => recentImages.map(img => img.url), []);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % carouselImages.length);
    }, 4800);
    return () => clearInterval(timer);
  }, [carouselImages.length]);

  return (
    <div className="w-full pt-20 animate-in fade-in duration-700 bg-white">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-gray-200">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-slate-100" />
        <div className="relative max-w-screen-2xl mx-auto px-6 pt-12 pb-20 md:pt-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tight leading-[0.95]">
              Material palette workspace for architects and designers.
            </h1>
            <p className="font-sans text-lg md:text-xl text-gray-700 max-w-3xl leading-relaxed">
              Curate a material palette with real specifications and sustainability data. Generate photorealistic renders of your materials applied to buildings, free during launch.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => onNavigate('materials')}
                className="bg-black text-white px-6 py-3 flex items-center gap-3 hover:bg-gray-900 transition-colors"
              >
                <Wand2 className="w-4 h-4" />
                <span className="font-mono text-xs uppercase tracking-widest">Start Free</span>
              </button>
            </div>
          </div>
          <div className="lg:col-span-6">
            <div className="relative overflow-hidden border border-gray-200 bg-white shadow-xl">
              <img
                src={heroMoodboard}
                alt="Material palette render preview"
                className="w-full h-[420px] md:h-[520px] lg:h-[560px] object-cover"
              />
            </div>
          </div>
        </div>
      </header>

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

      {/* Recent Renders */}
      <section className="bg-white py-12 border-b border-gray-100">
        <div className="max-w-screen-2xl mx-auto px-6 space-y-6">
          <div className="flex items-center gap-3">
            <span className="h-[1px] w-12 bg-black" />
            <p className="font-mono text-xs uppercase tracking-widest text-gray-600">Recent renders</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <p className="font-sans text-gray-700 leading-relaxed">
                Recent palette renders created in Moodboard Lab. Each one shows how real material choices can become fast, presentation-ready visuals.
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
