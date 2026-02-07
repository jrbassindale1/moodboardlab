#!/usr/bin/env node

/**
 * Generate lifecycle insights for all materials based on their lifecycle scores.
 * These insights describe where impact can be reduced and where the material performs well.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

const STAGE_LABELS = {
  raw: 'raw materials extraction',
  manufacturing: 'manufacturing',
  transport: 'transport',
  installation: 'installation',
  inUse: 'in-use',
  maintenance: 'maintenance',
  endOfLife: 'end-of-life',
};

const STAGE_ORDER = ['raw', 'manufacturing', 'transport', 'installation', 'inUse', 'maintenance', 'endOfLife'];

function analyseProfile(profile) {
  const entries = STAGE_ORDER.map(key => ({ key, score: profile[key].impact }));
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const sortedAsc = [...entries].sort((a, b) => a.score - b.score);

  return {
    highest: sorted[0],
    secondHighest: sorted[1],
    lowest: sortedAsc[0],
    secondLowest: sortedAsc[1],
  };
}

function generateInsight(materialId, profile) {
  const { highest, secondHighest, lowest, secondLowest } = analyseProfile(profile);

  // Material-specific insights based on patterns in the ID
  const id = materialId.toLowerCase();

  // Check for specific material types and generate tailored insights
  if (id.includes('steel') || id.includes('metal')) {
    if (highest.score >= 4) {
      return `High embodied carbon in ${STAGE_LABELS[highest.key]} due to energy-intensive metal production. Specify recycled content (85%+ target) and EAF-sourced steel to reduce impact. ${STAGE_LABELS[lowest.key]} phase performs well due to durability and recyclability.`;
    }
  }

  if (id.includes('concrete') || id.includes('rc-')) {
    if (highest.key === 'manufacturing') {
      return `Cement production dominates the carbon footprint. Specify GGBS/PFA replacement (50%+ target) to reduce ${STAGE_LABELS.manufacturing} impact. Long service life means ${STAGE_LABELS[lowest.key]} stage performs well.`;
    }
  }

  if (id.includes('timber') || id.includes('wood') || id.includes('clt') || id.includes('glulam') || id.includes('oak')) {
    return `Bio-based material with low embodied carbon across lifecycle. ${STAGE_LABELS[lowest.key]} performs exceptionally well. Ensure FSC/PEFC certification to maintain sustainability credentials. Consider end-of-life reuse or biomass recovery.`;
  }

  if (id.includes('glass')) {
    return `${STAGE_LABELS[highest.key]} stage has highest impact due to high-temperature processing. Specify recycled cullet content to reduce ${STAGE_LABELS.raw} impact. ${STAGE_LABELS[lowest.key]} phase benefits from material durability.`;
  }

  if (id.includes('brick')) {
    return `Kiln firing drives ${STAGE_LABELS.manufacturing} impact. Consider unfired or low-carbon brick alternatives. ${STAGE_LABELS[lowest.key]} stage performs well due to long service life and potential for reuse.`;
  }

  if (id.includes('insulation')) {
    if (id.includes('mineral') || id.includes('glass-wool') || id.includes('rockwool')) {
      return `Energy-intensive manufacturing process dominates lifecycle impact. Compare with bio-based alternatives (hemp, wood fibre) for lower embodied carbon. ${STAGE_LABELS[lowest.key]} phase benefits from operational energy savings.`;
    }
    if (id.includes('hemp') || id.includes('cellulose') || id.includes('wood-fibre') || id.includes('cork')) {
      return `Bio-based insulation with carbon sequestration benefits. Low impact across all lifecycle stages. ${STAGE_LABELS[lowest.key]} performs exceptionally well. Ensure responsible sourcing certification.`;
    }
  }

  if (id.includes('paint') || id.includes('coating')) {
    return `VOC content and manufacturing drive initial impact. Specify low-VOC, bio-based formulations. ${STAGE_LABELS.maintenance} may increase if repainting frequency is high—choose durable finishes.`;
  }

  if (id.includes('carpet')) {
    return `Synthetic carpet has high ${STAGE_LABELS.manufacturing} impact and limited recyclability. Consider wool or recycled-content options. ${STAGE_LABELS[lowest.key]} stage performs better with proper maintenance programmes.`;
  }

  if (id.includes('zinc') || id.includes('copper') || id.includes('aluminium')) {
    return `High ${STAGE_LABELS[highest.key]} impact from metal extraction and processing. Specify high recycled content to reduce embodied carbon. Long lifespan and recyclability benefit ${STAGE_LABELS[lowest.key]} stage.`;
  }

  if (id.includes('rammed-earth') || id.includes('clay') || id.includes('earth')) {
    return `Minimal processing results in very low embodied carbon. ${STAGE_LABELS[lowest.key]} performs exceptionally well. Local sourcing further reduces ${STAGE_LABELS.transport} impact. Consider thermal mass benefits.`;
  }

  if (id.includes('terrazzo') || id.includes('stone') || id.includes('granite') || id.includes('marble')) {
    return `${STAGE_LABELS[highest.key]} impact driven by extraction and processing. Specify reclaimed or locally-sourced material. Exceptional durability means ${STAGE_LABELS[lowest.key]} stage performs well over building lifetime.`;
  }

  if (id.includes('vinyl') || id.includes('pvc') || id.includes('plastic')) {
    return `Petrochemical feedstock drives ${STAGE_LABELS.raw} impact. Limited recyclability affects ${STAGE_LABELS.endOfLife}. Consider bio-based or recycled alternatives. ${STAGE_LABELS[lowest.key]} benefits from low maintenance requirements.`;
  }

  if (id.includes('plaster') || id.includes('gypsum')) {
    return `Moderate ${STAGE_LABELS.manufacturing} impact from calcination process. Specify recycled gypsum content where available. ${STAGE_LABELS[lowest.key]} stage performs well with long service intervals.`;
  }

  if (id.includes('render') || id.includes('stucco')) {
    return `Cement content drives ${STAGE_LABELS.manufacturing} impact. Consider lime-based alternatives for lower carbon. ${STAGE_LABELS[lowest.key]} stage benefits from durability when properly detailed.`;
  }

  // Generic insight based on scores
  if (highest.score >= 4) {
    return `Focus on reducing ${STAGE_LABELS[highest.key]} impact through specification choices—this is the primary carbon hotspot. ${STAGE_LABELS[lowest.key]} stage performs well at ${lowest.score}/5. Request EPD data to verify assumptions.`;
  }

  if (highest.score >= 3) {
    return `Moderate impact in ${STAGE_LABELS[highest.key]} and ${STAGE_LABELS[secondHighest.key]} stages. Specification choices can reduce these hotspots. ${STAGE_LABELS[lowest.key]} performs well—maintain current approach.`;
  }

  return `Balanced lifecycle profile with no major hotspots. ${STAGE_LABELS[lowest.key]} stage is strongest at ${lowest.score}/5. Consider this material as a benchmark for lower-impact alternatives.`;
}

// Load lifecycle profiles
const profilesData = JSON.parse(readFileSync(join(dataDir, 'lifecycleProfiles.json'), 'utf8'));
const profiles = profilesData.profiles;

// Generate insights for each material
const insights = {};
for (const [materialId, profile] of Object.entries(profiles)) {
  insights[materialId] = generateInsight(materialId, profile);
}

// Write insights to a new JSON file
const output = {
  "$schema": "./schemas/lifecycleInsights.schema.json",
  "_comment": "AI-generated lifecycle insights for materials. These describe where impact can be reduced and where the material performs well.",
  "insights": insights
};

writeFileSync(join(dataDir, 'lifecycleInsights.json'), JSON.stringify(output, null, 2) + '\n');

console.log(`Generated ${Object.keys(insights).length} lifecycle insights`);
console.log('Output written to data/lifecycleInsights.json');
