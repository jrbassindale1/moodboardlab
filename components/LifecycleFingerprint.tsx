import React from 'react';
import { MATERIAL_LIFECYCLE_PROFILES, LifecycleProfile, LifecycleStageKey, Confidence } from '../lifecycleProfiles';
import { MaterialOption } from '../types';

interface LifecycleFingerprintProps {
  material: MaterialOption;
}

const STAGE_LABELS: Record<LifecycleStageKey, string> = {
  raw: 'RAW',
  manufacturing: 'MFG',
  transport: 'TRN',
  installation: 'INS',
  inUse: 'USE',
  maintenance: 'MNT',
  endOfLife: 'EOL'
};

const STAGE_FULL_NAMES: Record<LifecycleStageKey, string> = {
  raw: 'Raw Material & Pre-processing',
  manufacturing: 'Manufacturing',
  transport: 'Transport & Distribution',
  installation: 'Installation',
  inUse: 'In-Use',
  maintenance: 'Maintenance',
  endOfLife: 'End-of-Life'
};

const STAGE_TOOLTIPS: Record<LifecycleStageKey, string> = {
  raw: 'Extraction and initial processing of raw materials',
  manufacturing: 'Energy and processes to fabricate the product',
  transport: 'Distribution from factory to site (varies by supplier distance)',
  installation: 'On-site assembly and fixing',
  inUse: 'Operational phase impacts',
  maintenance: 'Repairs, cleaning, and periodic treatments',
  endOfLife: 'Demolition, recycling potential, and disposal'
};

const STAGES_ORDER: LifecycleStageKey[] = [
  'raw',
  'manufacturing',
  'transport',
  'installation',
  'inUse',
  'maintenance',
  'endOfLife'
];

const LifecycleFingerprint: React.FC<LifecycleFingerprintProps> = ({ material }) => {
  const profile: LifecycleProfile | undefined = MATERIAL_LIFECYCLE_PROFILES[material.id];

  if (!profile) {
    return (
      <div className="border border-gray-200 bg-gray-50 p-4">
        <p className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
          Lifecycle profile not available
        </p>
      </div>
    );
  }

  const renderDots = (impact: number, confidence?: Confidence) => {
    const dots = [];

    for (let i = 1; i <= 5; i++) {
      const isFilled = i <= impact;
      let dotClass = 'w-2 h-2 rounded-full border ';

      if (isFilled) {
        if (confidence === 'low') {
          // Outline dots for low confidence
          dotClass += 'border-gray-700 bg-transparent';
        } else if (confidence === 'medium') {
          // Slightly faded for medium confidence
          dotClass += 'bg-gray-700 border-gray-700 opacity-60';
        } else {
          // Solid for high confidence (default)
          dotClass += 'bg-gray-900 border-gray-900';
        }
      } else {
        // Empty dot
        dotClass += 'border-gray-300 bg-transparent';
      }

      dots.push(
        <div key={i} className={dotClass} />
      );
    }

    return dots;
  };

  const getConfidenceIndicator = (confidence?: Confidence) => {
    if (!confidence || confidence === 'high') return null;

    return (
      <span
        className="inline-flex items-center justify-center w-3 h-3 text-[8px] font-mono text-gray-600 border border-gray-400 rounded-full ml-1"
        title={confidence === 'low' ? 'Low confidence estimate' : 'Medium confidence estimate'}
      >
        ?
      </span>
    );
  };

  return (
    <div className="border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-mono text-[11px] uppercase tracking-widest text-gray-700">
          Lifecycle Fingerprint
        </h4>
        <div className="flex items-center gap-3 text-[9px] font-mono uppercase tracking-widest text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-gray-900" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-gray-700 opacity-60" />
            <span>Med.</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full border border-gray-700 bg-transparent" />
            <span>Low conf.</span>
          </div>
        </div>
      </div>

      {/* Desktop: single row */}
      <div className="hidden md:grid md:grid-cols-7 md:gap-3">
        {STAGES_ORDER.map((stageKey) => {
          const stageData = profile[stageKey];
          return (
            <div
              key={stageKey}
              className="flex flex-col items-center gap-1 group relative"
              title={STAGE_TOOLTIPS[stageKey]}
            >
              <div className="font-mono text-[9px] uppercase tracking-widest text-gray-600 text-center">
                {STAGE_LABELS[stageKey]}
              </div>
              <div className="flex gap-0.5">
                {renderDots(stageData.impact, stageData.confidence)}
              </div>
              {getConfidenceIndicator(stageData.confidence)}

              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs font-sans rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                <div className="font-semibold mb-1">{STAGE_FULL_NAMES[stageKey]}</div>
                <div className="text-[11px] leading-snug">{STAGE_TOOLTIPS[stageKey]}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: two rows */}
      <div className="md:hidden space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {STAGES_ORDER.slice(0, 4).map((stageKey) => {
            const stageData = profile[stageKey];
            return (
              <div
                key={stageKey}
                className="flex flex-col items-center gap-1"
                title={STAGE_TOOLTIPS[stageKey]}
              >
                <div className="font-mono text-[9px] uppercase tracking-widest text-gray-600 text-center">
                  {STAGE_LABELS[stageKey]}
                </div>
                <div className="flex gap-0.5">
                  {renderDots(stageData.impact, stageData.confidence)}
                </div>
                {getConfidenceIndicator(stageData.confidence)}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {STAGES_ORDER.slice(4).map((stageKey) => {
            const stageData = profile[stageKey];
            return (
              <div
                key={stageKey}
                className="flex flex-col items-center gap-1"
                title={STAGE_TOOLTIPS[stageKey]}
              >
                <div className="font-mono text-[9px] uppercase tracking-widest text-gray-600 text-center">
                  {STAGE_LABELS[stageKey]}
                </div>
                <div className="flex gap-0.5">
                  {renderDots(stageData.impact, stageData.confidence)}
                </div>
                {getConfidenceIndicator(stageData.confidence)}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] font-sans text-gray-500 mt-2">
        Impact scale: 1 = very low, 5 = very high. ? indicates lower confidence estimate.
      </p>
    </div>
  );
};

export default LifecycleFingerprint;
