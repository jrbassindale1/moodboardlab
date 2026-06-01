/**
 * Batch import utilities for brand product submissions.
 * Converts flat CSV rows into MaterialDocument-compatible objects,
 * assembles SustainabilityData from flat columns, and generates
 * downloadable CSV templates.
 */

import { getAllCategoryPaths } from '../data/categories';
import type {
  SustainabilityData,
  EvidenceLevel,
  ProductVariant,
  VariantMode,
} from '../types';

// ─── Column definitions ────────────────────────────────────────────────────

export interface CsvColumnDef {
  key: string;
  required: boolean;
  description: string;
  allowedValues?: string[];
  example: string;
  group: 'core' | 'identity' | 'application' | 'spec' | 'sustainability' | 'sustainability-category';
}

export const PRODUCT_COLUMNS: CsvColumnDef[] = [
  // Core — required
  { key: 'name',             required: true,  group: 'core', description: 'Product name',                                                                      example: 'Cliff Edge' },
  { key: 'treePath',         required: true,  group: 'core', description: 'Category path — must match the hierarchy exactly, e.g. Interiors>Floor Finishes>Carpet & Soft Flooring', example: 'Interiors>Floor Finishes>Carpet & Soft Flooring' },
  { key: 'description',      required: true,  group: 'core', description: 'Product description (2–4 sentences)',                                               example: 'A textured loop pile carpet tile inspired by coastal erosion.' },
  { key: 'imageUrl',         required: true,  group: 'core', description: 'Primary product image URL (Azure Blob or external)',                                example: 'https://cdn.example.com/cliff-edge.jpg' },
  { key: 'variantMode',      required: true,  group: 'core', description: 'Variant picker type',  allowedValues: ['photo-variants','colour-standard','surface-finish','none'], example: 'photo-variants' },
  { key: 'tone',             required: true,  group: 'core', description: 'Representative hex colour — internal AI use only, never shown to user',             example: '#B8A98F' },
  { key: 'finish',           required: true,  group: 'core', description: 'Short finish description',                                                          example: 'Loop pile' },

  // Brand / product identity
  { key: 'productCollection', required: false, group: 'identity', description: 'Highest grouping level (collection)',          example: 'Human Nature' },
  { key: 'productRange',     required: false, group: 'identity', description: 'Sub-collection / range name',                   example: 'Cliff Edge' },
  { key: 'productCode',      required: false, group: 'identity', description: 'Manufacturer SKU',                              example: 'CE-001' },
  { key: 'productPageUrl',   required: false, group: 'identity', description: 'URL to product on brand website',               example: 'https://brand.com/cliff-edge' },
  { key: 'sampleRequestUrl', required: false, group: 'identity', description: 'URL for requesting a physical sample',          example: '' },

  // Application context
  { key: 'applications',     required: false, group: 'application', description: 'Comma-separated: floor,wall,ceiling,external-wall,roof,wet-area',               example: 'floor' },
  { key: 'internalExternal', required: false, group: 'application', description: 'internal | external | both',  allowedValues: ['internal','external','both'],     example: 'internal' },
  { key: 'typicalUse',       required: false, group: 'application', description: 'Comma-separated: commercial,residential,education,hospitality,healthcare,retail', example: 'commercial,hospitality' },

  // Technical specification
  { key: 'dimensionThickness', required: false, group: 'spec', description: 'e.g. 7mm',           example: '7mm' },
  { key: 'dimensionWidth',     required: false, group: 'spec', description: 'e.g. 600mm',          example: '600mm' },
  { key: 'dimensionLength',    required: false, group: 'spec', description: 'e.g. 1200mm',         example: '' },
  { key: 'weightPerM2',        required: false, group: 'spec', description: 'e.g. 680g/m²',        example: '680g/m²' },
  { key: 'fireRating',         required: false, group: 'spec', description: 'e.g. Euroclass Bfl-s1', example: '' },
  { key: 'acousticRating',     required: false, group: 'spec', description: 'e.g. ΔLw 21 dB',     example: '' },
  { key: 'thermalValue',       required: false, group: 'spec', description: 'e.g. λ = 0.034 W/mK', example: '' },
  { key: 'slipResistance',     required: false, group: 'spec', description: 'e.g. R10 (floors)',   example: '' },
  { key: 'warranty',           required: false, group: 'spec', description: 'e.g. 15 years',       example: '15 years' },
  { key: 'priceRange',         required: false, group: 'spec', description: 'Range only, e.g. £45–£65/m²', example: '' },
  { key: 'leadTime',           required: false, group: 'spec', description: 'e.g. 4–6 weeks',      example: '' },
  { key: 'minOrderQty',        required: false, group: 'spec', description: 'e.g. 10 m²',          example: '' },

  // Sustainability — core
  { key: 'sus_epd_available',        required: false, group: 'sustainability', description: 'TRUE | FALSE',          allowedValues: ['TRUE','FALSE'],  example: 'TRUE' },
  { key: 'sus_epd_url',              required: false, group: 'sustainability', description: 'Link to EPD document',                                    example: 'https://...' },
  { key: 'sus_epd_operator',         required: false, group: 'sustainability', description: 'EPD programme operator, e.g. BRE, IBU, EPD International', example: 'IBU' },
  { key: 'sus_epd_standard',         required: false, group: 'sustainability', description: 'Usually EN 15804+A2',                                     example: 'EN 15804+A2' },
  { key: 'sus_epd_valid_until',       required: false, group: 'sustainability', description: 'Expiry date YYYY-MM-DD',                                  example: '2029-12-31' },
  { key: 'sus_epd_declared_unit',    required: false, group: 'sustainability', description: 'Declared unit, e.g. 1 m², 1 kg, 1 item',                  example: '1 m²' },
  { key: 'sus_headline_carbon',      required: false, group: 'sustainability', description: 'Carbon figure (number only)',                              example: '12.4' },
  { key: 'sus_headline_carbon_unit', required: false, group: 'sustainability', description: 'e.g. kgCO2e/m², kgCO2e/kg',                               example: 'kgCO2e/m²' },
  { key: 'sus_headline_carbon_basis',required: false, group: 'sustainability', description: 'e.g. A1–A3',                                              example: 'A1–A3' },
  { key: 'sus_evidence_level',       required: false, group: 'sustainability', description: 'Evidence quality', allowedValues: ['third-party-verified','manufacturer-declared','published-source','unknown'], example: 'manufacturer-declared' },
  { key: 'sus_certifications',       required: false, group: 'sustainability', description: 'Comma-separated scheme names: FSC,PEFC,BBA,CE,UKCA',      example: 'FSC,CE' },
  { key: 'sus_recycled_pct',         required: false, group: 'sustainability', description: 'Recycled content % (0–100)',                              example: '62' },
  { key: 'sus_take_back',            required: false, group: 'sustainability', description: 'Manufacturer take-back scheme: TRUE | FALSE', allowedValues: ['TRUE','FALSE'], example: '' },

  // Sustainability — category-specific
  { key: 'sus_voc_content',          required: false, group: 'sustainability-category', description: 'Paint/coating only: zero | low | medium | high', allowedValues: ['zero','low','medium','high'], example: '' },
  { key: 'sus_voc_grams_per_litre',  required: false, group: 'sustainability-category', description: 'Paint/coating only: VOC content in g/L',         example: '' },
  { key: 'sus_emissions_class',      required: false, group: 'sustainability-category', description: 'Paint/coating only: A+ | A | B | C',             example: '' },
  { key: 'sus_timber_coc',          required: false, group: 'sustainability-category', description: 'Timber only: FSC | PEFC', allowedValues: ['FSC','PEFC'], example: '' },
  { key: 'sus_timber_species',       required: false, group: 'sustainability-category', description: 'Timber only: species name',                      example: 'European oak' },
  { key: 'sus_timber_country',       required: false, group: 'sustainability-category', description: 'Timber only: country of origin',                  example: 'France' },
  { key: 'sus_formaldehyde_class',   required: false, group: 'sustainability-category', description: 'Timber only: E0 | E1 | CARB P2 | NAF', allowedValues: ['E0','E1','CARB P2','NAF'], example: '' },
  { key: 'sus_stone_country',        required: false, group: 'sustainability-category', description: 'Stone only: country of origin',                   example: 'Italy' },
  { key: 'sus_metal_recycled_pct',   required: false, group: 'sustainability-category', description: 'Metal only: recycled content % (0–100)',          example: '' },
  { key: 'sus_tile_water_absorption',required: false, group: 'sustainability-category', description: 'Tile only: e.g. BIa (<0.5%)',                     example: '' },
];

export const VARIANT_COLUMNS: CsvColumnDef[] = [
  { key: 'parentName',        required: true,  group: 'core', description: 'Must match a product name exactly in the Products sheet',          example: 'Cliff Edge' },
  { key: 'variant_name',      required: true,  group: 'core', description: "Manufacturer's colourway/finish name — never a code",             example: 'Bone' },
  { key: 'variant_imageUrl',  required: true,  group: 'core', description: 'Product photo URL for this specific variant',                     example: 'https://cdn.example.com/cliff-edge-bone.jpg' },
  { key: 'variant_tone',      required: true,  group: 'core', description: 'Representative hex — AI use only, never shown',                   example: '#D4CFC4' },
  { key: 'variant_productCode',required: false, group: 'identity', description: 'SKU for this specific variant',                              example: 'CE-BONE-001' },
  { key: 'variant_isDefault', required: false, group: 'core', description: 'TRUE for the default variant (max one per product)', allowedValues: ['TRUE','FALSE'], example: 'TRUE' },
];

// ─── CSV parsing ───────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .split('\n')
    .map(l => l.replace(/\r$/, ''))
    .filter(l => l.trim() && !l.trim().startsWith('#'));
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  return lines.slice(1)
    .map(line => {
      const values = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim(); });
      return row;
    })
    .filter(row => Object.values(row).some(v => v !== ''));
}

// ─── Validation ────────────────────────────────────────────────────────────

export interface RowValidationResult {
  rowIndex: number;
  name: string;
  errors: string[];
  warnings: string[];
}

export function validateProductRow(
  row: Record<string, string>,
  rowIndex: number,
): RowValidationResult {
  const validPaths = getAllCategoryPaths();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row['name']?.trim()) errors.push('"name" is required');
  if (!row['treePath']?.trim()) {
    errors.push('"treePath" is required');
  } else if (!validPaths.includes(row['treePath'].trim())) {
    errors.push(`"treePath" value "${row['treePath']}" does not match any valid category path — check spelling and capitalisation`);
  }
  if (!row['description']?.trim()) errors.push('"description" is required');
  if (!row['imageUrl']?.trim()) errors.push('"imageUrl" is required');
  if (!row['variantMode']?.trim()) {
    errors.push('"variantMode" is required');
  } else if (!['photo-variants','colour-standard','surface-finish','none'].includes(row['variantMode'].trim())) {
    errors.push('"variantMode" must be: photo-variants, colour-standard, surface-finish, or none');
  }
  if (!row['finish']?.trim()) warnings.push('"finish" description is missing');
  if (!row['tone']?.trim()) warnings.push('"tone" hex is missing — AI colour matching will be less accurate');

  if (row['internalExternal'] && !['internal','external','both'].includes(row['internalExternal'])) {
    errors.push('"internalExternal" must be: internal, external, or both');
  }
  if (row['sus_evidence_level'] && !['third-party-verified','manufacturer-declared','published-source','unknown'].includes(row['sus_evidence_level'])) {
    errors.push('"sus_evidence_level" must be: third-party-verified, manufacturer-declared, published-source, or unknown');
  }

  return { rowIndex, name: row['name'] || `Row ${rowIndex + 2}`, errors, warnings };
}

export function validateVariantRow(
  row: Record<string, string>,
  rowIndex: number,
  knownProductNames: string[],
): { rowIndex: number; errors: string[] } {
  const errors: string[] = [];
  if (!row['parentName']?.trim()) errors.push('"parentName" is required');
  else if (!knownProductNames.includes(row['parentName'].trim())) {
    errors.push(`"parentName" "${row['parentName']}" does not match any product in the Products sheet`);
  }
  if (!row['variant_name']?.trim()) errors.push('"variant_name" is required');
  if (!row['variant_imageUrl']?.trim()) errors.push('"variant_imageUrl" is required');
  if (!row['variant_tone']?.trim()) errors.push('"variant_tone" (hex) is required');
  return { rowIndex, errors };
}

// ─── Assemblers ────────────────────────────────────────────────────────────

function bool(v: string | undefined): boolean {
  return (v ?? '').trim().toUpperCase() === 'TRUE';
}

function num(v: string | undefined): number | undefined {
  const n = parseFloat((v ?? '').trim());
  return isNaN(n) ? undefined : n;
}

function splitComma(v: string | undefined): string[] {
  return (v ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

export function assembleSustainabilityData(row: Record<string, string>): SustainabilityData | null {
  const hasAnyData = ['sus_epd_available','sus_epd_url','sus_headline_carbon','sus_certifications',
    'sus_recycled_pct','sus_evidence_level','sus_take_back','sus_voc_content','sus_timber_coc',
    'sus_timber_species','sus_stone_country','sus_metal_recycled_pct'].some(k => row[k]?.trim());
  if (!hasAnyData) return null;

  const epdAvailable = bool(row['sus_epd_available']) || !!row['sus_epd_url']?.trim();
  const evidenceLevel = (row['sus_evidence_level']?.trim() ||
    (epdAvailable ? 'manufacturer-declared' : 'unknown')) as EvidenceLevel;

  // Certifications array
  const certifications = splitComma(row['sus_certifications']).map(scheme => ({
    scheme: scheme.trim(),
    verified: evidenceLevel === 'third-party-verified',
  }));

  // Headline carbon
  const carbonValue = num(row['sus_headline_carbon']);
  const headlineCarbon = carbonValue !== undefined ? {
    value: carbonValue,
    unit: row['sus_headline_carbon_unit']?.trim() || 'kgCO2e/m²',
    basis: row['sus_headline_carbon_basis']?.trim() || 'A1–A3',
    confidence: evidenceLevel,
  } : null;

  // Category-specific attributes — only populate the key(s) that have data
  const categoryAttributes: SustainabilityData['categoryAttributes'] = {};

  if (row['sus_timber_coc'] || row['sus_timber_species'] || row['sus_timber_country']) {
    categoryAttributes.timber = {
      certifiedSource: !!row['sus_timber_coc'],
      chainOfCustody: row['sus_timber_coc']?.trim() || undefined,
      species: row['sus_timber_species']?.trim() || undefined,
      countryOfOrigin: row['sus_timber_country']?.trim() || undefined,
      formaldehydeClass: row['sus_formaldehyde_class']?.trim() || undefined,
    };
  }
  if (row['sus_voc_content'] || row['sus_emissions_class']) {
    categoryAttributes.paint = {
      vocContent: (row['sus_voc_content']?.trim() || undefined) as any,
      vocGramsPerLitre: num(row['sus_voc_grams_per_litre']),
      emissionsClass: row['sus_emissions_class']?.trim() || undefined,
    };
  }
  if (row['sus_stone_country']) {
    categoryAttributes.stone = { countryOfOrigin: row['sus_stone_country'].trim() };
  }
  const metalRecycled = num(row['sus_metal_recycled_pct']);
  if (metalRecycled !== undefined) {
    categoryAttributes.metal = { recycledContentPct: metalRecycled };
  }
  if (row['sus_tile_water_absorption']) {
    categoryAttributes.tile = { waterAbsorption: row['sus_tile_water_absorption'].trim() };
  }
  // Generic recycled content goes into textile if no more specific category matched
  const recycledPct = num(row['sus_recycled_pct']);
  if (recycledPct !== undefined && !categoryAttributes.timber && !categoryAttributes.metal) {
    categoryAttributes.textile = {
      recycledContentPct: recycledPct,
      takeBackScheme: bool(row['sus_take_back']) || undefined,
    };
  }

  // Normalised claims for UI badges
  const claims: NonNullable<SustainabilityData['claims']> = [];
  if (epdAvailable) claims.push({ type: 'epd-available', label: 'EPD available', confidence: evidenceLevel });
  if (recycledPct !== undefined) {
    claims.push({ type: 'recycled-content', label: `${recycledPct}% recycled content`, value: recycledPct, unit: '%', confidence: evidenceLevel });
  }
  if (bool(row['sus_take_back'])) {
    claims.push({ type: 'take-back', label: 'Manufacturer take-back scheme', confidence: evidenceLevel });
  }

  return {
    epd: {
      available: epdAvailable,
      epdUrl: row['sus_epd_url']?.trim() || undefined,
      epdProgramOperator: row['sus_epd_operator']?.trim() || undefined,
      standard: row['sus_epd_standard']?.trim() || undefined,
      validUntil: row['sus_epd_valid_until']?.trim() || undefined,
      declaredUnit: row['sus_epd_declared_unit']?.trim() || undefined,
      dataSource: 'manufacturer-supplied',
      verificationStatus: evidenceLevel === 'third-party-verified' ? 'third-party-verified' : 'self-declared',
    },
    headlineCarbon: headlineCarbon ?? undefined,
    certifications: certifications.length > 0 ? certifications : undefined,
    categoryAttributes: Object.keys(categoryAttributes).length > 0 ? categoryAttributes : undefined,
    claims: claims.length > 0 ? claims : undefined,
    evidenceLevel,
  };
}

export function assembleVariants(
  variantRows: Record<string, string>[],
  parentName: string,
): ProductVariant[] {
  return variantRows
    .filter(r => r['parentName']?.trim() === parentName)
    .map(r => ({
      id: `${parentName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${r['variant_name'].toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: r['variant_name'].trim(),
      imageUrl: r['variant_imageUrl'].trim(),
      tone: r['variant_tone']?.trim() || '#888888',
      productCode: r['variant_productCode']?.trim() || undefined,
      isDefault: bool(r['variant_isDefault']),
    }));
}

export function assembleProductFromRow(
  row: Record<string, string>,
  variantRows: Record<string, string>[],
): Record<string, unknown> {
  const variants = assembleVariants(variantRows, row['name']?.trim() ?? '');
  const sustainability = assembleSustainabilityData(row);
  const applications = splitComma(row['applications']) as any[];
  const typicalUse = splitComma(row['typicalUse']) as any[];

  const hasDimensions = row['dimensionThickness'] || row['dimensionWidth'] || row['dimensionLength'] || row['weightPerM2'];
  const dimensions = hasDimensions ? {
    thickness: row['dimensionThickness']?.trim() || undefined,
    width: row['dimensionWidth']?.trim() || undefined,
    length: row['dimensionLength']?.trim() || undefined,
    weightPerM2: row['weightPerM2']?.trim() || undefined,
  } : null;

  const variantMode = (row['variantMode']?.trim() || 'none') as VariantMode;

  return {
    name: row['name'].trim(),
    treePaths: [row['treePath'].trim()],
    description: row['description'].trim(),
    imageUrl: row['imageUrl']?.trim() || null,
    finish: row['finish']?.trim() || '',
    tone: row['tone']?.trim() || '#888888',
    keywords: [],
    // legacy required field — set to a broad value; admin assigns treePaths on approval
    category: 'floor',

    productCollection: row['productCollection']?.trim() || null,
    productRange: row['productRange']?.trim() || null,
    productCode: row['productCode']?.trim() || null,
    productPageUrl: row['productPageUrl']?.trim() || null,
    sampleRequestUrl: row['sampleRequestUrl']?.trim() || null,

    variantMode,
    isVariantParent: variants.length > 0,
    variantOf: null,
    variantGroup: variants.length > 0
      ? row['name'].toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : null,
    variants: variants.length > 0 ? variants : null,

    applications: applications.length > 0 ? applications : null,
    internalExternal: (row['internalExternal']?.trim() || null) as any,
    typicalUse: typicalUse.length > 0 ? typicalUse : null,

    dimensions,
    fireRating: row['fireRating']?.trim() || null,
    acousticRating: row['acousticRating']?.trim() || null,
    thermalValue: row['thermalValue']?.trim() || null,
    slipResistance: row['slipResistance']?.trim() || null,
    warranty: row['warranty']?.trim() || null,
    priceRange: row['priceRange']?.trim() || null,
    leadTime: row['leadTime']?.trim() || null,
    minOrderQty: row['minOrderQty']?.trim() || null,

    sustainability,

    // Legacy flat fields — derived from sustainability object for backward compat
    epdUrl: row['sus_epd_url']?.trim() || null,
    embodiedCarbonA1A3: num(row['sus_headline_carbon']) ?? null,
    recycledContentPct: num(row['sus_recycled_pct']) ?? null,
    recycledAtEol: null,
    vocClass: row['sus_voc_content']?.trim() || null,
    certifications: splitComma(row['sus_certifications']),
    nbsClause: null,
  };
}

// ─── Template generation ───────────────────────────────────────────────────

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function generateProductsTemplate(): string {
  const headers = PRODUCT_COLUMNS.map(c => c.key).join(',');
  const descriptions = PRODUCT_COLUMNS.map(c => csvEscape(`[${c.required ? 'REQUIRED' : 'optional'}] ${c.description}${c.allowedValues ? ` (${c.allowedValues.join(' | ')})` : ''}`)).join(',');
  const exampleRow = PRODUCT_COLUMNS.map(c => csvEscape(c.example)).join(',');
  return `${headers}\n${descriptions}\n${exampleRow}\n`;
}

export function generateVariantsTemplate(): string {
  const headers = VARIANT_COLUMNS.map(c => c.key).join(',');
  const descriptions = VARIANT_COLUMNS.map(c => csvEscape(`[${c.required ? 'REQUIRED' : 'optional'}] ${c.description}`)).join(',');
  const exampleRow = VARIANT_COLUMNS.map(c => csvEscape(c.example)).join(',');
  return `${headers}\n${descriptions}\n${exampleRow}\n`;
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
