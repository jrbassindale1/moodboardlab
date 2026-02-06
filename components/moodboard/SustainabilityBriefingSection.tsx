import React, { useState } from 'react';
import {
  Loader2,
  Leaf,
  Download,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { MaterialOption } from '../../types';
import type {
  SustainabilityBriefingResponse,
  SustainabilityBriefingPayload,
} from '../../utils/sustainabilityBriefing';

interface SustainabilityBriefingSectionProps {
  sustainabilityBriefing: SustainabilityBriefingResponse | null;
  briefingPayload: SustainabilityBriefingPayload | null;
  isBriefingLoading: boolean;
  exportingBriefingPdf: boolean;
  exportingMaterialsSheetPdf: boolean;
  board: MaterialOption[];
  onDownloadBriefingPdf: () => void;
  onDownloadMaterialsSheetPdf: () => void;
}

const SustainabilityBriefingSection: React.FC<SustainabilityBriefingSectionProps> = ({
  sustainabilityBriefing,
  briefingPayload,
  isBriefingLoading,
  exportingBriefingPdf,
  exportingMaterialsSheetPdf,
  board,
  onDownloadBriefingPdf,
  onDownloadMaterialsSheetPdf,
}) => {
  const [fullReportNotice, setFullReportNotice] = useState<string | null>(null);

  if (!sustainabilityBriefing && !isBriefingLoading) return null;

  return (
    <div id="sustainability-report" className="sustainability-briefing border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-green-600" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-gray-700">
            Sustainability Briefing
          </span>
        </div>
        {sustainabilityBriefing && (
          <div className="flex items-center gap-2">
            <button
              onClick={onDownloadBriefingPdf}
              disabled={exportingBriefingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
            >
              {exportingBriefingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Download PDF
            </button>
            <button
              onClick={onDownloadMaterialsSheetPdf}
              disabled={exportingMaterialsSheetPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 rounded hover:bg-emerald-200 transition-colors disabled:opacity-50"
            >
              {exportingMaterialsSheetPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Materials Sheet
            </button>
            <button
              onClick={() => setFullReportNotice('This feature is in production and will be coming soon.')}
              aria-disabled="true"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded border border-gray-200 cursor-not-allowed"
            >
              Create Full Sustainability Report
            </button>
          </div>
        )}
      </div>
      {fullReportNotice && (
        <div className="px-4 py-2 border-b border-amber-200 bg-amber-50 text-xs text-amber-800">
          {fullReportNotice}
        </div>
      )}

      {isBriefingLoading && !sustainabilityBriefing ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
          <span className="ml-3 text-sm text-gray-600">Generating sustainability briefing...</span>
        </div>
      ) : sustainabilityBriefing && briefingPayload ? (
        <div className="p-6 space-y-8">
          {/* Executive Summary */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Summary</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              {sustainabilityBriefing.summary}
            </p>
          </div>

          {/* Radar Chart + Explanation */}
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-gray-600 mb-3">
              Lifecycle Impact Profile
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-0">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                    <RadarChart
                      data={[
                        { stage: 'Raw Materials', score: briefingPayload.averageScores.raw, fullMark: 5 },
                        { stage: 'Manufacturing', score: briefingPayload.averageScores.manufacturing, fullMark: 5 },
                        { stage: 'Transport', score: briefingPayload.averageScores.transport, fullMark: 5 },
                        { stage: 'Installation', score: briefingPayload.averageScores.installation, fullMark: 5 },
                        { stage: 'In Use', score: briefingPayload.averageScores.inUse, fullMark: 5 },
                        { stage: 'Maintenance', score: briefingPayload.averageScores.maintenance, fullMark: 5 },
                        { stage: 'End of Life', score: briefingPayload.averageScores.endOfLife, fullMark: 5 },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius="70%"
                    >
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="stage" tick={{ fontSize: 10, fill: '#4b5563' }} />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 5]}
                        tick={{ fontSize: 9, fill: '#9ca3af' }}
                        tickCount={6}
                      />
                      <Radar
                        name="Impact"
                        dataKey="score"
                        stroke="#059669"
                        fill="#10b981"
                        fillOpacity={0.4}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-gray-500 text-center mt-2">
                  Lower scores = lower environmental impact (1 = minimal, 5 = significant)
                </p>
              </div>

              {/* Explanation */}
              {(() => {
                const stageLabels: Record<string, string> = {
                  raw: 'Raw Materials',
                  manufacturing: 'Manufacturing',
                  transport: 'Transport',
                  installation: 'Installation',
                  inUse: 'In Use',
                  maintenance: 'Maintenance',
                  endOfLife: 'End of Life',
                };
                const scores = briefingPayload.averageScores;
                type StageKey =
                  | 'raw'
                  | 'manufacturing'
                  | 'transport'
                  | 'installation'
                  | 'inUse'
                  | 'maintenance'
                  | 'endOfLife';
                const stageKeys: StageKey[] = [
                  'raw',
                  'manufacturing',
                  'transport',
                  'installation',
                  'inUse',
                  'maintenance',
                  'endOfLife',
                ];
                const sorted = stageKeys
                  .map((key) => ({ key, label: stageLabels[key] || key, score: scores[key] }))
                  .sort((a, b) => b.score - a.score);
                const contributors = sorted.slice(0, 3);
                const opportunities = [...sorted].sort((a, b) => a.score - b.score).slice(0, 3);

                const topStage = contributors[0]?.key;
                const topDrivers = topStage
                  ? briefingPayload.materials
                      .filter(
                        (m: { lifecycleScores: Record<string, number>; name: string }) =>
                          (m.lifecycleScores[topStage] ?? 0) >= 4
                      )
                      .map((m: { name: string }) => m.name)
                      .slice(0, 3)
                  : [];

                return (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* Top Contributors */}
                      <div>
                        <h4 className="font-mono text-[10px] uppercase tracking-widest text-orange-600 mb-2">
                          Major Contributors
                        </h4>
                        <ul className="space-y-1.5">
                          {contributors.map((s) => (
                            <li key={s.key} className="flex items-center justify-between">
                              <span className="text-xs text-gray-700">{s.label}</span>
                              <div className="flex items-center gap-1.5">
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${(s.score / 5) * 100}%`,
                                      backgroundColor:
                                        s.score >= 3
                                          ? '#f97316'
                                          : s.score >= 2
                                          ? '#eab308'
                                          : '#22c55e',
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] text-gray-500 w-6 text-right">
                                  {s.score.toFixed(1)}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                        {topDrivers.length > 0 && (
                          <p className="text-[10px] text-gray-500 mt-1.5">
                            Driven by: {topDrivers.join(', ')}
                          </p>
                        )}
                      </div>

                      {/* Opportunities */}
                      <div>
                        <h4 className="font-mono text-[10px] uppercase tracking-widest text-green-600 mb-2">
                          Strongest Stages
                        </h4>
                        <ul className="space-y-1.5">
                          {opportunities.map((s) => (
                            <li key={s.key} className="flex items-center justify-between">
                              <span className="text-xs text-gray-700">{s.label}</span>
                              <div className="flex items-center gap-1.5">
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-500 rounded-full"
                                    style={{ width: `${(s.score / 5) * 100}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-gray-500 w-6 text-right">
                                  {s.score.toFixed(1)}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Insight */}
                      <div className="bg-white border border-gray-200 rounded p-2.5">
                        <p className="text-[11px] text-gray-600 leading-relaxed">
                          {contributors[0] && contributors[0].score >= 3
                            ? `The ${String(contributors[0].label).toLowerCase()} stage is the palette's largest carbon hotspot at ${contributors[0].score.toFixed(1)}/5. `
                            : `No single stage dominates — the palette has a balanced impact profile. `}
                          {opportunities[0] && opportunities[0].score <= 2
                            ? `${String(opportunities[0].label)} and ${String(
                                opportunities[1]?.label || 'maintenance'
                              ).toLowerCase()} stages perform well, reflecting good in-service material choices.`
                            : `Focus procurement on reducing embodied carbon through EPDs and recycled content specifications.`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Heroes and Challenges Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Heroes */}
            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-gray-600 mb-3 flex items-center gap-2">
                <Leaf className="w-4 h-4 text-green-600" />
                Hero Materials
              </h3>
              <div className="space-y-3">
                {sustainabilityBriefing.heroes.map((hero, idx) => (
                  <div
                    key={hero.id || idx}
                    className="bg-green-50 border border-green-200 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium text-sm text-gray-900">{hero.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          hero.carbonIntensity === 'low'
                            ? 'bg-green-100 text-green-800'
                            : hero.carbonIntensity === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {hero.carbonIntensity === 'low'
                          ? 'Low Carbon'
                          : hero.carbonIntensity === 'high'
                          ? 'High Carbon'
                          : 'Medium'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700">
                      <span className="font-medium text-green-700">Strategic Value:</span>{' '}
                      {hero.strategicValue}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Challenges */}
            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-gray-600 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Challenge Materials
              </h3>
              <div className="space-y-3">
                {sustainabilityBriefing.challenges.map((challenge, idx) => (
                  <div
                    key={challenge.id || idx}
                    className="bg-orange-50 border border-orange-200 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium text-sm text-gray-900">{challenge.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          challenge.carbonIntensity === 'low'
                            ? 'bg-green-100 text-green-800'
                            : challenge.carbonIntensity === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {challenge.carbonIntensity === 'low'
                          ? 'Low Carbon'
                          : challenge.carbonIntensity === 'high'
                          ? 'High Carbon'
                          : 'Medium'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700">
                      <span className="font-medium text-orange-700">Mitigation Tip:</span>{' '}
                      {challenge.mitigationTip}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Strategic Synergies */}
          {sustainabilityBriefing.synergies && sustainabilityBriefing.synergies.length > 0 && (
            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-gray-600 mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                Strategic Synergies
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sustainabilityBriefing.synergies.map((synergy, idx) => {
                  const mat1 = board.find((m) => m.id === synergy.pair[0]);
                  const mat2 = board.find((m) => m.id === synergy.pair[1]);
                  return (
                    <div
                      key={idx}
                      className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-xs text-gray-900">
                          {mat1?.name || synergy.pair[0]}
                        </span>
                        <ArrowRight className="w-3 h-3 text-amber-600" />
                        <span className="font-medium text-xs text-gray-900">
                          {mat2?.name || synergy.pair[1]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700">{synergy.explanation}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Specifier Checklist */}
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-gray-600 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              Specifier Checklist
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <ul className="space-y-2">
                {(() => {
                  const checklist: string[] = [];
                  const materialTypes = new Set(
                    board.map((m) => m.materialType).filter(Boolean)
                  );
                  const categories = new Set(board.map((m) => m.category));

                  if (
                    materialTypes.has('metal') ||
                    board.some((m) => m.id.includes('steel'))
                  ) {
                    checklist.push(
                      'Request EPD for recycled steel content (target: 85%+ recycled)'
                    );
                  }
                  if (
                    materialTypes.has('timber') ||
                    board.some(
                      (m) => m.id.includes('timber') || m.id.includes('wood')
                    )
                  ) {
                    checklist.push(
                      'Confirm FSC or PEFC certification for all timber products'
                    );
                  }
                  if (
                    materialTypes.has('concrete') ||
                    board.some((m) => m.id.includes('concrete'))
                  ) {
                    checklist.push(
                      'Specify GGBS/PFA cement replacement (target: 50%+ replacement)'
                    );
                  }
                  if (materialTypes.has('glass') || categories.has('window')) {
                    checklist.push(
                      'Verify glazing U-values meet or exceed building regs'
                    );
                  }
                  if (categories.has('insulation')) {
                    checklist.push(
                      'Compare embodied carbon of insulation options (natural vs synthetic)'
                    );
                  }
                  checklist.push('Collect EPDs for all major material categories');
                  checklist.push(
                    'Calculate transport distances for main structure materials'
                  );

                  return checklist.slice(0, 5).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-4 h-4 rounded border-2 border-blue-400 bg-white mt-0.5" />
                      <span className="text-xs text-gray-700">{item}</span>
                    </li>
                  ));
                })()}
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4 text-center">
            <p className="text-[10px] text-gray-500">
              Generated by MoodboardLab |{' '}
              {new Date().toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <p className="text-[9px] text-gray-400 mt-1">
              This briefing provides indicative guidance only. Verify all data with
              material-specific EPDs and certifications.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SustainabilityBriefingSection;
