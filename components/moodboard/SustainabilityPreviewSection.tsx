import React from 'react';
import { Loader2 } from 'lucide-react';

const REPORT_PREVIEW_INCLUDES = [
  'Comparative lifecycle dashboard',
  'Carbon dominance ranking',
  'System-level synergies and risks',
  'Design actions and alternatives',
  'Confidence and compliance notes',
];

const ASSESSMENT_NOTES = [
  'Relative lifecycle impacts across key stages',
  'Early-stage proxies, not product EPDs',
  'Separate models for industrial materials and landscape systems',
  'Benefits are not allowed to greenwash high-carbon items',
  'Full assumptions and confidence levels in the downloadable report',
];

interface SustainabilitySnapshot {
  summarySentence: string;
  highestImpact: string[];
  lowCarbonSystems: string[];
  actionPriorities: string[];
}

interface SustainabilityHighlight {
  id: string;
  title: string;
  line: string;
}

interface SustainabilityPreviewData {
  snapshot: SustainabilitySnapshot;
  highlights: SustainabilityHighlight[];
}

interface SustainabilityPreviewSectionProps {
  sustainabilityPreview: SustainabilityPreviewData;
  isBuildingFullReport: boolean;
  fullReportReady: boolean;
  summaryReportReady: boolean;
  materialFlagsOpen: boolean;
  setMaterialFlagsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  assessmentOpen: boolean;
  setAssessmentOpen: React.Dispatch<React.SetStateAction<boolean>>;
  exportingReport: boolean;
  exportingSummaryReport: boolean;
  onDownloadSummaryReport: () => void;
  onDownloadReport: () => void;
  onMobileSaveSummaryReport: () => void;
  onMobileSaveReport: () => void;
}

const SustainabilityPreviewSection: React.FC<SustainabilityPreviewSectionProps> = ({
  sustainabilityPreview,
  isBuildingFullReport,
  fullReportReady,
  summaryReportReady,
  materialFlagsOpen,
  setMaterialFlagsOpen,
  assessmentOpen,
  setAssessmentOpen,
  exportingReport,
  exportingSummaryReport,
  onDownloadSummaryReport,
  onDownloadReport,
  onMobileSaveSummaryReport,
  onMobileSaveReport,
}) => {
  return (
    <div className="border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
          Sustainability Insights (Preview)
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          {isBuildingFullReport
            ? 'Full report generating…'
            : fullReportReady
            ? 'Report ready'
            : 'Preview only'}
        </span>
      </div>
      <div className="p-4 space-y-6">
        <div className="space-y-2">
          <div className="font-display text-sm uppercase tracking-wide text-gray-900">
            Sustainability snapshot
          </div>
          <p className="font-sans text-sm text-gray-700">
            {sustainabilityPreview.snapshot.summarySentence}
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
              Highest impact items (early-stage estimate)
            </p>
            <p className="font-sans text-sm text-gray-800">
              {sustainabilityPreview.snapshot.highestImpact.length > 0
                ? sustainabilityPreview.snapshot.highestImpact.join(' • ')
                : 'No high-impact items flagged yet.'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
              Low-carbon systems
            </p>
            <p className="font-sans text-sm text-gray-800">
              {sustainabilityPreview.snapshot.lowCarbonSystems.length > 0
                ? sustainabilityPreview.snapshot.lowCarbonSystems.join(' • ')
                : 'No low-carbon systems identified yet.'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
              Where to act first
            </p>
            {sustainabilityPreview.snapshot.actionPriorities.length > 0 ? (
              <ul className="list-disc list-inside space-y-1">
                {sustainabilityPreview.snapshot.actionPriorities.map((item) => (
                  <li key={item} className="font-sans text-sm text-gray-800">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-sans text-sm text-gray-800">
                Prioritize refinements after reviewing the report.
              </p>
            )}
          </div>
        </div>

        <div className="border border-gray-200">
          <button
            onClick={() => setMaterialFlagsOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left"
          >
            <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
              Material highlights
            </span>
            <span className="font-mono text-xs text-gray-500">
              {materialFlagsOpen ? '−' : '+'}
            </span>
          </button>
          {materialFlagsOpen && (
            <div className="p-4 bg-white border-t border-gray-200 space-y-4">
              {sustainabilityPreview.highlights.length > 0 ? (
                sustainabilityPreview.highlights.map((highlight) => (
                  <div
                    key={highlight.id}
                    className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0"
                  >
                    <div className="font-display text-sm uppercase tracking-wide text-gray-900">
                      {highlight.title}
                    </div>
                    <p className="mt-2 font-sans text-sm text-gray-700">{highlight.line}</p>
                  </div>
                ))
              ) : (
                <p className="font-sans text-sm text-gray-700">
                  {isBuildingFullReport
                    ? 'Detailed highlights will appear when the full report finishes.'
                    : 'Detailed highlights are not available yet.'}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border border-gray-200">
          <button
            onClick={() => setAssessmentOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left"
          >
            <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
              How this is assessed
            </span>
            <span className="font-mono text-xs text-gray-500">
              {assessmentOpen ? '−' : '+'}
            </span>
          </button>
          {assessmentOpen && (
            <div className="p-4 bg-white border-t border-gray-200">
              <ul className="list-disc list-inside space-y-1">
                {ASSESSMENT_NOTES.map((note) => (
                  <li key={note} className="font-sans text-sm text-gray-700">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
            What the full report includes
          </div>
          <ul className="list-disc list-inside space-y-1">
            {REPORT_PREVIEW_INCLUDES.map((item) => (
              <li key={item} className="font-sans text-sm text-gray-700">
                {item}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onDownloadSummaryReport}
              disabled={!summaryReportReady || exportingSummaryReport}
              className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 disabled:bg-gray-300 disabled:border-gray-300"
            >
              {exportingSummaryReport ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Building summary...
                </>
              ) : (
                'Download summary (1-page PDF)'
              )}
            </button>
            <button
              onClick={onDownloadReport}
              disabled={!fullReportReady || exportingReport}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500"
            >
              {exportingReport ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Building report...
                </>
              ) : (
                'Download full report (PDF)'
              )}
            </button>
            <button
              onClick={onMobileSaveSummaryReport}
              disabled={!summaryReportReady || exportingSummaryReport}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black lg:hidden disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500"
            >
              {exportingSummaryReport ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save summary (PDF)'
              )}
            </button>
            <button
              onClick={onMobileSaveReport}
              disabled={!fullReportReady || exportingReport}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-900 font-mono text-[11px] uppercase tracking-widest hover:border-black lg:hidden disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500"
            >
              {exportingReport ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save full report (PDF)'
              )}
            </button>
          </div>
          {!fullReportReady && (
            <p className="font-sans text-sm text-gray-700">
              {isBuildingFullReport
                ? 'Full report download unlocks automatically when generation completes.'
                : 'Run full sustainability analysis to unlock the full report download.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SustainabilityPreviewSection;
