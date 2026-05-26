import React, { useEffect, useState } from 'react';
import { ArrowLeft, BarChart2, Mail, Package } from 'lucide-react';
import { useAuth } from '../auth';
import {
  getMyBrand,
  getBrandAnalytics,
  getSampleRequests,
  type BrandSummary,
  type BrandAnalytics,
} from '../api';

interface ManufacturerDashboardProps {
  onNavigate: (page: string) => void;
}

type Tab = 'analytics' | 'requests';

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
  status: 'new' | 'viewed' | 'responded';
  createdAt: string;
};

const STATUS_BADGE: Record<SampleRequest['status'], string> = {
  new: 'bg-amber-50 text-amber-700 border-amber-200',
  viewed: 'bg-blue-50 text-blue-700 border-blue-200',
  responded: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_LABELS: Record<SampleRequest['status'], string> = {
  new: 'New',
  viewed: 'Viewed',
  responded: 'Responded',
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
  const [notFound, setNotFound] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SampleRequest | null>(null);
  const [isPatching, setIsPatching] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    setIsLoading(true);
    getAccessToken()
      .then(async (token) => {
        const b = await getMyBrand(token);
        if (!b) { setNotFound(true); return; }
        setBrand(b);

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

  const newRequestCount = requests.filter((r) => r.status === 'new').length;

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
            {/* Totals */}
            {analytics ? (
              <>
                <section className="space-y-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">All-time totals</p>
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
                    <div className="flex gap-2">
                      {(['new', 'viewed', 'responded'] as const).map((s) => (
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
