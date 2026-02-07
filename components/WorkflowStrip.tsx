import React, { useRef, useState } from 'react';
import materialKey from '../images/frontpage/moodboard_key.webp';
import moodboardSheet from '../images/frontpage/moodboard_sheet1.webp';
import beforeImage from '../images/frontpage/moodboard-sheet-before.webp';
import afterImage from '../images/frontpage/moodboard-sheet-after.webp';

const WorkflowStrip: React.FC = () => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const activeContainerRef = useRef<HTMLDivElement | null>(null);

  const handleMove = (clientX: number) => {
    const container = activeContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    activeContainerRef.current = e.currentTarget;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) handleMove(e.clientX);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    activeContainerRef.current = null;
  };

  return (
    <section className="bg-white py-16 border-b border-gray-100">
      <div className="max-w-screen-2xl mx-auto px-6 space-y-8">
        <div className="flex items-center gap-3">
          <span className="h-[1px] w-12 bg-black" />
          <p className="font-mono text-xs uppercase tracking-widest text-gray-600">How it works</p>
        </div>

        {/* Mobile: stack vertically */}
        <div className="flex flex-col gap-6 md:hidden">
          {/* Column 1: Choose materials */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-400">01</span>
              <h3 className="font-display text-lg uppercase font-semibold tracking-wide">Choose materials</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Easily pick your proposed building materials from an extensive list.
            </p>
            <div className="relative overflow-hidden border border-gray-200 bg-white shadow-md">
              <img
                src={materialKey}
                alt="Material selection palette showing various architectural materials"
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Column 2: Generate moodboard */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-400">02</span>
              <h3 className="font-display text-lg uppercase font-semibold tracking-wide">Generate moodboard</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              A beautiful moodboard is created in an instant.
            </p>
            <div className="relative overflow-hidden border border-gray-200 bg-white shadow-md">
              <img
                src={moodboardSheet}
                alt="Flat-lay moodboard arrangement of selected materials"
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Column 3: Apply to design */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-400">03</span>
              <h3 className="font-display text-lg uppercase font-semibold tracking-wide">Apply to design</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Use a wireframe or a sketch to see your materials applied to your project.
            </p>
            <div
              className="relative overflow-hidden border border-gray-200 bg-white shadow-md h-64 cursor-ew-resize select-none"
              style={{ touchAction: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                src={afterImage}
                alt="Rendered architectural design with materials applied"
                className="absolute inset-0 w-full h-full object-cover"
              />
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
              <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 text-[10px] font-mono uppercase tracking-wider pointer-events-none">
                Before
              </div>
              <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 text-[10px] font-mono uppercase tracking-wider pointer-events-none">
                After
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: 3-column grid layout */}
        <div className="hidden md:grid grid-cols-[auto_auto_1fr] gap-6">
          {/* Column 1: Choose materials */}
          <div className="space-y-4 flex flex-col">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-400">01</span>
              <h3 className="font-display text-lg uppercase font-semibold tracking-wide">Choose materials</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed max-w-xs">
              Easily pick your proposed building materials from an extensive list.
            </p>
            <div className="relative overflow-hidden border border-gray-200 bg-white shadow-md flex-1 flex items-start">
              <img
                src={materialKey}
                alt="Material selection palette showing various architectural materials"
                className="w-auto h-auto max-h-[300px] max-w-full"
              />
            </div>
          </div>

          {/* Column 2: Generate moodboard */}
          <div className="space-y-4 flex flex-col">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-400">02</span>
              <h3 className="font-display text-lg uppercase font-semibold tracking-wide">Generate moodboard</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed max-w-xs">
              A beautiful moodboard is created in an instant.
            </p>
            <div className="relative overflow-hidden border border-gray-200 bg-white shadow-md flex-1 flex items-start">
              <img
                src={moodboardSheet}
                alt="Flat-lay moodboard arrangement of selected materials"
                className="w-auto h-auto max-h-[300px] max-w-full"
              />
            </div>
          </div>

          {/* Column 3: Apply to design */}
          <div className="space-y-4 flex flex-col">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-400">03</span>
              <h3 className="font-display text-lg uppercase font-semibold tracking-wide">Apply to design</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed max-w-xs">
              Use a wireframe or a sketch to see your materials applied to your project.
            </p>
            <div
              className="relative overflow-hidden border border-gray-200 bg-white shadow-md flex-1 cursor-ew-resize select-none"
              style={{ touchAction: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                src={afterImage}
                alt="Rendered architectural design with materials applied"
                className="absolute inset-0 w-full h-full object-cover"
              />
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
