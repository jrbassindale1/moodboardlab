import type { MaterialOption, MaterialCategory, MaterialFunction } from '../types';
import lifecycleProfilesData from './lifecycleProfiles.json';
import lifecycleInsightsData from './lifecycleInsights.json';
import specificationActionsData from './specificationActions.json';
import healthToxicityData from './healthToxicity.json';
import materialDurationsData from './materialDurations.json';
import materialRisksData from './materialRisks.json';

export type MaterialSystemRole = 'Structure' | 'Envelope' | 'Openings' | 'Finishes' | 'Landscape';
export type DataConfidence = 'High' | 'Medium' | 'Low';
export type EpdStatus = 'Yes' | 'No' | 'Unknown';

export type MaterialLifecycleStage =
  | 'raw'
  | 'manufacturing'
  | 'transport'
  | 'installation'
  | 'inUse'
  | 'maintenance'
  | 'endOfLife';

type LifecycleStageData = { impact: 1 | 2 | 3 | 4 | 5; confidence: 'high' | 'medium' | 'low' };
type LifecycleProfile = Record<MaterialLifecycleStage, LifecycleStageData>;

export interface MaterialLifecycleSnapshot {
  scores: Record<MaterialLifecycleStage, number>;
  hotspots: MaterialLifecycleStage[];
  strengths: MaterialLifecycleStage[];
}

export interface MaterialFact {
  id: string;
  name: string;
  systemRole: MaterialSystemRole;
  formVariant: string;
  whatItIs: string;
  typicalUses: string[];
  performanceNote: string;
  lifecycle: MaterialLifecycleSnapshot;
  carbonIntensity: 'low' | 'medium' | 'high';
  insight: string;
  actions: string[];
  dataConfidence: DataConfidence;
  epdStatus: EpdStatus;
  alternatives?: string[];
  circularityNote?: string;
  healthRiskLevel?: 'low' | 'medium' | 'high';
  healthConcerns?: string[];
  healthNote?: string;
  localityFlag?: string;
  serviceLife?: number;
  risks?: { risk: string; mitigation: string }[];
}

type MaterialFactOverride = Partial<Omit<MaterialFact, 'lifecycle'>> & {
  lifecycle?: Partial<MaterialLifecycleSnapshot> & {
    scores?: Partial<Record<MaterialLifecycleStage, number>>;
  };
};

const STAGE_ORDER: MaterialLifecycleStage[] = [
  'raw',
  'manufacturing',
  'transport',
  'installation',
  'inUse',
  'maintenance',
  'endOfLife',
];

const STAGE_LABELS: Record<MaterialLifecycleStage, string> = {
  raw: 'Raw Materials',
  manufacturing: 'Manufacturing',
  transport: 'Transport',
  installation: 'Installation',
  inUse: 'In Use',
  maintenance: 'Maintenance',
  endOfLife: 'End of Life',
};

const STAGE_ACTIONS: Record<MaterialLifecycleStage, string> = {
  raw: 'responsible sourcing and recycled content',
  manufacturing: 'low-carbon manufacturing and verified EPDs',
  transport: 'shorter transport distances and optimized logistics',
  installation: 'prefabrication and reduced site waste',
  inUse: 'efficient operation and commissioning',
  maintenance: 'durable finishes and longer maintenance cycles',
  endOfLife: 'design for disassembly and material recovery',
};

const SYSTEM_ROLE_BY_CATEGORY: Record<MaterialCategory, MaterialSystemRole> = {
  structure: 'Structure',
  'exposed-structure': 'Structure',
  external: 'Envelope',
  roof: 'Envelope',
  soffit: 'Envelope',
  insulation: 'Envelope',
  window: 'Openings',
  door: 'Openings',
  balustrade: 'Openings',
  landscape: 'Landscape',
  'external-ground': 'Landscape',
  floor: 'Finishes',
  finish: 'Finishes',
  'wall-internal': 'Finishes',
  ceiling: 'Finishes',
  'paint-wall': 'Finishes',
  'paint-ceiling': 'Finishes',
  plaster: 'Finishes',
  microcement: 'Finishes',
  'timber-panel': 'Finishes',
  tile: 'Finishes',
  wallpaper: 'Finishes',
  'acoustic-panel': 'Finishes',
  'timber-slat': 'Finishes',
  joinery: 'Finishes',
  fixture: 'Finishes',
  furniture: 'Finishes',
};

const TYPICAL_USES_BY_CATEGORY: Record<MaterialCategory, string[]> = {
  structure: ['Primary frame', 'Long-span elements', 'Load-bearing supports'],
  'exposed-structure': ['Primary frame', 'Expressed structure', 'Long-span elements'],
  floor: ['Primary flooring', 'High-traffic circulation', 'Work areas'],
  finish: ['Interior wall finish', 'Feature surfaces', 'General fit-out'],
  'wall-internal': ['Partition linings', 'Feature walls', 'Back-of-house walls'],
  external: ['Facade cladding', 'Weather protection', 'External accents'],
  soffit: ['Underside linings', 'External canopies', 'Service soffits'],
  ceiling: ['Interior ceilings', 'Acoustic control', 'Service zones'],
  window: ['Glazing systems', 'Daylight openings', 'Thermal envelope'],
  roof: ['Roof coverings', 'Waterproofing layer', 'Weather protection'],
  'paint-wall': ['Internal wall coating', 'Light-reflective surfaces', 'Easy refresh'],
  'paint-ceiling': ['Ceiling coating', 'Light-reflective surfaces', 'Easy refresh'],
  plaster: ['Interior wall finish', 'Breathable coatings', 'Repairable surfaces'],
  microcement: ['Seamless interior finish', 'Wet areas', 'Low-build overlays'],
  'timber-panel': ['Interior wall cladding', 'Warm feature panels', 'Lobby accents'],
  tile: ['Wet areas', 'Durable floors', 'Wall tiling'],
  wallpaper: ['Feature walls', 'Brand graphics', 'Low-contact zones'],
  'acoustic-panel': ['Acoustic absorption', 'Meeting rooms', 'Open-plan ceilings'],
  'timber-slat': ['Acoustic feature walls', 'Ceiling baffles', 'Screening elements'],
  joinery: ['Built-in cabinetry', 'Storage walls', 'Custom millwork'],
  fixture: ['Hardware & fittings', 'Bathroom/kitchen fixtures', 'Accessories'],
  landscape: ['Planting systems', 'Biodiversity zones', 'Outdoor amenity'],
  'external-ground': ['Paths & paving', 'Public realm surfaces', 'Permeable groundworks'],
  insulation: ['Thermal envelope', 'Roof/wall cavities', 'Airtightness layers'],
  door: ['Internal doors', 'Entrance doors', 'Fire-rated partitions'],
  balustrade: ['Guardrails', 'Stair edges', 'Balcony safety'],
  furniture: ['Loose furniture', 'Workspace fittings', 'Soft seating'],
};

const PERFORMANCE_NOTE_BY_CATEGORY: Partial<Record<MaterialCategory, string>> = {
  structure: 'High load-bearing capacity for primary frame.',
  'exposed-structure': 'Structural capacity with an exposed finish.',
  external: 'Weather-resistant finish for facade exposure.',
  roof: 'High durability in wet exposure and wind uplift.',
  window: 'Supports daylight and thermal performance of the envelope.',
  insulation: 'Good thermal resistance with reduced heat loss.',
  'acoustic-panel': 'Improves sound absorption and reverberation control.',
  'timber-slat': 'Provides acoustic diffusion and visual warmth.',
  floor: 'Hard-wearing surface for high footfall.',
  'paint-wall': 'Easy refresh cycles for wall finishes.',
  'paint-ceiling': 'High light reflectance for ceilings.',
  microcement: 'Seamless, low-build finish for wet areas.',
  plaster: 'Breathable finish with easy patch repair.',
  door: 'Provides access control and fire separation.',
  balustrade: 'Guarding performance for edges and stairs.',
  landscape: 'Supports biodiversity and surface water management.',
  'external-ground': 'Durable external surface with slip resistance.',
};

const PERFORMANCE_NOTE_BY_FUNCTION: Record<MaterialFunction, string> = {
  insulation: 'Good thermal resistance and reduced heat loss.',
  weatherproofing: 'High durability in wet exposure.',
  acoustic: 'Supports sound absorption and acoustic comfort.',
  structural: 'High load-bearing capacity for primary structure.',
  surface: 'Durable surface for daily wear.',
  decorative: 'Adds visual texture and character.',
};

const DEFAULT_LIFECYCLE_SCORES: Record<MaterialLifecycleStage, number> = {
  raw: 3,
  manufacturing: 3,
  transport: 2,
  installation: 2,
  inUse: 1,
  maintenance: 2,
  endOfLife: 2,
};

const lifecycleProfiles = (lifecycleProfilesData as { profiles: Record<string, LifecycleProfile> })
  .profiles;

const lifecycleInsights = (lifecycleInsightsData as { insights: Record<string, string> }).insights;

const specificationActions = (specificationActionsData as { actions: Record<string, string[]> }).actions;

type HealthRiskLevel = 'low' | 'medium' | 'high';
type HealthConcern = 'vocs' | 'formaldehyde' | 'fibres' | 'phthalates' | 'flame-retardants' | 'isocyanates' | 'lead' | 'chromium' | 'radon' | 'lead-paint' | 'treatments' | 'preservatives' | 'fire-retardants' | 'moth-treatments' | 'binders' | 'odour' | 'dust' | 'biocides' | 'pahs' | 'bpa' | 'fire';
type HealthDataEntry = { riskLevel: HealthRiskLevel; concerns: HealthConcern[]; note: string };
const healthToxicity = (healthToxicityData as { healthData: Record<string, HealthDataEntry> }).healthData;

type DurationOverride = {
  id: string;
  pattern: string;
  patternFlags?: string;
  categories?: string[];
  duration: {
    serviceLife: number;
    replacementCycle?: number;
    notes?: string;
  };
};
const materialDurations = (materialDurationsData as { overrides: DurationOverride[] }).overrides;

type RiskEntry = { risk: string; mitigation: string };
const materialRisks = (materialRisksData as { risks: Record<string, RiskEntry[]> }).risks;

// Optional per-material overrides for hand-curated fact sheets.
const MATERIAL_FACT_OVERRIDES: Record<string, MaterialFactOverride> = {};

const sentenceSplit = (value: string): string[] => {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const matches = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return matches ? matches.map((entry) => entry.trim()) : [trimmed];
};

const toTitleCase = (value: string) =>
  value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const clampWords = (value: string, maxWords = 6) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(' ');

const cleanVariant = (value: string): string => {
  const cleaned = value.replace(/^finish[:\s-]*/i, '').trim();
  const firstClause = cleaned.split(/[.;]/)[0]?.trim() || cleaned;
  const withoutColor = firstClause.replace(/\s*—\s*select.*$/i, '').trim();
  return withoutColor || cleaned;
};

const getLifecycleScores = (material: MaterialOption): Record<MaterialLifecycleStage, number> => {
  const profile = lifecycleProfiles[material.id];
  if (profile) {
    return {
      raw: profile.raw?.impact ?? DEFAULT_LIFECYCLE_SCORES.raw,
      manufacturing: profile.manufacturing?.impact ?? DEFAULT_LIFECYCLE_SCORES.manufacturing,
      transport: profile.transport?.impact ?? DEFAULT_LIFECYCLE_SCORES.transport,
      installation: profile.installation?.impact ?? DEFAULT_LIFECYCLE_SCORES.installation,
      inUse: profile.inUse?.impact ?? DEFAULT_LIFECYCLE_SCORES.inUse,
      maintenance: profile.maintenance?.impact ?? DEFAULT_LIFECYCLE_SCORES.maintenance,
      endOfLife: profile.endOfLife?.impact ?? DEFAULT_LIFECYCLE_SCORES.endOfLife,
    };
  }

  const intensityMultiplier =
    material.carbonIntensity === 'high'
      ? 1.3
      : material.carbonIntensity === 'low'
      ? 0.7
      : 1.0;

  return {
    raw: Math.round(DEFAULT_LIFECYCLE_SCORES.raw * intensityMultiplier),
    manufacturing: Math.round(DEFAULT_LIFECYCLE_SCORES.manufacturing * intensityMultiplier),
    transport: DEFAULT_LIFECYCLE_SCORES.transport,
    installation: DEFAULT_LIFECYCLE_SCORES.installation,
    inUse: DEFAULT_LIFECYCLE_SCORES.inUse,
    maintenance: DEFAULT_LIFECYCLE_SCORES.maintenance,
    endOfLife: DEFAULT_LIFECYCLE_SCORES.endOfLife,
  };
};

const getDataConfidence = (material: MaterialOption): DataConfidence => {
  const profile = lifecycleProfiles[material.id];
  if (!profile) return 'Medium';
  const confidences = [
    profile.raw?.confidence,
    profile.manufacturing?.confidence,
    profile.transport?.confidence,
    profile.installation?.confidence,
    profile.inUse?.confidence,
    profile.maintenance?.confidence,
    profile.endOfLife?.confidence,
  ];
  if (confidences.includes('low')) return 'Low';
  if (confidences.includes('medium')) return 'Medium';
  return 'High';
};

const pickStages = (
  scores: Record<MaterialLifecycleStage, number>,
  count: number,
  direction: 'desc' | 'asc'
): MaterialLifecycleStage[] => {
  const entries = Object.entries(scores) as [MaterialLifecycleStage, number][];
  const order = direction === 'desc' ? -1 : 1;
  return entries
    .sort((a, b) => {
      if (a[1] === b[1]) {
        return STAGE_ORDER.indexOf(a[0]) - STAGE_ORDER.indexOf(b[0]);
      }
      return (a[1] - b[1]) * order;
    })
    .slice(0, count)
    .map(([key]) => key);
};

const getSystemRole = (category: MaterialCategory): MaterialSystemRole =>
  SYSTEM_ROLE_BY_CATEGORY[category] || 'Finishes';

const getTypicalUses = (category: MaterialCategory): string[] =>
  (TYPICAL_USES_BY_CATEGORY[category] || ['General fit-out', 'Interior surfaces', 'Supporting elements']).slice(0, 3);

const getPerformanceNote = (material: MaterialOption): string => {
  const categoryNote = PERFORMANCE_NOTE_BY_CATEGORY[material.category];
  if (categoryNote) return categoryNote;

  const functions = material.materialFunction ?? [];
  const priority: MaterialFunction[] = [
    'insulation',
    'weatherproofing',
    'acoustic',
    'structural',
    'surface',
    'decorative',
  ];
  for (const fn of priority) {
    if (functions.includes(fn)) {
      return PERFORMANCE_NOTE_BY_FUNCTION[fn];
    }
  }

  return 'Reliable base material performance for its system role.';
};

const getSpecActions = (material: MaterialOption): string[] => {
  // First, check for material-specific actions in JSON
  const jsonActions = specificationActions[material.id];
  if (jsonActions && jsonActions.length > 0) {
    return jsonActions.slice(0, 3);
  }

  // Fallback to generated actions based on material type/category
  const actions: string[] = [];
  const id = material.id.toLowerCase();
  const materialType = material.materialType;
  const category = material.category;

  if (materialType === 'metal' || id.includes('steel')) {
    actions.push('Request EPD for recycled steel content (target: 85%+ recycled)');
    actions.push('Verify steel supplier uses electric arc furnace (EAF) production');
  }
  if (materialType === 'timber' || id.includes('timber') || id.includes('wood')) {
    actions.push('Confirm FSC or PEFC certification for all timber products.');
    actions.push('Request chain-of-custody documentation from supplier.');
  }
  if (materialType === 'concrete' || id.includes('concrete')) {
    actions.push('Specify GGBS/PFA cement replacement (target: 50%+ replacement)');
    actions.push('Request EPD showing embodied carbon per m3');
  }
  if (materialType === 'glass' || category === 'window') {
    actions.push('Verify glazing U-values meet or exceed building regs');
    actions.push('Consider specifying higher recycled glass content');
  }
  if (category === 'insulation') {
    actions.push('Compare embodied carbon of insulation options (natural vs synthetic)');
    actions.push('Request blowing agent GWP values for foam insulation');
  }

  const fallback = [
    'Collect EPDs for major material categories',
    'Calculate transport distances for primary materials',
    'Document material reuse or reclaimed content percentages',
  ];

  fallback.forEach((item) => {
    if (actions.length < 3) actions.push(item);
  });

  return actions.slice(0, 3);
};

const getEpdStatus = (material: MaterialOption): EpdStatus => {
  const tokens = [...(material.keywords ?? []), ...(material.tags ?? [])]
    .join(' ')
    .toLowerCase();
  if (/no\s+epd|unverified/.test(tokens)) return 'No';
  if (/epd|environmental product declaration/.test(tokens)) return 'Yes';
  return 'Unknown';
};

const getServiceLife = (material: MaterialOption): number | undefined => {
  const nameAndId = `${material.id} ${material.name}`.toLowerCase();

  for (const override of materialDurations) {
    // Check category match if specified
    if (override.categories && override.categories.length > 0) {
      if (!override.categories.includes(material.category)) {
        continue;
      }
    }

    // Check pattern match
    const flags = override.patternFlags || 'i';
    const regex = new RegExp(override.pattern, flags);
    if (regex.test(nameAndId)) {
      return override.duration.serviceLife;
    }
  }

  // Default service life by category
  const categoryDefaults: Partial<Record<MaterialCategory, number>> = {
    structure: 60,
    'exposed-structure': 60,
    external: 40,
    roof: 40,
    window: 30,
    floor: 25,
    'wall-internal': 30,
    ceiling: 30,
    'paint-wall': 10,
    'paint-ceiling': 12,
    landscape: 30,
    insulation: 60,
  };

  return categoryDefaults[material.category];
};

const getFormVariant = (material: MaterialOption): string => {
  if (material.finish) return cleanVariant(material.finish);
  if (material.materialForm && material.materialForm.length > 0) {
    const form = material.materialForm[0];
    const base = material.materialType ? toTitleCase(material.materialType) : 'Material';
    return `${base} ${form}`;
  }
  return material.name;
};

const buildInsightSentence = (
  hotspots: MaterialLifecycleStage[],
  strengths: MaterialLifecycleStage[]
): string => {
  const hotspotLabels = hotspots.map((key) => STAGE_LABELS[key]);
  const strengthLabels = strengths.map((key) => STAGE_LABELS[key]);

  const summary = `Hotspots: ${hotspotLabels.join(', ')}. Strengths: ${strengthLabels.join(', ')}.`;
  const primaryHotspot = hotspots[0];
  const action = primaryHotspot ? STAGE_ACTIONS[primaryHotspot] : 'targeted specification';
  const primaryLabel = primaryHotspot ? STAGE_LABELS[primaryHotspot].toLowerCase() : 'lifecycle';
  const actionSentence = `Main hotspot is ${primaryLabel}; reduce via ${action}.`;

  return `${summary} ${actionSentence}`.trim();
};

const applyOverrides = (fact: MaterialFact, override?: MaterialFactOverride): MaterialFact => {
  if (!override) return fact;
  const lifecycleOverride = override.lifecycle;
  return {
    ...fact,
    ...override,
    lifecycle: {
      ...fact.lifecycle,
      ...(lifecycleOverride || {}),
      scores: {
        ...fact.lifecycle.scores,
        ...(lifecycleOverride?.scores || {}),
      },
    },
  };
};

export function buildMaterialFact(material: MaterialOption): MaterialFact {
  const textSource = (material.customDescription || material.description || '').trim();
  const sentences = sentenceSplit(textSource);
  const whatItIs = sentences[0] || material.name;

  const scores = getLifecycleScores(material);
  const hotspots = pickStages(scores, 2, 'desc');
  const strengths = pickStages(scores, 2, 'asc');

  const fact: MaterialFact = {
    id: material.id,
    name: material.name,
    systemRole: getSystemRole(material.category),
    formVariant: clampWords(getFormVariant(material), 7),
    whatItIs,
    typicalUses: getTypicalUses(material.category),
    performanceNote: getPerformanceNote(material),
    lifecycle: {
      scores,
      hotspots,
      strengths,
    },
    carbonIntensity: material.carbonIntensity ?? 'medium',
    insight: lifecycleInsights[material.id] || buildInsightSentence(hotspots, strengths),
    actions: getSpecActions(material),
    dataConfidence: getDataConfidence(material),
    epdStatus: getEpdStatus(material),
    healthRiskLevel: healthToxicity[material.id]?.riskLevel,
    healthConcerns: healthToxicity[material.id]?.concerns,
    healthNote: healthToxicity[material.id]?.note,
    serviceLife: getServiceLife(material),
    risks: materialRisks[material.id],
  };

  return applyOverrides(fact, MATERIAL_FACT_OVERRIDES[material.id]);
}
