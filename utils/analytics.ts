type EventParamValue = string | number | boolean;
type EventParams = Record<string, EventParamValue | null | undefined>;

const canTrack = () =>
  typeof window !== 'undefined' && typeof window.gtag === 'function';

const applyConsentToGtag = (analytics: boolean, ads: 'personalized' | 'non-personalized') => {
  if (!canTrack()) return;
  const adConsent = ads === 'personalized' ? 'granted' : 'denied';
  window.gtag?.('consent', 'update', {
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: adConsent,
    ad_user_data: adConsent,
    ad_personalization: adConsent,
  });
};

// Apply saved consent on load, then listen for changes from the cookie banner
if (typeof window !== 'undefined') {
  const saved = window.localStorage.getItem('cookieConsent');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      applyConsentToGtag(parsed.analytics, parsed.ads);
    } catch {
      // ignore malformed storage
    }
  }

  window.addEventListener('cookieConsentChanged', (e: Event) => {
    const detail = (e as CustomEvent).detail;
    applyConsentToGtag(detail.analytics, detail.ads);
  });
}

export const trackEvent = (eventName: string, params: EventParams = {}) => {
  if (!canTrack()) return;
  const payload: Record<string, EventParamValue> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    payload[key] = value;
  });
  window.gtag?.('event', eventName, payload);
};

export const trackPageView = (pagePath: string, pageTitle: string) => {
  trackEvent('page_view', {
    page_path: pagePath,
    page_title: pageTitle,
  });
};
