import React, { useState } from 'react';
import { Menu, ShoppingCart, X } from 'lucide-react';
import AuthButton from './AuthButton';
import { useAuth } from '../auth';
import { isAuthBypassEnabled } from '../auth/authConfig';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  boardCount?: number;
  moodboardReady?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  boardCount = 0,
  moodboardReady = false
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === 'jrbassindale@yahoo.co.uk' || isAuthBypassEnabled;

  const baseNavItems = [
    { id: 'concept', label: 'Home' },
    { id: 'materials', label: 'Materials' },
    { id: 'moodboard', label: 'Moodboard Lab' },
    { id: 'apply', label: 'Apply' }
  ];
  const navItemsDesktop = [
    ...baseNavItems,
    ...(isAdmin ? [{ id: 'material-admin', label: 'Material Admin' }] : []),
  ];
  const navItemsMobile = [
    ...baseNavItems,
    ...(isAdmin ? [{ id: 'material-admin', label: 'Material Admin' }] : []),
    ...(isAuthenticated ? [{ id: 'dashboard', label: 'Dashboard' }] : [])
  ];

  const handleNavigate = (page: string) => {
    if (page === 'apply' && !moodboardReady) return;
    onNavigate(page);
    setIsMobileMenuOpen(false);
  };

  const isApplyDisabled = !moodboardReady;
  const applyDisabledCopy = 'Create a moodboard first to unlock Apply.';

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-screen-2xl mx-auto px-6 h-20 flex items-center justify-between">
        <div 
          className="flex flex-col cursor-pointer group" 
          onClick={() => handleNavigate('concept')}
        >
          <h1 className="font-display font-bold text-xl tracking-tighter uppercase group-hover:opacity-70 transition-opacity">
            Moodboard Lab
          </h1>
          <span className="hidden sm:block font-mono text-xs text-gray-500 tracking-widest uppercase">
            Moodboard & Material Workspace
          </span>
        </div>

        <div className="flex items-center gap-4 md:gap-8">
          <div className="hidden md:flex gap-8 font-mono text-xs uppercase tracking-widest text-gray-600">
            {navItemsDesktop.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                disabled={item.id === 'apply' && isApplyDisabled}
                title={item.id === 'apply' && isApplyDisabled ? applyDisabledCopy : undefined}
                aria-disabled={item.id === 'apply' && isApplyDisabled}
                className={`relative py-1 transition-colors ${
                  item.id === 'apply' && isApplyDisabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'hover:text-black'
                } ${currentPage === item.id ? 'text-black font-bold' : ''}`}
              >
                {item.label}
                {currentPage === item.id && (
                  <span className="absolute bottom-0 left-0 w-full h-[1px] bg-black"></span>
                )}
              </button>
            ))}
          </div>
          {/* Shopping basket - visible on all screens */}
          <button
            className="relative p-2 rounded-md hover:bg-gray-100 transition-colors"
            onClick={() => handleNavigate('moodboard')}
            aria-label={`Go to moodboard (${boardCount} items)`}
          >
            <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
            {boardCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-black px-1.5 text-[10px] font-mono font-semibold text-white">
                {boardCount}
              </span>
            )}
          </button>

          {/* Auth Button */}
          <AuthButton onNavigate={onNavigate} />

          <button
            className="md:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-sm">
          <div className="max-w-screen-2xl mx-auto px-6 py-4 flex flex-col gap-4 font-mono text-sm uppercase tracking-widest text-gray-700">
            {navItemsMobile.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                disabled={item.id === 'apply' && isApplyDisabled}
                title={item.id === 'apply' && isApplyDisabled ? applyDisabledCopy : undefined}
                aria-disabled={item.id === 'apply' && isApplyDisabled}
                className={`text-left transition-colors ${
                  item.id === 'apply' && isApplyDisabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'hover:text-black'
                } ${currentPage === item.id ? 'text-black font-bold' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
