import React, { useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { SignInButton, SignUpButton } from '@clerk/clerk-react';
import { isClerkAuthEnabled } from '../auth';

interface AuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthPromptModal: React.FC<AuthPromptModalProps> = ({ isOpen, onClose }) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !isClerkAuthEnabled) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-md p-8 shadow-xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-gray-700" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-mono uppercase tracking-widest mb-3">
            Your Palette is Ready
          </h2>
          <p className="text-gray-600">
            Create a free account to generate your moodboard and sustainability briefing.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <SignUpButton mode="modal">
            <button className="w-full py-3 px-4 bg-black text-white font-mono text-sm uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              Create Free Account
            </button>
          </SignUpButton>

          <div className="text-center">
            <span className="text-sm text-gray-500">Already have an account? </span>
            <SignInButton mode="modal">
              <button className="text-sm text-gray-900 underline hover:text-gray-600 transition-colors">
                Sign in
              </button>
            </SignInButton>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-xs text-gray-400 text-center">
          Free accounts include credits to get started.
        </p>
      </div>
    </div>
  );
};

export default AuthPromptModal;
