#!/usr/bin/env node
/**
 * Batch generate lifecycle profiles for all materials
 * Run with: node scripts/batch-generate-profiles.mjs > scripts/generated-profiles.txt
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read constants.ts
const constantsPath = path.join(__dirname, '..', 'constants.ts');
const constantsContent = fs.readFileSync(constantsPath, 'utf-8');

// Extract all material IDs
const materialMatches = [...constantsContent.matchAll(/\{\s*\n\s*id:\s*'([^']+)'/g)];
const allMaterialIds = materialMatches.map(m => m[1]);

// Extract existing profiles
const profileSection = constantsContent.match(/MATERIAL_LIFECYCLE_PROFILES[^{]*\{([^}]+(?:\}[^}]+)*)\};/s);
const existingProfiles = new Set();
if (profileSection) {
  const profileMatches = [...profileSection[1].matchAll(/'([^']+)':\s*\{/g)];
  profileMatches.forEach(m => existingProfiles.add(m[1]));
}

// Extract material details for classification
function extractMaterialDetails(id) {
  const materialRegex = new RegExp(`id:\\s*'${id}'[^}]+name:\\s*'([^']+)'[^}]+finish:\\s*'([^']+)'[^}]+description:\\s*'([^']+)'[^}]+keywords:\\s*\\[([^\\]]+)\\]`, 's');
  const match = constantsContent.match(materialRegex);

  if (match) {
    return {
      id,
      name: match[1],
      finish: match[2],
      description: match[3],
      keywords: match[4].replace(/'/g, '').split(',').map(k => k.trim())
    };
  }
  return { id, name: '', finish: '', description: '', keywords: [] };
}

// Material type profiles
const profiles = {
  timber: {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 2, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 1, confidence: 'high' }
  },
  ceramic: {
    raw: { impact: 2, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },
  metal: {
    raw: { impact: 5, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },
  concrete: {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 5, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 3, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },
  glass: {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 3, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 3, confidence: 'medium' }
  },
  plastic: {
    raw: { impact: 4, confidence: 'high' },
    manufacturing: { impact: 4, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 1, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 4, confidence: 'low' }
  },
  earth: {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 1, confidence: 'high' },
    transport: { impact: 1, confidence: 'high' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },
  stone: {
    raw: { impact: 3, confidence: 'high' },
    manufacturing: { impact: 3, confidence: 'high' },
    transport: { impact: 4, confidence: 'medium' },
    installation: { impact: 2, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 2, confidence: 'medium' }
  },
  textile: {
    raw: { impact: 2, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 1, confidence: 'high' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'low' }
  },
  biobased: {
    raw: { impact: 1, confidence: 'high' },
    manufacturing: { impact: 1, confidence: 'high' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 1, confidence: 'high' },
    endOfLife: { impact: 1, confidence: 'high' }
  },
  paint: {
    raw: { impact: 3, confidence: 'medium' },
    manufacturing: { impact: 3, confidence: 'medium' },
    transport: { impact: 2, confidence: 'medium' },
    installation: { impact: 2, confidence: 'medium' },
    inUse: { impact: 1, confidence: 'high' },
    maintenance: { impact: 2, confidence: 'medium' },
    endOfLife: { impact: 2, confidence: 'low' }
  }
};

function classifyMaterial(mat) {
  const text = `${mat.name} ${mat.finish} ${mat.description} ${mat.keywords.join(' ')}`.toLowerCase();

  if (text.match(/timber|wood|oak|bamboo|larch|cedar/)) return 'timber';
  if (text.match(/steel|aluminum|aluminium|metal|brass|copper|zinc/)) return 'metal';
  if (text.match(/concrete|cement|microcement/)) return 'concrete';
  if (text.match(/glass|glazing/)) return 'glass';
  if (text.match(/ceramic|terracotta|porcelain|clay|brick|tile/)) return 'ceramic';
  if (text.match(/plastic|vinyl|upvc|composite|grp|pet|epoxy|resin/)) return 'plastic';
  if (text.match(/hemp|cork|mycelium|bio-based|biobased|wool|felt/)) return 'biobased';
  if (text.match(/earth|rammed|lime|plaster/)) return 'earth';
  if (text.match(/stone|marble|granite|slate|travertine/)) return 'stone';
  if (text.match(/fabric|textile|carpet|leather|upholster/)) return 'textile';
  if (text.match(/paint|emulsion/)) return 'paint';

  return 'concrete'; // default
}

function formatProfile(id, profile, type) {
  return `  '${id}': { // ${type}
    raw: { impact: ${profile.raw.impact}, confidence: '${profile.raw.confidence}' },
    manufacturing: { impact: ${profile.manufacturing.impact}, confidence: '${profile.manufacturing.confidence}' },
    transport: { impact: ${profile.transport.impact}, confidence: '${profile.transport.confidence}' },
    installation: { impact: ${profile.installation.impact}, confidence: '${profile.installation.confidence}' },
    inUse: { impact: ${profile.inUse.impact}, confidence: '${profile.inUse.confidence}' },
    maintenance: { impact: ${profile.maintenance.impact}, confidence: '${profile.maintenance.confidence}' },
    endOfLife: { impact: ${profile.endOfLife.impact}, confidence: '${profile.endOfLife.confidence}' }
  }`;
}

// Generate profiles for materials without them
console.log('// === GENERATED PROFILES ===');
console.log('// Copy these into MATERIAL_LIFECYCLE_PROFILES in constants.ts\n');

let count = 0;
for (const id of allMaterialIds) {
  if (!existingProfiles.has(id)) {
    const material = extractMaterialDetails(id);
    const type = classifyMaterial(material);
    const profile = profiles[type];

    console.log(`  // ${material.name}`);
    console.log(formatProfile(id, profile, type) + ',\n');
    count++;
  }
}

console.error(`\n// Generated ${count} new profiles`);
console.error(`// Existing profiles: ${existingProfiles.size}`);
console.error(`// Total will be: ${count + existingProfiles.size}`);
