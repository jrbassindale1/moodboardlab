import React, { useEffect, useMemo, useState } from 'react';
import { getMaterials, updateMaterial } from '../api';
import { useAuth } from '../auth';
import { isAuthBypassEnabled } from '../auth/authConfig';
import type { MaterialOption } from '../types';

interface MaterialAdminProps {
  onNavigate: (page: string) => void;
}

type RiskItem = { risk: string; mitigation: string };
type HealthRiskLevel = 'low' | 'medium' | 'high' | null;
type CarbonIntensity = 'low' | 'medium' | 'high' | undefined;

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
  actions?: string[] | null;
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
                  Tone (HEX)
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
                  Service Life (years)
                  <input
                    type="number"
                    value={draft.serviceLife ?? ''}
                    onChange={(event) => setField('serviceLife', event.target.value ? Number(event.target.value) : null)}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-xs uppercase tracking-widest font-mono">
                <input
                  type="checkbox"
                  checked={Boolean(draft.supportsColor)}
                  onChange={(event) => setField('supportsColor', event.target.checked)}
                />
                Supports Color
              </label>

              <label className="text-xs uppercase tracking-widest font-mono block">
                Description
                <textarea
                  value={draft.description}
                  onChange={(event) => setField('description', event.target.value)}
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
                />
              </label>

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
                  Finish Options (one per line)
                  <textarea
                    value={joinLines(draft.finishOptions)}
                    onChange={(event) => setField('finishOptions', splitLines(event.target.value))}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs uppercase tracking-widest font-mono">
                  Actions (one per line)
                  <textarea
                    value={joinLines(draft.actions)}
                    onChange={(event) => setField('actions', splitLines(event.target.value))}
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm min-h-24"
                  />
                </label>
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
                Color Options (JSON array)
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
