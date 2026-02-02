/**
 * Sustainability Briefing Utilities
 * Prepares material data for Gemini API analysis and processes the response
 */

import type { MaterialOption } from '../types';
import type { LifecycleProfile, LifecycleStageKey } from '../lifecycleProfiles';
import { getLifecycleProfile } from '../data';

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

  return {
    materials: materialData,
    averageScores,
    projectName,
  };
}

/**
 * Generate the system instruction for Gemini
 */
export function getSustainabilityBriefingSystemInstruction(): string {
  return `You are an expert Sustainability Consultant specializing in architectural material selection.
Analyze the provided list of materials and their lifecycle impact scores.

Rules for your JSON response:
1. Headline: Create a 3-word 'Project Persona' based on the material mix (e.g., "Biophilic Modern Efficiency", "Industrial Heritage Revival").
2. Summary: Write exactly 3 sentences as an architectural narrative about the carbon strategy. Be specific about the material choices.
3. Heroes: Pick exactly 2 materials with the lowest impact/carbon scores. For each, explain their 'Strategic Value' in 1-2 sentences.
4. Challenges: Pick exactly 2 materials with the highest impact scores. For each, provide a practical 'Mitigation Tip' in 1-2 sentences.
5. Synergies: Identify 2 pairs of materials that work well together (e.g., thermal mass + insulation, timber structure + natural finishes). Explain how they complement each other.
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
