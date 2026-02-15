#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const MATERIALS_PATH = path.join(ROOT, 'tmp/cosmos-seed/materials.json');
const RECS_PATH = path.join(ROOT, 'docs/MATERIAL_WORKFLOW_RECOMMENDATIONS.csv');

const materials = JSON.parse(fs.readFileSync(MATERIALS_PATH, 'utf8'));

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  values.push(current);
  return values;
}

const csvRaw = fs.readFileSync(RECS_PATH, 'utf8').trim().split('\n');
const header = parseCsvLine(csvRaw[0]).map((cell, idx) =>
  idx === 0 ? cell.replace(/^\uFEFF/, '') : cell
);
const rows = csvRaw.slice(1).map((line) => {
  const cols = parseCsvLine(line);
  const obj = {};
  for (let i = 0; i < header.length; i += 1) {
    obj[header[i]] = cols[i] ?? '';
  }
  return obj;
});

const recById = new Map(rows.map((row) => [row.id, row]));

const defaultColorOptionsNatural = [
  { label: 'Light', tone: '#d7c7b3' },
  { label: 'Mid Tone', tone: '#a38666' },
  { label: 'Dark', tone: '#64503f' },
];

const defaultColorOptionsGlass = [
  { label: 'Clear', tone: '#dfe8ef' },
  { label: 'Soft Grey Tint', tone: '#b6c0c8' },
  { label: 'Smoke Tint', tone: '#7d858c' },
];

const defaultColorOptionsGround = [
  { label: 'Light Aggregate', tone: '#c9c1b4' },
  { label: 'Warm Earth', tone: '#9f7c5d' },
  { label: 'Dark Aggregate', tone: '#5f5750' },
];

function includesAny(text, tokens) {
  return tokens.some((token) => text.includes(token));
}

function materialText(material) {
  return `${material.id} ${material.name} ${material.finish} ${material.description} ${(material.keywords || []).join(' ')}`.toLowerCase();
}

function defaultVarietyOptions(material) {
  const text = materialText(material);

  if (material.id === 'rubber-floor') {
    return ['Recycled Rubber', 'Virgin Rubber', 'Cork-rubber Composite'];
  }

  if (includesAny(text, ['timber', 'wood', 'oak', 'bamboo', 'cork'])) {
    return ['Select Grade', 'Engineered', 'Reclaimed'];
  }
  if (includesAny(text, ['stone', 'marble', 'travertine', 'slate', 'granite'])) {
    return ['Select Grade', 'Commercial Grade', 'Reclaimed'];
  }
  if (includesAny(text, ['brick', 'terracotta', 'clay'])) {
    return ['Standard', 'Facing Grade', 'Reclaimed'];
  }
  if (includesAny(text, ['roof', 'standing seam', 'tile', 'cladding'])) {
    return ['Standard Profile', 'Heavy Duty', 'Low-Carbon Variant'];
  }
  if (includesAny(text, ['furniture', 'joinery', 'panel', 'slat'])) {
    return ['Standard', 'Premium', 'Reclaimed'];
  }

  return ['Standard', 'Premium', 'Recycled Content'];
}

function defaultFinishOptions(material) {
  const text = materialText(material);
  const category = material.category;

  if (category === 'paint-wall' || category === 'paint-ceiling' || includesAny(text, ['paint'])) {
    return ['Matte', 'Satin', 'Gloss'];
  }
  if (material.id === 'rubber-floor') {
    return ['Smooth', 'Studded', 'Textured'];
  }
  if (includesAny(text, ['glass', 'glazing'])) {
    return ['Clear', 'Frosted', 'Tinted'];
  }
  if (includesAny(text, ['stone', 'marble', 'travertine', 'concrete', 'terrazzo'])) {
    return ['Honed', 'Polished', 'Textured'];
  }
  if (includesAny(text, ['timber', 'wood', 'bamboo', 'cork'])) {
    return ['Natural', 'Oiled', 'Lacquered'];
  }
  if (includesAny(text, ['metal', 'steel', 'aluminium', 'aluminum', 'zinc', 'copper'])) {
    return ['Matte', 'Satin', 'Gloss'];
  }
  if (category === 'roof') {
    return ['Matte', 'Satin', 'Embossed'];
  }

  return ['Matte', 'Satin', 'Textured'];
}

function defaultColourStep(material) {
  const text = materialText(material);
  const category = material.category;

  if (category === 'paint-wall' || category === 'paint-ceiling') {
    return { supportsColor: true, colorOptions: undefined };
  }

  if (includesAny(text, ['glass', 'glazing'])) {
    return { supportsColor: false, colorOptions: defaultColorOptionsGlass };
  }

  if (category === 'external-ground') {
    return { supportsColor: false, colorOptions: defaultColorOptionsGround };
  }

  if (includesAny(text, ['metal', 'steel', 'aluminium', 'aluminum', 'powder coat', 'coated', 'door', 'window'])) {
    return { supportsColor: true, colorOptions: undefined };
  }

  if (includesAny(text, ['timber', 'wood', 'stone', 'brick', 'terracotta', 'cork', 'bamboo', 'slate', 'clay'])) {
    return { supportsColor: false, colorOptions: defaultColorOptionsNatural };
  }

  return { supportsColor: true, colorOptions: undefined };
}

function applyWorkflow(material, workflow) {
  const next = { ...material };

  const wantVariety = workflow.includes('variety');
  const wantFinish = workflow.includes('finish');
  const wantColour = workflow.includes('colour');

  if (!wantVariety) {
    delete next.varietyOptions;
    delete next.selectedVariety;
  } else if (!Array.isArray(next.varietyOptions) || next.varietyOptions.length === 0) {
    next.varietyOptions = defaultVarietyOptions(next);
  }

  if (!wantFinish) {
    delete next.finishOptions;
  } else if (!Array.isArray(next.finishOptions) || next.finishOptions.length === 0) {
    next.finishOptions = defaultFinishOptions(next);
  }

  if (!wantColour) {
    delete next.colorOptions;
    delete next.supportsColor;
    delete next.colorLabel;
    delete next.colorVariantId;
  } else {
    const hasColorOptions = Array.isArray(next.colorOptions) && next.colorOptions.length > 0;
    if (!hasColorOptions && !next.supportsColor) {
      const colourDefaults = defaultColourStep(next);
      if (colourDefaults.supportsColor) {
        next.supportsColor = true;
        delete next.colorOptions;
      } else {
        next.supportsColor = false;
        next.colorOptions = colourDefaults.colorOptions;
      }
    }
  }

  return next;
}

function workflowFromMaterial(material) {
  const steps = [];
  if (Array.isArray(material.varietyOptions) && material.varietyOptions.length > 0) steps.push('variety');
  if (Array.isArray(material.finishOptions) && material.finishOptions.length > 0) steps.push('finish');
  if ((Array.isArray(material.colorOptions) && material.colorOptions.length > 0) || material.supportsColor) {
    steps.push('colour');
  }
  return steps.length ? steps.join(' -> ') : 'none';
}

let appliedCount = 0;

const updated = materials.map((material) => {
  const rec = recById.get(material.id);
  if (!rec) return material;
  const next = applyWorkflow(material, rec.recommendedWorkflow);
  if (JSON.stringify(next) !== JSON.stringify(material)) {
    appliedCount += 1;
  }
  return next;
});

fs.writeFileSync(MATERIALS_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8');

let mismatches = 0;
for (const material of updated) {
  const rec = recById.get(material.id);
  if (!rec) continue;
  const actual = workflowFromMaterial(material);
  if (actual !== rec.recommendedWorkflow) {
    mismatches += 1;
    console.error(`Mismatch: ${material.id} expected "${rec.recommendedWorkflow}" got "${actual}"`);
  }
}

console.log(`Updated ${updated.length} materials in ${MATERIALS_PATH}`);
console.log(`Materials changed by apply: ${appliedCount}`);
console.log(`Workflow mismatches after apply: ${mismatches}`);
