#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SOURCE = path.join(ROOT, 'tmp/cosmos-seed/materials.json');
const OUT_CSV = path.join(ROOT, 'docs/MATERIAL_WORKFLOW_RECOMMENDATIONS.csv');
const OUT_MD = path.join(ROOT, 'docs/MATERIAL_WORKFLOW_RECOMMENDATIONS.md');

const materials = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));

const SPECIAL_NONE = new Set([
  'clt-structure',
  'nlt-structure',
  'glulam-structure',
  'green-oak-structure',
  'hybrid-structure',
  'concrete-frame',
  'ggbs-concrete',
  'precast-concrete',
  'prestressed-concrete',
  'masonry-loadbearing',
  'rc-columns-beams',
  'ring-beams',
  'edge-beams',
]);

const SPECIAL_FINISH_COLOUR = new Set([
  'steel-frame',
  'space-frame-structure',
  'steel-columns-beams',
  'steel-trusses',
  'steel-window-frame',
  'timber-door',
  'steel-door',
  'aluminum-door',
  'composite-door',
  'fire-rated-door',
]);

const SPECIAL_VARIETY_FINISH_COLOUR = new Set([
  'rubber-floor',
  'timber-flooring',
  'bamboo-parquet',
  'cork-plank-floor',
  'stone-paver',
  'marble-floor',
  'travertine-tiles',
  'stone-facade',
  'stone-rainscreen',
  'brick-veneer',
  'brick-loadbearing',
  'terracotta-panels',
  'timber-rainscreen',
  'timber-rainscreen-larch',
]);

const SPECIAL_FINISH_ONLY = new Set([
  'frameless-glazing',
  'glass-door',
  'glass-balustrade',
  'glass-partitions',
  'curtain-wall-system',
]);

function hasOptions(material) {
  return {
    variety: Array.isArray(material.varietyOptions) && material.varietyOptions.length > 0,
    finish: Array.isArray(material.finishOptions) && material.finishOptions.length > 0,
    colour:
      (Array.isArray(material.colorOptions) && material.colorOptions.length > 0) ||
      Boolean(material.supportsColor),
  };
}

function workflowLabel(flags) {
  const steps = [];
  if (flags.variety) steps.push('variety');
  if (flags.finish) steps.push('finish');
  if (flags.colour) steps.push('colour');
  return steps.length ? steps.join(' -> ') : 'none';
}

function classify(material) {
  const cat = (material.category || '').toLowerCase();
  const text = [
    material.id,
    material.name,
    material.finish,
    material.description,
    ...(material.keywords || []),
  ]
    .join(' ')
    .toLowerCase();

  const idAndName = `${material.id} ${material.name}`.toLowerCase();
  const isPaint = cat === 'paint-wall' || cat === 'paint-ceiling' || /\bpaint\b/.test(idAndName);
  const isGlazing = /glass|glazing|curtain-wall|frameless/.test(text);
  const isMetal = /steel|aluminium|aluminum|copper|zinc|stainless|brass|metal/.test(text);
  const isNaturalVariety =
    /timber|wood|oak|bamboo|cork|stone|marble|travertine|slate|terracotta|brick|clay|rammed earth|rammed-earth|wool|felt|mycelium|bio-fibre|reclaimed/.test(
      text
    );
  const isStructural = cat === 'structure';
  const isInsulationOrLandscape = cat === 'insulation' || cat === 'landscape';
  const isGround = cat === 'external-ground';
  const isHighChoiceCategory = [
    'floor',
    'finish',
    'external',
    'ceiling',
    'door',
    'balustrade',
    'window',
    'fixture',
    'roof',
    'tile',
    'timber-panel',
    'wallpaper',
    'acoustic-panel',
    'timber-slat',
    'joinery',
    'microcement',
  ].includes(cat);

  if (SPECIAL_NONE.has(material.id)) {
    return { variety: false, finish: false, colour: false, reason: 'Structural system is typically selected as a fixed product.' };
  }

  if (SPECIAL_FINISH_ONLY.has(material.id)) {
    return { variety: false, finish: true, colour: false, reason: 'Glass-led product; finish/treatment matters more than colour palette.' };
  }

  if (SPECIAL_FINISH_COLOUR.has(material.id)) {
    return { variety: false, finish: true, colour: true, reason: 'System typically needs coating/finish and colour selection.' };
  }

  if (SPECIAL_VARIETY_FINISH_COLOUR.has(material.id)) {
    return { variety: true, finish: true, colour: true, reason: 'Material family usually selected by subtype, finish texture, and colour tone.' };
  }

  if (isPaint) {
    return { variety: false, finish: true, colour: true, reason: 'Paint workflow should always pick sheen then colour.' };
  }

  if (isInsulationOrLandscape) {
    return { variety: false, finish: false, colour: false, reason: 'Performance-led selection; appearance options are usually not primary.' };
  }

  if (isStructural) {
    if (isMetal) {
      return { variety: false, finish: true, colour: true, reason: 'Metal structure commonly requires finish and colour/coating selection.' };
    }
    if (/rammed earth|rammed-earth/.test(text)) {
      return { variety: true, finish: true, colour: true, reason: 'Rammed earth typically varies by mix, surface finish, and earth tone.' };
    }
    return { variety: false, finish: false, colour: false, reason: 'Most structural materials are chosen as fixed assemblies.' };
  }

  if (cat === 'window') {
    if (isGlazing) {
      return { variety: false, finish: true, colour: false, reason: 'Glazing systems usually vary by performance finish/treatment.' };
    }
    return { variety: false, finish: true, colour: true, reason: 'Frame systems generally need finish and colour decisions.' };
  }

  if (cat === 'wall-internal') {
    if (isGlazing) {
      return { variety: false, finish: true, colour: false, reason: 'Internal glazing typically uses finish/tint choices.' };
    }
    if (/plasterboard|gypsum|concrete block/.test(text)) {
      return { variety: false, finish: false, colour: false, reason: 'Substrate selection is typically fixed before applied finishes.' };
    }
    if (/brick-internal|brick \(internal\)/.test(text)) {
      return { variety: true, finish: true, colour: true, reason: 'Brick interiors usually vary by brick type, finish, and tone.' };
    }
    return { variety: false, finish: true, colour: true, reason: 'Internal wall finish products often require finish and colour choices.' };
  }

  if (isGround) {
    return {
      variety: isNaturalVariety,
      finish: true,
      colour: true,
      reason: 'Ground materials usually need texture/finish and tone control for context and slip requirements.',
    };
  }

  if (cat === 'roof') {
    if (/green-roof|blue-roof|pv-roof/.test(text)) {
      return { variety: true, finish: true, colour: false, reason: 'Roof system choice is mainly system subtype and assembly finish.' };
    }
    return {
      variety: isNaturalVariety,
      finish: true,
      colour: true,
      reason: 'Roof finishes typically require profile/finish and visible colour coordination.',
    };
  }

  if (isHighChoiceCategory) {
    return {
      variety: isNaturalVariety,
      finish: true,
      colour: true,
      reason: 'Architectural finish category generally benefits from full appearance workflow.',
    };
  }

  return { variety: false, finish: false, colour: false, reason: 'Default to fixed material where configurable options are uncommon.' };
}

function quoteCsv(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

const rows = [];
const summary = {
  current: {},
  recommended: {},
  changed: 0,
};

for (const material of materials) {
  const current = hasOptions(material);
  const currentLabel = workflowLabel(current);
  const recommended = classify(material);
  const recommendedLabel = workflowLabel(recommended);
  const changed = currentLabel !== recommendedLabel;
  if (changed) summary.changed += 1;

  summary.current[currentLabel] = (summary.current[currentLabel] || 0) + 1;
  summary.recommended[recommendedLabel] = (summary.recommended[recommendedLabel] || 0) + 1;

  rows.push({
    id: material.id,
    name: material.name,
    category: material.category,
    currentWorkflow: currentLabel,
    recommendedWorkflow: recommendedLabel,
    changed: changed ? 'yes' : 'no',
    reason: recommended.reason,
  });
}

rows.sort((a, b) => {
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return a.name.localeCompare(b.name);
});

const header = [
  'id',
  'name',
  'category',
  'currentWorkflow',
  'recommendedWorkflow',
  'changed',
  'reason',
];

const csvLines = [header.join(',')];
for (const row of rows) {
  csvLines.push(header.map((key) => quoteCsv(row[key])).join(','));
}
fs.writeFileSync(OUT_CSV, csvLines.join('\n') + '\n', 'utf8');

const summarize = (obj) =>
  Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

const md = [
  '# Material Workflow Recommendations',
  '',
  `Generated from \`${path.relative(ROOT, SOURCE)}\` on ${new Date().toISOString()}.`,
  '',
  `- Total materials: ${materials.length}`,
  `- Materials where recommendation differs from current data: ${summary.changed}`,
  '',
  '## Current Workflow Distribution',
  summarize(summary.current),
  '',
  '## Recommended Workflow Distribution',
  summarize(summary.recommended),
  '',
  `Detailed per-material table: \`${path.relative(ROOT, OUT_CSV)}\``,
  '',
  '## Workflow Legend',
  '- `none`: add directly, no option steps',
  '- `variety -> finish -> colour`: all three selection steps',
  '- `variety -> finish`: no colour step',
  '- `finish -> colour`: no variety step',
  '- `finish`: finish only',
].join('\n');

fs.writeFileSync(OUT_MD, md + '\n', 'utf8');

console.log(`Wrote ${OUT_CSV}`);
console.log(`Wrote ${OUT_MD}`);
console.log(`Changed recommendations: ${summary.changed}/${materials.length}`);
