import React from 'react';
import AdSenseSlot from './AdSenseSlot';

interface AdRailProps {
  side: 'left' | 'right';
}

const AdRail: React.FC<AdRailProps> = ({ side }) => {
  const slotId =
    side === 'left'
      ? import.meta.env.VITE_ADSENSE_SLOT_LEFT ?? import.meta.env.VITE_ADSENSE_SLOT_RIGHT
      : import.meta.env.VITE_ADSENSE_SLOT_RIGHT ?? import.meta.env.VITE_ADSENSE_SLOT_LEFT;

  const positionClass = side === 'left' ? 'left-4 2xl:left-10' : 'right-4 2xl:right-10';

  return (
    <div className={`hidden xl:block fixed ${positionClass} top-28 z-30`}>
      <AdSenseSlot slotId={slotId} />
    </div>
  );
};

export default AdRail;
