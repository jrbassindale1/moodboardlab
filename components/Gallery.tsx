import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PROJECT_IMAGES } from '../constants';

const Gallery: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === PROJECT_IMAGES.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? PROJECT_IMAGES.length - 1 : prev - 1));
  };

  useEffect(() => {
    let interval: number;
    if (isAutoPlaying) {
      interval = window.setInterval(nextSlide, 5000);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const currentImage = PROJECT_IMAGES[currentIndex];

  return (
    <div className="w-full bg-arch-gray min-h-screen pt-20 animate-in fade-in duration-500">
      
      {/* Slideshow Section */}
      <div className="w-full bg-white border-b border-gray-200 pb-12 pt-12">
        <div className="max-w-screen-2xl mx-auto px-6">
            <div className="flex justify-between items-end mb-8">
                <h2 className="font-display text-4xl font-light uppercase tracking-tight">Visual Documentation</h2>
                <div className="hidden md:flex gap-4 font-mono text-xs">
                    <button 
                        onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                        className={`px-4 py-2 border ${isAutoPlaying ? 'bg-black text-white border-black' : 'border-gray-400 hover:border-black'} transition-colors uppercase`}
                    >
                        {isAutoPlaying ? 'Pause Sequence' : 'Auto Play'}
                    </button>
                </div>
            </div>

            <div className="relative group shadow-2xl">
                <div className="relative aspect-[16/9] w-full bg-white overflow-hidden border border-gray-200">
                    <img 
                    src={currentImage.url} 
                    alt={currentImage.title}
                    className="w-full h-full object-cover"
                    />
                </div>

                <button 
                    onClick={prevSlide}
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-16 h-16 bg-white flex items-center justify-center border-y border-r border-gray-200 hover:bg-black hover:text-white transition-colors z-10"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                
                <button 
                    onClick={nextSlide}
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-16 h-16 bg-white flex items-center justify-center border-y border-l border-gray-200 hover:bg-black hover:text-white transition-colors z-10"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>

                <div className="absolute top-6 left-6 bg-white px-3 py-1 font-mono text-sm border border-gray-200 z-10">
                    {String(currentIndex + 1).padStart(2, '0')} / {String(PROJECT_IMAGES.length).padStart(2, '0')}
                </div>
            </div>

            <div className="mt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div>
                    <h3 className="font-display text-xl uppercase font-bold">{currentImage.title}</h3>
                    <p className="font-mono text-xs text-gray-500 uppercase mt-1">{currentImage.category}</p>
                 </div>
                 <p className="font-sans text-sm text-gray-600 max-w-xl text-left md:text-right">
                    {currentImage.description}
                 </p>
            </div>
        </div>
      </div>

      {/* Grid View */}
      <div className="max-w-screen-2xl mx-auto px-6 py-24">
         <h3 className="font-mono text-xs uppercase tracking-widest text-gray-500 mb-8 border-b border-gray-300 pb-2">Full Gallery Index</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PROJECT_IMAGES.map((img, idx) => (
                <div 
                    key={img.id} 
                    className={`cursor-pointer group ${idx === currentIndex ? 'ring-2 ring-black ring-offset-2' : ''}`}
                    onClick={() => setCurrentIndex(idx)}
                >
                    <div className="aspect-square bg-white border border-gray-200 overflow-hidden mb-3">
                        <img src={img.url} alt={img.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 grayscale group-hover:grayscale-0" />
                    </div>
                    <h4 className="font-display text-sm font-bold uppercase">{img.title}</h4>
                    <span className="font-mono text-[10px] text-gray-500 uppercase">{img.category}</span>
                </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default Gallery;