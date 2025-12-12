import React, { useEffect, useState } from 'react';

type AdsPreference = 'personalized' | 'non-personalized';
type AdsConsent = AdsPreference | 'denied';

interface ConsentSettings {
  ads: AdsPreference;
  analytics: boolean;
  timestamp: string;
}

type AdsByGoogleQueue = Array<Record<string, unknown>> & {
  requestNonPersonalizedAds?: number;
};

const readConsentFromStorage = (): AdsConsent => {
  if (typeof window === 'undefined') return 'denied';
  const saved = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  if (!saved) return 'denied';
  try {
    const parsed = JSON.parse(saved) as ConsentSettings;
    return parsed.ads === 'non-personalized' ? 'non-personalized' : 'personalized';
  } catch {
    return 'denied';
  }
};

declare global {
  interface Window {
    adsbygoogle?: AdsByGoogleQueue;
  }
}

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT_ID;
const IS_DEV = import.meta.env.DEV;
const CONSENT_STORAGE_KEY = 'cookieConsent';

interface AdSenseSlotProps {
  slotId?: string;
  label?: string;
}

const AdSenseSlot: React.FC<AdSenseSlotProps> = ({ slotId, label = 'Advertisement' }) => {
  const [adsConsent, setAdsConsent] = useState<AdsConsent>(() => readConsentFromStorage());

  // Keep ads consent in sync with banner saves and other tabs
  useEffect(() => {
    const handleConsentChange = (event: Event) => {
      const detail = (event as CustomEvent<ConsentSettings>).detail;
      if (detail?.ads) {
        setAdsConsent(detail.ads === 'non-personalized' ? 'non-personalized' : 'personalized');
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== CONSENT_STORAGE_KEY) return;
      setAdsConsent(readConsentFromStorage());
    };

    window.addEventListener('cookieConsentChanged', handleConsentChange as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('cookieConsentChanged', handleConsentChange as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Load the AdSense script once when we have a client and slot configured
  useEffect(() => {
    if (!ADSENSE_CLIENT || !slotId || adsConsent === 'denied') return;

    const scriptId = 'adsense-js';
    if (document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }, [slotId, adsConsent]);

  // Ask AdSense to render into this slot when it mounts
  useEffect(() => {
    if (!ADSENSE_CLIENT || !slotId || adsConsent === 'denied') return;

    try {
      const queue = (window.adsbygoogle = window.adsbygoogle || []);
      queue.requestNonPersonalizedAds = adsConsent === 'non-personalized' ? 1 : 0;
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense render error', err);
    }
  }, [slotId, adsConsent]);

  if (adsConsent === 'denied') {
    if (!IS_DEV) return null;
    return (
      <div className="w-[160px] h-[600px] border border-dashed border-gray-300 text-gray-500 text-xs font-mono flex items-center justify-center text-center px-4 bg-white">
        Ads blocked until consent is saved in the cookie banner
      </div>
    );
  }

  if (!ADSENSE_CLIENT || !slotId) {
    if (!IS_DEV) return null;
    return (
      <div className="w-[160px] h-[600px] border border-dashed border-gray-300 text-gray-500 text-xs font-mono flex items-center justify-center text-center px-4 bg-white">
        Add VITE_ADSENSE_CLIENT_ID and slot IDs to show ad rails
      </div>
    );
  }

  return (
    <div className="w-[160px] space-y-1">
      <div className="text-[10px] uppercase font-mono text-gray-500 tracking-[0.2em] text-center">
        {label}
      </div>
      <ins
        className="adsbygoogle block w-[160px] h-[600px]"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="false"
      />
    </div>
  );
};

export default AdSenseSlot;
