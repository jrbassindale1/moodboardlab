import React, { useEffect, useMemo, useState } from 'react';

type AdsPreference = 'personalized' | 'non-personalized';

interface ConsentSettings {
  ads: AdsPreference;
  analytics: boolean;
  timestamp: string;
}

const STORAGE_KEY = 'cookieConsent';

interface CookieBannerProps {
  openPreferences: boolean;
  onClosePreferences: () => void;
}

const CookieBanner: React.FC<CookieBannerProps> = ({ openPreferences, onClosePreferences }) => {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [adsPreference, setAdsPreference] = useState<AdsPreference>('personalized');
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      setShowBanner(true);
      return;
    }

    try {
      const parsed: ConsentSettings = JSON.parse(saved);
      setAdsPreference(parsed.ads);
      setAnalyticsEnabled(parsed.analytics);
      setShowBanner(false);
    } catch {
      setShowBanner(true);
    }
  }, []);

  useEffect(() => {
    if (openPreferences) {
      setShowBanner(true);
      setShowPreferences(true);
    }
  }, [openPreferences]);

  const currentSelection: ConsentSettings = useMemo(
    () => ({
      ads: adsPreference,
      analytics: analyticsEnabled,
      timestamp: new Date().toISOString(),
    }),
    [adsPreference, analyticsEnabled]
  );

  const saveConsent = (settings: ConsentSettings, hideBanner = true) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
    setShowPreferences(false);
    if (hideBanner) {
      setShowBanner(false);
    }
    onClosePreferences();
  };

  const handleAcceptAll = () => {
    setAdsPreference('personalized');
    setAnalyticsEnabled(true);
    saveConsent({ ...currentSelection, ads: 'personalized', analytics: true });
  };

  const handleEssentialOnly = () => {
    setAdsPreference('non-personalized');
    setAnalyticsEnabled(false);
    saveConsent({ ...currentSelection, ads: 'non-personalized', analytics: false });
  };

  if (!showBanner) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="max-w-screen-lg mx-auto bg-white border border-gray-200 shadow-lg rounded-lg p-4 md:p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="font-display text-lg uppercase">Cookies & ads</p>
          <p className="font-sans text-sm text-gray-700 leading-relaxed">
            We use cookies for essential site functions and to support ads (with Google AdSense) and analytics.
            You can choose personalized ads and analytics, or limit to essential and non-personalized ads.
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowPreferences(true)}
            className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-md font-mono text-xs uppercase tracking-widest hover:bg-gray-50 transition"
          >
            Manage choices
          </button>
          <button
            onClick={handleEssentialOnly}
            className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-md font-mono text-xs uppercase tracking-widest hover:bg-gray-50 transition"
          >
            Essential only
          </button>
          <button
            onClick={handleAcceptAll}
            className="w-full md:w-auto px-4 py-2 bg-black text-white rounded-md font-mono text-xs uppercase tracking-widest hover:bg-gray-900 transition"
          >
            Allow all
          </button>
        </div>
      </div>

      {showPreferences && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4 py-8">
          <div className="max-w-xl w-full bg-white rounded-lg shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-xl uppercase">Cookie & ad preferences</p>
                <p className="font-sans text-sm text-gray-700 mt-1">
                  Control how we use cookies for ads and analytics. Essential cookies are always on to keep the site working.
                </p>
              </div>
              <button
                aria-label="Close preferences"
                onClick={() => {
                  setShowPreferences(false);
                  onClosePreferences();
                }}
                className="text-gray-500 hover:text-black font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-md cursor-pointer">
                <input
                  type="radio"
                  name="adsPreference"
                  value="personalized"
                  checked={adsPreference === 'personalized'}
                  onChange={() => setAdsPreference('personalized')}
                  className="mt-1"
                />
                <div>
                  <p className="font-display text-sm uppercase">Personalized ads</p>
                  <p className="font-sans text-sm text-gray-700">
                    Allow cookies for tailored ads and measurement across this site and partner sites.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-md cursor-pointer">
                <input
                  type="radio"
                  name="adsPreference"
                  value="non-personalized"
                  checked={adsPreference === 'non-personalized'}
                  onChange={() => setAdsPreference('non-personalized')}
                  className="mt-1"
                />
                <div>
                  <p className="font-display text-sm uppercase">Non-personalized ads</p>
                  <p className="font-sans text-sm text-gray-700">
                    Limit ad cookies to contextual delivery, basic measurement, and fraud prevention.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-md cursor-pointer">
                <input
                  type="checkbox"
                  name="analytics"
                  checked={analyticsEnabled}
                  onChange={(event) => setAnalyticsEnabled(event.target.checked)}
                  className="mt-1"
                />
                <div>
                  <p className="font-display text-sm uppercase">Analytics</p>
                  <p className="font-sans text-sm text-gray-700">
                    Allow cookies that help us understand usage, improve performance, and debug issues.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex flex-col md:flex-row gap-3 justify-end pt-2">
              <button
                onClick={handleEssentialOnly}
                className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-md font-mono text-xs uppercase tracking-widest hover:bg-gray-50 transition"
              >
                Save essential only
              </button>
              <button
                onClick={() => saveConsent(currentSelection)}
                className="w-full md:w-auto px-4 py-2 bg-black text-white rounded-md font-mono text-xs uppercase tracking-widest hover:bg-gray-900 transition"
              >
                Save choices
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CookieBanner;
