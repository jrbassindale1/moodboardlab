import React, { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT_ID;
const IS_DEV = import.meta.env.DEV;

interface AdSenseSlotProps {
  slotId?: string;
  label?: string;
}

const AdSenseSlot: React.FC<AdSenseSlotProps> = ({ slotId, label = 'Advertisement' }) => {
  // Load the AdSense script once when we have a client and slot configured
  useEffect(() => {
    if (!ADSENSE_CLIENT || !slotId) return;

    const scriptId = 'adsense-js';
    if (document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }, [slotId]);

  // Ask AdSense to render into this slot when it mounts
  useEffect(() => {
    if (!ADSENSE_CLIENT || !slotId) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense render error', err);
    }
  }, [slotId]);

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
