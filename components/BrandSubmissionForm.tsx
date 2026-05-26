import React, { useState, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Upload } from 'lucide-react';
import type { BrandProductSubmission } from '../types';

interface BrandSubmissionFormProps {
  onNavigate: (page: string) => void;
}

interface FormBrand {
  companyName: string;
  website: string;
  logoFile: File | null;
  tagline: string;
  countryOfOrigin: string;
  contactName: string;
  contactEmail: string;
}

const EMPTY_PRODUCT: BrandProductSubmission = {
  name: '', category: '', productCode: '', productRange: '', productPageUrl: '',
  finish: '', description: '', keywords: '', tone: '#888888',
  bimObjectUrl: '',
  dimensionThickness: '', dimensionWidth: '', dimensionLength: '', weightPerM2: '',
  fireRating: '', acousticRating: '', thermalValue: '', slipResistance: '', warranty: '',
  epdUrl: '', embodiedCarbonA1A3: '', recycledContentPct: '', recycledAtEol: null,
  vocClass: '', certifications: '', nbsClause: '',
  priceRange: '', leadTime: '', minOrderQty: '',
  carbonIntensity: '', healthRiskLevel: '', healthConcerns: '', healthNote: '',
  risks: '', serviceLife: '', finishOptions: '', colorOptions: '',
};

const CATEGORIES = [
  'Concrete', 'Stone', 'Brick & Masonry', 'Metal', 'Glass', 'Wood & Timber',
  'Ceramic & Porcelain', 'Render & Plaster', 'Insulation', 'Membrane & Waterproofing',
  'Flooring', 'Cladding', 'Fabric & Soft Furnishings', 'Paint & Coatings', 'Other',
];

function getApiBase() {
  const useLocalApi = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LOCAL_API === 'true';
  if (useLocalApi) return 'http://localhost:7071';
  const isViteDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  if (isViteDev) return '/__api_proxy__';
  return 'https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net';
}

async function uploadAsset(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  const res = await fetch(`${getApiBase()}/api/brand-assets`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const { url } = await res.json() as { url: string };
  return url;
}

const STEP_LABELS = ['Company', 'Products', 'Review & Submit'];

const BrandSubmissionForm: React.FC<BrandSubmissionFormProps> = ({ onNavigate }) => {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brand, setBrand] = useState<FormBrand>({
    companyName: '', website: '', logoFile: null, tagline: '',
    countryOfOrigin: '', contactName: '', contactEmail: '',
  });

  const [products, setProducts] = useState<BrandProductSubmission[]>([{ ...EMPTY_PRODUCT }]);
  const [activeProduct, setActiveProduct] = useState(0);

  // File refs for product assets
  const specSheetRefs = useRef<(HTMLInputElement | null)[]>([]);
  const epdRefs = useRef<(HTMLInputElement | null)[]>([]);
  const productImageRefs = useRef<(HTMLInputElement | null)[]>([]);
  const logoRef = useRef<HTMLInputElement | null>(null);

  const updateBrand = (field: keyof FormBrand, value: string | File | null) =>
    setBrand((prev) => ({ ...prev, [field]: value }));

  const updateProduct = (idx: number, field: keyof BrandProductSubmission, value: unknown) =>
    setProducts((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));

  const addProduct = () => {
    setProducts((prev) => [...prev, { ...EMPTY_PRODUCT }]);
    setActiveProduct(products.length);
  };

  const removeProduct = (idx: number) => {
    if (products.length === 1) return;
    setProducts((prev) => prev.filter((_, i) => i !== idx));
    setActiveProduct(Math.max(0, idx - 1));
  };

  const validateStep0 = () => {
    if (!brand.companyName.trim()) return 'Company name is required';
    if (!brand.contactName.trim()) return 'Contact name is required';
    if (!brand.contactEmail.trim()) return 'Contact email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brand.contactEmail)) return 'Valid email is required';
    return null;
  };

  const validateStep1 = () => {
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.name.trim()) return `Product ${i + 1}: name is required`;
      if (!p.category) return `Product ${i + 1}: category is required`;
      if (!p.finish.trim()) return `Product ${i + 1}: finish is required`;
      if (!p.description.trim()) return `Product ${i + 1}: description is required`;
    }
    return null;
  };

  const handleNext = () => {
    setError(null);
    if (step === 0) {
      const err = validateStep0();
      if (err) { setError(err); return; }
    }
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      // Upload logo if provided
      let logoUrl: string | null = null;
      if (brand.logoFile) {
        logoUrl = await uploadAsset(brand.logoFile);
      }

      // Upload per-product assets
      const processedProducts = await Promise.all(
        products.map(async (p, idx) => {
          const specSheetInput = specSheetRefs.current[idx];
          const epdInput = epdRefs.current[idx];
          const imageInput = productImageRefs.current[idx];

          let specSheetUrl = p.epdUrl || null;
          let epdUrl = p.epdUrl || null;
          const productImages: string[] = [];

          if (specSheetInput?.files?.[0]) {
            specSheetUrl = await uploadAsset(specSheetInput.files[0] as File);
          }
          if (epdInput?.files?.[0]) {
            epdUrl = await uploadAsset(epdInput.files[0] as File);
          }
          if (imageInput?.files) {
            for (const file of Array.from(imageInput.files as FileList)) {
              productImages.push(await uploadAsset(file));
            }
          }

          const certifications = p.certifications
            ? p.certifications.split(/[,|]/).map((s) => s.trim()).filter(Boolean)
            : [];

          const keywords = p.keywords
            ? p.keywords.split(/[,|]/).map((s) => s.trim()).filter(Boolean)
            : [];

          return {
            name: p.name,
            category: p.category,
            description: p.description,
            keywords,
            tone: p.tone,
            finish: p.finish,
            carbonIntensity: (p.carbonIntensity || undefined) as 'low' | 'medium' | 'high' | undefined,
            productCode: p.productCode || null,
            productRange: p.productRange || null,
            productPageUrl: p.productPageUrl || null,
            bimObjectUrl: p.bimObjectUrl || null,
            specSheetUrl: specSheetUrl || null,
            installGuideUrl: null,
            epdUrl: epdUrl || null,
            productImages,
            dimensions: (p.dimensionThickness || p.dimensionWidth || p.dimensionLength || p.weightPerM2)
              ? {
                  thickness: p.dimensionThickness || undefined,
                  width: p.dimensionWidth || undefined,
                  length: p.dimensionLength || undefined,
                  weightPerM2: p.weightPerM2 || undefined,
                }
              : null,
            fireRating: p.fireRating || null,
            acousticRating: p.acousticRating || null,
            thermalValue: p.thermalValue || null,
            slipResistance: p.slipResistance || null,
            warranty: p.warranty || null,
            embodiedCarbonA1A3: p.embodiedCarbonA1A3 ? parseFloat(p.embodiedCarbonA1A3) : null,
            recycledContentPct: p.recycledContentPct ? parseFloat(p.recycledContentPct) : null,
            recycledAtEol: p.recycledAtEol,
            vocClass: p.vocClass || null,
            certifications,
            nbsClause: p.nbsClause || null,
            priceRange: p.priceRange || null,
            leadTime: p.leadTime || null,
            minOrderQty: p.minOrderQty || null,
            healthRiskLevel: (p.healthRiskLevel || null) as 'low' | 'medium' | 'high' | null,
            healthConcerns: p.healthConcerns
              ? p.healthConcerns.split(/[,|]/).map((s) => s.trim()).filter(Boolean)
              : null,
            healthNote: p.healthNote || null,
            risks: null,
            serviceLife: p.serviceLife ? parseInt(p.serviceLife, 10) : null,
          };
        })
      );

      const payload = {
        brand: {
          name: brand.companyName,
          website: brand.website || null,
          logoUrl,
          tagline: brand.tagline || null,
          countryOfOrigin: brand.countryOfOrigin || null,
          contactName: brand.contactName,
          contactEmail: brand.contactEmail,
        },
        materials: processedProducts,
      };

      const res = await fetch(`${getApiBase()}/api/brand-submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `Submission failed: ${res.status}`);
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="w-full pt-20 min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-6 max-w-lg px-6">
          <div className="w-12 h-12 bg-black flex items-center justify-center mx-auto">
            <Check className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-display text-3xl uppercase font-bold tracking-tight">Submission received</h1>
          <p className="font-sans text-gray-600 leading-relaxed">
            We'll review your products and get in touch with {brand.contactEmail}. This typically takes 3–5 business days.
          </p>
          <button
            onClick={() => onNavigate('concept')}
            className="inline-flex items-center gap-2 border border-black px-6 py-3 text-xs font-mono uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pt-20 min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 py-8">
        <div className="max-w-3xl mx-auto px-6 space-y-4">
          <button
            onClick={() => onNavigate('concept')}
            className="flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-gray-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div>
            <h1 className="font-display text-3xl md:text-4xl uppercase font-bold tracking-tight">
              Get your products featured
            </h1>
            <p className="font-sans text-gray-600 mt-2 leading-relaxed">
              Submit product data to feature in the Moodboard Lab material library. Partner brands supply verified specifications and EPDs so architects see accurate data at concept stage.
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-0">
            {STEP_LABELS.map((label, idx) => (
              <React.Fragment key={label}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 flex items-center justify-center text-[10px] font-mono transition-colors ${
                      idx < step
                        ? 'bg-black text-white'
                        : idx === step
                        ? 'bg-black text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {idx < step ? <Check className="w-3 h-3" /> : idx + 1}
                  </div>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-widest hidden sm:block ${
                      idx === step ? 'text-black' : 'text-gray-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {idx < STEP_LABELS.length - 1 && (
                  <div className={`h-[1px] w-8 mx-2 ${idx < step ? 'bg-black' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Form body */}
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {error && (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm font-sans text-red-700">
            {error}
          </div>
        )}

        {/* Step 0: Company */}
        {step === 0 && (
          <div className="space-y-6">
            <h2 className="font-display text-2xl uppercase tracking-tight">Company profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2 space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                  Company name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={brand.companyName}
                  onChange={(e) => updateBrand('companyName', e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-black"
                  placeholder="e.g. Rockwool UK"
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Website</label>
                <input
                  type="url"
                  value={brand.website}
                  onChange={(e) => updateBrand('website', e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-black"
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Country</label>
                <input
                  type="text"
                  value={brand.countryOfOrigin}
                  onChange={(e) => updateBrand('countryOfOrigin', e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-black"
                  placeholder="e.g. United Kingdom"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                  One-line description
                </label>
                <input
                  type="text"
                  value={brand.tagline}
                  onChange={(e) => updateBrand('tagline', e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-black"
                  placeholder="e.g. High-performance stone wool insulation for demanding environments"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                  Company logo <span className="text-gray-400">(PNG, JPG or WebP, max 10 MB)</span>
                </label>
                <div
                  className="border border-dashed border-gray-300 px-4 py-6 text-center cursor-pointer hover:border-black transition-colors"
                  onClick={() => logoRef.current?.click()}
                >
                  {brand.logoFile ? (
                    <p className="font-sans text-sm text-gray-700">{brand.logoFile.name}</p>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-5 h-5 text-gray-400 mx-auto" />
                      <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Click to upload</p>
                    </div>
                  )}
                  <input
                    ref={logoRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => updateBrand('logoFile', e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                  Contact name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={brand.contactName}
                  onChange={(e) => updateBrand('contactName', e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-black"
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                  Contact email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={brand.contactEmail}
                  onChange={(e) => updateBrand('contactEmail', e.target.value)}
                  className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-black"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Products */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl uppercase tracking-tight">Products</h2>
              <button
                onClick={addProduct}
                className="flex items-center gap-2 border border-gray-300 px-4 py-2 text-xs font-mono uppercase tracking-widest hover:border-black transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add product
              </button>
            </div>

            {/* Product tabs */}
            {products.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {products.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveProduct(idx)}
                    className={`px-4 py-1.5 text-xs font-mono uppercase tracking-widest border transition-colors ${
                      idx === activeProduct
                        ? 'bg-black text-white border-black'
                        : 'border-gray-300 text-gray-500 hover:border-black'
                    }`}
                  >
                    {p.name || `Product ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}

            {products.map((p, idx) => (
              <div key={idx} className={idx !== activeProduct ? 'hidden' : 'space-y-8'}>
                {/* Required */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Required</p>
                    {products.length > 1 && (
                      <button
                        onClick={() => removeProduct(idx)}
                        className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                        Product name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => updateProduct(idx, 'name', e.target.value)}
                        className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-black"
                        placeholder="e.g. ROCKWOOL RWA45"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={p.category}
                        onChange={(e) => updateProduct(idx, 'category', e.target.value)}
                        className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-black bg-white"
                      >
                        <option value="">Select category…</option>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                        Finish / texture <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={p.finish}
                        onChange={(e) => updateProduct(idx, 'finish', e.target.value)}
                        className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-black"
                        placeholder="e.g. Natural stone finish, Polished"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Carbon intensity</label>
                      <select
                        value={p.carbonIntensity}
                        onChange={(e) => updateProduct(idx, 'carbonIntensity', e.target.value)}
                        className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-black bg-white"
                      >
                        <option value="">Unknown</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={p.description}
                        onChange={(e) => updateProduct(idx, 'description', e.target.value)}
                        className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-black resize-none"
                        placeholder="Brief description of the product and its typical uses"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                        Keywords <span className="text-gray-400">(comma separated)</span>
                      </label>
                      <input
                        type="text"
                        value={p.keywords}
                        onChange={(e) => updateProduct(idx, 'keywords', e.target.value)}
                        className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-black"
                        placeholder="e.g. insulation, mineral wool, fire resistant"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                        Representative colour
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={p.tone}
                          onChange={(e) => updateProduct(idx, 'tone', e.target.value)}
                          className="w-10 h-10 border border-gray-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={p.tone}
                          onChange={(e) => updateProduct(idx, 'tone', e.target.value)}
                          className="flex-1 border border-gray-300 px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-black"
                          placeholder="#888888"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technical (optional) */}
                <details className="group border border-gray-200">
                  <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Technical specification (optional)</span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-4 pb-5 pt-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      ['productCode', 'Product code / SKU'],
                      ['productRange', 'Product range / collection'],
                      ['dimensionThickness', 'Thickness (e.g. 50mm)'],
                      ['dimensionWidth', 'Width (e.g. 600mm)'],
                      ['dimensionLength', 'Length (e.g. 2400mm)'],
                      ['weightPerM2', 'Weight per m² (e.g. 15 kg/m²)'],
                      ['fireRating', 'Fire rating (e.g. Euroclass A1)'],
                      ['acousticRating', 'Acoustic rating (e.g. Rw 52 dB)'],
                      ['thermalValue', 'Thermal value (e.g. λ = 0.034 W/mK)'],
                      ['slipResistance', 'Slip resistance (e.g. R10)'],
                      ['warranty', 'Warranty'],
                    ].map(([field, label]) => (
                      <div key={field} className="space-y-1">
                        <label className="font-mono text-[10px] uppercase tracking-widest text-gray-500">{label}</label>
                        <input
                          type="text"
                          value={(p as Record<string, unknown>)[field] as string}
                          onChange={(e) => updateProduct(idx, field as keyof BrandProductSubmission, e.target.value)}
                          className="w-full border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                        />
                      </div>
                    ))}
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Product page URL</label>
                      <input
                        type="url"
                        value={p.productPageUrl}
                        onChange={(e) => updateProduct(idx, 'productPageUrl', e.target.value)}
                        className="w-full border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                        placeholder="https://example.com/product"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-500">BIM object URL</label>
                      <input
                        type="url"
                        value={p.bimObjectUrl}
                        onChange={(e) => updateProduct(idx, 'bimObjectUrl', e.target.value)}
                        className="w-full border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                        placeholder="https://example.com/bim"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                        Spec sheet (PDF, max 10 MB)
                      </label>
                      <input
                        type="file"
                        accept="application/pdf"
                        ref={(el) => { specSheetRefs.current[idx] = el; }}
                        className="font-sans text-sm text-gray-600 file:mr-3 file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-mono file:uppercase file:tracking-widest file:cursor-pointer hover:file:border-black"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                        Product images (PNG, JPG or WebP, max 10 MB each)
                      </label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        ref={(el) => { productImageRefs.current[idx] = el; }}
                        className="font-sans text-sm text-gray-600 file:mr-3 file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-mono file:uppercase file:tracking-widest file:cursor-pointer hover:file:border-black"
                      />
                    </div>
                  </div>
                </details>

                {/* Sustainability (optional) */}
                <details className="group border border-gray-200">
                  <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Sustainability & compliance (optional)</span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-4 pb-5 pt-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Embodied carbon A1–A3 (kgCO₂e/kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={p.embodiedCarbonA1A3}
                        onChange={(e) => updateProduct(idx, 'embodiedCarbonA1A3', e.target.value)}
                        className="w-full border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Recycled content (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={p.recycledContentPct}
                        onChange={(e) => updateProduct(idx, 'recycledContentPct', e.target.value)}
                        className="w-full border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Recyclable at end of life?</label>
                      <select
                        value={p.recycledAtEol === null ? '' : p.recycledAtEol ? 'yes' : 'no'}
                        onChange={(e) =>
                          updateProduct(idx, 'recycledAtEol',
                            e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null)
                        }
                        className="w-full border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black bg-white"
                      >
                        <option value="">Unknown</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-500">VOC class</label>
                      <input
                        type="text"
                        value={p.vocClass}
                        onChange={(e) => updateProduct(idx, 'vocClass', e.target.value)}
                        className="w-full border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                        placeholder="e.g. A+ or Very Low"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                        Certifications <span className="text-gray-400">(comma separated)</span>
                      </label>
                      <input
                        type="text"
                        value={p.certifications}
                        onChange={(e) => updateProduct(idx, 'certifications', e.target.value)}
                        className="w-full border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                        placeholder="e.g. FSC, BRE A+, UKCA"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-500">NBS clause</label>
                      <input
                        type="text"
                        value={p.nbsClause}
                        onChange={(e) => updateProduct(idx, 'nbsClause', e.target.value)}
                        className="w-full border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                        placeholder="e.g. R21"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-500">EPD (PDF, max 10 MB)</label>
                      <input
                        type="file"
                        accept="application/pdf"
                        ref={(el) => { epdRefs.current[idx] = el; }}
                        className="font-sans text-sm text-gray-600 file:mr-3 file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-mono file:uppercase file:tracking-widest file:cursor-pointer hover:file:border-black"
                      />
                    </div>
                  </div>
                </details>

                {/* Commercial (optional) */}
                <details className="group border border-gray-200">
                  <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Commercial information (optional)</span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-4 pb-5 pt-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      ['priceRange', 'Price range (e.g. £45–£65/m²)'],
                      ['leadTime', 'Lead time (e.g. 4–6 weeks)'],
                      ['minOrderQty', 'Min order quantity (e.g. 10 m²)'],
                    ].map(([field, label]) => (
                      <div key={field} className="space-y-1">
                        <label className="font-mono text-[10px] uppercase tracking-widest text-gray-500">{label}</label>
                        <input
                          type="text"
                          value={(p as Record<string, unknown>)[field] as string}
                          onChange={(e) => updateProduct(idx, field as keyof BrandProductSubmission, e.target.value)}
                          className="w-full border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black"
                        />
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}

        {/* Step 2: Review */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="font-display text-2xl uppercase tracking-tight">Review & submit</h2>

            {/* Company summary */}
            <div className="border border-gray-200 p-5 space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Company</p>
              <p className="font-display text-xl uppercase">{brand.companyName}</p>
              {brand.tagline && <p className="font-sans text-sm text-gray-600">{brand.tagline}</p>}
              <p className="font-sans text-sm text-gray-600">{brand.contactName} · {brand.contactEmail}</p>
            </div>

            {/* Product summaries */}
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                {products.length} product{products.length !== 1 ? 's' : ''}
              </p>
              {products.map((p, idx) => (
                <div key={idx} className="border border-gray-200 p-4 flex items-start gap-4">
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0 border border-white ring-1 ring-gray-200 mt-0.5"
                    style={{ backgroundColor: p.tone }}
                  />
                  <div>
                    <p className="font-display text-lg uppercase">{p.name || `Product ${idx + 1}`}</p>
                    <p className="font-sans text-xs text-gray-500">{p.category} · {p.finish}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="font-sans text-sm text-gray-500 leading-relaxed">
              By submitting, you confirm that you have permission to share this product data and agree to Moodboard Lab's{' '}
              <a href="/terms" className="underline hover:text-black">terms of service</a>.
              We'll review your submission and confirm via email.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-2 border border-gray-300 px-5 py-2.5 text-xs font-mono uppercase tracking-widest hover:border-black transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 2 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 bg-black text-white px-6 py-2.5 text-xs font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-black text-white px-6 py-2.5 text-xs font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting…' : 'Submit'}
              {!isSubmitting && <Check className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrandSubmissionForm;
