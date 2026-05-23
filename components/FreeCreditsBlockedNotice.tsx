import React, { useState } from 'react';
import BuyCreditsModal from './BuyCreditsModal';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../utils/freeCreditSupport';

interface FreeCreditsBlockedNoticeProps {
  isAuthenticated: boolean;
  className?: string;
}

const FreeCreditsBlockedNotice: React.FC<FreeCreditsBlockedNoticeProps> = ({
  isAuthenticated,
  className,
}) => {
  const [showBuyModal, setShowBuyModal] = useState(false);

  return (
    <>
      <div className={className || 'border border-amber-300 bg-amber-50 p-4'}>
        <p className="text-sm font-sans text-amber-900">
          Looks like you are really enjoying Moodboard Lab. Free credits for your current access are used up for now.
        </p>
        <p className="text-sm font-sans text-amber-800 mt-1">
          Keep going with paid credits.
        </p>
        <p className="text-xs font-sans text-amber-800 mt-2">
          Unfortunately, some people use multiple emails to claim extra free credits, which is not sustainable for a small business like Moodboard-Lab.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isAuthenticated && (
            <button
              onClick={() => setShowBuyModal(true)}
              className="inline-flex items-center px-4 py-2 bg-black text-white font-mono text-xs uppercase tracking-widest hover:bg-gray-800 transition-colors"
            >
              Buy Credits
            </button>
          )}
          <a
            className="inline-flex items-center px-4 py-2 border border-amber-700 text-amber-800 font-mono text-xs uppercase tracking-widest hover:bg-amber-100 transition-colors"
            href={SUPPORT_MAILTO}
          >
            Contact Support
          </a>
          <span className="text-xs text-amber-800">{SUPPORT_EMAIL}</span>
        </div>
      </div>

      <BuyCreditsModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />
    </>
  );
};

export default FreeCreditsBlockedNotice;
