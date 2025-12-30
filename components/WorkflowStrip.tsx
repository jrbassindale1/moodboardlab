import React, { useEffect, useRef, useState } from 'react';
import materialKey from '../images/frontpage/moodboard_key.webp';
import moodboardSheet from '../images/frontpage/moodboard_sheet1.webp';
import beforeImage from '../images/frontpage/moodboard-sheet-before.webp';
import afterImage from '../images/frontpage/moodboard-sheet-after.webp';

const WorkflowStrip: React.FC = () => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseDown = () => setIsDragging(true);

  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mouseleave', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mouseleave', handleGlobalMouseUp);
    };
  }, [isDragging]);

  return (
    <section className="bg-white py-16 border-b border-gray-100">
      <div className="max-w-screen-2xl mx-auto px-6 space-y-8">
        <div className="flex items-center gap-3">
          <span className="h-[1px] w-12 bg-black" />
          <p className="font-mono text-xs uppercase tracking-widest text-gray-600">How it works</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Column 1: Choose materials - portrait */}
          <div className="space-y-4 flex-shrink-0 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-400">01</span>
              <h3 className="font-display text-lg uppercase font-semibold tracking-wide">Choose materials</h3>
            </div>
            <div className="relative overflow-hidden border border-gray-200 bg-white shadow-md h-[350px] md:h-[420px] max-h-[50vh]">
              <img
                src={materialKey}
                alt="Material selection palette showing various architectural materials"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Column 2: Generate moodboard - square */}
          <div className="space-y-4 flex-shrink-0 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-400">02</span>
              <h3 className="font-display text-lg uppercase font-semibold tracking-wide">Generate moodboard</h3>
            </div>
            <div className="relative overflow-hidden border border-gray-200 bg-white shadow-md w-[350px] h-[350px] md:w-[420px] md:h-[420px] max-w-full max-h-[50vh]">
              <img
                src={moodboardSheet}
                alt="Flat-lay moodboard arrangement of selected materials"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Column 3: Apply to design (interactive slider) - landscape */}
          <div className="space-y-4 flex-1 w-full md:w-auto md:min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-400">03</span>
              <h3 className="font-display text-lg uppercase font-semibold tracking-wide">Apply to design</h3>
            </div>
            <div
              ref={imageContainerRef}
              className="relative overflow-hidden border border-gray-200 bg-white shadow-md h-[350px] md:h-[420px] max-h-[50vh] cursor-ew-resize select-none"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
              onTouchMove={handleTouchMove}
            >
              {/* After image (full) */}
              <img
                src={afterImage}
                alt="Rendered architectural design with materials applied"
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Before image (clipped) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
              >
                <img
                  src={beforeImage}
                  alt="Base architectural sketch or clay render"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>

              {/* Slider line and handle */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white border-2 border-gray-300 rounded-full shadow-lg pointer-events-auto cursor-ew-resize flex items-center justify-center">
                  <div className="flex gap-0.5">
                    <div className="w-0.5 h-3 bg-gray-400"></div>
                    <div className="w-0.5 h-3 bg-gray-400"></div>
                  </div>
                </div>
              </div>

              {/* Labels */}
              <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 text-[10px] font-mono uppercase tracking-wider pointer-events-none">
                Before
              </div>
              <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 text-[10px] font-mono uppercase tracking-wider pointer-events-none">
                After
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WorkflowStrip;
