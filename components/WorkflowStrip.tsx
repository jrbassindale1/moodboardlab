import React, { useEffect, useRef, useState } from 'react';
import materialKey from '../images/frontpage/moodboard_key.webp';
import moodboardSheet from '../images/frontpage/moodboard_sheet1.webp';
import beforeImage from '../images/frontpage/moodboard-sheet-before.webp';
import afterImage from '../images/frontpage/moodboard-sheet-after.webp';

const WorkflowStrip: React.FC = () => {
  const [isAnimated, setIsAnimated] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile || !imageContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isAnimated) {
            setIsAnimated(true);
          }
        });
      },
      {
        threshold: 0.45,
        rootMargin: '0px',
      }
    );

    observer.observe(imageContainerRef.current);

    return () => {
      if (imageContainerRef.current) {
        observer.unobserve(imageContainerRef.current);
      }
    };
  }, [isAnimated, isMobile]);

  return (
    <section className="bg-white py-16 border-b border-gray-100">
      <div className="max-w-screen-2xl mx-auto px-6 space-y-8">
        <div className="flex items-center gap-3">
          <span className="h-[1px] w-12 bg-black" />
          <p className="font-mono text-xs uppercase tracking-widest text-gray-600">How it works</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Column 1: Choose materials */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-400">01</span>
              <h3 className="font-display text-lg uppercase font-semibold tracking-wide">Choose materials</h3>
            </div>
            <div className="relative overflow-hidden border border-gray-200 bg-white shadow-md aspect-[4/3]">
              <img
                src={materialKey}
                alt="Material selection palette showing various architectural materials"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Column 2: Generate moodboard */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-400">02</span>
              <h3 className="font-display text-lg uppercase font-semibold tracking-wide">Generate moodboard</h3>
            </div>
            <div className="relative overflow-hidden border border-gray-200 bg-white shadow-md aspect-[4/3]">
              <img
                src={moodboardSheet}
                alt="Flat-lay moodboard arrangement of selected materials"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Column 3: Apply to design (animated) */}
          <div className="space-y-4 md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-400">03</span>
              <h3 className="font-display text-lg uppercase font-semibold tracking-wide">Apply to design</h3>
            </div>
            <div
              ref={imageContainerRef}
              className="relative overflow-hidden border border-gray-200 bg-white shadow-md aspect-[4/3]"
            >
              {isMobile ? (
                <img
                  src={afterImage}
                  alt="Rendered architectural design with materials applied"
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  <img
                    src={beforeImage}
                    alt="Base architectural sketch or clay render"
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out"
                    style={{ opacity: isAnimated ? 0 : 1 }}
                  />
                  <img
                    src={afterImage}
                    alt="Rendered architectural design with materials applied"
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out"
                    style={{ opacity: isAnimated ? 1 : 0 }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WorkflowStrip;
