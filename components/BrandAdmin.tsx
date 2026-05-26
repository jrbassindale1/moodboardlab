import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../auth';

interface BrandAdminProps {
  onNavigate: (page: string) => void;
}

const ADMIN_EMAILS = ['jrbassindale@yahoo.co.uk'];

type SubmissionStatus = 'pending' | 'approved' | 'changes-requested' | 'rejected';

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

  const selected = submissions.find((s) => s.id === selectedId) ?? null;

  const filtered = submissions.filter(
    (s) => filterTab === 'all' || s.status === filterTab
  );

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

  useEffect(() => {
    if (selected) {
      setReviewNotes(selected.reviewNotes ?? '');
      setTier('verified');
      setExpandedProducts(new Set());
      setPatchSuccess(null);
      setPatchError(null);
    }
  }, [selectedId]);

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
      setSubmissions((prev) =>
        prev.map((s) => (s.id === selected.id ? data.submission : s))
      );
      setPatchSuccess(`Marked as ${STATUS_LABELS[status]}`);
    } catch (err) {
      setPatchError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setIsPatching(false);
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
        <h1 className="font-display text-lg uppercase tracking-wide">Brand Submissions</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — list */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col">
          {/* Filter tabs */}
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key)}
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
              <button
                key={sub.id}
                onClick={() => setSelectedId(sub.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  selectedId === sub.id ? 'bg-gray-50' : ''
                }`}
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
    </div>
  );
};

export default BrandAdmin;
