import React, { useEffect, useRef, useState } from 'react';
import { Menu, X, Zap, ChevronDown, FolderOpen } from 'lucide-react';
import AuthButton from './AuthButton';
import BuyCreditsModal from './BuyCreditsModal';
import ProjectSwitcherDropdown from './ProjectSwitcherDropdown';
import { useAuth, useUsage } from '../auth';
import { getPathForPage } from '../utils/siteSeo';
import { getMyBrand } from '../api';
import type { Project } from '../api';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  boardCount?: number;
  currentProject?: Project | null;
  projects?: Project[];
  onSelectProject?: (project: Project) => void;
  onOpenProjectModal?: () => void;
  isProjectsLoading?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  boardCount = 0,
  currentProject = null,
  projects = [],
  onSelectProject,
  onOpenProjectModal,
  isProjectsLoading = false,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showBuyCreditsModal, setShowBuyCreditsModal] = useState(false);
  const [isProjectSwitcherOpen, setIsProjectSwitcherOpen] = useState(false);
  const [isBrandUser, setIsBrandUser] = useState(false);
  const projectButtonRef = useRef<HTMLButtonElement>(null);
  const { user, isAuthenticated, getAccessToken } = useAuth();
  const { remaining, isLoading: isUsageLoading } = useUsage();
  const isAdmin = user?.email?.toLowerCase() === 'jrbassindale@yahoo.co.uk';

  useEffect(() => {
    if (!isAuthenticated) { setIsBrandUser(false); return; }
    getAccessToken()
      .then((token) => getMyBrand(token))
      .then((b) => setIsBrandUser(Boolean(b)))
      .catch(() => setIsBrandUser(false));
  }, [isAuthenticated]);
  const materialCountLabel = boardCount > 99 ? '99+' : `${boardCount}`;
  const creditBalanceLabel = isUsageLoading ? '...' : remaining > 9999 ? '9999+' : `${remaining}`;

  const baseNavItems = [
    { id: 'materials', label: 'Materials' },
    { id: 'moodboard', label: 'Moodboard' },
    { id: 'apply', label: 'Render' },
    { id: 'dashboard', label: 'Dashboard' }
  ];
  const navItemsDesktop = [
    ...baseNavItems,
    ...(isBrandUser ? [{ id: 'manufacturer-dashboard', label: 'My Brand' }] : []),
    ...(isAdmin ? [{ id: 'material-admin', label: 'Material Admin' }] : []),
    ...(isAdmin ? [{ id: 'brand-admin', label: 'Brand Admin' }] : []),
  ];
  const navItemsMobile = [
    ...baseNavItems,
    ...(isBrandUser ? [{ id: 'manufacturer-dashboard', label: 'My Brand' }] : []),
    ...(isAdmin ? [{ id: 'material-admin', label: 'Material Admin' }] : []),
    ...(isAdmin ? [{ id: 'brand-admin', label: 'Brand Admin' }] : []),
  ];

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setIsMobileMenuOpen(false);
  };

  const handleNavigateClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    page: string
  ) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    handleNavigate(page);
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-screen-2xl mx-auto px-6 h-16 md:h-20 flex items-center justify-between">
        <a
          href={getPathForPage('concept')}
          className="flex flex-col cursor-pointer group"
          onClick={(event) => handleNavigateClick(event, 'concept')}
        >
          <img
            src="/logo.svg"
            alt="Moodboard Lab"
            className="hidden md:block h-8 w-auto group-hover:opacity-70 transition-opacity"
          />
          <img
            src="/logo-mark.svg"
            alt="Moodboard Lab"
            className="md:hidden h-9 w-9 group-hover:opacity-70 transition-opacity"
          />
        </a>

        <div className="flex items-center gap-4 md:gap-8">
          {isAuthenticated && (
            <div className="relative hidden lg:block">
              <button
                ref={projectButtonRef}
                onClick={() => setIsProjectSwitcherOpen((open) => !open)}
                className="inline-flex items-center gap-2 border border-gray-200 px-3 py-2 hover:border-black transition-colors"
                aria-label="Switch project"
              >
                <FolderOpen className="w-4 h-4 text-gray-500" />
                <span className="max-w-[180px] truncate font-mono text-[10px] uppercase tracking-widest text-gray-700">
                  {currentProject?.name || 'Select Project'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              <ProjectSwitcherDropdown
                isOpen={isProjectSwitcherOpen}
                onClose={() => setIsProjectSwitcherOpen(false)}
                projects={projects}
                currentProject={currentProject}
                onSelectProject={(project) => onSelectProject?.(project)}
                onCreateNew={() => onOpenProjectModal?.()}
                isLoading={isProjectsLoading}
                anchorRef={projectButtonRef}
              />
            </div>
          )}

          <div className="hidden md:flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-gray-600">
            {navItemsDesktop.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <span aria-hidden className="text-gray-300">·</span>}
                <a
                  href={getPathForPage(item.id)}
                  onClick={(event) => handleNavigateClick(event, item.id)}
                  className={`relative inline-flex items-center gap-2 py-1 transition-colors hover:text-black ${currentPage === item.id ? 'text-black font-bold' : ''}`}
                >
                  {item.label}
                  {item.id === 'materials' && boardCount > 0 && (
                    <span className="min-w-[18px] h-[18px] inline-flex items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold text-white">
                      {materialCountLabel}
                    </span>
                  )}
                  {currentPage === item.id && (
                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-black"></span>
                  )}
                </a>
              </React.Fragment>
            ))}
          </div>

          {isAuthenticated ? (
            <button
              onClick={() => setShowBuyCreditsModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-2 text-gray-700 transition-colors hover:bg-gray-100 hover:text-black"
              aria-label={`${creditBalanceLabel} credits available. Click to buy more.`}
            >
              <Zap className="w-5 h-5 md:w-6 md:h-6" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-widest">
                {creditBalanceLabel}
              </span>
            </button>
          ) : (
            <a
              href={getPathForPage('pricing')}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-2 text-gray-700 transition-colors hover:bg-gray-100 hover:text-black"
              onClick={(event) => handleNavigateClick(event, 'pricing')}
              aria-label="View pricing"
            >
              <Zap className="w-5 h-5 md:w-6 md:h-6" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-widest">
                {creditBalanceLabel}
              </span>
            </a>
          )}

          {/* Auth Button */}
          <AuthButton />

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
            {isAuthenticated && (
              <div className="border border-gray-200 bg-white">
                <div className="px-3 py-2 border-b border-gray-100 text-[10px] uppercase tracking-widest text-gray-500">
                  Active Project
                </div>
                <div className="px-3 py-2 text-[11px] uppercase tracking-widest text-gray-800">
                  {currentProject?.name || 'Select Project'}
                </div>
                <div className="max-h-52 overflow-y-auto border-t border-gray-100">
                  {isProjectsLoading ? (
                    <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-gray-400">
                      Loading projects...
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-gray-400">
                      Projects appear after generation
                    </div>
                  ) : (
                    projects.map((project) => {
                      const isSelected = currentProject?.id === project.id;
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => {
                            onSelectProject?.(project);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 border-b border-gray-50 last:border-b-0 text-[11px] uppercase tracking-widest transition-colors ${
                            isSelected
                              ? 'bg-gray-100 text-black font-bold'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {project.name}
                        </button>
                      );
                    })
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onOpenProjectModal?.();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-[10px] uppercase tracking-widest text-gray-700 hover:bg-gray-50"
                >
                  + Name New Project
                </button>
              </div>
            )}

            {navItemsMobile.map((item) => (
              <a
                key={item.id}
                href={getPathForPage(item.id)}
                onClick={(event) => handleNavigateClick(event, item.id)}
                className={`relative inline-flex w-fit items-center gap-2 text-left transition-colors hover:text-black ${currentPage === item.id ? 'text-black font-bold' : ''}`}
              >
                {item.label}
                {item.id === 'materials' && boardCount > 0 && (
                  <span className="min-w-[18px] h-[18px] inline-flex items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold text-white">
                    {materialCountLabel}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Buy Credits Modal */}
      <BuyCreditsModal
        isOpen={showBuyCreditsModal}
        onClose={() => setShowBuyCreditsModal(false)}
      />
    </nav>
  );
};

export default Navbar;
