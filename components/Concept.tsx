import React, { useEffect, useState } from 'react';
import { ArrowRight, Wand2 } from 'lucide-react';
import { SUSTAINABILITY_PYRAMID } from '../constants';
import heroMoodboard from '../images/moodboard-2.webp';
import carouselA from '../images/moodboard-4.webp';
import carouselB from '../images/moodboard-5.webp';
import carouselC from '../images/moodboard-6.webp';
import carouselD from '../images/moodboard.webp';

interface ConceptProps {
  onNavigate: (page: string) => void;
}

const Concept: React.FC<ConceptProps> = ({ onNavigate }) => {
  const carouselImages = [carouselA, carouselB, carouselC, carouselD];
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
        <div className="relative max-w-screen-2xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 border border-black px-3 py-1">
              <span className="font-mono text-xs uppercase tracking-widest font-bold">Moodboard Lab</span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tight leading-[0.95]">
              Material and moodboard workspace for architects and designers.
            </h1>
            <p className="font-sans text-lg md:text-xl text-gray-700 max-w-3xl leading-relaxed">
              Curate a material palette, get instant sustainability insight and a concise spec, and generate photorealistic
              moodboard renders. Upload a reference image to see your palette applied, then pass selections into the
              Material Lab for deeper rendering.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => onNavigate('materials')}
                className="bg-black text-white px-6 py-3 flex items-center gap-3 hover:bg-gray-900 transition-colors"
              >
                <Wand2 className="w-4 h-4" />
                <span className="font-mono text-xs uppercase tracking-widest">Start Creating</span>
              </button>
            </div>
            <div className="border border-gray-200 bg-white shadow-lg">
              <img
                src={heroMoodboard}
                alt="Moodboard hero preview"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="lg:col-span-5 bg-white border border-gray-200 shadow-xl p-6 space-y-4">
            <p className="font-mono text-xs uppercase tracking-widest text-gray-500">Why it matters</p>
            <p className="font-sans text-gray-800 text-lg leading-relaxed">
              Moodboard Lab helps you move fast: curate materials, understand sustainability, generate visuals, and keep
              your palette consistent from early ideas to detailed rendering.
            </p>
          </div>
        </div>
      </header>

      {/* Recent Moodboards */}
      <section className="bg-white py-12 border-b border-gray-100">
        <div className="max-w-screen-2xl mx-auto px-6 space-y-6">
          <div className="flex items-center gap-3">
            <span className="h-[1px] w-12 bg-black" />
            <p className="font-mono text-xs uppercase tracking-widest text-gray-600">Recent Boards</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <p className="font-sans text-gray-700 leading-relaxed">
                A selection of moodboards created in Moodboard Lab. Each one shows how the palette system brings together balanced tones and clear material choices through speedy AI renders.
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
                      <img src={src} alt={`Moodboard ${idx + 1}`} className="w-full h-full object-cover" />
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

      {/* Value Proposition */}
      <section className="bg-white py-12 border-b border-gray-100">
        <div className="max-w-screen-2xl mx-auto px-6 space-y-6">
          <div className="flex items-center gap-3">
            <span className="h-[1px] w-12 bg-black" />
            <p className="font-mono text-xs uppercase tracking-widest text-gray-600">What you can do</p>
          </div>
          <p className="font-sans text-lg text-gray-700 max-w-4xl leading-relaxed">
            Drag ready-made materials or add your own colours, get one-click sustainability advice, produce a concise
            material spec, generate a photorealistic moodboard render, upload an image to see your palette applied, and
            hand the selections into the Material Lab for deeper work—all in one place.
          </p>
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
            <div className="space-y-3">
              <h3 className="font-display text-2xl uppercase font-semibold">Curate</h3>
              <p className="font-sans text-gray-700">
                Build your palette by dragging materials or adding custom colours; choose steel tones when you select a steel frame.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="font-display text-2xl uppercase font-semibold">Sustainability</h3>
              <p className="font-sans text-gray-700">
                One-click AI advice highlights carbon hotspots, circularity potential, and simple improvements.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="font-display text-2xl uppercase font-semibold">Specification</h3>
              <p className="font-sans text-gray-700">
                Get a concise, project-ready material specification alongside your board.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="font-display text-2xl uppercase font-semibold">Render</h3>
              <p className="font-sans text-gray-700">
                Generate a photorealistic moodboard render that reflects your chosen tones and textures.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="font-display text-2xl uppercase font-semibold">Apply to images</h3>
              <p className="font-sans text-gray-700">
                Upload a sketch, elevation, or precedent and see your palette applied in a separate render.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="font-display text-2xl uppercase font-semibold">Hand-off</h3>
              <p className="font-sans text-gray-700">
                Send your selections into the Material Lab for detailed rendering and refinement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="bg-gray-50 py-16 border-b border-gray-200">
        <div className="max-w-screen-2xl mx-auto px-6 space-y-6">
          <div className="flex items-center gap-3">
            <span className="h-[1px] w-12 bg-black" />
            <p className="font-mono text-xs uppercase tracking-widest text-gray-600">Use cases</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              'Quickly explore design options and material strategies.',
              'Understand sustainability implications early in the process.',
              'Produce convincing visuals without specialist software.',
              'Apply palettes to concept sketches or reference images.',
              'Carry materials forward into later design stages.'
            ].map((item, idx) => (
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

      {/* Sustainability Pyramid */}
      <section className="bg-white py-16">
        <div className="max-w-screen-2xl mx-auto px-6 space-y-8">
          <div className="flex items-center gap-3">
            <span className="h-[1px] w-12 bg-black" />
            <p className="font-mono text-xs uppercase tracking-widest text-gray-600">Sustainability Pyramid</p>
          </div>
          <p className="font-sans text-gray-700 max-w-3xl">
            Moodboard Lab helps you work top-down: avoid and reduce first, reuse where you can, prioritise bio-based
            options, choose low-carbon conventional materials, and only then consider offsets.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {SUSTAINABILITY_PYRAMID.map((tier, idx) => (
              <div key={tier.id} className="border border-gray-200 p-4 bg-gray-50">
                <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500">{idx + 1}</div>
                <div className="font-display uppercase text-sm mt-1">{tier.title}</div>
                <p className="font-sans text-xs text-gray-700 mt-2 leading-relaxed">{tier.guidance}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-black text-white py-16">
        <div className="max-w-screen-2xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-gray-400">Ready to start?</div>
            <h3 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight mt-2">
              Open Moodboard Lab and build your palette now.
            </h3>
          </div>
          <button
            onClick={() => onNavigate('moodboard')}
            className="bg-white text-black px-6 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-widest">Open Moodboard Lab</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default Concept;
