import React from 'react';
import { SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import { LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../auth';

interface AuthButtonProps {
  onNavigate?: (page: string) => void;
}

const AuthButton: React.FC<AuthButtonProps> = ({ onNavigate }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { user } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-10 h-10">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate?.('dashboard')}
          className="hidden md:block font-mono text-[11px] uppercase tracking-widest text-gray-600 hover:text-black transition-colors"
        >
          Dashboard
        </button>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8',
            },
          }}
        />
      </div>
    );
  }

  return (
    <SignInButton mode="modal">
      <button className="flex items-center gap-2 px-4 py-2 bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 transition-colors">
        <LogIn className="w-4 h-4" />
        <span className="hidden sm:inline">Sign In</span>
      </button>
    </SignInButton>
  );
};

export default AuthButton;
