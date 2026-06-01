import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Upload } from 'lucide-react';
import { CATEGORIES } from '../../data/categories';
import type {
  VariantMode,
  EvidenceLevel,
} from '../../types';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface VariantDraft {
  name: string;
  imageUrl: string;
  tone: string;
  productCode: string;
  isDefault: boolean;
}

export interface CertificationDraft {
  scheme: string;
  value: string;
  verified: boolean;
}

export interface ProductDraft {
  // Step 1 — basics
  name: string;
  parentCategoryId: string;
  childCategoryId: string;
  grandchildCategoryId: string;
  description: string;
  imageUrl: string;
  finish: string;
  tone: string;

  // Step 2 — variants
  variantMode: VariantMode;
  productCollection: string;
  productRange: string;
  productCode: string;
  productPageUrl: string;
  sampleRequestUrl: string;
  variants: VariantDraft[];

  // Step 3 — sustainability
  epdAvailable: boolean;
  epdUrl: string;
  epdOperator: string;
  epdStandard: string;
  epdValidUntil: string;
  epdDeclaredUnit: string;
  headlineCarbonValue: string;
  headlineCarbonUnit: string;
  headlineCarbonBasis: string;
  evidenceLevel: EvidenceLevel | '';
  certifications: CertificationDraft[];
  recycledContentPct: string;
  takeBackScheme: boolean;
  // category-specific
  timberChainOfCustody: string;
  timberSpecies: string;
  timberCountry: string;
  formaldehydeClass: string;
  paintVocContent: string;
  paintVocGpl: string;
  paintEmissionsClass: string;
  stoneCountry: string;
  metalRecycledPct: string;
  tileWaterAbsorption: string;

  // Step 4 — spec + commercial
  applications: string[];
  internalExternal: '' | 'internal' | 'external' | 'both';
  typicalUse: string[];
  dimensionThickness: string;
  dimensionWidth: string;
  dimensionLength: string;
  weightPerM2: string;
  fireRating: string;
  acousticRating: string;
  thermalValue: string;
  slipResistance: string;
  warranty: string;
  priceRange: string;
  leadTime: string;
  minOrderQty: string;
}

const EMPTY_DRAFT: ProductDraft = {
  name: '', parentCategoryId: '', childCategoryId: '', grandchildCategoryId: '',
  description: '', imageUrl: '', finish: '', tone: '#888888',
  variantMode: 'none', productCollection: '', productRange: '', productCode: '',
  productPageUrl: '', sampleRequestUrl: '', variants: [],
  epdAvailable: false, epdUrl: '', epdOperator: '', epdStandard: 'EN 15804+A2',
  epdValidUntil: '', epdDeclaredUnit: '1 m²', headlineCarbonValue: '',
  headlineCarbonUnit: 'kgCO2e/m²', headlineCarbonBasis: 'A1–A3', evidenceLevel: '',
  certifications: [], recycledContentPct: '', takeBackScheme: false,
  timberChainOfCustody: '', timberSpecies: '', timberCountry: '', formaldehydeClass: '',
  paintVocContent: '', paintVocGpl: '', paintEmissionsClass: '',
  stoneCountry: '', metalRecycledPct: '', tileWaterAbsorption: '',
  applications: [], internalExternal: '', typicalUse: [],
  dimensionThickness: '', dimensionWidth: '', dimensionLength: '', weightPerM2: '',
  fireRating: '', acousticRating: '', thermalValue: '', slipResistance: '',
  warranty: '', priceRange: '', leadTime: '', minOrderQty: '',
};

const EMPTY_VARIANT: VariantDraft = { name: '', imageUrl: '', tone: '#888888', productCode: '', isDefault: false };

const STEPS = ['Basics', 'Variants', 'Sustainability', 'Spec & Commercial', 'Review'];

const VARIANT_MODE_OPTIONS: { value: VariantMode; label: string; hint: string }[] = [
  { value: 'none',            label: 'No variants',      hint: 'Single product, no colour or finish choice' },
  { value: 'photo-variants',  label: 'Photo variants',   hint: 'Brand photo per variant — carpet colourways, tile SKUs, brassware finishes, wallpaper, etc.' },
  { value: 'surface-finish',  label: 'Surface finishes', hint: 'Same material, different surface treatments — stone polished/honed, timber oiled/lacquered' },
  { value: 'colour-standard', label: 'Colour standard',  hint: 'RAL / NCS / BS range — no per-colour photo needed (powder coat, architectural paint)' },
];

const APPLICATION_OPTIONS = ['floor','wall','ceiling','external-wall','roof','wet-area'];
const TYPICAL_USE_OPTIONS = ['commercial','residential','education','hospitality','healthcare','retail'];
const CERT_PRESETS = ['FSC','PEFC','BBA','CE','UKCA','BES 6001','ISO 14001','Cradle to Cradle','VOC A+'];
const EVIDENCE_LEVEL_OPTIONS: { value: EvidenceLevel; label: string }[] = [
  { value: 'third-party-verified', label: 'Third-party verified (EPD or independent cert)' },
  { value: 'manufacturer-declared', label: 'Manufacturer declared' },
  { value: 'published-source',      label: 'Published source / database' },
  { value: 'unknown',               label: 'Unknown / not assessed' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildTreePath(draft: ProductDraft): string {
  const parent = CATEGORIES.find(c => c.id === draft.parentCategoryId);
  const child = parent?.children?.find(c => c.id === draft.childCategoryId);
  const grandchild = child?.children?.find(c => c.id === draft.grandchildCategoryId);
  if (!parent || !child) return '';
  return grandchild ? `${parent.label}>${child.label}>${grandchild.label}` : `${parent.label}>${child.label}`;
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {hint && <p className="font-sans text-xs text-gray-400 leading-snug">{hint}</p>}
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-300 px-3 py-2 text-sm font-sans focus:outline-none focus:border-black transition-colors"
    />
  );
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-300 px-3 py-2 text-sm font-sans bg-white focus:outline-none focus:border-black transition-colors"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Textarea({ value, onChange, placeholder, rows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full border border-gray-300 px-3 py-2 text-sm font-sans focus:outline-none focus:border-black transition-colors resize-none"
    />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-black' : 'bg-gray-300'}`}
      >
        <span className={`block w-3 h-3 rounded-full bg-white mt-0.5 transition-transform ${checked ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
      </button>
      <span className="font-sans text-sm text-gray-700">{label}</span>
    </label>
  );
}

function CheckboxGroup({ options, selected, onChange }: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-colors ${
            selected.includes(opt) ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-500 hover:border-black'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Step components ───────────────────────────────────────────────────────

function StepBasics({ draft, update }: { draft: ProductDraft; update: (patch: Partial<ProductDraft>) => void }) {
  const parentCat = CATEGORIES.find(c => c.id === draft.parentCategoryId);
  const childCat = parentCat?.children?.find(c => c.id === draft.childCategoryId);
  const browseable = CATEGORIES.filter(c => !['favourites','brands','custom'].includes(c.id));

  return (
    <div className="space-y-6">
      <Field label="Product name" required>
        <Input value={draft.name} onChange={v => update({ name: v })} placeholder="e.g. Cliff Edge" />
      </Field>

      <div className="space-y-1">
        <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600">
          Category <span className="text-red-500">*</span>
        </label>
        <p className="font-sans text-xs text-gray-400">Select the most specific path that fits.</p>
        <div className="grid grid-cols-3 gap-2">
          <Select
            value={draft.parentCategoryId}
            onChange={v => update({ parentCategoryId: v, childCategoryId: '', grandchildCategoryId: '' })}
            placeholder="Section…"
            options={browseable.map(c => ({ value: c.id, label: c.label }))}
          />
          <Select
            value={draft.childCategoryId}
            onChange={v => update({ childCategoryId: v, grandchildCategoryId: '' })}
            placeholder="Sub-category…"
            options={(parentCat?.children ?? []).map(c => ({ value: c.id, label: c.label }))}
          />
          <Select
            value={draft.grandchildCategoryId}
            onChange={v => update({ grandchildCategoryId: v })}
            placeholder="Product type…"
            options={(childCat?.children ?? []).map(c => ({ value: c.id, label: c.label }))}
          />
        </div>
        {buildTreePath(draft) && (
          <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 pt-1">
            {buildTreePath(draft)}
          </p>
        )}
      </div>

      <Field label="Description" required hint="2–4 sentences. Focus on character, texture, and typical application.">
        <Textarea value={draft.description} onChange={v => update({ description: v })} placeholder="A textured loop pile carpet tile…" />
      </Field>

      <Field label="Primary image URL" required hint="Azure Blob URL or hosted image. Minimum 1000px wide.">
        <Input value={draft.imageUrl} onChange={v => update({ imageUrl: v })} placeholder="https://…" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Finish description" required hint="Short phrase, e.g. Loop pile, Honed, Satin powder coat">
          <Input value={draft.finish} onChange={v => update({ finish: v })} placeholder="Loop pile" />
        </Field>
        <Field label="Representative colour (hex)" hint="Used internally by AI for colour matching — never shown to users.">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={draft.tone}
              onChange={e => update({ tone: e.target.value })}
              className="w-10 h-9 border border-gray-300 cursor-pointer p-0.5"
            />
            <Input value={draft.tone} onChange={v => update({ tone: v })} placeholder="#888888" />
          </div>
        </Field>
      </div>
    </div>
  );
}

function StepVariants({ draft, update }: { draft: ProductDraft; update: (patch: Partial<ProductDraft>) => void }) {
  const addVariant = () => update({ variants: [...draft.variants, { ...EMPTY_VARIANT }] });
  const removeVariant = (i: number) => update({ variants: draft.variants.filter((_, idx) => idx !== i) });
  const updateVariant = (i: number, patch: Partial<VariantDraft>) =>
    update({ variants: draft.variants.map((v, idx) => idx === i ? { ...v, ...patch } : v) });
  const setDefault = (i: number) =>
    update({ variants: draft.variants.map((v, idx) => ({ ...v, isDefault: idx === i })) });

  const showVariantEditor = draft.variantMode === 'photo-variants' || draft.variantMode === 'surface-finish';

  return (
    <div className="space-y-6">
      <Field label="Product identity" hint="Optional groupings — use the levels your brand actually uses.">
        <div className="grid grid-cols-2 gap-3">
          <Input value={draft.productCollection} onChange={v => update({ productCollection: v })} placeholder="Collection (e.g. Human Nature)" />
          <Input value={draft.productRange} onChange={v => update({ productRange: v })} placeholder="Range (e.g. Cliff Edge)" />
          <Input value={draft.productCode} onChange={v => update({ productCode: v })} placeholder="SKU (e.g. CE-001)" />
          <Input value={draft.productPageUrl} onChange={v => update({ productPageUrl: v })} placeholder="Product page URL" />
          <Input value={draft.sampleRequestUrl} onChange={v => update({ sampleRequestUrl: v })} placeholder="Sample request URL" />
        </div>
      </Field>

      <div className="space-y-3">
        <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-600">
          Variant mode <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {VARIANT_MODE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ variantMode: opt.value, variants: [] })}
              className={`w-full text-left px-4 py-3 border transition-colors ${
                draft.variantMode === opt.value ? 'border-black bg-black text-white' : 'border-gray-200 hover:border-black'
              }`}
            >
              <p className={`font-mono text-[10px] uppercase tracking-widest ${draft.variantMode === opt.value ? 'text-white' : 'text-black'}`}>{opt.label}</p>
              <p className={`font-sans text-xs mt-0.5 ${draft.variantMode === opt.value ? 'text-gray-300' : 'text-gray-400'}`}>{opt.hint}</p>
            </button>
          ))}
        </div>
      </div>

      {showVariantEditor && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
              {draft.variantMode === 'surface-finish' ? 'Surface finish variants' : 'Colourways / variants'}
            </p>
            <button
              type="button"
              onClick={addVariant}
              className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest border border-gray-300 px-3 py-1.5 hover:border-black transition-colors"
            >
              <Plus className="w-3 h-3" /> Add variant
            </button>
          </div>

          {draft.variants.length === 0 && (
            <p className="font-sans text-sm text-gray-400 border border-dashed border-gray-200 p-4 text-center">
              No variants added yet. Click "Add variant" to begin.
            </p>
          )}

          {draft.variants.map((variant, i) => (
            <div key={i} className="border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400">Variant {i + 1}</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDefault(i)}
                    className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border transition-colors ${
                      variant.isDefault ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-400 hover:border-black'
                    }`}
                  >
                    Default
                  </button>
                  <button type="button" onClick={() => removeVariant(i)}>
                    <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500 transition-colors" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" required hint="Manufacturer's descriptive name — not a colour code">
                  <Input value={variant.name} onChange={v => updateVariant(i, { name: v })} placeholder={draft.variantMode === 'surface-finish' ? 'e.g. Honed' : 'e.g. Bone'} />
                </Field>
                <Field label="SKU">
                  <Input value={variant.productCode} onChange={v => updateVariant(i, { productCode: v })} placeholder="e.g. CE-BONE-001" />
                </Field>
              </div>
              <Field label="Image URL" required hint="Photo of this specific colourway / surface finish">
                <Input value={variant.imageUrl} onChange={v => updateVariant(i, { imageUrl: v })} placeholder="https://…" />
              </Field>
              <Field label="Representative hex" hint="AI colour matching only — never shown to users">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={variant.tone}
                    onChange={e => updateVariant(i, { tone: e.target.value })}
                    className="w-10 h-9 border border-gray-300 cursor-pointer p-0.5"
                  />
                  <Input value={variant.tone} onChange={v => updateVariant(i, { tone: v })} placeholder="#D4CFC4" />
                </div>
              </Field>
            </div>
          ))}
        </div>
      )}

      {draft.variantMode === 'colour-standard' && (
        <div className="border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700">Colour standard mode</p>
          <p className="font-sans text-xs text-amber-700 leading-relaxed">
            Individual colour variants are not listed here — users will select from a RAL/NCS/BS picker.
            Make sure the primary image (Step 1) shows the actual surface texture, scale, and sheen.
            A colour swatch alone is not enough.
          </p>
        </div>
      )}
    </div>
  );
}

function StepSustainability({ draft, update }: { draft: ProductDraft; update: (patch: Partial<ProductDraft>) => void }) {
  const addCert = (scheme: string) => {
    if (!draft.certifications.find(c => c.scheme === scheme)) {
      update({ certifications: [...draft.certifications, { scheme, value: '', verified: true }] });
    }
  };
  const removeCert = (i: number) => update({ certifications: draft.certifications.filter((_, idx) => idx !== i) });
  const updateCert = (i: number, patch: Partial<CertificationDraft>) =>
    update({ certifications: draft.certifications.map((c, idx) => idx === i ? { ...c, ...patch } : c) });

  const showTimber = draft.timberSpecies || draft.timberChainOfCustody || draft.timberCountry || true;
  const showPaint = draft.paintVocContent || draft.paintEmissionsClass || true;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Environmental Product Declaration (EPD)</p>
        <Toggle checked={draft.epdAvailable} onChange={v => update({ epdAvailable: v })} label="An EPD is available for this product" />

        {draft.epdAvailable && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Field label="EPD URL">
              <Input value={draft.epdUrl} onChange={v => update({ epdUrl: v })} placeholder="https://…" />
            </Field>
            <Field label="Programme operator" hint="e.g. BRE, IBU, EPD International">
              <Input value={draft.epdOperator} onChange={v => update({ epdOperator: v })} placeholder="IBU" />
            </Field>
            <Field label="Standard">
              <Input value={draft.epdStandard} onChange={v => update({ epdStandard: v })} placeholder="EN 15804+A2" />
            </Field>
            <Field label="Valid until">
              <Input type="date" value={draft.epdValidUntil} onChange={v => update({ epdValidUntil: v })} />
            </Field>
            <Field label="Declared unit" hint="e.g. 1 m², 1 kg, 1 item">
              <Input value={draft.epdDeclaredUnit} onChange={v => update({ epdDeclaredUnit: v })} placeholder="1 m²" />
            </Field>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Carbon figure</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Value (number only)">
            <Input value={draft.headlineCarbonValue} onChange={v => update({ headlineCarbonValue: v })} placeholder="12.4" />
          </Field>
          <Field label="Unit">
            <Select
              value={draft.headlineCarbonUnit}
              onChange={v => update({ headlineCarbonUnit: v })}
              options={[
                { value: 'kgCO2e/m²', label: 'kgCO2e/m²' },
                { value: 'kgCO2e/kg', label: 'kgCO2e/kg' },
                { value: 'kgCO2e/item', label: 'kgCO2e/item' },
              ]}
            />
          </Field>
          <Field label="Basis">
            <Select
              value={draft.headlineCarbonBasis}
              onChange={v => update({ headlineCarbonBasis: v })}
              options={[
                { value: 'A1–A3', label: 'A1–A3 (product stage)' },
                { value: 'A1–A3 + C1–C4', label: 'A1–A3 + C1–C4' },
                { value: 'A1–A5', label: 'A1–A5 (incl. installation)' },
              ]}
            />
          </Field>
        </div>
        <Field label="Evidence level" hint="How reliable is this figure?">
          <Select
            value={draft.evidenceLevel}
            onChange={v => update({ evidenceLevel: v as EvidenceLevel })}
            placeholder="Select…"
            options={EVIDENCE_LEVEL_OPTIONS}
          />
        </Field>
      </div>

      <div className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Certifications & accreditations</p>
        <div className="flex flex-wrap gap-1.5">
          {CERT_PRESETS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => addCert(s)}
              disabled={!!draft.certifications.find(c => c.scheme === s)}
              className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest border border-gray-200 hover:border-black disabled:opacity-30 transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
        {draft.certifications.map((cert, i) => (
          <div key={i} className="flex items-center gap-2 border border-gray-200 p-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600 w-24 flex-shrink-0">{cert.scheme}</span>
            <Input value={cert.value} onChange={v => updateCert(i, { value: v })} placeholder="Level / reference (optional)" />
            <button type="button" onClick={() => removeCert(i)}>
              <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Recycled content & circularity</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Recycled content %" hint="0–100, leave blank if unknown">
            <Input value={draft.recycledContentPct} onChange={v => update({ recycledContentPct: v })} placeholder="e.g. 62" />
          </Field>
        </div>
        <Toggle checked={draft.takeBackScheme} onChange={v => update({ takeBackScheme: v })} label="Manufacturer take-back scheme available" />
      </div>

      <details className="border border-gray-200">
        <summary className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-gray-500 cursor-pointer hover:bg-gray-50">
          Timber-specific fields
        </summary>
        <div className="px-4 pb-4 pt-2 grid grid-cols-2 gap-3">
          <Field label="Chain of custody">
            <Select value={draft.timberChainOfCustody} onChange={v => update({ timberChainOfCustody: v })} placeholder="None / not applicable" options={[{value:'FSC',label:'FSC'},{value:'PEFC',label:'PEFC'}]} />
          </Field>
          <Field label="Species">
            <Input value={draft.timberSpecies} onChange={v => update({ timberSpecies: v })} placeholder="e.g. European oak" />
          </Field>
          <Field label="Country of origin">
            <Input value={draft.timberCountry} onChange={v => update({ timberCountry: v })} placeholder="e.g. France" />
          </Field>
          <Field label="Formaldehyde class">
            <Select value={draft.formaldehydeClass} onChange={v => update({ formaldehydeClass: v })} placeholder="None / not applicable" options={[{value:'E0',label:'E0'},{value:'E1',label:'E1'},{value:'CARB P2',label:'CARB P2'},{value:'NAF',label:'NAF (No Added Formaldehyde)'}]} />
          </Field>
        </div>
      </details>

      <details className="border border-gray-200">
        <summary className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-gray-500 cursor-pointer hover:bg-gray-50">
          Paint & coating fields
        </summary>
        <div className="px-4 pb-4 pt-2 grid grid-cols-2 gap-3">
          <Field label="VOC content">
            <Select value={draft.paintVocContent} onChange={v => update({ paintVocContent: v })} placeholder="None / not applicable" options={[{value:'zero',label:'Zero'},{value:'low',label:'Low'},{value:'medium',label:'Medium'},{value:'high',label:'High'}]} />
          </Field>
          <Field label="VOC g/L">
            <Input value={draft.paintVocGpl} onChange={v => update({ paintVocGpl: v })} placeholder="e.g. 5" />
          </Field>
          <Field label="Emissions class">
            <Select value={draft.paintEmissionsClass} onChange={v => update({ paintEmissionsClass: v })} placeholder="None / not applicable" options={[{value:'A+',label:'A+'},{value:'A',label:'A'},{value:'B',label:'B'},{value:'C',label:'C'}]} />
          </Field>
        </div>
      </details>

      <details className="border border-gray-200">
        <summary className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-gray-500 cursor-pointer hover:bg-gray-50">
          Stone, metal & tile fields
        </summary>
        <div className="px-4 pb-4 pt-2 grid grid-cols-2 gap-3">
          <Field label="Stone — country of origin">
            <Input value={draft.stoneCountry} onChange={v => update({ stoneCountry: v })} placeholder="e.g. Italy" />
          </Field>
          <Field label="Metal — recycled content %">
            <Input value={draft.metalRecycledPct} onChange={v => update({ metalRecycledPct: v })} placeholder="e.g. 35" />
          </Field>
          <Field label="Tile — water absorption">
            <Input value={draft.tileWaterAbsorption} onChange={v => update({ tileWaterAbsorption: v })} placeholder="e.g. BIa (<0.5%)" />
          </Field>
        </div>
      </details>
    </div>
  );
}

function StepSpec({ draft, update }: { draft: ProductDraft; update: (patch: Partial<ProductDraft>) => void }) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Application context</p>
        <Field label="Where can this product be used?">
          <CheckboxGroup options={APPLICATION_OPTIONS} selected={draft.applications} onChange={v => update({ applications: v })} />
        </Field>
        <Field label="Internal / external">
          <Select
            value={draft.internalExternal}
            onChange={v => update({ internalExternal: v as ProductDraft['internalExternal'] })}
            placeholder="Select…"
            options={[{value:'internal',label:'Internal'},{value:'external',label:'External'},{value:'both',label:'Both'}]}
          />
        </Field>
        <Field label="Typical use contexts">
          <CheckboxGroup options={TYPICAL_USE_OPTIONS} selected={draft.typicalUse} onChange={v => update({ typicalUse: v })} />
        </Field>
      </div>

      <div className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Dimensions</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Thickness"><Input value={draft.dimensionThickness} onChange={v => update({ dimensionThickness: v })} placeholder="e.g. 7mm" /></Field>
          <Field label="Width"><Input value={draft.dimensionWidth} onChange={v => update({ dimensionWidth: v })} placeholder="e.g. 600mm" /></Field>
          <Field label="Length"><Input value={draft.dimensionLength} onChange={v => update({ dimensionLength: v })} placeholder="e.g. 1200mm" /></Field>
          <Field label="Weight per m²"><Input value={draft.weightPerM2} onChange={v => update({ weightPerM2: v })} placeholder="e.g. 680g/m²" /></Field>
        </div>
      </div>

      <div className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Performance ratings</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fire rating"><Input value={draft.fireRating} onChange={v => update({ fireRating: v })} placeholder="e.g. Euroclass Bfl-s1" /></Field>
          <Field label="Acoustic rating"><Input value={draft.acousticRating} onChange={v => update({ acousticRating: v })} placeholder="e.g. ΔLw 21 dB" /></Field>
          <Field label="Thermal value"><Input value={draft.thermalValue} onChange={v => update({ thermalValue: v })} placeholder="e.g. λ = 0.034 W/mK" /></Field>
          <Field label="Slip resistance"><Input value={draft.slipResistance} onChange={v => update({ slipResistance: v })} placeholder="e.g. R10" /></Field>
          <Field label="Warranty"><Input value={draft.warranty} onChange={v => update({ warranty: v })} placeholder="e.g. 15 years" /></Field>
        </div>
      </div>

      <div className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Commercial (optional)</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price range"><Input value={draft.priceRange} onChange={v => update({ priceRange: v })} placeholder="e.g. £45–£65/m²" /></Field>
          <Field label="Lead time"><Input value={draft.leadTime} onChange={v => update({ leadTime: v })} placeholder="e.g. 4–6 weeks" /></Field>
          <Field label="Min. order qty"><Input value={draft.minOrderQty} onChange={v => update({ minOrderQty: v })} placeholder="e.g. 10 m²" /></Field>
        </div>
      </div>
    </div>
  );
}

function StepReview({ draft }: { draft: ProductDraft }) {
  const treePath = buildTreePath(draft);
  const rows: [string, string][] = [
    ['Name', draft.name],
    ['Category', treePath || '—'],
    ['Variant mode', draft.variantMode || '—'],
    ['Variants', draft.variants.length > 0 ? `${draft.variants.length} variant${draft.variants.length > 1 ? 's' : ''}` : '—'],
    ['Collection', draft.productCollection || '—'],
    ['Range', draft.productRange || '—'],
    ['EPD available', draft.epdAvailable ? 'Yes' : 'No'],
    ['Carbon figure', draft.headlineCarbonValue ? `${draft.headlineCarbonValue} ${draft.headlineCarbonUnit} (${draft.headlineCarbonBasis})` : '—'],
    ['Certifications', draft.certifications.map(c => c.scheme).join(', ') || '—'],
    ['Applications', draft.applications.join(', ') || '—'],
    ['Internal/External', draft.internalExternal || '—'],
  ];
  return (
    <div className="space-y-6">
      <p className="font-sans text-sm text-gray-500">Review your product before submitting. This will be sent for Moodboard Lab review before going live.</p>
      {draft.imageUrl && (
        <div className="w-24 h-24 border border-gray-200 overflow-hidden">
          <img src={draft.imageUrl} alt={draft.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="border border-gray-200">
        {rows.map(([label, value]) => (
          <div key={label} className="flex border-b border-gray-100 last:border-0">
            <dt className="w-40 flex-shrink-0 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-gray-400 bg-gray-50">{label}</dt>
            <dd className="flex-1 px-3 py-2 font-sans text-sm text-gray-700">{value}</dd>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main form component ───────────────────────────────────────────────────

interface ProductSubmissionFormProps {
  brandId: string;
  brandName: string;
  brandContactEmail: string;
  brandWebsite?: string;
  brandLogoUrl?: string;
  onSubmit: (product: ProductDraft) => Promise<void>;
  onCancel: () => void;
}

export const ProductSubmissionForm: React.FC<ProductSubmissionFormProps> = ({
  onSubmit,
  onCancel,
}) => {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProductDraft>({ ...EMPTY_DRAFT });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<ProductDraft>) => setDraft(prev => ({ ...prev, ...patch }));

  const canAdvance = (): boolean => {
    if (step === 0) return !!(draft.name && buildTreePath(draft) && draft.description && draft.imageUrl && draft.finish);
    if (step === 1) return !!draft.variantMode;
    return true;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(draft);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
          <Check className="w-5 h-5 text-emerald-600" />
        </div>
        <p className="font-display text-lg uppercase tracking-wide">Submitted</p>
        <p className="font-sans text-sm text-gray-500 text-center max-w-xs">
          Your product has been sent for Moodboard Lab review. You'll be contacted once it's been approved.
        </p>
        <button onClick={onCancel} className="font-mono text-[10px] uppercase tracking-widest text-gray-400 hover:text-black transition-colors pt-2">
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-1.5 ${i < step ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono transition-colors ${
                i < step ? 'bg-black text-white' : i === step ? 'bg-black text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                {i < step ? <Check className="w-2.5 h-2.5" /> : i + 1}
              </span>
              <span className={`font-mono text-[9px] uppercase tracking-widest hidden sm:block ${i === step ? 'text-black' : 'text-gray-400'}`}>
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200 mx-2" />}
          </React.Fragment>
        ))}
      </div>

      <div className="mb-8">
        <h2 className="font-display text-xl uppercase tracking-wide mb-1">{STEPS[step]}</h2>
      </div>

      {/* Step content */}
      <div className="mb-8">
        {step === 0 && <StepBasics draft={draft} update={update} />}
        {step === 1 && <StepVariants draft={draft} update={update} />}
        {step === 2 && <StepSustainability draft={draft} update={update} />}
        {step === 3 && <StepSpec draft={draft} update={update} />}
        {step === 4 && <StepReview draft={draft} />}
      </div>

      {error && (
        <p className="mb-4 font-sans text-sm text-red-600 border border-red-200 bg-red-50 px-3 py-2">{error}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-6">
        <button
          onClick={() => step === 0 ? onCancel() : setStep(s => s - 1)}
          className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canAdvance()}
            className="flex items-center gap-2 px-5 py-2.5 bg-black text-white text-[10px] font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors disabled:opacity-40"
          >
            Next <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-black text-white text-[10px] font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors disabled:opacity-40"
          >
            {isSubmitting ? 'Submitting…' : 'Submit for review'}
          </button>
        )}
      </div>
    </div>
  );
};
