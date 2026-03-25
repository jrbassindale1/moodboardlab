import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Zap, Check, Loader2, Image, RefreshCw, Maximize2 } from 'lucide-react';
import { useAuth } from '../auth';
import { createCheckoutSession, CREDIT_PACKAGES, CreditPackageId, CREDIT_COSTS } from '../api';

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPackage?: CreditPackageId;
}

const BuyCreditsModal: React.FC<BuyCreditsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPackage = 'standard',
}) => {
  const { getAccessToken } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<CreditPackageId>(initialPackage);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCheckoutReturnPath = () => {
    if (typeof window === 'undefined') return '/apply';

    const url = new URL(window.location.href);
    url.searchParams.delete('credits_purchased');
    url.searchParams.delete('credits_cancelled');
    url.searchParams.delete('session_id');

    const nextPath = `${url.pathname}${url.search}${url.hash}`;
    return nextPath || '/apply';
  };

  // Update selection when initialPackage changes (e.g., opening modal from different pricing tier)
  useEffect(() => {
    if (isOpen) {
      setSelectedPackage(initialPackage);
    }
  }, [isOpen, initialPackage]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handlePurchase = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Please sign in to purchase credits');
        return;
      }

      const { url } = await createCheckoutSession(
        token,
        selectedPackage,
        getCheckoutReturnPath()
      );

      if (url) {
        // Redirect to Stripe checkout
        window.location.href = url;
      } else {
        setError('Failed to create checkout session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setIsLoading(false);
    }
  };

  const getPerCreditPrice = (pkg: typeof CREDIT_PACKAGES[number]) => {
    const pencePerCredit = pkg.pricePence / pkg.credits;
    return `£${(pencePerCredit / 100).toFixed(2)}`;
  };

  const getBestValue = () => {
    let bestValue: CreditPackageId = 'starter';
    let lowestPricePerCredit = Infinity;

    for (const pkg of CREDIT_PACKAGES) {
      const pricePerCredit = pkg.pricePence / pkg.credits;
      if (pricePerCredit < lowestPricePerCredit) {
        lowestPricePerCredit = pricePerCredit;
        bestValue = pkg.id;
      }
    }

    return bestValue;
  };

  const bestValueId = getBestValue();

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative flex min-h-full items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
        {/* Modal */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="buy-credits-modal-title"
          className="relative my-8 max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl sm:my-0 sm:max-h-[calc(100vh-3rem)]"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close buy credits modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h2
                id="buy-credits-modal-title"
                className="text-lg font-mono uppercase tracking-widest"
              >
                Buy Credits
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              Credits start at £0.20 each, with better value on larger bundles.
            </p>
          </div>

          {/* Credit Costs Info */}
          <div className="mb-6 p-3 bg-gray-50 border border-gray-200 text-xs">
            <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-2">
              Credit Costs
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <Image className="w-3 h-3" />
                  Standard generation
                </span>
                <span className="font-mono">{CREDIT_COSTS.STANDARD_GENERATION} credit</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <RefreshCw className="w-3 h-3" />
                  Turn-by-turn generation
                </span>
                <span className="font-mono">{CREDIT_COSTS.ITERATIVE_GENERATION} credits</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <Maximize2 className="w-3 h-3" />
                  4K generation
                </span>
                <span className="font-mono">{CREDIT_COSTS.FOUR_K_GENERATION} credits</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-gray-500">
              4K generation unlocks when you have at least 5 purchased credits.
            </p>
          </div>

          {/* Package Selection */}
          <div className="space-y-3 mb-6">
            {CREDIT_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id)}
                className={`w-full p-4 border-2 text-left transition-all ${
                  selectedPackage === pkg.id
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedPackage === pkg.id
                          ? 'border-black bg-black'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedPackage === pkg.id && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{pkg.name}</span>
                        {pkg.id === bestValueId && (
                          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-green-100 text-green-700">
                            Best Value
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {pkg.credits} credits · {getPerCreditPrice(pkg)}/credit
                      </div>
                    </div>
                  </div>
                  <div className="text-lg font-mono font-medium">
                    {pkg.priceDisplay}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Purchase button */}
          <button
            onClick={handlePurchase}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-black text-white font-mono text-sm uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Purchase Credits
              </>
            )}
          </button>

          {/* Footer */}
          <p className="mt-4 text-xs text-gray-500 text-center">
            Credits never expire. Secure payment powered by Stripe.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BuyCreditsModal;
