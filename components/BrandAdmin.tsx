import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '../auth';
import { getAllBrandsAdmin, updateBrand } from '../api';

interface BrandAdminProps {
  onNavigate: (page: string) => void;
}

const ADMIN_EMAILS = ['jrbassindale@yahoo.co.uk'];

type SubmissionStatus = 'pending' | 'approved' | 'changes-requested' | 'rejected';
type AdminTab = 'submissions' | 'brands';

interface BrandSub {
  id: string;
  status: SubmissionStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  brand: {
    name: string;
    website: string | null;
    logoUrl: string | null;
    tagline: string | null;
    countryOfOrigin: string | null;
    contactName: string;
    contactEmail: string;
  };
  materials: Array<{
    suggestedId?: string;
    name: string;
    category: string;
    finish: string;
    description: string;
    carbonIntensity?: string;
    productCode?: string | null;
    productRange?: string | null;
    embodiedCarbonA1A3?: number | null;
    recycledContentPct?: number | null;
    certifications?: string[];
    [key: string]: unknown;
  }>;
}

type BrandTier = 'partner' | 'verified' | 'standard';

type AdminBrand = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  website?: string | null;
  tagline?: string | null;
  countryOfOrigin?: string | null;
  tier: BrandTier;
  isActive: boolean;
  isFeatured: boolean;
  featuredOrder?: number | null;
  contactEmail?: string | null;
  materialCount?: number;
  addedAt: string;
  updatedAt: string;
};

const STATUS_BADGE: Record<SubmissionStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'changes-requested': 'bg-blue-50 text-blue-700 border-blue-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  'changes-requested': 'Changes Requested',
  rejected: 'Rejected',
};

const FILTER_TABS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'changes-requested', label: 'Changes' },
  { key: 'rejected', label: 'Rejected' },
];

const TIER_BADGE: Record<BrandTier, string> = {
  partner: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  standard: 'bg-gray-50 text-gray-500 border-gray-200',
};

function getApiBase() {
  const useLocalApi = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LOCAL_API === 'true';
  if (useLocalApi) return 'http://localhost:7071';
  const isViteDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  if (isViteDev) return '/__api_proxy__';
  return 'https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net';
}

const BrandAdmin: React.FC<BrandAdminProps> = ({ onNavigate }) => {
  const { user, isAuthenticated, isLoading, getAccessToken } = useAuth();
  const isAdmin = Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));

  // ── Submissions state ────────────────────────────────────────────────────
  const [adminTab, setAdminTab] = useState<AdminTab>('submissions');
  const [submissions, setSubmissions] = useState<BrandSub[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [reviewNotes, setReviewNotes] = useState('');
  const [tier, setTier] = useState<BrandTier>('verified');
  const [isPatching, setIsPatching] = useState(false);
  const [patchSuccess, setPatchSuccess] = useState<string | null>(null);
  const [patchError, setPatchError] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPatching, setIsBulkPatching] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // ── Brands state ─────────────────────────────────────────────────────────
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [brandEdit, setBrandEdit] = useState<Partial<AdminBrand>>({});
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [brandSaveMsg, setBrandSaveMsg] = useState<string | null>(null);

  const selected = submissions.find((s) => s.id === selectedId) ?? null;
  const filtered = submissions.filter((s) => filterTab === 'all' || s.status === filterTab);
  const selectedBrand = brands.find((b) => b.id === selectedBrandId) ?? null;

  // ── Fetch submissions ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    setIsFetching(true);
    setFetchError(null);

    getAccessToken()
      .then((token) =>
        fetch(`${getApiBase()}/api/brand-submissions`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then((res) => {
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        return res.json() as Promise<BrandSub[]>;
      })
      .then(setSubmissions)
      .catch((err: unknown) =>
        setFetchError(err instanceof Error ? err.message : 'Failed to load submissions')
      )
      .finally(() => setIsFetching(false));
  }, [isAuthenticated, isAdmin]);

  // ── Fetch brands ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !isAdmin || adminTab !== 'brands') return;
    if (brands.length > 0) return; // already loaded
    setBrandsLoading(true);
    getAccessToken()
      .then((token) => getAllBrandsAdmin(token))
      .then((data) => setBrands(data as AdminBrand[]))
      .catch(() => {})
      .finally(() => setBrandsLoading(false));
  }, [isAuthenticated, isAdmin, adminTab]);

  // ── Reset review form on selection change ────────────────────────────────
  useEffect(() => {
    if (selected) {
      setReviewNotes(selected.reviewNotes ?? '');
      setTier('verified');
      setExpandedProducts(new Set());
      setPatchSuccess(null);
      setPatchError(null);
    }
  }, [selectedId]);

  // ── Seed brand edit form ─────────────────────────────────────────────────
  useEffect(() => {
    if (selectedBrand) {
      setBrandEdit({
        tier: selectedBrand.tier,
        isActive: selectedBrand.isActive,
        isFeatured: selectedBrand.isFeatured,
        featuredOrder: selectedBrand.featuredOrder ?? undefined,
        name: selectedBrand.name,
        tagline: selectedBrand.tagline ?? '',
        website: selectedBrand.website ?? '',
      });
      setBrandSaveMsg(null);
    }
  }, [selectedBrandId]);

  // ── Single submission PATCH ───────────────────────────────────────────────
  const patch = async (status: SubmissionStatus) => {
    if (!selected) return;
    setIsPatching(true);
    setPatchError(null);
    setPatchSuccess(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${getApiBase()}/api/brand-submissions/${selected.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewNotes: reviewNotes || undefined, tier }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `Update failed: ${res.status}`);
      }
      const data = await res.json() as { submission: BrandSub };
      setSubmissions((prev) => prev.map((s) => (s.id === selected.id ? data.submission : s)));
      setPatchSuccess(`Marked as ${STATUS_LABELS[status]}`);
    } catch (err) {
      setPatchError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setIsPatching(false);
    }
  };

  // ── Bulk submission PATCH ─────────────────────────────────────────────────
  const bulkPatch = async (status: SubmissionStatus) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setIsBulkPatching(true);
    setBulkResult(null);
    try {
      const token = await getAccessToken();
      let succeeded = 0;
      for (const id of ids) {
        try {
          const res = await fetch(`${getApiBase()}/api/brand-submissions/${id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, tier }),
          });
          if (res.ok) {
            const data = await res.json() as { submission: BrandSub };
            setSubmissions((prev) => prev.map((s) => (s.id === id ? data.submission : s)));
            succeeded++;
          }
        } catch { /* continue */ }
      }
      setSelectedIds(new Set());
      setBulkResult(`${succeeded} of ${ids.length} marked as ${STATUS_LABELS[status]}`);
    } finally {
      setIsBulkPatching(false);
    }
  };

  // ── Brand save ────────────────────────────────────────────────────────────
  const saveBrand = async () => {
    if (!selectedBrand) return;
    setIsSavingBrand(true);
    setBrandSaveMsg(null);
    try {
      const token = await getAccessToken();
      const updated = await updateBrand(token, selectedBrand.id, brandEdit);
      if (updated) {
        setBrands((prev) => prev.map((b) => (b.id === selectedBrand.id ? { ...b, ...updated } as AdminBrand : b)));
        setBrandSaveMsg('Saved');
        setTimeout(() => setBrandSaveMsg(null), 3000);
      } else {
        setBrandSaveMsg('Failed to save');
      }
    } catch {
      setBrandSaveMsg('Failed to save');
    } finally {
      setIsSavingBrand(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full pt-20 min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-widest text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="w-full pt-20 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="font-mono text-sm uppercase tracking-widest text-gray-500">Access denied</p>
          <button
            onClick={() => onNavigate('concept')}
            className="flex items-center gap-2 mx-auto text-sm font-mono uppercase tracking-widest text-gray-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pt-16 min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => onNavigate('concept')}
          className="flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span className="h-4 w-[1px] bg-gray-200" />
        <h1 className="font-display text-lg uppercase tracking-wide">Brand Admin</h1>

        {/* Top-level tabs */}
        <div className="ml-auto flex border border-gray-200">
          {(['submissions', 'brands'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setAdminTab(t)}
              className={`px-4 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors ${
                adminTab === t ? 'bg-black text-white' : 'text-gray-500 hover:text-black'
              }`}
            >
              {t === 'submissions'
                ? `Submissions${submissions.filter((s) => s.status === 'pending').length > 0 ? ` (${submissions.filter((s) => s.status === 'pending').length})` : ''}`
                : 'Brands'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Submissions tab ────────────────────────────────────────────────── */}
      {adminTab === 'submissions' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — list */}
          <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col">
            {/* Filter tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setFilterTab(tab.key); setSelectedIds(new Set()); }}
                  className={`px-3 py-2.5 text-[10px] font-mono uppercase tracking-widest whitespace-nowrap transition-colors border-b-2 ${
                    filterTab === tab.key
                      ? 'border-black text-black'
                      : 'border-transparent text-gray-400 hover:text-black'
                  }`}
                >
                  {tab.label}
                  {tab.key === 'pending' && (
                    <span className="ml-1 text-amber-600">
                      ({submissions.filter((s) => s.status === 'pending').length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Bulk actions bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={() => bulkPatch('approved')}
                  disabled={isBulkPatching}
                  className="px-2 py-1 bg-black text-white text-[9px] font-mono uppercase tracking-widest hover:bg-gray-900 disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  onClick={() => bulkPatch('changes-requested')}
                  disabled={isBulkPatching}
                  className="px-2 py-1 border border-gray-300 text-[9px] font-mono uppercase tracking-widest hover:border-black disabled:opacity-40"
                >
                  Request Changes
                </button>
                <button
                  onClick={() => bulkPatch('rejected')}
                  disabled={isBulkPatching}
                  className="px-2 py-1 border border-red-200 text-red-600 text-[9px] font-mono uppercase tracking-widest hover:bg-red-50 disabled:opacity-40"
                >
                  Reject
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-auto text-[9px] font-mono uppercase tracking-widest text-gray-400 hover:text-black"
                >
                  Clear
                </button>
              </div>
            )}
            {bulkResult && (
              <div className="px-3 py-2 text-[10px] font-mono text-emerald-700 bg-emerald-50 border-b border-emerald-200">
                {bulkResult}
              </div>
            )}

            {/* Select all / deselect all */}
            {filtered.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(filtered.map((s) => s.id)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                  className="w-3 h-3 accent-black"
                />
                <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">
                  {filtered.every((s) => selectedIds.has(s.id)) ? 'Deselect all' : 'Select all'}
                </span>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {isFetching && (
                <div className="p-6 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Loading…</p>
                </div>
              )}
              {fetchError && (
                <div className="p-4 text-sm font-sans text-red-600">{fetchError}</div>
              )}
              {!isFetching && filtered.length === 0 && (
                <div className="p-6 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">No submissions</p>
                </div>
              )}
              {filtered.map((sub) => (
                <div
                  key={sub.id}
                  className={`flex items-start gap-2 px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedId === sub.id ? 'bg-gray-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(sub.id)}
                    onChange={(e) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(sub.id);
                        else next.delete(sub.id);
                        return next;
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 w-3 h-3 flex-shrink-0 accent-black"
                  />
                  <button
                    onClick={() => setSelectedId(sub.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-sm uppercase tracking-wide truncate">{sub.brand.name}</p>
                      <span
                        className={`flex-shrink-0 inline-flex items-center border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest ${STATUS_BADGE[sub.status]}`}
                      >
                        {STATUS_LABELS[sub.status]}
                      </span>
                    </div>
                    <p className="font-sans text-xs text-gray-500 mt-0.5">
                      {sub.materials.length} product{sub.materials.length !== 1 ? 's' : ''} ·{' '}
                      {new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel — detail */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selected ? (
              <div className="h-full flex items-center justify-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">
                  Select a submission
                </p>
              </div>
            ) : (
              <div className="max-w-2xl space-y-8">
                {/* Brand info */}
                <section className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-2xl uppercase font-bold tracking-tight">{selected.brand.name}</h2>
                      {selected.brand.tagline && (
                        <p className="font-sans text-sm text-gray-600 mt-1">{selected.brand.tagline}</p>
                      )}
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center border px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest ${STATUS_BADGE[selected.status]}`}>
                      {STATUS_LABELS[selected.status]}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm font-sans">
                    {selected.brand.website && (
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Website</p>
                        <a href={selected.brand.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline truncate block">
                          {selected.brand.website}
                        </a>
                      </div>
                    )}
                    {selected.brand.countryOfOrigin && (
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Country</p>
                        <p className="text-gray-700">{selected.brand.countryOfOrigin}</p>
                      </div>
                    )}
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Contact</p>
                      <p className="text-gray-700">{selected.brand.contactName}</p>
                      <p className="text-gray-500">{selected.brand.contactEmail}</p>
                    </div>
                    {selected.brand.logoUrl && (
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Logo</p>
                        <a href={selected.brand.logoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">View uploaded logo</a>
                      </div>
                    )}
                  </div>
                </section>

                {/* Products */}
                <section className="space-y-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                    Products ({selected.materials.length})
                  </p>
                  {selected.materials.map((mat, idx) => (
                    <div key={idx} className="border border-gray-200">
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                        onClick={() =>
                          setExpandedProducts((prev) => {
                            const next = new Set(prev);
                            if (next.has(idx)) next.delete(idx);
                            else next.add(idx);
                            return next;
                          })
                        }
                      >
                        <div>
                          <p className="font-display text-base uppercase">{mat.name}</p>
                          <p className="font-sans text-xs text-gray-500">{mat.category} · {mat.finish}</p>
                        </div>
                        {expandedProducts.has(idx) ? (
                          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                      </button>

                      {expandedProducts.has(idx) && (
                        <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-gray-50">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-sans">
                            {[
                              ['Description', mat.description],
                              ['Carbon intensity', mat.carbonIntensity],
                              ['Product code', mat.productCode],
                              ['Product range', mat.productRange],
                              ['Embodied carbon A1–A3', mat.embodiedCarbonA1A3 != null ? `${mat.embodiedCarbonA1A3} kgCO₂e/kg` : null],
                              ['Recycled content', mat.recycledContentPct != null ? `${mat.recycledContentPct}%` : null],
                              ['Certifications', mat.certifications?.join(', ')],
                            ].filter(([, v]) => v).map(([label, value]) => (
                              <div key={label as string}>
                                <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400">{label}</p>
                                <p className="text-gray-700">{String(value)}</p>
                              </div>
                            ))}
                          </div>
                          {mat.suggestedId && (
                            <p className="font-mono text-[10px] text-gray-400">Suggested ID: {mat.suggestedId}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </section>

                {/* Review controls */}
                <section className="space-y-4 border-t border-gray-200 pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Tier on approval</label>
                      <select
                        value={tier}
                        onChange={(e) => setTier(e.target.value as BrandTier)}
                        className="w-full border border-gray-300 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black bg-white"
                      >
                        <option value="partner">Partner</option>
                        <option value="verified">Verified</option>
                        <option value="standard">Standard</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-gray-600">Review notes</label>
                    <textarea
                      rows={3}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="w-full border border-gray-300 px-3 py-2 font-sans text-sm focus:outline-none focus:border-black resize-none"
                      placeholder="Internal notes or feedback to the submitter"
                    />
                  </div>

                  {patchSuccess && (
                    <p className="font-sans text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2">
                      {patchSuccess}
                    </p>
                  )}
                  {patchError && (
                    <p className="font-sans text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                      {patchError}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => patch('changes-requested')}
                      disabled={isPatching}
                      className="px-4 py-2 border border-gray-300 text-xs font-mono uppercase tracking-widest hover:border-black transition-colors disabled:opacity-40"
                    >
                      Request Changes
                    </button>
                    <button
                      onClick={() => patch('rejected')}
                      disabled={isPatching}
                      className="px-4 py-2 border border-red-300 text-red-700 text-xs font-mono uppercase tracking-widest hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => patch('approved')}
                      disabled={isPatching}
                      className="px-4 py-2 bg-black text-white text-xs font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors disabled:opacity-40 ml-auto"
                    >
                      {isPatching ? 'Processing…' : 'Approve'}
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Brands tab ────────────────────────────────────────────────────── */}
      {adminTab === 'brands' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — brand list */}
          <div className="w-72 flex-shrink-0 border-r border-gray-200 overflow-y-auto">
            {brandsLoading ? (
              <div className="p-6 text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Loading…</p>
              </div>
            ) : brands.length === 0 ? (
              <div className="p-6 text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">No brands found</p>
              </div>
            ) : (
              brands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => setSelectedBrandId(brand.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedBrandId === brand.id ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-sm uppercase tracking-wide truncate">{brand.name}</p>
                    <span className={`flex-shrink-0 inline-flex items-center border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest ${TIER_BADGE[brand.tier]}`}>
                      {brand.tier}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`text-[9px] font-mono uppercase tracking-widest ${brand.isActive ? 'text-emerald-600' : 'text-red-400'}`}>
                      {brand.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {brand.isFeatured && (
                      <span className="text-[9px] font-mono uppercase tracking-widest text-indigo-500">Featured</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Right panel — brand edit */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedBrand ? (
              <div className="h-full flex items-center justify-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Select a brand to edit</p>
              </div>
            ) : (
              <div className="max-w-lg space-y-6">
                <div className="flex items-start gap-4">
                  {selectedBrand.logoUrl && (
                    <img src={selectedBrand.logoUrl} alt={selectedBrand.name} className="h-10 w-auto object-contain border border-gray-100 p-1" />
                  )}
                  <div>
                    <h2 className="font-display text-xl uppercase font-bold tracking-tight">{selectedBrand.name}</h2>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">{selectedBrand.slug}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Text fields */}
                  {([
                    { key: 'name', label: 'Display Name' },
                    { key: 'tagline', label: 'Tagline' },
                    { key: 'website', label: 'Website' },
                  ] as const).map(({ key, label }) => (
                    <div key={key}>
                      <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1">{label}</label>
                      <input
                        type="text"
                        value={(brandEdit[key] as string) ?? ''}
                        onChange={(e) => setBrandEdit((p) => ({ ...p, [key]: e.target.value }))}
                        className="w-full border border-gray-200 px-3 py-2 text-sm font-sans focus:outline-none focus:border-black"
                      />
                    </div>
                  ))}

                  {/* Tier */}
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1">Tier</label>
                    <select
                      value={brandEdit.tier ?? selectedBrand.tier}
                      onChange={(e) => setBrandEdit((p) => ({ ...p, tier: e.target.value as BrandTier }))}
                      className="w-full border border-gray-200 px-3 py-2 text-sm font-sans focus:outline-none focus:border-black bg-white"
                    >
                      <option value="partner">Partner</option>
                      <option value="verified">Verified</option>
                      <option value="standard">Standard</option>
                    </select>
                  </div>

                  {/* Toggles */}
                  <div className="grid grid-cols-2 gap-4">
                    {([
                      { key: 'isActive', label: 'Active' },
                      { key: 'isFeatured', label: 'Featured on homepage' },
                    ] as const).map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(brandEdit[key] ?? selectedBrand[key])}
                          onChange={(e) => setBrandEdit((p) => ({ ...p, [key]: e.target.checked }))}
                          className="w-4 h-4 accent-black"
                        />
                        <span className="text-sm font-sans text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Featured order */}
                  {(brandEdit.isFeatured ?? selectedBrand.isFeatured) && (
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1">Featured order (lower = higher)</label>
                      <input
                        type="number"
                        value={brandEdit.featuredOrder ?? selectedBrand.featuredOrder ?? ''}
                        onChange={(e) => setBrandEdit((p) => ({ ...p, featuredOrder: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-32 border border-gray-200 px-3 py-2 text-sm font-sans focus:outline-none focus:border-black"
                        min={1}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <button
                    onClick={saveBrand}
                    disabled={isSavingBrand}
                    className="px-5 py-2 bg-black text-white text-xs font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors disabled:opacity-50"
                  >
                    {isSavingBrand ? 'Saving…' : 'Save'}
                  </button>
                  {brandSaveMsg && (
                    <span className={`flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest ${brandSaveMsg === 'Saved' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {brandSaveMsg === 'Saved' && <Check className="w-3.5 h-3.5" />}
                      {brandSaveMsg}
                    </span>
                  )}
                </div>

                {/* Read-only meta */}
                <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-3 text-xs font-sans text-gray-500">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">Contact email</p>
                    <p>{selectedBrand.contactEmail ?? '—'}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">Added</p>
                    <p>{new Date(selectedBrand.addedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">Last updated</p>
                    <p>{new Date(selectedBrand.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  {selectedBrand.materialCount != null && (
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">Products</p>
                      <p>{selectedBrand.materialCount}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandAdmin;
