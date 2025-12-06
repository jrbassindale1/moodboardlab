import React from 'react';
import { ArrowRight, Grid, Layout } from 'lucide-react';

interface ConceptProps {
  onNavigate: (page: string) => void;
}

const Concept: React.FC<ConceptProps> = ({ onNavigate }) => {
  return (
    <div className="w-full pt-20 animate-in fade-in duration-700">
      {/* Hero Section */}
      <header className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden border-b border-gray-200">
        <div className="absolute inset-0 bg-arch-gray z-0">
            <img 
              src="https://picsum.photos/1920/1080?grayscale&blur=2" 
              alt="Background Texture" 
              className="w-full h-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px]"></div>
        </div>

        <div className="relative z-10 max-w-screen-2xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8">
            <div className="inline-block border border-black px-3 py-1 mb-6">
                <span className="font-mono text-xs uppercase tracking-widest font-bold">UWE Engineering Proposal</span>
            </div>
            <h1 className="font-display text-6xl md:text-8xl lg:text-9xl font-bold uppercase tracking-tighter leading-[0.9] text-black mb-8">
              The<br/>
              Internal<br/>
              <span className="text-gray-500">Street</span>
            </h1>
            <p className="font-sans text-xl md:text-2xl text-gray-800 max-w-2xl leading-relaxed border-l-4 border-black pl-6 bg-white/80 backdrop-blur-sm p-4">
              A rational architectural response where a wide central atrium acts as the social heart, connecting labs, classrooms, and breakout spaces within a robust, adaptable grid.
            </p>
            
            <button 
                onClick={() => onNavigate('visuals')}
                className="mt-12 bg-black text-white px-8 py-4 flex items-center gap-4 hover:bg-gray-800 transition-colors group"
            >
                <span className="font-mono text-xs uppercase tracking-widest">View Drawings</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          
          <div className="lg:col-span-4 hidden lg:block">
             <div className="bg-white p-8 border border-gray-200 shadow-xl max-w-sm ml-auto">
                <div className="font-mono text-xs uppercase tracking-widest text-gray-500 mb-4 border-b border-gray-100 pb-2">Key Metrics</div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <div className="font-bold text-lg">Social</div>
                        <div className="text-xs text-gray-500">Heart Concept</div>
                    </div>
                    <div>
                        <div className="font-bold text-lg">Passive</div>
                        <div className="text-xs text-gray-500">Ventilation Strategy</div>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm font-mono text-gray-600">
                        <Grid className="w-4 h-4" />
                        <span>Rational Structural Grid</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-mono text-gray-600">
                        <Layout className="w-4 h-4" />
                        <span>Central Atrium Plan</span>
                    </div>
                </div>
             </div>
          </div>
        </div>
      </header>

      {/* Text Content Section */}
      <section className="bg-white py-24">
        <div className="max-w-screen-xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16">
            <div>
                <h3 className="font-display text-3xl uppercase font-bold mb-6">Academic Flow</h3>
                <p className="font-sans text-gray-600 leading-relaxed mb-6">
                    The primary spatial concept is a wide internal "street" or atrium that runs through the heart of the building. All classrooms, laboratories, collaboration spaces and staff rooms are accessed directly from this central spine.
                </p>
                <p className="font-sans text-gray-600 leading-relaxed">
                     The building footprint follows a rational grid to ensure future flexibility, with corner cores anchoring the structure and freeing up the central volume for social interaction and visual connectivity.
                </p>
            </div>
            <div>
                 <h3 className="font-display text-3xl uppercase font-bold mb-6">The "Street"</h3>
                 <ul className="space-y-4 font-mono text-sm text-gray-700">
                    <li className="flex items-start gap-3 border-t border-gray-200 pt-4">
                        <span className="font-bold">01</span>
                        <span>Reads as a generous, continuous space suitable for informal gathering.</span>
                    </li>
                    <li className="flex items-start gap-3 border-t border-gray-200 pt-4">
                        <span className="font-bold">02</span>
                        <span>Facilitates natural stack ventilation and daylight penetration.</span>
                    </li>
                    <li className="flex items-start gap-3 border-t border-gray-200 pt-4">
                        <span className="font-bold">03</span>
                        <span>Loose furniture clusters shown in fine-line detail.</span>
                    </li>
                 </ul>
            </div>
        </div>
      </section>
    </div>
  );
};

export default Concept;