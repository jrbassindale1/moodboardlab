import React, { useEffect, useState } from 'react';
import { ArrowLeft, BarChart2, Building2, Check, Mail, Package, Trophy } from 'lucide-react';
import { useAuth } from '../auth';
import {
  getMyBrand,
  getBrandAnalytics,
  getSampleRequests,
  updateBrand,
  type BrandSummary,
  type BrandAnalytics,
} from '../api';

type TimeRange = 'all' | 'month';

interface ManufacturerDashboardProps {
  onNavigate: (page: string) => void;
}

type Tab = 'analytics' | 'requests' | 'profile';

type SampleRequest = {
  id: string;
  brandId: string;
  materialId: string;
  materialName: string;
  requesterName: string;
  requesterEmail: string;
  requesterCompany?: string;
  requesterRole?: string;
  message?: string;
  projectType?: string;
  status: 'new' | 'viewed' | 'responded' | 'closed';
  createdAt: string;
};

const STATUS_BADGE: Record<SampleRequest['status'], string> = {
  new: 'bg-amber-50 text-amber-700 border-amber-200',
  viewed: 'bg-blue-50 text-blue-700 border-blue-200',
  responded: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-gray-50 text-gray-400 border-gray-200',
};

const STATUS_LABELS: Record<SampleRequest['status'], string> = {
  new: 'New',
  viewed: 'Viewed',
  responded: 'Responded',
  closed: 'Closed',
};

function getApiBase() {
  if (typeof import.meta !== 'undefined') {
    if (import.meta.env?.VITE_USE_LOCAL_API === 'true') return 'http://localhost:7071';
    if (import.meta.env?.VITE_API_URL) return import.meta.env.VITE_API_URL as string;
    if (import.meta.env?.DEV) return '/__api_proxy__';
  }
  return 'https://moodboardlab-api-bhc6a4b0dgbdb2gf.westeurope-01.azurewebsites.net';
}

const METRIC_COLS = [
  { key: 'views', label: 'Views' },
  { key: 'addToBoard', label: 'Added' },
  { key: 'specSheet', label: 'Spec sheets' },
  { key: 'epd', label: 'EPDs' },
  { key: 'sampleRequest', label: 'Sample req.' },
  { key: 'total', label: 'Total' },
] as const;

const ManufacturerDashboard: React.FC<ManufacturerDashboardProps> = ({ onNavigate }) => {
  const { isAuthenticated, isLoading: authLoading, getAccessToken } = useAuth();
  const [tab, setTab] = useState<Tab>('analytics');
  const [brand, setBrand] = useState<BrandSummary | null>(null);
  const [analytics, setAnalytics] = useState<BrandAnalytics | null>(null);
  const [requests, setRequests] = useState<SampleRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SampleRequest | null>(null);
  const [isPatching, setIsPatching] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [profileForm, setProfileForm] = useState({ name: '', tagline: '', website: '', countryOfOrigin: '', logoUrl: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    setIsLoading(true);
    getAccessToken()
      .then(async (token) => {
        const b = await getMyBrand(token);
        if (!b) { setNotFound(true); return; }
        setBrand(b);
        setProfileForm({
          name: b.name ?? '',
          tagline: b.tagline ?? '',
          website: b.website ?? '',
          countryOfOrigin: (b as BrandSummary & { countryOfOrigin?: string }).countryOfOrigin ?? '',
          logoUrl: b.logoUrl ?? '',
        });

        const [a, r] = await Promise.all([
          getBrandAnalytics(token, b.id),
          getSampleRequests(token, b.id),
        ]);
        if (a) setAnalytics(a);
        setRequests(r as SampleRequest[]);
      })
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (!brand || isLoading) return;
    setIsAnalyticsLoading(true);
    getAccessToken()
      .then(async (token) => {
        const since = timeRange === 'month'
          ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
          : undefined;
        const a = await getBrandAnalytics(token, brand.id, since);
        if (a) setAnalytics(a);
      })
      .catch(() => {/* silent */})
      .finally(() => setIsAnalyticsLoading(false));
  }, [timeRange, brand]);

  const patchRequestStatus = async (req: SampleRequest, status: SampleRequest['status']) => {
    setIsPatching(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${getApiBase()}/api/sample-requests?id=${encodeURIComponent(req.id)}&brandId=${encodeURIComponent(req.brandId)}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      );
      if (res.ok) {
        const data = await res.json() as { request: SampleRequest };
        setRequests((prev) => prev.map((r) => (r.id === req.id ? data.request : r)));
        if (selectedRequest?.id === req.id) setSelectedRequest(data.request);
      }
    } catch { /* silent */ }
    finally { setIsPatching(false); }
  };

  const saveProfile = async () => {
    if (!brand) return;
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const token = await getAccessToken();
      const updated = await updateBrand(token, brand.id, {
        name: profileForm.name || undefined,
        tagline: profileForm.tagline || undefined,
        website: profileForm.website || undefined,
        logoUrl: profileForm.logoUrl || undefined,
        countryOfOrigin: profileForm.countryOfOrigin || undefined,
      });
      if (updated) {
        setBrand(updated);
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 3000);
      }
    } catch { /* silent */ }
    finally { setProfileSaving(false); }
  };

  const maxTrend = analytics?.trend.reduce((m, t) => Math.max(m, t.count), 0) ?? 0;

  if (authLoading || isLoading) {
    return (
      <div className="w-full pt-20 min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-widest text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="w-full pt-20 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="font-mono text-sm uppercase tracking-widest text-gray-500">Sign in to view your dashboard</p>
          <button onClick={() => onNavigate('concept')} className="flex items-center gap-2 mx-auto text-sm font-mono uppercase tracking-widest text-gray-500 hover:text-black transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </div>
    );
  }

  if (notFound || !brand) {
    return (
      <div className="w-full pt-20 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <p className="font-mono text-sm uppercase tracking-widest text-gray-500">No brand account found</p>
          <p className="font-sans text-sm text-gray-500 leading-relaxed">
            Your account is not linked to a manufacturer brand. Contact us to get your products listed.
          </p>
          <button onClick={() => onNavigate('brand-register')} className="px-6 py-2 bg-black text-white text-xs font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors">
            Register your brand
          </button>
          <button onClick={() => onNavigate('concept')} className="flex items-center gap-2 mx-auto text-sm font-mono uppercase tracking-widest text-gray-500 hover:text-black transition-colors mt-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </div>
    );
  }

  const newRequestCount = requests.filter((r) => r.status === 'new' && r.status !== 'closed').length;

  return (
    <div className="w-full pt-16 min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => onNavigate('concept')} className="flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-gray-500 hover:text-black transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="h-4 w-[1px] bg-gray-200" />
        {brand.logoUrl && (
          <img src={brand.logoUrl} alt={brand.name} className="h-6 w-auto object-contain" />
        )}
        <h1 className="font-display text-lg uppercase tracking-wide">{brand.name}</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-6">
        {([
          { key: 'analytics', label: 'Analytics', icon: BarChart2 },
          { key: 'requests', label: `Sample Requests${newRequestCount > 0 ? ` (${newRequestCount})` : ''}`, icon: Mail },
          { key: 'profile', label: 'Brand Profile', icon: Building2 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-[11px] font-mono uppercase tracking-widest border-b-2 transition-colors ${
              tab === key ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-black'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'analytics' && (
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
            {/* Time range toggle */}
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                {timeRange === 'month' ? 'This month' : 'All time'}
              </p>
              <div className="flex border border-gray-200">
                {([
                  { key: 'all', label: 'All Time' },
                  { key: 'month', label: 'This Month' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTimeRange(key)}
                    className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest transition-colors ${
                      timeRange === key ? 'bg-black text-white' : 'bg-white text-gray-500 hover:text-black'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Totals */}
            {analytics && !isAnalyticsLoading ? (
              <>
                {/* Top product highlight */}
                {analytics.materials.length > 0 && (() => {
                  const top = analytics.materials.slice().sort((a, b) => b.total - a.total)[0];
                  return (
                    <section className="border border-gray-200 p-5 flex items-center gap-5 bg-gray-50">
                      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-amber-50 border border-amber-200">
                        <Trophy className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">Top product this period</p>
                        <p className="font-display text-sm uppercase tracking-wide truncate">{top.materialName}</p>
                      </div>
                      <div className="flex gap-6 flex-shrink-0">
                        <div className="text-center">
                          <p className="font-display text-xl font-bold">{top.views}</p>
                          <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400">Views</p>
                        </div>
                        <div className="text-center">
                          <p className="font-display text-xl font-bold">{top.addToBoard}</p>
                          <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400">Added</p>
                        </div>
                        <div className="text-center">
                          <p className="font-display text-xl font-bold">{top.total}</p>
                          <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400">Total</p>
                        </div>
                      </div>
                    </section>
                  );
                })()}

                <section className="space-y-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Totals</p>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {METRIC_COLS.map(({ key, label }) => (
                      <div key={key} className="border border-gray-200 p-4 space-y-1">
                        <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400">{label}</p>
                        <p className="font-display text-2xl font-bold">{analytics.totals[key]}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Trend */}
                {analytics.trend.length > 0 && (
                  <section className="space-y-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Monthly interactions</p>
                    <div className="flex items-end gap-1 h-24">
                      {analytics.trend.map(({ month, count }) => (
                        <div key={month} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                          <div
                            className="w-full bg-black transition-all"
                            style={{ height: maxTrend > 0 ? `${Math.round((count / maxTrend) * 80)}px` : '2px' }}
                            title={`${month}: ${count}`}
                          />
                          <span className="font-mono text-[8px] text-gray-400 truncate w-full text-center">
                            {month.slice(5)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Per-material table */}
                {analytics.materials.length > 0 && (
                  <section className="space-y-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                      By product ({analytics.materials.length})
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-sans">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 pr-4 font-mono text-[9px] uppercase tracking-widest text-gray-400">Product</th>
                            {METRIC_COLS.map(({ key, label }) => (
                              <th key={key} className="text-right py-2 px-2 font-mono text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.materials.map((m) => (
                            <tr key={m.materialId} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2.5 pr-4 font-display uppercase tracking-wide text-sm">{m.materialName}</td>
                              {METRIC_COLS.map(({ key }) => (
                                <td key={key} className="py-2.5 px-2 text-right font-mono text-gray-700">
                                  {m[key]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
            ) : isAnalyticsLoading ? (
              <div className="py-20 text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Loading…</p>
              </div>
            ) : (
              <div className="py-20 text-center">
                <Package className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">No interaction data yet</p>
                <p className="font-sans text-sm text-gray-500 mt-2 leading-relaxed">
                  Data will appear here once architects start viewing your products.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === 'profile' && (
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
            <div>
              <h2 className="font-display text-xl uppercase tracking-wide mb-1">Brand Profile</h2>
              <p className="text-sm text-gray-500 font-sans">
                Updates apply immediately to your brand page and all product listings.
              </p>
            </div>

            <div className="space-y-5">
              {([
                { key: 'name', label: 'Brand Name', type: 'text', placeholder: 'e.g. ROCKWOOL UK' },
                { key: 'tagline', label: 'Tagline', type: 'text', placeholder: 'One-line description for the homepage' },
                { key: 'website', label: 'Website', type: 'url', placeholder: 'https://www.example.com' },
                { key: 'countryOfOrigin', label: 'Country of Origin', type: 'text', placeholder: 'e.g. United Kingdom' },
              ] as const).map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={profileForm[key]}
                    onChange={(e) => setProfileForm((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-200 px-3 py-2 text-sm font-sans focus:outline-none focus:border-black"
                  />
                </div>
              ))}

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Logo URL</label>
                {profileForm.logoUrl && (
                  <img src={profileForm.logoUrl} alt="Logo preview" className="h-10 w-auto object-contain mb-2 border border-gray-100 p-1" />
                )}
                <input
                  type="url"
                  value={profileForm.logoUrl}
                  onChange={(e) => setProfileForm((p) => ({ ...p, logoUrl: e.target.value }))}
                  placeholder="https://… (paste blob URL after uploading)"
                  className="w-full border border-gray-200 px-3 py-2 text-sm font-sans focus:outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={saveProfile}
                disabled={profileSaving}
                className="px-6 py-2.5 bg-black text-white text-xs font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                {profileSaving ? 'Saving…' : 'Save changes'}
              </button>
              {profileSaved && (
                <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-emerald-600">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>
          </div>
        )}

        {tab === 'requests' && (
          <div className="flex flex-1 overflow-hidden h-full" style={{ minHeight: 'calc(100vh - 160px)' }}>
            {/* List */}
            <div className="w-72 flex-shrink-0 border-r border-gray-200 overflow-y-auto">
              {requests.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Mail className="w-7 h-7 text-gray-300 mx-auto" />
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">No sample requests yet</p>
                </div>
              ) : (
                requests
                  .slice()
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((req) => (
                    <button
                      key={req.id}
                      onClick={() => setSelectedRequest(req)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        selectedRequest?.id === req.id ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-display text-sm uppercase truncate">{req.requesterName}</p>
                        <span className={`flex-shrink-0 inline-flex items-center border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest ${STATUS_BADGE[req.status]}`}>
                          {STATUS_LABELS[req.status]}
                        </span>
                      </div>
                      <p className="font-sans text-xs text-gray-500 mt-0.5 truncate">{req.materialName}</p>
                      <p className="font-mono text-[9px] text-gray-400 mt-0.5">
                        {new Date(req.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </button>
                  ))
              )}
            </div>

            {/* Detail */}
            <div className="flex-1 overflow-y-auto p-6">
              {!selectedRequest ? (
                <div className="h-full flex items-center justify-center">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Select a request</p>
                </div>
              ) : (
                <div className="max-w-lg space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-xl uppercase font-bold tracking-tight">{selectedRequest.requesterName}</h2>
                      <a
                        href={`mailto:${selectedRequest.requesterEmail}`}
                        className="font-sans text-sm text-blue-600 underline"
                      >
                        {selectedRequest.requesterEmail}
                      </a>
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center border px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest ${STATUS_BADGE[selectedRequest.status]}`}>
                      {STATUS_LABELS[selectedRequest.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm font-sans">
                    {[
                      ['Product', selectedRequest.materialName],
                      ['Company', selectedRequest.requesterCompany],
                      ['Role', selectedRequest.requesterRole],
                      ['Project type', selectedRequest.projectType],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label}>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
                        <p className="text-gray-700">{value}</p>
                      </div>
                    ))}
                  </div>

                  {selectedRequest.message && (
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mb-1">Message</p>
                      <p className="font-sans text-sm text-gray-700 leading-relaxed bg-gray-50 border border-gray-200 p-3">
                        {selectedRequest.message}
                      </p>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-4 space-y-2">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400">Update status</p>
                    <div className="flex gap-2 flex-wrap">
                      {(['new', 'viewed', 'responded', 'closed'] as const).map((s) => (
                        <button
                          key={s}
                          disabled={isPatching || selectedRequest.status === s}
                          onClick={() => patchRequestStatus(selectedRequest, s)}
                          className={`px-3 py-1.5 border text-[10px] font-mono uppercase tracking-widest transition-colors disabled:opacity-40 ${
                            selectedRequest.status === s
                              ? 'border-black bg-black text-white'
                              : 'border-gray-300 hover:border-black'
                          }`}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <a
                    href={`mailto:${selectedRequest.requesterEmail}?subject=Re: Sample request for ${encodeURIComponent(selectedRequest.materialName)}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-mono uppercase tracking-widest hover:bg-gray-900 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Reply by email
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManufacturerDashboard;
