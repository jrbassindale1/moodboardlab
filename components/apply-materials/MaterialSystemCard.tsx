import React from "react";
import { ArrowUpRight, Layers, TriangleAlert } from "lucide-react";
import type { CarbonSignal, CostBand, MaterialSystem, SupplierLink } from "../../types/materialTranslation";

interface MaterialSystemCardProps {
  system: MaterialSystem;
}

const evidenceTone: Record<"high" | "medium" | "low", string> = {
  high: "bg-emerald-50 border-emerald-200 text-emerald-700",
  medium: "bg-blue-50 border-blue-200 text-blue-700",
  low: "bg-amber-50 border-amber-200 text-amber-700",
};

const pickFirst = (...values: Array<string | undefined | null>): string => {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
};

const collectLegacySuppliers = (system: MaterialSystem): SupplierLink[] => {
  const suppliers: SupplierLink[] = [];

  if (Array.isArray(system.recommendedPathway?.manufacturers)) {
    suppliers.push(...system.recommendedPathway.manufacturers);
  }
  if (Array.isArray(system.alternativePathway?.manufacturers)) {
    suppliers.push(...system.alternativePathway.manufacturers);
  }
  if (Array.isArray(system.buildableOptions)) {
    for (const option of system.buildableOptions.slice(0, 2)) {
      if (Array.isArray(option.manufacturers)) {
        suppliers.push(...option.manufacturers);
      }
    }
  }

  const deduped = new Map<string, SupplierLink>();
  for (const supplier of suppliers) {
    const name = String(supplier?.name || "").trim();
    const url = String(supplier?.url || "").trim();
    if (!name || !url) continue;

    const key = `${name.toLowerCase()}|${url.toLowerCase()}`;
    if (!deduped.has(key)) {
      deduped.set(key, { name, url });
    }
  }

  return Array.from(deduped.values()).slice(0, 3);
};

const resolveSuppliers = (system: MaterialSystem): SupplierLink[] => {
  const current = Array.isArray(system.possibleSuppliers)
    ? system.possibleSuppliers
        .map((supplier) => ({
          name: String(supplier?.name || "").trim(),
          url: String(supplier?.url || "").trim(),
        }))
        .filter((supplier) => supplier.name && supplier.url)
        .slice(0, 3)
    : [];

  if (current.length > 0) return current;
  return collectLegacySuppliers(system);
};

const resolveCostBand = (system: MaterialSystem): CostBand | null => {
  const current = system.costBand;
  if (current && current !== "unknown") return current;

  if (system.recommendedPathway?.costBand) return system.recommendedPathway.costBand;
  if (Array.isArray(system.buildableOptions) && system.buildableOptions[0]?.costBand) {
    return system.buildableOptions[0].costBand;
  }

  return null;
};

const resolveCarbonSignal = (system: MaterialSystem): CarbonSignal | null => {
  const current = system.carbonSignal;
  if (current && current !== "unknown") return current;

  if (system.recommendedPathway?.carbonSignal && system.recommendedPathway.carbonSignal !== "unknown") {
    return system.recommendedPathway.carbonSignal;
  }
  if (Array.isArray(system.buildableOptions) && system.buildableOptions[0]?.carbonSignal && system.buildableOptions[0].carbonSignal !== "unknown") {
    return system.buildableOptions[0].carbonSignal;
  }

  return null;
};

const MaterialSystemCard: React.FC<MaterialSystemCardProps> = ({ system }) => {
  const evidenceStrength = system.evidenceStrength || "medium";

  const readsAs = pickFirst(
    system.readsAs,
    system.whyThisReadsThisWay,
    system.visualIntent,
    system.likelySystem,
    "Likely system intent inferred from render evidence."
  );

  const likelyRoute = pickFirst(
    system.likelyRoute,
    system.recommendedPathway?.name,
    system.likelySystem,
    system.buildableOptions?.[0]?.name,
    "Likely route requires project-specific validation."
  );

  const alternative = pickFirst(
    system.alternative,
    system.alternativePathway?.name,
    system.buildableOptions?.[1]?.name,
    system.buildableOptions?.[0]?.name,
    "Alternative route to test against programme and buildability priorities."
  );

  const watchOut = pickFirst(
    system.watchOut,
    system.risks?.[0],
    system.designNote,
    system.tradeOff,
    "Check interfaces, movement, fire, and drainage strategy before route lock-in."
  );

  const suppliers = resolveSuppliers(system);
  const showSuppliers = evidenceStrength !== "low" && suppliers.length > 0;
  const costBand = resolveCostBand(system);
  const carbonSignal = resolveCarbonSignal(system);

  return (
    <article className="border border-gray-200 bg-white shadow-sm p-4 sm:p-5 space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Key System</p>
          <span
            className={`px-2 py-0.5 border font-mono text-[10px] uppercase tracking-widest ${
              evidenceTone[evidenceStrength]
            }`}
          >
            Evidence: {evidenceStrength}
          </span>
        </div>
        <h4 className="font-display text-lg uppercase tracking-tight text-black flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-500" />
          {system.category}
        </h4>
      </header>

      <div className="space-y-3">
        <div className="border border-gray-100 bg-gray-50 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1">Reads as</p>
          <p className="text-sm text-gray-800">{readsAs}</p>
        </div>

        <div className="border border-gray-100 bg-gray-50 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Likely route</p>
            <div className="flex flex-wrap gap-2">
              {costBand && (
                <span className="px-2 py-0.5 border border-gray-200 bg-white text-[10px] uppercase tracking-widest text-gray-600">
                  Cost: {costBand}
                </span>
              )}
              {carbonSignal && (
                <span className="px-2 py-0.5 border border-gray-200 bg-white text-[10px] uppercase tracking-widest text-gray-600">
                  Carbon: {carbonSignal}
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-800">{likelyRoute}</p>
        </div>

        <div className="border border-gray-100 bg-gray-50 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1">Alternative</p>
          <p className="text-sm text-gray-800">{alternative}</p>
        </div>

        <div className="border border-amber-100 bg-amber-50 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700 mb-1 flex items-center gap-1.5">
            <TriangleAlert className="w-3.5 h-3.5" />
            Watch-out
          </p>
          <p className="text-sm text-amber-900">{watchOut}</p>
        </div>

        {showSuppliers && (
          <div className="space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
              Possible suppliers
            </p>
            <div className="flex flex-wrap gap-2">
              {suppliers.map((supplier) => (
                <a
                  key={`${supplier.name}-${supplier.url}`}
                  href={supplier.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${supplier.name} (opens in a new tab)`}
                  title="Opens in a new tab"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-gray-300 bg-white text-xs text-gray-700 hover:border-black hover:text-black transition-colors"
                >
                  {supplier.name}
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
};

export default MaterialSystemCard;
