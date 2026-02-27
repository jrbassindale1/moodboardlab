import React from 'react';
import { useUsage } from '../auth';
import { useAuth } from '../auth';
import { Zap } from 'lucide-react';

interface UsageDisplayProps {
  variant?: 'compact' | 'full';
  showSignUpPrompt?: boolean;
  onSignIn?: () => void;
}

const UsageDisplay: React.FC<UsageDisplayProps> = ({
  variant = 'compact',
  showSignUpPrompt = true,
  onSignIn
}) => {
  const { login } = useAuth();
  const { remaining, limit, isLoading, isAnonymous, paidCredits, freeRemaining, freeLimit } = useUsage();

  const denominator = Math.max(1, limit);
  const percentage = ((denominator - remaining) / denominator) * 100;
  const isLow = remaining <= 3;
  const isExhausted = remaining <= 0;

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono ${
        isExhausted ? 'bg-red-100 text-red-700' :
        isLow ? 'bg-amber-100 text-amber-700' :
        'bg-gray-100 text-gray-700'
      }`}>
        <Zap className="w-3 h-3" />
        {isLoading ? '...' : isAnonymous ? `${remaining}/${limit}` : `${remaining} credits`}
        <span className="hidden sm:inline">{isAnonymous ? 'this month' : 'available'}</span>
      </div>
    );
  }

  return (
    <div className={`p-4 border ${
      isExhausted ? 'border-red-200 bg-red-50' :
      isLow ? 'border-amber-200 bg-amber-50' :
      'border-gray-200 bg-gray-50'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-gray-600">
          {isAnonymous ? 'Monthly Generations' : 'Available Credits'}
        </span>
        <span className={`font-mono text-sm font-medium ${
          isExhausted ? 'text-red-600' :
          isLow ? 'text-amber-600' :
          'text-gray-700'
        }`}>
          {isLoading ? '...' : isAnonymous ? `${remaining} / ${limit} remaining` : `${remaining} credits`}
        </span>
      </div>

      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full transition-all duration-300 ${
            isExhausted ? 'bg-red-500' :
            isLow ? 'bg-amber-500' :
            'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {!isAnonymous && (
        <p className="text-xs text-gray-600 mb-1">
          Free monthly credits: {freeRemaining}/{freeLimit}
        </p>
      )}
      {!isAnonymous && (
        <p className="text-xs text-gray-600">
          Paid credit balance: {paidCredits}
        </p>
      )}

      {isAnonymous && showSignUpPrompt && (
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-600 mb-2">
            Sign in to get 10 free generations per month and save your moodboards.
          </p>
          <button
            onClick={onSignIn || login}
            className="text-xs font-mono uppercase tracking-widest text-black hover:underline"
          >
            Sign in for more
          </button>
        </div>
      )}

      {isExhausted && !isAnonymous && (
        <p className="text-xs text-red-600 mt-2">
          No credits left. Buy a credit pack or wait for your free monthly reset.
        </p>
      )}
    </div>
  );
};

export default UsageDisplay;
