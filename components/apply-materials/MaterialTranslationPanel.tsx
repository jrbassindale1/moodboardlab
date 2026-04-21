import {
  CheckCircle2,
  CircleDashed,
  CircleOff,
  Compass,
  Download,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import type {
  MaterialAlignmentItem,
  MaterialAlignmentStrength,
  MaterialTranslationResult,
  MaterialTranslationStatus,
} from "../../types/materialTranslation";
import MaterialSystemCard from "./MaterialSystemCard";

interface MaterialTranslationPanelProps {
  isOpen: boolean;
  status: MaterialTranslationStatus;
  result: MaterialTranslationResult | null;
  error: string | null;
  createdAt: string | null;
  isDownloadingPdf: boolean;
  onClose: () => void;
  onReanalyse: () => void;
  onDownloadPdf: () => void;
}

const confidenceTone: Record<MaterialTranslationResult["summary"]["confidence"], string> = {
  low: "bg-amber-50 border-amber-200 text-amber-700",
  medium: "bg-blue-50 border-blue-200 text-blue-700",
  high: "bg-emerald-50 border-emerald-200 text-emerald-700",
};

const alignmentTone: Record<MaterialAlignmentStrength, string> = {
  strong: "border-emerald-200 bg-emerald-50",
  partial: "border-blue-200 bg-blue-50",
  weak: "border-gray-200 bg-gray-50",
};

const formatTimestamp = (value: string | null): string | null => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toLocaleString();
};

const inferStrengthFromRelationship = (value: string): MaterialAlignmentStrength => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "direct") return "strong";
  if (normalized === "adjacent" || normalized === "contrast") return "partial";
  return "weak";
};

const deriveAlignmentFallback = (result: MaterialTranslationResult): MaterialAlignmentItem[] => {
  const fromPaletteReferences = result.systems
    .flatMap((system) => (Array.isArray(system.paletteReferences) ? system.paletteReferences : []))
    .map((reference) => ({
      materialId: reference.materialId,
      name: reference.name,
      strength: inferStrengthFromRelationship(reference.relationship),
      reason: reference.note || "Linked from legacy system mapping.",
    }))
    .filter((item) => item.name);

  if (fromPaletteReferences.length > 0) {
    return fromPaletteReferences;
  }

  const fromLinkedMaterials = result.systems
    .flatMap((system) => (Array.isArray(system.linkedMaterials) ? system.linkedMaterials : []))
    .map((name) => ({
      materialId: null,
      name,
      strength: "partial" as const,
      reason: "Linked to a system in this saved analysis.",
    }))
    .filter((item) => item.name);

  return fromLinkedMaterials;
};

const dedupeAlignment = (items: MaterialAlignmentItem[]): MaterialAlignmentItem[] => {
  const map = new Map<string, MaterialAlignmentItem>();
  const rank = { strong: 3, partial: 2, weak: 1 } as const;

  for (const item of items) {
    const key = String(item.name || "").toLowerCase().trim();
    if (!key) continue;

    const existing = map.get(key);
    if (!existing || rank[item.strength] > rank[existing.strength]) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
};

const groupAlignment = (items: MaterialAlignmentItem[]): Record<MaterialAlignmentStrength, MaterialAlignmentItem[]> => {
  const deduped = dedupeAlignment(items);
  return {
    strong: deduped.filter((item) => item.strength === "strong"),
    partial: deduped.filter((item) => item.strength === "partial"),
    weak: deduped.filter((item) => item.strength === "weak"),
  };
};

const groupMeta: Array<{
  key: MaterialAlignmentStrength;
  label: string;
  icon: typeof CheckCircle2;
}> = [
  { key: "strong", label: "Strong", icon: CheckCircle2 },
  { key: "partial", label: "Partial", icon: CircleDashed },
  { key: "weak", label: "Weak", icon: CircleOff },
];

const MaterialTranslationPanel = ({
  isOpen,
  status,
  result,
  error,
  createdAt,
  isDownloadingPdf,
  onClose,
  onReanalyse,
  onDownloadPdf,
}: MaterialTranslationPanelProps) => {
  if (!isOpen) return null;

  const formattedTime = formatTimestamp(createdAt);
  const isLoading = status === "loading";
  const alignmentItems = result
    ? Array.isArray(result.materialAlignment) && result.materialAlignment.length > 0
      ? result.materialAlignment
      : deriveAlignmentFallback(result)
    : [];
  const alignmentGroups = groupAlignment(alignmentItems);

  return (
    <section className="border border-gray-200 bg-white shadow-sm p-4 sm:p-5 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-display text-2xl uppercase tracking-tight text-black flex items-center gap-2">
            <Compass className="w-5 h-5 text-gray-600" />
            Specification pathways
          </h3>
          <p className="text-sm text-gray-600">
            Concise architectural decision support from render evidence and selected materials.
          </p>
          {formattedTime && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
              Last analysed: {formattedTime}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 font-mono text-[10px] uppercase tracking-widest hover:border-black hover:text-black"
        >
          <X className="w-3.5 h-3.5" />
          Back To Render
        </button>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking material alignment and key system routes...
        </div>
      )}

      {!isLoading && error && (
        <div className="space-y-3 border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={onReanalyse}
            className="inline-flex items-center gap-2 px-3 py-2 border border-red-300 bg-white text-red-700 font-mono text-[10px] uppercase tracking-widest hover:border-red-500"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-analyse
          </button>
        </div>
      )}

      {!isLoading && result && (
        <>
          <div className="space-y-3 border border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50 p-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Intent</p>
              <span
                className={`px-2 py-0.5 border font-mono text-[10px] uppercase tracking-widest ${
                  confidenceTone[result.summary.confidence]
                }`}
              >
                Confidence: {result.summary.confidence}
              </span>
            </div>
            <p className="text-sm text-gray-800">{result.summary.overallIntent}</p>
            <p className="text-xs text-gray-600">{result.summary.disclaimer}</p>
          </div>

          <section className="space-y-3 border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display text-lg uppercase tracking-tight text-black">Material Alignment</h4>
              <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                Image vs selected list
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {groupMeta.map((group) => {
                const Icon = group.icon;
                const items = alignmentGroups[group.key];
                return (
                  <div key={group.key} className={`border p-3 space-y-2 ${alignmentTone[group.key]}`}>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600 flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" />
                      {group.label}
                    </p>
                    {items.length === 0 ? (
                      <p className="text-xs text-gray-600">No items.</p>
                    ) : (
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={`${group.key}-${item.materialId || item.name}`}
                            className="border border-white/70 bg-white px-2.5 py-2 space-y-1"
                          >
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-700">{item.reason}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="space-y-4">
            {result.systems.slice(0, 4).map((system) => (
              <MaterialSystemCard key={system.id} system={system} />
            ))}
          </div>

          <footer className="space-y-3 border border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50 p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Reality check</p>
            <ul className="space-y-2">
              {result.realityCheck.slice(0, 3).map((item, index) => (
                <li
                  key={`reality-check-${index}`}
                  className="border border-gray-100 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onDownloadPdf}
                disabled={isDownloadingPdf}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 bg-white text-gray-700 font-mono text-[10px] uppercase tracking-widest hover:border-black hover:text-black disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300"
              >
                {isDownloadingPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Preparing PDF
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </>
                )}
              </button>
              <button
                onClick={onReanalyse}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 bg-white text-gray-700 font-mono text-[10px] uppercase tracking-widest hover:border-black hover:text-black"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-analyse
              </button>
            </div>
          </footer>
        </>
      )}

      {!isLoading && !error && !result && (
        <div className="space-y-3 border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-700">No translation has been created for this render yet.</p>
          <button
            onClick={onReanalyse}
            className="inline-flex items-center gap-2 px-3 py-2 border border-black bg-black text-white font-mono text-[10px] uppercase tracking-widest hover:bg-gray-900"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Specification pathways
          </button>
        </div>
      )}
    </section>
  );
};

export default MaterialTranslationPanel;
