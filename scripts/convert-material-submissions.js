#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const ALLOWED_CATEGORIES = new Set(['structure', 'envelope', 'interiors', 'landscape', 'custom']);
const ALLOWED_CARBON_INTENSITY = new Set(['low', 'medium', 'high']);
const ALLOWED_HEALTH_RISK = new Set(['low', 'medium', 'high']);
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function printUsage() {
  console.log(
    [
      'Usage:',
      '  node scripts/convert-material-submissions.js --in <input.csv> [--out <materials.json>] [--report <report.json>] [--sort-base <n>]',
      '',
      'Example:',
      '  node scripts/convert-material-submissions.js \\',
      '    --in docs/MATERIAL_SUBMISSION_TEMPLATE.csv \\',
      '    --out tmp/material-submissions/materials.json \\',
      '    --report tmp/material-submissions/report.json',
      '',
      'List fields in CSV should use "|" for multi-value cells.',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      continue;
    }

    const eqIndex = arg.indexOf('=');
    if (eqIndex > -1) {
      const key = arg.slice(2, eqIndex);
      const value = arg.slice(eqIndex + 1);
      out[key] = value;
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function toSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (char === '\r') {
      continue;
    }

    field += char;
  }

  row.push(field);
  rows.push(row);

  if (!rows.length) return [];

  const headers = rows[0].map((h, idx) => {
    const value = idx === 0 ? h.replace(/^\uFEFF/, '') : h;
    return String(value || '').trim();
  });

  const records = [];
  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i];
    const record = {};
    let hasData = false;
    for (let c = 0; c < headers.length; c += 1) {
      const key = headers[c];
      if (!key) continue;
      const value = String(cells[c] || '').trim();
      if (value) hasData = true;
      record[key] = value;
    }
    if (hasData) records.push(record);
  }

  return records;
}

function splitList(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  const separator = text.includes('|') ? '|' : (text.includes(';') ? ';' : null);
  const rawItems = separator ? text.split(separator) : [text];
  return rawItems
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseKeywords(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  if (text.includes('|')) return splitList(text);
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNullableString(value) {
  const text = String(value || '').trim();
  return text.length ? text : null;
}

function parseNullableInteger(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

function parseBoolean(value, fallback = false) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return fallback;
  if (['true', '1', 'yes', 'y'].includes(text)) return true;
  if (['false', '0', 'no', 'n'].includes(text)) return false;
  return fallback;
}

function parseColorOptions(value, errors) {
  const items = splitList(value);
  if (!items.length) return undefined;

  const colorOptions = [];
  for (const item of items) {
    const separator = item.includes(':') ? ':' : (item.includes('=') ? '=' : null);
    if (!separator) {
      errors.push(`Invalid colorOptions entry "${item}". Use "Label:#HEX".`);
      continue;
    }
    const parts = item.split(separator);
    const label = parts[0].trim();
    const tone = parts.slice(1).join(separator).trim();
    if (!label || !tone) {
      errors.push(`Invalid colorOptions entry "${item}".`);
      continue;
    }
    if (!HEX_COLOR_RE.test(tone)) {
      errors.push(`Invalid color hex "${tone}" in colorOptions.`);
      continue;
    }
    colorOptions.push({ label, tone });
  }

  return colorOptions.length ? colorOptions : undefined;
}

function parseRisks(value, errors) {
  const items = splitList(value);
  if (!items.length) return null;

  const risks = [];
  for (const item of items) {
    const divider = item.includes('=>') ? '=>' : (item.includes('->') ? '->' : null);
    if (!divider) {
      errors.push(`Invalid risks entry "${item}". Use "Risk=>Mitigation".`);
      continue;
    }
    const [riskPart, mitigationPart] = item.split(divider);
    const risk = String(riskPart || '').trim();
    const mitigation = String(mitigationPart || '').trim();
    if (!risk || !mitigation) {
      errors.push(`Invalid risks entry "${item}".`);
      continue;
    }
    risks.push({ risk, mitigation });
  }
  return risks.length ? risks : null;
}

function normalizeFinishId(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;

  if (text.startsWith('finish:')) {
    const normalized = toSlug(text.slice('finish:'.length));
    return normalized ? `finish:${normalized}` : null;
  }

  const normalized = toSlug(text);
  return normalized ? `finish:${normalized}` : null;
}

function stripUndefined(input) {
  if (Array.isArray(input)) return input.map(stripUndefined);
  if (input && typeof input === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      out[key] = stripUndefined(value);
    }
    return out;
  }
  return input;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function buildMaterial(row, rowNumber, index, sortBase) {
  const errors = [];
  const warnings = [];

  const name = String(row.name || '').trim();
  const finish = String(row.finish || '').trim();
  const description = String(row.description || '').trim();
  const keywords = parseKeywords(row.keywords);
  const category = String(row.category || '').trim().toLowerCase();

  if (!name) errors.push('Missing required field: name');
  if (!finish) errors.push('Missing required field: finish');
  if (!description) errors.push('Missing required field: description');
  if (!keywords.length) errors.push('Missing required field: keywords');
  if (!category) {
    errors.push('Missing required field: category');
  } else if (!ALLOWED_CATEGORIES.has(category)) {
    errors.push(`Invalid category "${category}". Allowed: ${Array.from(ALLOWED_CATEGORIES).join(', ')}`);
  }

  const idInput = String(row.id || '').trim();
  const id = toSlug(idInput || name);
  if (!id) errors.push('Could not derive id. Provide "id" or a valid "name".');

  const toneInput = String(row.tone || '').trim();
  const tone = toneInput || '#808080';
  if (!HEX_COLOR_RE.test(tone)) {
    warnings.push(`Invalid tone "${tone}". Defaulted to #808080.`);
  }
  const finalTone = HEX_COLOR_RE.test(tone) ? tone : '#808080';

  const colorOptions = parseColorOptions(row.colorOptions, errors);
  const finishOptions = splitList(row.finishOptions);
  const varietyOptions = splitList(row.varietyOptions);
  const tags = splitList(row.tags);
  const treePaths = splitList(row.treePaths);
  const materialForm = splitList(row.materialForm);
  const materialFunction = splitList(row.materialFunction);
  const manufacturingProcess = splitList(row.manufacturingProcess);
  const actions = splitList(row.actions);
  const healthConcerns = splitList(row.healthConcerns);

  const carbonIntensityRaw = String(row.carbonIntensity || '').trim().toLowerCase();
  const carbonIntensity = carbonIntensityRaw
    ? (ALLOWED_CARBON_INTENSITY.has(carbonIntensityRaw) ? carbonIntensityRaw : null)
    : null;
  if (carbonIntensityRaw && !carbonIntensity) {
    errors.push(`Invalid carbonIntensity "${carbonIntensityRaw}". Use low|medium|high.`);
  }

  const healthRiskRaw = String(row.healthRiskLevel || '').trim().toLowerCase();
  const healthRiskLevel = healthRiskRaw
    ? (ALLOWED_HEALTH_RISK.has(healthRiskRaw) ? healthRiskRaw : null)
    : null;
  if (healthRiskRaw && !healthRiskLevel) {
    errors.push(`Invalid healthRiskLevel "${healthRiskRaw}". Use low|medium|high.`);
  }

  let finishIds = splitList(row.finishIds)
    .map((value) => normalizeFinishId(value))
    .filter(Boolean);
  if (!finishIds.length && finish) {
    const derivedFinishId = normalizeFinishId(finish);
    if (derivedFinishId) finishIds = [derivedFinishId];
  }

  const primaryFinishIdRaw = normalizeFinishId(row.primaryFinishId);
  let primaryFinishId = primaryFinishIdRaw || (finishIds[0] || null);
  if (primaryFinishId && !finishIds.includes(primaryFinishId)) {
    finishIds.unshift(primaryFinishId);
    warnings.push(`primaryFinishId "${primaryFinishId}" was added to finishIds.`);
  }

  const finishSetIds = splitList(row.finishSetIds);
  let primaryFinishSetId = parseNullableString(row.primaryFinishSetId);
  if (primaryFinishSetId && !finishSetIds.includes(primaryFinishSetId)) {
    finishSetIds.unshift(primaryFinishSetId);
    warnings.push(`primaryFinishSetId "${primaryFinishSetId}" was added to finishSetIds.`);
  }
  if (!primaryFinishSetId) primaryFinishSetId = null;

  const risks = parseRisks(row.risks, errors);
  const sortOrder = parseNullableInteger(row.sortOrder) ?? (sortBase + index);

  const material = stripUndefined({
    id,
    pk: category,
    docType: 'material',
    sortOrder,
    name,
    tone: finalTone,
    finish,
    description,
    keywords,
    category,
    colorOptions,
    supportsColor: parseBoolean(row.supportsColor, false),
    finishOptions: finishOptions.length ? finishOptions : undefined,
    varietyOptions: varietyOptions.length ? varietyOptions : undefined,
    treePaths: treePaths.length ? treePaths : undefined,
    carbonIntensity: carbonIntensity || undefined,
    tags: tags.length ? tags : undefined,
    materialType: parseNullableString(row.materialType) || undefined,
    finishFamily: parseNullableString(row.finishFamily) || undefined,
    materialForm: materialForm.length ? materialForm : undefined,
    materialFunction: materialFunction.length ? materialFunction : undefined,
    manufacturingProcess: manufacturingProcess.length ? manufacturingProcess : undefined,
    finishIds,
    primaryFinishId: primaryFinishId || null,
    finishSetIds,
    primaryFinishSetId,
    lifecycleProfileId: parseNullableString(row.lifecycleProfileId),
    insight: parseNullableString(row.insight),
    actions: actions.length ? actions : null,
    strategicValue: parseNullableString(row.strategicValue),
    mitigationTip: parseNullableString(row.mitigationTip),
    healthRiskLevel: healthRiskLevel || null,
    healthConcerns: healthConcerns.length ? healthConcerns : null,
    healthNote: parseNullableString(row.healthNote),
    risks,
    serviceLife: parseNullableInteger(row.serviceLife),
  });

  const review = {
    rowNumber,
    id: material.id,
    companyName: parseNullableString(row.companyName),
    contactName: parseNullableString(row.contactName),
    contactEmail: parseNullableString(row.contactEmail),
    website: parseNullableString(row.website),
    dateSubmitted: parseNullableString(row.dateSubmitted),
    warnings,
    errors,
  };

  return { material, review, errors };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const inputPath = args.in;
  if (!inputPath) {
    printUsage();
    process.exit(1);
  }

  const outputPath = args.out || 'tmp/material-submissions/materials.json';
  const reportPath = args.report || 'tmp/material-submissions/report.json';
  const sortBaseRaw = Number(args['sort-base']);
  const sortBase = Number.isFinite(sortBaseRaw) ? Math.round(sortBaseRaw) : 9000;

  const csvText = fs.readFileSync(inputPath, 'utf8');
  const records = parseCsv(csvText);
  if (!records.length) {
    throw new Error(`No data rows found in ${inputPath}`);
  }

  const materials = [];
  const reviewRows = [];
  const allErrors = [];

  for (let i = 0; i < records.length; i += 1) {
    const rowNumber = i + 2;
    const built = buildMaterial(records[i], rowNumber, i, sortBase);
    materials.push(built.material);
    reviewRows.push(built.review);
    if (built.errors.length) {
      allErrors.push(...built.errors.map((err) => `Row ${rowNumber}: ${err}`));
    }
  }

  const idSeen = new Set();
  for (let i = 0; i < materials.length; i += 1) {
    const material = materials[i];
    if (idSeen.has(material.id)) {
      allErrors.push(`Row ${i + 2}: Duplicate id "${material.id}" in input file.`);
    }
    idSeen.add(material.id);
  }

  if (allErrors.length) {
    console.error('Validation failed:\n');
    for (const err of allErrors) console.error(`- ${err}`);
    process.exit(1);
  }

  ensureDir(outputPath);
  ensureDir(reportPath);

  fs.writeFileSync(outputPath, `${JSON.stringify(materials, null, 2)}\n`);
  fs.writeFileSync(reportPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    sourceFile: inputPath,
    count: materials.length,
    rows: reviewRows,
  }, null, 2)}\n`);

  const warningCount = reviewRows.reduce((count, row) => count + row.warnings.length, 0);

  console.log(`Wrote ${materials.length} material docs to ${outputPath}`);
  console.log(`Wrote conversion report to ${reportPath}`);
  if (warningCount > 0) {
    console.log(`Completed with ${warningCount} warning(s). Check ${reportPath} before import.`);
  }
}

main();
