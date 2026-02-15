/**
 * Sustainability Briefing Utilities
 * Prepares material data for Gemini API analysis and processes the response
 */

import type { MaterialOption } from '../types';
import { getLifecycleProfile } from '../data';
import synergyPairsData from '../data/synergyPairs.json';

// Types for Sustainability Briefing

export interface MaterialBriefingData {
  id: string;
  name: string;
  carbonIntensity: 'low' | 'medium' | 'high';
  materialType?: string;
  category: string;
  lifecycleScores: {
    raw: number;
    manufacturing: number;
    transport: number;
    installation: number;
    inUse: number;
    maintenance: number;
    endOfLife: number;
  };
  totalScore: number;
  strategicValue?: string; // Pre-stored value for low-carbon materials
  mitigationTip?: string; // Pre-stored tip for high-carbon materials
}

export interface SynergyPair {
  materials: [string, string];
  explanation: string;
}

export interface SustainabilityBriefingPayload {
  materials: MaterialBriefingData[];
  averageScores: {
    raw: number;
    manufacturing: number;
    transport: number;
    installation: number;
    inUse: number;
    maintenance: number;
    endOfLife: number;
  };
  knownSynergies?: SynergyPair[]; // Pre-defined synergies matching the current palette
  projectName?: string;
}

export interface HeroMaterial {
  id: string;
  name: string;
  strategicValue: string;
  carbonIntensity: 'low' | 'medium' | 'high';
}

export interface ChallengeMaterial {
  id: string;
  name: string;
  mitigationTip: string;
  carbonIntensity: 'low' | 'medium' | 'high';
}

export interface MaterialSynergy {
  pair: [string, string];
  explanation: string;
}

export interface SustainabilityBriefingResponse {
  headline: string; // 3-word project persona
  summary: string; // 3-sentence narrative
  heroes: HeroMaterial[];
  challenges: ChallengeMaterial[];
  synergies: MaterialSynergy[];
}

export function getBriefingMaterialsKey(materials: MaterialOption[]): string {
  return materials
    .map((material) => [
      material.id,
      material.name,
      material.finish,
      material.tone,
      material.category,
      material.materialType ?? '',
      material.carbonIntensity ?? '',
    ]
      .map((value) => `${value ?? ''}`.trim())
      .join('::'))
    .sort()
    .join('||');
}

// Default lifecycle scores for materials without profile
const DEFAULT_LIFECYCLE_SCORES = {
  raw: 3,
  manufacturing: 3,
  transport: 2,
  installation: 2,
  inUse: 1,
  maintenance: 2,
  endOfLife: 2,
};

/**
 * Get lifecycle scores for a material, falling back to defaults
 */
function getMaterialLifecycleScores(material: MaterialOption): MaterialBriefingData['lifecycleScores'] {
  const profile = getLifecycleProfile(material.id);

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

  // Estimate based on carbon intensity if no profile exists
  const intensityMultiplier =
    material.carbonIntensity === 'high' ? 1.3 :
    material.carbonIntensity === 'low' ? 0.7 : 1.0;

  return {
    raw: Math.round(DEFAULT_LIFECYCLE_SCORES.raw * intensityMultiplier),
    manufacturing: Math.round(DEFAULT_LIFECYCLE_SCORES.manufacturing * intensityMultiplier),
    transport: DEFAULT_LIFECYCLE_SCORES.transport,
    installation: DEFAULT_LIFECYCLE_SCORES.installation,
    inUse: DEFAULT_LIFECYCLE_SCORES.inUse,
    maintenance: DEFAULT_LIFECYCLE_SCORES.maintenance,
    endOfLife: DEFAULT_LIFECYCLE_SCORES.endOfLife,
  };
}

/**
 * Find synergy pairs that match the given material IDs
 */
function findMatchingSynergies(materialIds: string[]): SynergyPair[] {
  const idSet = new Set(materialIds);
  const matchingSynergies: SynergyPair[] = [];

  for (const synergy of synergyPairsData.synergies) {
    const [mat1, mat2] = synergy.materials;
    // Check if both materials in the synergy are in our palette
    if (idSet.has(mat1) && idSet.has(mat2)) {
      matchingSynergies.push({
        materials: [mat1, mat2],
        explanation: synergy.explanation,
      });
    }
  }

  return matchingSynergies;
}

/**
 * Calculate total impact score from lifecycle scores
 */
function calculateTotalScore(scores: MaterialBriefingData['lifecycleScores']): number {
  // Weighted sum: embodied phases count more
  const weights = {
    raw: 0.15,
    manufacturing: 0.25,
    transport: 0.1,
    installation: 0.1,
    inUse: 0.15,
    maintenance: 0.1,
    endOfLife: 0.15,
  };

  return Object.entries(scores).reduce((sum, [key, value]) => {
    return sum + value * (weights[key as keyof typeof weights] ?? 0.1);
  }, 0);
}

/**
 * Prepare material data payload for Gemini API
 * Includes pre-stored strategicValue/mitigationTip and matching synergies
 */
export function prepareBriefingPayload(
  materials: MaterialOption[],
  projectName?: string
): SustainabilityBriefingPayload {
  const materialData: MaterialBriefingData[] = materials.map((material) => {
    const lifecycleScores = getMaterialLifecycleScores(material);
    return {
      id: material.id,
      name: material.name,
      carbonIntensity: material.carbonIntensity ?? 'medium',
      materialType: material.materialType,
      category: material.category,
      lifecycleScores,
      totalScore: calculateTotalScore(lifecycleScores),
      // Include pre-stored sustainability content if available
      strategicValue: material.strategicValue,
      mitigationTip: material.mitigationTip,
    };
  });

  // Calculate average scores across all materials
  const averageScores = {
    raw: 0,
    manufacturing: 0,
    transport: 0,
    installation: 0,
    inUse: 0,
    maintenance: 0,
    endOfLife: 0,
  };

  if (materialData.length > 0) {
    const stageKeys = Object.keys(averageScores) as (keyof typeof averageScores)[];
    stageKeys.forEach((stage) => {
      averageScores[stage] =
        materialData.reduce((sum, m) => sum + m.lifecycleScores[stage], 0) / materialData.length;
    });
  }

  // Find synergy pairs that match materials in the current palette
  const materialIds = materials.map((m) => m.id);
  const knownSynergies = findMatchingSynergies(materialIds);

  return {
    materials: materialData,
    averageScores,
    knownSynergies: knownSynergies.length > 0 ? knownSynergies : undefined,
    projectName,
  };
}

/**
 * Generate the system instruction for Gemini
 * Uses pre-stored strategicValue/mitigationTip when available
 */
export function getSustainabilityBriefingSystemInstruction(): string {
  return `You are an expert Sustainability Consultant specializing in architectural material selection.
Analyze the provided list of materials and their lifecycle impact scores.

IMPORTANT: Some materials include pre-stored "strategicValue" (for heroes) or "mitigationTip" (for challenges).
When these are provided, USE THEM EXACTLY as given. Only generate new text if the field is missing.
The payload may also include "knownSynergies" - pre-defined material pairs that work well together. Prefer these over generating new synergies.

Rules for your JSON response:
1. Headline: Create a 3-word 'Project Persona' based on the material mix (e.g., "Biophilic Modern Efficiency", "Industrial Heritage Revival").
2. Summary: Write exactly 3 sentences as an architectural narrative about the carbon strategy. Be specific about the material choices.
3. Heroes: Pick exactly 2 materials with the lowest impact/carbon scores. Use the material's pre-stored "strategicValue" if provided; otherwise generate 1-2 sentences.
4. Challenges: Pick exactly 2 materials with the highest impact scores. Use the material's pre-stored "mitigationTip" if provided; otherwise generate 1-2 sentences.
5. Synergies: Check if any pairs from "knownSynergies" match materials in the palette. If matches found, use those explanations. Otherwise identify 2 pairs that work well together.
6. Return ONLY valid JSON matching this exact structure:
{
  "headline": "Three Word Persona",
  "summary": "Three complete sentences about the carbon strategy...",
  "heroes": [
    { "id": "material-id", "name": "Material Name", "strategicValue": "Why this material is excellent...", "carbonIntensity": "low" },
    { "id": "material-id", "name": "Material Name", "strategicValue": "Why this material is excellent...", "carbonIntensity": "low" }
  ],
  "challenges": [
    { "id": "material-id", "name": "Material Name", "mitigationTip": "How to address the carbon impact...", "carbonIntensity": "high" },
    { "id": "material-id", "name": "Material Name", "mitigationTip": "How to address the carbon impact...", "carbonIntensity": "high" }
  ],
  "synergies": [
    { "pair": ["material-id-1", "material-id-2"], "explanation": "How these materials work together..." },
    { "pair": ["material-id-3", "material-id-4"], "explanation": "How these materials work together..." }
  ]
}`;
}

/**
 * Generate specifier checklist items based on material types
 */
export function generateSpecifierChecklist(materials: MaterialOption[]): string[] {
  const checklist: string[] = [];
  const materialTypes = new Set(materials.map((m) => m.materialType).filter(Boolean));
  const categories = new Set(materials.map((m) => m.category));

  // Steel-related checks
  if (materialTypes.has('metal') || materials.some((m) => m.id.includes('steel'))) {
    checklist.push('Request EPD for recycled steel content (target: 85%+ recycled)');
    checklist.push('Verify steel supplier uses electric arc furnace (EAF) production');
  }

  // Timber-related checks
  if (materialTypes.has('timber') || materials.some((m) => m.id.includes('timber') || m.id.includes('wood'))) {
    checklist.push('Confirm FSC or PEFC certification for all timber products');
    checklist.push('Request chain-of-custody documentation from supplier');
  }

  // Concrete-related checks
  if (materialTypes.has('concrete') || materials.some((m) => m.id.includes('concrete'))) {
    checklist.push('Specify GGBS/PFA cement replacement (target: 50%+ replacement)');
    checklist.push('Request EPD showing embodied carbon per m³');
  }

  // Glass-related checks
  if (materialTypes.has('glass') || categories.has('window')) {
    checklist.push('Verify glazing U-values meet or exceed building regs');
    checklist.push('Consider specifying higher recycled glass content');
  }

  // Insulation checks
  if (categories.has('insulation')) {
    checklist.push('Compare embodied carbon of insulation options (natural vs synthetic)');
    checklist.push('Request blowing agent GWP values for foam insulation');
  }

  // General checks
  checklist.push('Collect EPDs for all major material categories');
  checklist.push('Calculate transport distances for main structure materials');
  checklist.push('Document material reuse or reclaimed content percentages');

  // Limit to 6 most relevant items
  return checklist.slice(0, 6);
}

/**
 * Get intensity badge styling based on carbon intensity
 */
export function getIntensityBadgeStyle(intensity: 'low' | 'medium' | 'high'): {
  bg: string;
  text: string;
  label: string;
} {
  switch (intensity) {
    case 'low':
      return { bg: 'bg-green-100', text: 'text-green-800', label: 'Low Carbon' };
    case 'high':
      return { bg: 'bg-orange-100', text: 'text-orange-800', label: 'High Carbon' };
    default:
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Medium Carbon' };
  }
}

/**
 * Format radar chart data from average scores
 */
export function formatRadarChartData(averageScores: SustainabilityBriefingPayload['averageScores']): Array<{
  stage: string;
  score: number;
  fullMark: 5;
}> {
  const stageLabels: Record<keyof typeof averageScores, string> = {
    raw: 'Raw Materials',
    manufacturing: 'Manufacturing',
    transport: 'Transport',
    installation: 'Installation',
    inUse: 'In Use',
    maintenance: 'Maintenance',
    endOfLife: 'End of Life',
  };

  return Object.entries(averageScores).map(([key, value]) => ({
    stage: stageLabels[key as keyof typeof stageLabels] ?? key,
    score: Number(value.toFixed(2)),
    fullMark: 5,
  }));
}
