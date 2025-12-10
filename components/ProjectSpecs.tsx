import React from 'react';
import { BUILDING_SPECS } from '../constants';
import { ArrowUpRight } from 'lucide-react';

const ProjectSpecs: React.FC = () => {
  return (
    <div className="w-full min-h-screen pt-20 bg-white relative animate-in fade-in duration-500">
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 relative z-10 py-12">
        <h2 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-16">
            Technical<br/>Specifications
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16">
          {BUILDING_SPECS.map((spec, index) => (
            <div key={index} className="group cursor-default flex flex-col h-full">
              <div className="relative overflow-hidden aspect-[4/3] mb-4 border border-gray-200 bg-arch-gray">
                <img 
                  src={spec.image} 
                  alt={spec.imageAlt} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/50 pointer-events-none"></div>
              </div>

              <div className="flex items-center gap-3 mb-4 border-b border-gray-200 pb-2 group-hover:border-black transition-colors duration-300">
                <span className="font-mono text-xs text-gray-400 group-hover:text-black">0{index + 1}</span>
                <h3 className="font-display text-lg uppercase font-semibold tracking-wide">{spec.title}</h3>
              </div>
              <p className="font-sans text-gray-600 text-sm leading-relaxed text-justify">
                {spec.content}
              </p>
            </div>
          ))}
          
          <div className="bg-black text-white p-8 flex flex-col justify-between h-full min-h-[200px]">
            <div>
                <h3 className="font-display text-xl uppercase font-bold mb-4">Documentation</h3>
                <p className="font-mono text-sm text-gray-400 mb-6">
                    Full architectural set<br/>
                    Plans, Sections, Details
                </p>
            </div>
            <button className="flex items-center justify-between w-full border-t border-gray-700 pt-4 hover:text-gray-300 transition-colors">
                <span className="font-mono text-xs uppercase tracking-widest">Download PDF</span>
                <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSpecs;
