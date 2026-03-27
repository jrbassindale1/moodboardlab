import React, { useState } from 'react';
import { useUsage } from '../auth';
import { useAuth } from '../auth';
import { Zap, Plus, Info } from 'lucide-react';
import BuyCreditsModal from './BuyCreditsModal';
import { CREDIT_COSTS } from '../api';

interface UsageDisplayProps {
  variant?: 'compact' | 'full' | 'minimal';
  showSignUpPrompt?: boolean;
  onSignIn?: () => void;
  showBuyCredits?: boolean;
}

const UsageDisplay: React.FC<UsageDisplayProps> = ({
  variant = 'compact',
  showSignUpPrompt = true,
  onSignIn,
  showBuyCredits = true,
}) => {
  const { isAuthenticated, login } = useAuth();
  const { remaining, limit, isLoading, isAnonymous, purchasedCredits, freeRemaining } = useUsage();
  const [showBuyModal, setShowBuyModal] = useState(false);

  const percentage = ((limit - freeRemaining) / limit) * 100;
  const isLow = remaining <= 5;
  const isVeryLow = remaining <= 3;
  const isExhausted = remaining <= 0;

  // Minimal variant: single compact line, expands only when low
  if (variant === 'minimal') {
    // Expanded state for low credits
    if (isLow && !isAnonymous) {
      return (
        <>
          <div className={`flex items-center justify-between px-4 py-3 border ${
            isExhausted ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
          }`}>
            <div className="flex items-center gap-3">
              <Zap className={`w-4 h-4 ${isExhausted ? 'text-red-600' : 'text-amber-600'}`} />
              <span className={`font-mono text-sm font-medium ${
                isExhausted ? 'text-red-700' : 'text-amber-700'
              }`}>
                {isExhausted
                  ? "Out of credits"
                  : `${remaining} credits remaining`}
              </span>
            </div>
            {showBuyCredits && isAuthenticated && (
              <button
                onClick={() => setShowBuyModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white font-mono text-xs uppercase tracking-widest hover:bg-gray-800 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Buy Credits
              </button>
            )}
          </div>
          <BuyCreditsModal
            isOpen={showBuyModal}
            onClose={() => setShowBuyModal(false)}
          />
        </>
      );
    }

    // Collapsed single line for healthy credits
    return (
      <>
        <div className="flex items-center justify-between px-4 py-2 border border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-gray-600" />
              <span className="font-mono text-sm text-gray-700">
                {isLoading ? '...' : `${remaining} credits`}
              </span>
            </div>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500">
              {CREDIT_COSTS.MOODBOARD_GENERATION} moodboard / {CREDIT_COSTS.RENDER_GENERATION} edits+renders / {CREDIT_COSTS.FOUR_K_GENERATION} 4K
            </span>
          </div>
          {showBuyCredits && isAuthenticated && (
            <button
              onClick={() => setShowBuyModal(true)}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-mono text-gray-700 hover:text-black transition-colors"
            >
              <Plus className="w-3 h-3" />
              Buy Credits
            </button>
          )}
          {isAnonymous && showSignUpPrompt && (
            <button
              onClick={onSignIn || login}
              className="text-xs font-mono text-gray-600 hover:text-black transition-colors"
            >
              Sign in for more
            </button>
          )}
        </div>
        <BuyCreditsModal
          isOpen={showBuyModal}
          onClose={() => setShowBuyModal(false)}
        />
      </>
    );
  }

  if (variant === 'compact') {
    return (
      <>
        <div className="inline-flex items-center gap-2">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono ${
            isExhausted ? 'bg-red-100 text-red-700' :
            isVeryLow ? 'bg-amber-100 text-amber-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            <Zap className="w-3 h-3" />
            {isLoading ? '...' : `${remaining}`}
            {purchasedCredits > 0 && (
              <span className="text-green-600">+{purchasedCredits}</span>
            )}
          </div>
          {showBuyCredits && isAuthenticated && (
            <button
              onClick={() => setShowBuyModal(true)}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-mono bg-black text-white hover:bg-gray-800 transition-colors"
              title="Buy more credits"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
        <BuyCreditsModal
          isOpen={showBuyModal}
          onClose={() => setShowBuyModal(false)}
        />
      </>
    );
  }

  // Full variant (for dashboard)
  return (
    <>
      <div className={`p-4 border ${
        isExhausted ? 'border-red-200 bg-red-50' :
        isVeryLow ? 'border-amber-200 bg-amber-50' :
        'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
            Available Credits
          </span>
          <span className={`font-mono text-sm font-medium ${
            isExhausted ? 'text-red-600' :
            isVeryLow ? 'text-amber-600' :
            'text-gray-700'
          }`}>
            {isLoading ? '...' : `${remaining} remaining`}
          </span>
        </div>

        {/* Credits breakdown */}
        {!isAnonymous && !isLoading && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
            <span>{freeRemaining}/{limit} free this month</span>
            {purchasedCredits > 0 && (
              <span className="text-green-600">{purchasedCredits} purchased</span>
            )}
            <span className="flex items-center gap-1 text-gray-400">
              <Info className="w-3 h-3" />
              {CREDIT_COSTS.MOODBOARD_GENERATION} moodboard / {CREDIT_COSTS.RENDER_GENERATION} edits+renders / {CREDIT_COSTS.FOUR_K_GENERATION} 4K
            </span>
          </div>
        )}

        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full transition-all duration-300 ${
              isExhausted ? 'bg-red-500' :
              isVeryLow ? 'bg-amber-500' :
              'bg-green-500'
            }`}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>

        {isAnonymous && showSignUpPrompt && (
          <div className="pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-600 mb-2">
              Sign in to get 10 free credits each month and save your moodboards.
            </p>
            <button
              onClick={onSignIn || login}
              className="text-xs font-mono uppercase tracking-widest text-black hover:underline"
            >
              Sign in for more
            </button>
          </div>
        )}

        {!isAnonymous && showBuyCredits && (
          <div className={`pt-3 border-t flex items-center justify-between ${
            isExhausted || isVeryLow ? 'border-amber-300' : 'border-gray-200'
          }`}>
            <p className={`text-xs ${isExhausted || isVeryLow ? 'font-medium' : ''} ${
              isExhausted ? 'text-red-700' : isVeryLow ? 'text-amber-700' : 'text-gray-600'
            }`}>
              {isExhausted
                ? "You've run out of credits."
                : isVeryLow
                ? `Running low — ${remaining} credits remaining`
                : 'Top up your credits'}
            </p>
            <button
              onClick={() => setShowBuyModal(true)}
              className={`inline-flex items-center gap-1.5 font-mono uppercase tracking-widest transition-colors ${
                isExhausted || isVeryLow
                  ? 'px-4 py-2 text-xs bg-black text-white hover:bg-gray-800'
                  : 'px-3 py-1.5 text-xs bg-black text-white hover:bg-gray-800'
              }`}
            >
              <Plus className="w-3 h-3" />
              Buy Credits
            </button>
          </div>
        )}
      </div>
      <BuyCreditsModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />
    </>
  );
};

export default UsageDisplay;
