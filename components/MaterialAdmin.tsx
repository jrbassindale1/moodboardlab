import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Check, X } from 'lucide-react';
import { getMaterials, updateMaterial, saveMaterialIcon } from '../api';
import { useAuth } from '../auth';
import { isAuthBypassEnabled } from '../auth/authConfig';
import { generateMaterialIcon } from '../utils/materialIconGenerator';
import { getMaterialIconUrls } from '../utils/materialIconUrls';
import type { FinishFamily, MaterialOption } from '../types';

interface MaterialAdminProps {
  onNavigate: (page: string) => void;
}

type RiskItem = { risk: string; mitigation: string };
type HealthRiskLevel = 'low' | 'medium' | 'high' | null;
type CarbonIntensity = 'low' | 'medium' | 'high' | undefined;

const FINISH_FAMILY_OPTIONS: { value: FinishFamily; label: string }[] = [
  { value: 'self-finished', label: 'Self-finished / No options' },
  { value: 'ral', label: 'RAL Classic' },
  { value: 'ncs', label: 'NCS (Natural Color System)' },
  { value: 'pantone', label: 'Pantone' },
  { value: 'bs', label: 'British Standard' },
  { value: 'timber-stain', label: 'Timber — Stain' },
  { value: 'timber-oil', label: 'Timber — Oil' },
  { value: 'timber-lacquer', label: 'Timber — Lacquer' },
  { value: 'timber-wax', label: 'Timber — Wax' },
  { value: 'timber-natural', label: 'Timber — Natural' },
  { value: 'metal-powder-coat', label: 'Metal — Powder Coat' },
  { value: 'metal-anodised', label: 'Metal — Anodised' },
  { value: 'metal-galvanised', label: 'Metal — Galvanised' },
  { value: 'metal-patina', label: 'Metal — Patina' },
  { value: 'metal-brushed', label: 'Metal — Brushed' },
  { value: 'metal-polished', label: 'Metal — Polished' },
  { value: 'stone-polished', label: 'Stone — Polished' },
  { value: 'stone-honed', label: 'Stone — Honed' },
  { value: 'stone-flamed', label: 'Stone — Flamed' },
  { value: 'stone-natural', label: 'Stone — Natural' },
  { value: 'concrete-polished', label: 'Concrete — Polished' },
  { value: 'concrete-exposed', label: 'Concrete — Exposed Aggregate' },
  { value: 'concrete-formed', label: 'Concrete — Board-formed' },
  { value: 'paint-matte', label: 'Paint — Matte' },
  { value: 'paint-satin', label: 'Paint — Satin' },
  { value: 'paint-gloss', label: 'Paint — Gloss' },
  { value: 'tile-glazed', label: 'Tile — Glazed' },
  { value: 'tile-unglazed', label: 'Tile — Unglazed' },
  { value: 'glass-clear', label: 'Glass — Clear' },
  { value: 'glass-tinted', label: 'Glass — Tinted' },
  { value: 'glass-frosted', label: 'Glass — Frosted' },
  { value: 'fabric-natural', label: 'Fabric — Natural' },
  { value: 'fabric-synthetic', label: 'Fabric — Synthetic' },
  { value: 'leather', label: 'Leather' },
  { value: 'vinyl', label: 'Vinyl' },
  { value: 'laminate', label: 'Laminate (HPL)' },
  { value: 'veneer', label: 'Veneer' },
  { value: 'custom', label: 'Custom / Other' },
];

interface AdminMaterial extends MaterialOption {
  pk?: string;
  docType?: 'material';
  sortOrder?: number;
  finishIds?: string[];
  primaryFinishId?: string | null;
  finishSetIds?: string[];
  primaryFinishSetId?: string | null;
  lifecycleProfileId?: string | null;
  insight?: string | null;
  actions?: string[] | null; // Legacy field
  actionDocumentation?: string | null;
  actionVerification?: string | null;
  actionCircularity?: string | null;
  strategicValue?: string | null;
  mitigationTip?: string | null;
  healthRiskLevel?: HealthRiskLevel;
  healthConcerns?: string[] | null;
  healthNote?: string | null;
  risks?: RiskItem[] | null;
  serviceLife?: number | null;
}

const ADMIN_EMAILS = ['jrbassindale@yahoo.co.uk'];
const ADMIN_KEY_STORAGE_KEY = 'moodboard_admin_bypass_key_v1';

const splitLines = (value: string): string[] =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

const joinLines = (value?: string[] | null): string => (Array.isArray(value) ? value.join('\n') : '');

const cloneMaterial = (material: AdminMaterial): AdminMaterial => {
  if (typeof structuredClone === 'function') {
    return structuredClone(material);
  }
  return JSON.parse(JSON.stringify(material)) as AdminMaterial;
};

const MaterialAdmin: React.FC<MaterialAdminProps> = ({ onNavigate }) => {
  const { user, isAuthenticated, isLoading, getAccessToken } = useAuth();
  const isAdmin = Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
  const canUseBypass = isAuthBypassEnabled;
  const canAccessAdmin = isAdmin || canUseBypass;

  const [materials, setMaterials] = useState<AdminMaterial[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<AdminMaterial | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [colorOptionsJson, setColorOptionsJson] = useState('[]');
  const [risksJson, setRisksJson] = useState('[]');
  const [adminKey, setAdminKey] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY) || '';
  });
  const [isRegeneratingIcon, setIsRegeneratingIcon] = useState(false);
  const [previewIconUrl, setPreviewIconUrl] = useState<string | null>(null);
  const [isSavingIcon, setIsSavingIcon] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!adminKey.trim()) {
      window.localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(ADMIN_KEY_STORAGE_KEY, adminKey.trim());
  }, [adminKey]);

  useEffect(() => {
    if (!canAccessAdmin) return;
    let mounted = true;
    const run = async () => {
      setLoadingMaterials(true);
      setError(null);
      try {
        const items = await getMaterials();
        if (!mounted) return;
        const typed = items as AdminMaterial[];
        setMaterials(typed);
        if (!typed.length) return;
        const initial = typed[0];
        setSelectedId(initial.id);
        const cloned = cloneMaterial(initial);
        setDraft(cloned);
        setColorOptionsJson(JSON.stringify(cloned.colorOptions ?? [], null, 2));
        setRisksJson(JSON.stringify(cloned.risks ?? [], null, 2));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load materials');
      } finally {
        if (mounted) setLoadingMaterials(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [canAccessAdmin]);

  const filteredMaterials = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return materials;
    return materials.filter((material) =>
      `${material.name} ${material.id} ${material.category}`.toLowerCase().includes(term)
    );
  }, [materials, searchTerm]);

  const pickMaterial = (material: AdminMaterial) => {
    setSelectedId(material.id);
    const cloned = cloneMaterial(material);
    setDraft(cloned);
    setColorOptionsJson(JSON.stringify(cloned.colorOptions ?? [], null, 2));
    setRisksJson(JSON.stringify(cloned.risks ?? [], null, 2));
    setMessage(null);
    setError(null);
    setPreviewIconUrl(null);
    setIsRegeneratingIcon(false);
    setIsSavingIcon(false);
  };

  const setField = <K extends keyof AdminMaterial>(key: K, value: AdminMaterial[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const colorOptionsParsed = colorOptionsJson.trim()
        ? JSON.parse(colorOptionsJson)
        : [];
      const risksParsed = risksJson.trim() ? JSON.parse(risksJson) : [];

      if (!Array.isArray(colorOptionsParsed)) {
        throw new Error('Color Options JSON must be an array');
      }
      if (!Array.isArray(risksParsed)) {
        throw new Error('Risks JSON must be an array');
      }

      let token: string | null = null;
      if (!canUseBypass) {
        token = await getAccessToken();
        if (!token) {
          throw new Error('Authentication token unavailable. Please sign in again.');
        }
      }

      if (canUseBypass && !adminKey.trim()) {
        throw new Error('Enter the staging admin key before saving.');
      }

      const payload: Record<string, unknown> = {
        ...draft,
        pk: draft.category,
        colorOptions: colorOptionsParsed,
        risks: risksParsed,
      };

      const updated = (await updateMaterial(token, payload, {
        adminKey: canUseBypass ? adminKey : undefined,
      })) as AdminMaterial;

      setMaterials((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setDraft(cloneMaterial(updated));
      setColorOptionsJson(JSON.stringify(updated.colorOptions ?? [], null, 2));
      setRisksJson(JSON.stringify(updated.risks ?? [], null, 2));
      setMessage(`Saved ${updated.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save material');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateIcon = async () => {
    if (!draft) return;
    setIsRegeneratingIcon(true);
    setPreviewIconUrl(null);
    try {
      const icon = await generateMaterialIcon({
        id: draft.id,
        name: draft.name,
        description: draft.description || '',
        tone: draft.tone,
        finish: draft.finish,
        keywords: draft.keywords,
      });
      if (icon?.dataUri) {
        setPreviewIconUrl(icon.dataUri);
      } else {
        setError('Failed to generate icon - no image returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate icon');
    } finally {
      setIsRegeneratingIcon(false);
    }
  };

  const handleApplyIcon = async () => {
    if (!previewIconUrl || !draft) return;

    // If we have an admin key, try to save to blob storage
    if (adminKey.trim()) {
      setIsSavingIcon(true);
      setError(null);
      try {
        const result = await saveMaterialIcon({
          materialId: draft.id,
          imageBase64: previewIconUrl,
          adminKey: adminKey.trim(),
        });

        // Update draft with permanent blob URLs
        setDraft(prev => prev ? {
          ...prev,
          iconPngUrl: result.pngUrl,
          iconWebpUrl: result.webpUrl,
          customImage: undefined, // Clear customImage since we have permanent URLs
        } : prev);

        setPreviewIconUrl(null);
        setMessage('Icon saved to blob storage - remember to save the material');
      } catch (err) {
        // Fall back to customImage if blob storage fails
        console.error('Blob storage save failed:', err);
        setField('customImage', previewIconUrl);
        setPreviewIconUrl(null);
        setMessage('Icon applied locally (blob storage unavailable) - remember to save');
      } finally {
        setIsSavingIcon(false);
      }
    } else {
      // No admin key, just set as customImage
      setField('customImage', previewIconUrl);
      setPreviewIconUrl(null);
      setMessage('Icon applied - remember to save the material');
    }
  };

  const handleDiscardIcon = () => {
    setPreviewIconUrl(null);
  };

  if (isLoading) {
    return <section className="pt-28 px-6 max-w-screen-xl mx-auto">Loading authentication...</section>;
  }

  if (!canUseBypass && !isAuthenticated) {
    return (
      <section className="pt-28 px-6 max-w-screen-xl mx-auto">
        <h2 className="font-display text-2xl uppercase tracking-widest">Material Admin</h2>
        <p className="mt-4 text-sm text-gray-700">Please sign in to access admin tools.</p>
      </section>
    );
  }

  if (!canAccessAdmin) {
    return (
      <section className="pt-28 px-6 max-w-screen-xl mx-auto">
        <h2 className="font-display text-2xl uppercase tracking-widest">Material Admin</h2>
        <p className="mt-4 text-sm text-red-600">You do not have admin access for this page.</p>
      </section>
    );
  }

  return (
    <section className="pt-28 pb-10 px-6 max-w-screen-2xl mx-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-widest">Material Admin</h2>
          <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mt-1">
            Edit material data and save directly to Cosmos
          </p>
          {canUseBypass && (
            <p className="text-xs font-mono uppercase tracking-widest text-amber-700 mt-2">
              Staging mode: using admin bypass key instead of Clerk login
            </p>
          )}
        </div>
        <button
          onClick={() => onNavigate('materials')}
          className="px-3 py-2 border border-gray-300 text-xs font-mono uppercase tracking-widest hover:bg-gray-100"
        >
          Back to Materials
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
        <aside className="border border-gray-300 bg-white p-4">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search materials"
            className="w-full border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="mt-3 h-[60vh] overflow-auto border border-gray-200">
            {loadingMaterials && <p className="p-3 text-sm text-gray-600">Loading materials...</p>}
            {!loadingMaterials && filteredMaterials.length === 0 && (
              <p className="p-3 text-sm text-gray-600">No materials match your search.</p>
            )}
            {filteredMaterials.map((material) => (
              <button
                key={material.id}
                onClick={() => pickMaterial(material)}
                className={`w-full text-left px-3 py-2 border-b border-gray-200 hover:bg-gray-50 ${
                  selectedId === material.id ? 'bg-black text-white hover:bg-black' : ''
                }`}
              >
                <div className="text-sm font-semibold">{material.name}</div>
                <div className={`text-[11px] uppercase tracking-widest ${selectedId === material.id ? 'text-gray-300' : 'text-gray-500'}`}>
                  {material.id}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="border border-gray-300 bg-white p-4">
          {!draft && <p className="text-sm text-gray-600">Select a material to edit.</p>}

          {draft && (
            <div className="space-y-5">
              {canUseBypass && (
                <label className="text-xs uppercase tracking-widest font-mono block">
                  Staging Admin Key
                  <input
                    type="password"
                    value={adminKey}
                    onChange={(event) => setAdminKey(event.target.value)}
                    placeholder="Enter x-admin-key value"
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              )}
              {message && <p className="text-sm text-emerald-700">{message}</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}

              {/* Material Icon Section */}
              <div className="border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs uppercase tracking-widest font-mono text-purple-800 font-semibold">
                    Material Icon
                  </span>
                  <span className="text-[10px] text-purple-600">
                    (AI-generated thumbnail for material display)
                  </span>
                </div>
                <div className="flex items-start gap-4">
                  {/* Current Icon */}
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-gray-500">Current</span>
                    <div className="w-24 h-24 border border-gray-300 overflow-hidden bg-white flex-shrink-0">
                      {(() => {
                        const { webpUrl, pngUrl } = getMaterialIconUrls(draft);
                        return draft.customImage ? (
                          <img src={draft.customImage} alt={draft.name} className="w-full h-full object-cover" />
                        ) : (
                          <picture>
                            <source srcSet={webpUrl} type="image/webp" />
                            <img
                              src={pngUrl}
                              alt={draft.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const fallback = target.parentElement?.nextElementSibling as HTMLElement | null;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          </picture>
                        );
                      })()}
                      <div
                        className="w-full h-full hidden items-center justify-center"
                        style={{ backgroundColor: draft.tone }}
                      >
                        <span className="text-[8px] uppercase tracking-widest text-white/70">No icon</span>
                      </div>
                    </div>
                  </div>

                  {/* Preview Icon (if regenerating) */}
                  {previewIconUrl && (
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-purple-600 font-semibold">Preview</span>
                      <div className="w-24 h-24 border-2 border-purple-400 overflow-hidden bg-white flex-shrink-0">
                        <img src={previewIconUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}

                  {/* Controls */}
                  <div className="flex flex-col gap-2 pt-5">
                    {!previewIconUrl ? (
                      <button
                        onClick={handleRegenerateIcon}
                        disabled={isRegeneratingIcon}
                        className="flex items-center gap-2 px-3 py-2 border border-purple-300 bg-white text-xs font-mono uppercase tracking-widest hover:bg-purple-100 disabled:opacity-60"
                      >
                        <RefreshCw className={`w-4 h-4 ${isRegeneratingIcon ? 'animate-spin' : ''}`} />
                        {isRegeneratingIcon ? 'Generating...' : 'Regenerate Icon'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleApplyIcon}
                          disabled={isSavingIcon}
                          className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-xs font-mono uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {isSavingIcon ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          {isSavingIcon ? 'Saving...' : 'Apply & Save'}
                        </button>
                        <button
                          onClick={handleDiscardIcon}
                          disabled={isSavingIcon}
                          className="flex items-center gap-2 px-3 py-2 border border-gray-300 bg-white text-xs font-mono uppercase tracking-widest hover:bg-gray-100 disabled:opacity-60"
                        >
                          <X className="w-4 h-4" />
                          Discard
                        </button>
                      </>
                    )}
                    {draft.customImage && !previewIconUrl && (
                      <button
                        onClick={() => {
                          setField('customImage', undefined);
                          setMessage('Custom icon removed - remember to save');
                        }}
                        className="flex items-center gap-2 px-3 py-2 border border-red-300 bg-white text-red-600 text-xs font-mono uppercase tracking-widest hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                        Remove Custom
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs uppercase tracking-widest font-mono">
                  ID
                  <input value={draft.id} readOnly className="mt-1 w-full border border-gray-300 px-3 py-2 bg-gray-50 text-sm" />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Name
                  <input
                    value={draft.name}
                    onChange={(event) => setField('name', event.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Category
                  <input
                    value={draft.category}
                    onChange={(event) => setField('category', event.target.value as MaterialOption['category'])}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Sort Order
                  <input
                    type="number"
                    value={draft.sortOrder ?? 0}
                    onChange={(event) => setField('sortOrder', Number(event.target.value))}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Tone (Swatch Value)
                  <input
                    value={draft.tone}
                    onChange={(event) => setField('tone', event.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Finish
                  <input
                    value={draft.finish}
                    onChange={(event) => setField('finish', event.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Carbon Intensity
                  <select
                    value={draft.carbonIntensity ?? ''}
                    onChange={(event) => setField('carbonIntensity', (event.target.value || undefined) as CarbonIntensity)}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Not set</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Finish Family
                  <select
                    value={draft.finishFamily ?? ''}
                    onChange={(event) => setField('finishFamily', (event.target.value || undefined) as FinishFamily | undefined)}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Not set</option>
                    {FINISH_FAMILY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Service Life (years)
                  <input
                    type="number"
                    value={draft.serviceLife ?? ''}
                    onChange={(event) => setField('serviceLife', event.target.value ? Number(event.target.value) : null)}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="text-xs uppercase tracking-widest font-mono block">
                Description
                <textarea
                  value={draft.description}
                  onChange={(event) => setField('description', event.target.value)}
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
                />
              </label>

              {/* Selection Hierarchy Section */}
              <div className="border border-blue-200 bg-blue-50 p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs uppercase tracking-widest font-mono text-blue-800 font-semibold">
                    Selection Workflow
                  </span>
                  <span className="text-[10px] text-blue-600">
                    (Materials page order: Variety → Finish Options → Colour Options)
                  </span>
                </div>

                <div className="bg-white p-3 border border-blue-100">
                  <p className="text-[11px] font-mono text-gray-700 uppercase tracking-widest mb-2">
                    Current workflow for this material
                  </p>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>Variety: {draft.varietyOptions?.length ? `${draft.varietyOptions.length} option(s)` : 'Not configured (skipped)'}</p>
                    <p>Finish Options: {draft.finishOptions?.length ? `${draft.finishOptions.length} option(s)` : 'Not configured (skipped)'}</p>
                    <p>Colour Options: {draft.supportsColor ? 'Enabled (full RAL palette)' : `${draft.colorOptions?.length ?? 0} curated option(s)`}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Step 1: Variety Options */}
                  <div className="bg-white p-3 border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                      <span className="text-xs uppercase tracking-widest font-mono text-gray-700">Variety Options</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-2">Material subtypes (e.g., stone: Bath, Portland, Carrara)</p>
                    <textarea
                      value={joinLines(draft.varietyOptions)}
                      onChange={(event) => setField('varietyOptions', splitLines(event.target.value))}
                      placeholder="Bath Stone&#10;Portland Stone&#10;Carrara Marble..."
                      className="w-full border border-gray-300 px-3 py-2 text-sm min-h-20"
                    />
                  </div>

                  {/* Step 2: Finish Options */}
                  <div className="bg-white p-3 border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                      <span className="text-xs uppercase tracking-widest font-mono text-gray-700">Finish Options</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-2">Specific finishes available (e.g., Polished, Honed, Flamed)</p>
                    <textarea
                      value={joinLines(draft.finishOptions)}
                      onChange={(event) => setField('finishOptions', splitLines(event.target.value))}
                      placeholder="Polished&#10;Honed&#10;Flamed&#10;Brushed..."
                      className="w-full border border-gray-300 px-3 py-2 text-sm min-h-20"
                    />
                  </div>

                  {/* Step 3: Color Options */}
                  <div className="bg-white p-3 border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                      <span className="text-xs uppercase tracking-widest font-mono text-gray-700">Colour Options</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-2">Available colours (set in Colour Options JSON below, or enable full RAL palette)</p>
                    <label className="flex items-center gap-2 text-xs font-mono">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.supportsColor)}
                        onChange={(event) => setField('supportsColor', event.target.checked)}
                      />
                      Enable full RAL color palette
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs uppercase tracking-widest font-mono">
                  Keywords (one per line)
                  <textarea
                    value={joinLines(draft.keywords)}
                    onChange={(event) => setField('keywords', splitLines(event.target.value))}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Tags (one per line)
                  <textarea
                    value={joinLines(draft.tags)}
                    onChange={(event) => setField('tags', splitLines(event.target.value))}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Tree Paths (one per line)
                  <textarea
                    value={joinLines(draft.treePaths)}
                    onChange={(event) => setField('treePaths', splitLines(event.target.value))}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Material Type
                  <input
                    value={draft.materialType ?? ''}
                    onChange={(event) => setField('materialType', event.target.value || undefined)}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Material Form (one per line)
                  <textarea
                    value={joinLines(draft.materialForm)}
                    onChange={(event) => setField('materialForm', splitLines(event.target.value) as MaterialOption['materialForm'])}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Material Function (one per line)
                  <textarea
                    value={joinLines(draft.materialFunction)}
                    onChange={(event) => setField('materialFunction', splitLines(event.target.value) as MaterialOption['materialFunction'])}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Manufacturing Process (one per line)
                  <textarea
                    value={joinLines(draft.manufacturingProcess)}
                    onChange={(event) => setField('manufacturingProcess', splitLines(event.target.value) as MaterialOption['manufacturingProcess'])}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs uppercase tracking-widest font-mono">
                  Finish IDs (one per line)
                  <textarea
                    value={joinLines(draft.finishIds)}
                    onChange={(event) => setField('finishIds', splitLines(event.target.value))}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Primary Finish ID
                  <input
                    value={draft.primaryFinishId ?? ''}
                    onChange={(event) => setField('primaryFinishId', event.target.value || null)}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Finish Set IDs (one per line)
                  <textarea
                    value={joinLines(draft.finishSetIds)}
                    onChange={(event) => setField('finishSetIds', splitLines(event.target.value))}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Primary Finish Set ID
                  <input
                    value={draft.primaryFinishSetId ?? ''}
                    onChange={(event) => setField('primaryFinishSetId', event.target.value || null)}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Lifecycle Profile ID
                  <input
                    value={draft.lifecycleProfileId ?? ''}
                    onChange={(event) => setField('lifecycleProfileId', event.target.value || null)}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="text-xs uppercase tracking-widest font-mono block">
                Lifecycle Insight
                <textarea
                  value={draft.insight ?? ''}
                  onChange={(event) => setField('insight', event.target.value || null)}
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm min-h-28"
                />
              </label>

              {/* Sustainability Briefing Content Section */}
              <div className="border border-emerald-200 bg-emerald-50 p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs uppercase tracking-widest font-mono text-emerald-800 font-semibold">
                    Sustainability Briefing Content
                  </span>
                  <span className="text-[10px] text-emerald-600">
                    (Pre-stored content for AI briefing - used instead of generating)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-3 border border-emerald-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">⭐</span>
                      <span className="text-xs uppercase tracking-widest font-mono text-gray-700">Strategic Value</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-2">For low-carbon materials: why this is an excellent choice (1-2 sentences)</p>
                    <textarea
                      value={draft.strategicValue ?? ''}
                      onChange={(event) => setField('strategicValue', event.target.value || null)}
                      placeholder="e.g., Sequester significant carbon while providing structural integrity..."
                      className="w-full border border-gray-300 px-3 py-2 text-sm min-h-20"
                    />
                  </div>

                  <div className="bg-white p-3 border border-emerald-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold">💡</span>
                      <span className="text-xs uppercase tracking-widest font-mono text-gray-700">Mitigation Tip</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-2">For high-carbon materials: practical tip to reduce impact (1-2 sentences)</p>
                    <textarea
                      value={draft.mitigationTip ?? ''}
                      onChange={(event) => setField('mitigationTip', event.target.value || null)}
                      placeholder="e.g., Specify high recycled content and use bolted connections for future reuse..."
                      className="w-full border border-gray-300 px-3 py-2 text-sm min-h-20"
                    />
                  </div>
                </div>
              </div>

              {/* Sustainability Actions Section */}
              <div className="border border-green-200 bg-green-50 p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs uppercase tracking-widest font-mono text-green-800 font-semibold">
                    Sustainability Actions
                  </span>
                  <span className="text-[10px] text-green-600">
                    (Structured actions for specification and procurement)
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-white p-3 border border-green-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-green-600 text-white text-[10px] flex items-center justify-center font-bold">📄</span>
                      <span className="text-xs uppercase tracking-widest font-mono text-gray-700">Documentation</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-2">Request for EPD, certification, or sourcing evidence</p>
                    <textarea
                      value={draft.actionDocumentation ?? ''}
                      onChange={(event) => setField('actionDocumentation', event.target.value || null)}
                      placeholder="e.g., Provide an EPD (EN 15804) or verified embodied carbon figure..."
                      className="w-full border border-gray-300 px-3 py-2 text-sm min-h-16"
                    />
                  </div>

                  <div className="bg-white p-3 border border-green-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">✓</span>
                      <span className="text-xs uppercase tracking-widest font-mono text-gray-700">Verification</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-2">Specification to verify (recycled content, VOC levels, etc.)</p>
                    <textarea
                      value={draft.actionVerification ?? ''}
                      onChange={(event) => setField('actionVerification', event.target.value || null)}
                      placeholder="e.g., Verify recycled content and low-VOC finish specification..."
                      className="w-full border border-gray-300 px-3 py-2 text-sm min-h-16"
                    />
                  </div>

                  <div className="bg-white p-3 border border-green-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">♻</span>
                      <span className="text-xs uppercase tracking-widest font-mono text-gray-700">Circularity</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-2">End-of-life action (take-back, disassembly, reuse)</p>
                    <textarea
                      value={draft.actionCircularity ?? ''}
                      onChange={(event) => setField('actionCircularity', event.target.value || null)}
                      placeholder="e.g., Confirm take-back scheme and specify bolted connections for disassembly..."
                      className="w-full border border-gray-300 px-3 py-2 text-sm min-h-16"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs uppercase tracking-widest font-mono">
                  Health Concerns (one per line)
                  <textarea
                    value={joinLines(draft.healthConcerns)}
                    onChange={(event) => setField('healthConcerns', splitLines(event.target.value))}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
                  />
                </label>
                <label className="text-xs uppercase tracking-widest font-mono">
                  Health Risk Level
                  <select
                    value={draft.healthRiskLevel ?? ''}
                    onChange={(event) => setField('healthRiskLevel', (event.target.value || null) as HealthRiskLevel)}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Not set</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
              </div>

              <label className="text-xs uppercase tracking-widest font-mono block">
                Health Note
                <textarea
                  value={draft.healthNote ?? ''}
                  onChange={(event) => setField('healthNote', event.target.value || null)}
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
                />
              </label>

              <label className="text-xs uppercase tracking-widest font-mono block">
                Colour Options (JSON array)
                <textarea
                  value={colorOptionsJson}
                  onChange={(event) => setColorOptionsJson(event.target.value)}
                  className="mt-1 w-full border border-gray-300 px-3 py-2 font-mono text-xs min-h-36"
                />
              </label>

              <label className="text-xs uppercase tracking-widest font-mono block">
                Risks (JSON array of {"{ risk, mitigation }"})
                <textarea
                  value={risksJson}
                  onChange={(event) => setRisksJson(event.target.value)}
                  className="mt-1 w-full border border-gray-300 px-3 py-2 font-mono text-xs min-h-36"
                />
              </label>

              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-3 bg-black text-white text-xs font-mono uppercase tracking-widest hover:bg-gray-900 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Material'}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default MaterialAdmin;
