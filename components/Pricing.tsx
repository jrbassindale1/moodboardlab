import React from 'react';
import { Sparkles, Zap, Image, Camera } from 'lucide-react';

const Pricing: React.FC = () => {
  return (
    <div className="w-full pt-24 pb-16 bg-white animate-in fade-in duration-700">
      <div className="max-w-screen-2xl mx-auto px-6 space-y-16">
        {/* Header */}
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 border border-black px-3 py-1">
            <span className="font-mono text-xs uppercase tracking-widest font-bold">Pricing & Credits</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight">
            Simple, transparent pricing
          </h1>
          <p className="font-sans text-lg text-gray-700 max-w-3xl leading-relaxed">
            Start with 10 free credits each month. Purchase more when you need them, with better value on larger packs.
            Credits never expire.
          </p>
        </header>

        {/* Credit Packages */}
        <section className="space-y-6">
          <h2 className="font-display text-2xl uppercase tracking-wide">Credit Packages</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Starter */}
            <div className="border border-gray-200 p-6 space-y-4 hover:border-black transition-colors">
              <div className="space-y-1">
                <h3 className="font-display text-xl uppercase">Starter</h3>
                <p className="font-sans text-sm text-gray-600">Perfect for trying things out</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">£5</span>
                <span className="font-sans text-gray-500">/ 25 credits</span>
              </div>
              <p className="font-mono text-xs text-gray-500 uppercase">£0.20 per credit</p>
            </div>

            {/* Standard */}
            <div className="border-2 border-black p-6 space-y-4 relative">
              <div className="absolute -top-3 left-4 bg-black text-white px-2 py-0.5">
                <span className="font-mono text-[10px] uppercase tracking-widest">Popular</span>
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-xl uppercase">Standard</h3>
                <p className="font-sans text-sm text-gray-600">For regular projects</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">£10</span>
                <span className="font-sans text-gray-500">/ 50 credits</span>
              </div>
              <p className="font-mono text-xs text-gray-500 uppercase">£0.20 per credit</p>
            </div>

            {/* Pro */}
            <div className="border border-gray-200 bg-gray-50 p-6 space-y-4 hover:border-black transition-colors">
              <div className="space-y-1">
                <h3 className="font-display text-xl uppercase">Pro</h3>
                <p className="font-sans text-sm text-gray-600">Best value for teams</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">£25</span>
                <span className="font-sans text-gray-500">/ 150 credits</span>
              </div>
              <p className="font-mono text-xs text-green-600 uppercase font-medium">£0.17 per credit — Save 17%</p>
            </div>
          </div>
        </section>

        {/* Credit Usage */}
        <section className="space-y-6">
          <h2 className="font-display text-2xl uppercase tracking-wide">How Credits Work</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Standard Generation */}
            <div className="border border-gray-200 p-6 space-y-3">
              <div className="w-10 h-10 bg-gray-100 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-gray-700" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-3xl font-bold">1</span>
                <span className="font-sans text-sm text-gray-600">credit</span>
              </div>
              <h3 className="font-display text-sm uppercase tracking-wide">Standard Render</h3>
              <p className="font-sans text-sm text-gray-600 leading-relaxed">
                Generate a new moodboard or apply materials to an image for the first time.
              </p>
            </div>

            {/* Iterative Generation */}
            <div className="border border-gray-200 p-6 space-y-3">
              <div className="w-10 h-10 bg-gray-100 flex items-center justify-center">
                <Zap className="w-5 h-5 text-gray-700" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-3xl font-bold">2</span>
                <span className="font-sans text-sm text-gray-600">credits</span>
              </div>
              <h3 className="font-display text-sm uppercase tracking-wide">Edit & Refine</h3>
              <p className="font-sans text-sm text-gray-600 leading-relaxed">
                Refine an existing render with additional prompts or adjustments.
              </p>
            </div>

            {/* Photo Analysis */}
            <div className="border border-gray-200 p-6 space-y-3">
              <div className="w-10 h-10 bg-gray-100 flex items-center justify-center">
                <Camera className="w-5 h-5 text-gray-700" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-3xl font-bold">2</span>
                <span className="font-sans text-sm text-gray-600">credits</span>
              </div>
              <h3 className="font-display text-sm uppercase tracking-wide">Analyze Photo</h3>
              <p className="font-sans text-sm text-gray-600 leading-relaxed">
                Detect and identify materials from an uploaded photograph.
              </p>
            </div>

            {/* 4K Generation */}
            <div className="border border-gray-200 p-6 space-y-3">
              <div className="w-10 h-10 bg-gray-100 flex items-center justify-center">
                <Image className="w-5 h-5 text-gray-700" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-3xl font-bold">5</span>
                <span className="font-sans text-sm text-gray-600">credits</span>
              </div>
              <h3 className="font-display text-sm uppercase tracking-wide">4K Upscale</h3>
              <p className="font-sans text-sm text-gray-600 leading-relaxed">
                Upscale your render to high-resolution 4K for presentations and print.
              </p>
            </div>
          </div>
        </section>

        {/* Free Tier */}
        <section className="border border-gray-200 bg-gray-50 p-8 space-y-4">
          <h2 className="font-display text-xl uppercase tracking-wide">Free Monthly Credits</h2>
          <p className="font-sans text-gray-700 leading-relaxed max-w-2xl">
            Every account receives <strong>10 free credits each month</strong>, automatically refreshed at the start of
            each billing period. Free credits are used first, so your purchased credits are preserved until needed.
          </p>
          <p className="font-sans text-sm text-gray-500">
            Note: 4K upscaling requires purchased credits and is not available with free monthly credits.
          </p>
        </section>

        {/* How AI Generation Works */}
        <section className="space-y-6">
          <h2 className="font-display text-2xl uppercase tracking-wide">How AI Generation Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-display text-lg uppercase">The Creative Process</h3>
              <p className="font-sans text-gray-700 leading-relaxed">
                Each render uses advanced AI models to interpret your materials and create unique visualisations.
                Like working with any creative tool, some outputs will resonate more than others — that's part of
                the iterative design process.
              </p>
              <p className="font-sans text-gray-700 leading-relaxed">
                We encourage experimentation: try different material combinations, adjust scene controls, or
                add notes to guide the AI. The more you explore, the better your results become.
              </p>
            </div>
            <div className="border border-amber-200 bg-amber-50 p-6 space-y-3">
              <h3 className="font-display text-lg uppercase text-amber-900">Understanding Credit Usage</h3>
              <p className="font-sans text-amber-800 leading-relaxed">
                Credits are consumed when the AI processes your request, regardless of whether you choose to keep
                the result. This reflects the computational resources used to generate each unique image.
              </p>
              <p className="font-sans text-amber-800 leading-relaxed">
                Think of it like a sketch pad — each page used has value, even if you don't frame every drawing.
                We recommend starting with your free credits to learn what works best for your projects.
              </p>
            </div>
          </div>
        </section>

        {/* Tips for Better Results */}
        <section className="space-y-6">
          <h2 className="font-display text-2xl uppercase tracking-wide">Tips for Better Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-gray-200 p-6 space-y-3">
              <div className="font-display text-4xl text-gray-300">01</div>
              <h3 className="font-display text-sm uppercase tracking-wide">Curate Your Palette</h3>
              <p className="font-sans text-sm text-gray-600 leading-relaxed">
                Start with 3-5 complementary materials. Too many materials can create visual noise.
              </p>
            </div>
            <div className="border border-gray-200 p-6 space-y-3">
              <div className="font-display text-4xl text-gray-300">02</div>
              <h3 className="font-display text-sm uppercase tracking-wide">Use Scene Controls</h3>
              <p className="font-sans text-sm text-gray-600 leading-relaxed">
                Adjust lighting, weather, and time of day to see how materials perform in different conditions.
              </p>
            </div>
            <div className="border border-gray-200 p-6 space-y-3">
              <div className="font-display text-4xl text-gray-300">03</div>
              <h3 className="font-display text-sm uppercase tracking-wide">Add Context Notes</h3>
              <p className="font-sans text-sm text-gray-600 leading-relaxed">
                Include notes about the space type, style, or specific requirements to guide the AI.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-6">
          <h2 className="font-display text-2xl uppercase tracking-wide">Common Questions</h2>
          <div className="space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="font-display text-sm uppercase tracking-wide mb-2">Do credits expire?</h3>
              <p className="font-sans text-gray-600 text-sm leading-relaxed">
                Purchased credits never expire. Free monthly credits refresh at the start of each month and don't
                roll over.
              </p>
            </div>
            <div className="border-b border-gray-200 pb-4">
              <h3 className="font-display text-sm uppercase tracking-wide mb-2">Which credits are used first?</h3>
              <p className="font-sans text-gray-600 text-sm leading-relaxed">
                Your free monthly credits are always used before purchased credits, so your paid credits are preserved.
              </p>
            </div>
            <div className="border-b border-gray-200 pb-4">
              <h3 className="font-display text-sm uppercase tracking-wide mb-2">Can I get a refund for unused credits?</h3>
              <p className="font-sans text-gray-600 text-sm leading-relaxed">
                Credits are non-refundable, but they never expire so you can use them whenever you need them.
              </p>
            </div>
            <div className="border-b border-gray-200 pb-4">
              <h3 className="font-display text-sm uppercase tracking-wide mb-2">What if I'm not happy with a render?</h3>
              <p className="font-sans text-gray-600 text-sm leading-relaxed">
                AI generation is an iterative process. Try adjusting your materials, adding notes, or changing scene
                controls. Each attempt helps you understand what works best for your projects.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Pricing;
