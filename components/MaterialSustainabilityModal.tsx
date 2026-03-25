import React from 'react';
import { Leaf, X } from 'lucide-react';
import type { MaterialFact, MaterialLifecycleStage } from '../data/materialFacts';
import type { MaterialOption } from '../types';
import { CARBON_IMPACT_CLASSES, CARBON_IMPACT_LABELS } from '../utils/materialCarbon';

interface MaterialSustainabilityModalProps {
  material: MaterialOption;
  fact: MaterialFact;
  onClose: () => void;
}

const STAGE_LABELS: Record<MaterialLifecycleStage, string> = {
  raw: 'Raw Materials',
  manufacturing: 'Manufacturing',
  transport: 'Transport',
  installation: 'Installation',
  inUse: 'In Use',
  maintenance: 'Maintenance',
  endOfLife: 'End of Life',
};

const SHORT_STAGE_LABELS: Record<MaterialLifecycleStage, string> = {
  raw: 'Raw',
  manufacturing: 'Mfg',
  transport: 'Trans',
  installation: 'Install',
  inUse: 'Use',
  maintenance: 'Maint',
  endOfLife: 'EoL',
};

const LIFECYCLE_STAGES: MaterialLifecycleStage[] = [
  'raw',
  'manufacturing',
  'transport',
  'installation',
  'inUse',
  'maintenance',
  'endOfLife',
];

const MaterialSustainabilityModal: React.FC<MaterialSustainabilityModalProps> = ({
  material,
  fact,
  onClose,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-4 overflow-y-auto">
    <div className="relative w-full max-w-4xl bg-white shadow-2xl my-auto">
      <div className="max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-green-50">
          <div className="flex items-center gap-3">
            <Leaf className="w-5 h-5 text-emerald-600" />
            <span className="font-mono text-xs uppercase tracking-widest text-gray-700">
              Sustainability Credentials
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/50 rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div
            className="w-12 h-12 border border-gray-200 flex-shrink-0 rounded"
            style={{ backgroundColor: material.tone }}
          />
          <div className="flex-1">
            <h2 className="font-display uppercase tracking-wide text-lg">{fact.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{fact.formVariant}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center border px-2 py-1 text-[10px] font-mono uppercase tracking-widest ${CARBON_IMPACT_CLASSES[fact.carbonIntensity]}`}>
              {CARBON_IMPACT_LABELS[fact.carbonIntensity]}
            </span>
            <span className="inline-flex items-center border px-2 py-1 text-[10px] font-mono uppercase tracking-widest bg-gray-50 text-gray-600 border-gray-200">
              {fact.systemRole}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          <div className="space-y-5">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <p className="text-sm text-gray-700 leading-relaxed">{fact.whatItIs}</p>
            </div>

            {fact.typicalUses.length > 0 && (
              <div>
                <h4 className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-2">Typical Uses</h4>
                <ul className="space-y-1.5">
                  {fact.typicalUses.slice(0, 4).map((use, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-gray-400 mt-1">•</span>
                      <span>{use}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {fact.performanceNote && (
              <div>
                <h4 className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-2">Key Performance</h4>
                <p className="text-sm text-gray-700">{fact.performanceNote}</p>
              </div>
            )}

            {fact.serviceLife && (
              <div className="flex items-center gap-3">
                <h4 className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Expected Service Life</h4>
                <span className="text-sm font-medium text-gray-700">{fact.serviceLife} years</span>
              </div>
            )}

            {fact.risks && fact.risks.length > 0 && (
              <div>
                <h4 className="font-mono text-[10px] uppercase tracking-widest text-orange-600 mb-2">Watch For</h4>
                <ul className="space-y-2">
                  {fact.risks.slice(0, 2).map((riskItem, i) => (
                    <li key={i} className="text-sm text-gray-700">
                      <div className="flex items-start gap-2">
                        <span className="text-orange-500 mt-0.5">•</span>
                        <div>
                          <span className="font-medium">{riskItem.risk}</span>
                          {riskItem.mitigation && (
                            <p className="text-xs text-gray-500 mt-0.5">{riskItem.mitigation}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {fact.actions.length > 0 && (
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <h4 className="font-mono text-[10px] uppercase tracking-widest text-emerald-700 mb-3 flex items-center gap-2">
                  <Leaf className="w-3 h-3" />
                  Specification Actions
                </h4>
                <ul className="space-y-2">
                  {fact.actions.slice(0, 3).map((action, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-4">Lifecycle Impact</h4>

              <div className="flex justify-center">
                <svg viewBox="0 0 200 200" className="w-48 h-48">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <polygon
                      key={level}
                      points={(() => {
                        const cx = 100;
                        const cy = 100;
                        const maxR = 70;
                        const r = (level / 5) * maxR;
                        return LIFECYCLE_STAGES.map((_, i) => {
                          const angle = (Math.PI * 2 * i) / LIFECYCLE_STAGES.length - Math.PI / 2;
                          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
                        }).join(' ');
                      })()}
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="0.5"
                    />
                  ))}
                  {LIFECYCLE_STAGES.map((_, i) => {
                    const cx = 100;
                    const cy = 100;
                    const maxR = 70;
                    const angle = (Math.PI * 2 * i) / LIFECYCLE_STAGES.length - Math.PI / 2;
                    return (
                      <line
                        key={i}
                        x1={cx}
                        y1={cy}
                        x2={cx + maxR * Math.cos(angle)}
                        y2={cy + maxR * Math.sin(angle)}
                        stroke="#e5e7eb"
                        strokeWidth="0.5"
                      />
                    );
                  })}
                  <polygon
                    points={(() => {
                      const cx = 100;
                      const cy = 100;
                      const maxR = 70;
                      return LIFECYCLE_STAGES.map((stage, i) => {
                        const score = fact.lifecycle.scores[stage];
                        const r = (score / 5) * maxR;
                        const angle = (Math.PI * 2 * i) / LIFECYCLE_STAGES.length - Math.PI / 2;
                        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
                      }).join(' ');
                    })()}
                    fill="rgba(34, 197, 94, 0.2)"
                    stroke="#22c55e"
                    strokeWidth="2"
                  />
                  {LIFECYCLE_STAGES.map((stage, i) => {
                    const cx = 100;
                    const cy = 100;
                    const maxR = 70;
                    const score = fact.lifecycle.scores[stage];
                    const isHotspot = fact.lifecycle.hotspots.includes(stage);
                    const isStrength = fact.lifecycle.strengths.includes(stage);
                    const r = (score / 5) * maxR;
                    const angle = (Math.PI * 2 * i) / LIFECYCLE_STAGES.length - Math.PI / 2;
                    const x = cx + r * Math.cos(angle);
                    const y = cy + r * Math.sin(angle);
                    return (
                      <circle
                        key={stage}
                        cx={x}
                        cy={y}
                        r="4"
                        fill={isHotspot ? '#f97316' : isStrength ? '#22c55e' : '#9ca3af'}
                        stroke="white"
                        strokeWidth="1.5"
                      />
                    );
                  })}
                  {LIFECYCLE_STAGES.map((stage, i) => {
                    const cx = 100;
                    const cy = 100;
                    const labelR = 88;
                    const angle = (Math.PI * 2 * i) / LIFECYCLE_STAGES.length - Math.PI / 2;
                    const x = cx + labelR * Math.cos(angle);
                    const y = cy + labelR * Math.sin(angle);
                    return (
                      <text
                        key={stage}
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-[8px] fill-gray-500"
                      >
                        {SHORT_STAGE_LABELS[stage]}
                      </text>
                    );
                  })}
                </svg>
              </div>

              <p className="text-[10px] text-gray-400 text-center mt-2">
                Lower scores = lower impact (1 minimal, 5 significant)
              </p>
            </div>

            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-orange-600 mb-2">Major Contributors</h4>
              <div className="flex flex-wrap gap-2">
                {fact.lifecycle.hotspots.map((stage) => (
                  <span key={stage} className="inline-flex items-center px-2 py-1 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded">
                    {STAGE_LABELS[stage]}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-emerald-600 mb-2">Strongest Stages</h4>
              <div className="flex flex-wrap gap-2">
                {fact.lifecycle.strengths.map((stage) => (
                  <span key={stage} className="inline-flex items-center px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                    {STAGE_LABELS[stage]}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <p className="text-sm text-gray-700 leading-relaxed">{fact.insight}</p>
            </div>

            {(fact.healthRiskLevel || fact.healthNote) && (
              <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-1 h-3 bg-teal-500 rounded-sm" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-1 bg-teal-500 rounded-sm" />
                      </div>
                    </div>
                    <h4 className="font-mono text-[10px] uppercase tracking-widest text-teal-700">Health & Indoor Air</h4>
                  </div>
                  {fact.healthRiskLevel && (
                    <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest rounded-full ${
                      fact.healthRiskLevel === 'low' ? 'bg-emerald-100 text-emerald-700' :
                      fact.healthRiskLevel === 'high' ? 'bg-rose-100 text-rose-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {fact.healthRiskLevel} Risk
                    </span>
                  )}
                </div>
                {fact.healthConcerns && fact.healthConcerns.length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {fact.healthConcerns.slice(0, 3).map((concern, i) => (
                      <li key={i} className="text-sm text-teal-800 flex items-start gap-2">
                        <span className="text-teal-400 mt-0.5">•</span>
                        <span>{concern}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {fact.healthNote && (
                  <p className="text-sm text-teal-800">{fact.healthNote}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="font-medium">Data Confidence:</span>
              <span className={`${
                fact.dataConfidence === 'High' ? 'text-emerald-600' :
                fact.dataConfidence === 'Low' ? 'text-amber-600' :
                'text-gray-600'
              }`}>{fact.dataConfidence}</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-arch-black text-white uppercase font-mono text-[10px] tracking-widest hover:bg-gray-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default MaterialSustainabilityModal;
