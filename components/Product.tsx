import React from 'react';
import { Layers, ShieldCheck, Sparkles, Wand2, Palette, Images } from 'lucide-react';

interface ProductProps {
  onNavigate: (page: string) => void;
}

const features = [
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: 'AI-assisted workflows',
    copy: 'Generate renders, sustainability advice, and concise specs without leaving the board.',
  },
  {
    icon: <Palette className="w-5 h-5" />,
    title: 'Material palette clarity',
    copy: 'Lock in tones, textures, and finishes, then reuse them across views and exports.',
  },
  {
    icon: <Images className="w-5 h-5" />,
    title: 'Visual consistency',
    copy: 'Apply your palette to sketches, elevations, or precedent images in one click.',
  },
  {
    icon: <Layers className="w-5 h-5" />,
    title: 'End-to-end handoff',
    copy: 'Send boards into the Material Lab for detailed rendering, refinement, and export.',
  },
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    title: 'Sustainability guardrails',
    copy: 'Built-in heuristics highlight carbon hotspots and circularity opportunities.',
  },
  {
    icon: <Wand2 className="w-5 h-5" />,
    title: 'Fast iterations',
    copy: 'Swap options, compare variants, and keep a clean history of material decisions.',
  },
];

const Product: React.FC<ProductProps> = ({ onNavigate }) => {
  return (
    <div className="w-full pt-24 pb-16 bg-white animate-in fade-in duration-700">
      <section className="max-w-screen-2xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 border border-black px-3 py-1">
            <span className="font-mono text-xs uppercase tracking-widest font-bold">Product Overview</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold uppercase tracking-tight leading-[0.95]">
            The fastest way to build and prove a material direction.
          </h1>
          <p className="font-sans text-lg text-gray-700 max-w-3xl leading-relaxed">
            Moodboard Lab blends material curation, sustainability insight, and photorealistic rendering into one focused
            workspace. Move from palette ideas to convincing visuals without context switching.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => onNavigate('moodboard')}
              className="bg-black text-white px-6 py-3 flex items-center gap-3 hover:bg-gray-900 transition-colors"
            >
              <Wand2 className="w-4 h-4" />
              <span className="font-mono text-xs uppercase tracking-widest">Open Moodboard Lab</span>
            </button>
            <button
              onClick={() => onNavigate('concept')}
              className="border border-black px-6 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <Layers className="w-4 h-4" />
              <span className="font-mono text-xs uppercase tracking-widest">Back to homepage</span>
            </button>
          </div>
        </div>
        <div className="lg:col-span-5 border border-gray-200 bg-gray-50 p-6 space-y-4">
          <p className="font-mono text-xs uppercase tracking-widest text-gray-500">Who uses it</p>
          <ul className="space-y-3 font-sans text-gray-800">
            <li>• Architects and designers aligning early-stage palettes.</li>
            <li>• Sustainability leads needing fast guidance inside the board.</li>
            <li>• Visualization teams keeping renders consistent with chosen materials.</li>
          </ul>
        </div>
      </section>

      <section className="max-w-screen-2xl mx-auto px-6 mt-16 space-y-10">
        <div className="flex items-center gap-3">
          <span className="h-[1px] w-12 bg-black" />
          <p className="font-mono text-xs uppercase tracking-widest text-gray-600">Features</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="border border-gray-200 bg-white p-5 space-y-3">
              <div className="inline-flex items-center gap-2 text-gray-800">
                {feature.icon}
                <span className="font-display uppercase text-sm">{feature.title}</span>
              </div>
              <p className="font-sans text-gray-700 text-sm leading-relaxed">{feature.copy}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Product;
