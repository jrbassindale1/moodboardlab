type EventParamValue = string | number | boolean;
type EventParams = Record<string, EventParamValue | null | undefined>;

const canTrack = () =>
  typeof window !== 'undefined' && typeof window.gtag === 'function';

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
