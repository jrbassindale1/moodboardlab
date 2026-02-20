import React, { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from './components/Navbar';
import Concept from './components/Concept';
import Moodboard from './components/Moodboard';
import ApplyMaterials from './components/ApplyMaterials';
import MaterialSelection from './components/MaterialSelection';
import AdRail from './components/AdRail';
import Product from './components/Product';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import Contact from './components/Contact';
import CookieBanner from './components/CookieBanner';
import Dashboard from './components/Dashboard';
import MaterialAdmin from './components/MaterialAdmin';
import { MaterialOption } from './types';
import type {
  SustainabilityBriefingPayload,
  SustainabilityBriefingResponse,
} from './utils/sustainabilityBriefing';
import { getBriefingMaterialsKey } from './utils/sustainabilityBriefing';
import { trackPageView } from './utils/analytics';

const BRIEFING_CACHE_KEY = 'moodboard_sustainability_briefing_v1';
const BOARD_CACHE_KEY = 'moodboard_selected_materials_v1';

type BriefingCache = {
  materialsKey: string;
  briefing: SustainabilityBriefingResponse;
  payload: SustainabilityBriefingPayload;
  savedAt: string;
};

type BoardCache = {
  board: MaterialOption[];
  savedAt: string;
};

const readBriefingCache = (): BriefingCache | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BRIEFING_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BriefingCache>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.materialsKey || !parsed.briefing || !parsed.payload) return null;
    return parsed as BriefingCache;
  } catch {
    return null;
  }
};

const readBoardCache = (): BoardCache | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BoardCache>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.board)) return null;
    return { board: parsed.board as MaterialOption[], savedAt: parsed.savedAt || '' };
  } catch {
    return null;
  }
};

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('concept');
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialOption[]>([]);
  const [moodboardRenderUrl, setMoodboardRenderUrl] = useState<string | null>(null);
  const [appliedRenderUrl, setAppliedRenderUrl] = useState<string | null>(null);
  const [sustainabilityBriefing, setSustainabilityBriefing] =
    useState<SustainabilityBriefingResponse | null>(null);
  const [briefingPayload, setBriefingPayload] = useState<SustainabilityBriefingPayload | null>(null);
  const [briefingMaterialsKey, setBriefingMaterialsKey] = useState<string | null>(null);
  const [briefingInvalidatedMessage, setBriefingInvalidatedMessage] = useState<string | null>(null);
  const [openConsentPreferences, setOpenConsentPreferences] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const briefingCacheRef = useRef<BriefingCache | null>(null);
  const boardCacheRestoredRef = useRef(false);

  const materialsKey = useMemo(() => getBriefingMaterialsKey(selectedMaterials), [selectedMaterials]);

  useEffect(() => {
    briefingCacheRef.current = readBriefingCache();
  }, []);

  // Track page views in Google Analytics
  useEffect(() => {
    trackPageView(
      `/${currentPage}`,
      currentPage.charAt(0).toUpperCase() + currentPage.slice(1)
    );
  }, [currentPage]);

  useEffect(() => {
    if (boardCacheRestoredRef.current) return;
    boardCacheRestoredRef.current = true;
    const cached = readBoardCache();
    if (!cached) return;
    setSelectedMaterials((prev) => (prev.length ? prev : cached.board));
  }, []);

  useEffect(() => {
    if (sustainabilityBriefing || briefingPayload) return;
    if (!selectedMaterials.length) return;
    const cached = briefingCacheRef.current;
    if (!cached || cached.materialsKey !== materialsKey) return;
    setSustainabilityBriefing(cached.briefing);
    setBriefingPayload(cached.payload);
    setBriefingMaterialsKey(cached.materialsKey);
    setBriefingInvalidatedMessage(null);
  }, [materialsKey, selectedMaterials.length, sustainabilityBriefing, briefingPayload]);

  useEffect(() => {
    if (!briefingMaterialsKey || !sustainabilityBriefing || !briefingPayload) return;
    if (typeof window === 'undefined') return;
    const cache: BriefingCache = {
      materialsKey: briefingMaterialsKey,
      briefing: sustainabilityBriefing,
      payload: briefingPayload,
      savedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(BRIEFING_CACHE_KEY, JSON.stringify(cache));
      briefingCacheRef.current = cache;
    } catch {
      // Ignore storage errors (quota, private mode, etc.)
    }
  }, [briefingMaterialsKey, sustainabilityBriefing, briefingPayload]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cache: BoardCache = {
      board: selectedMaterials,
      savedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(BOARD_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // Ignore storage errors (quota, private mode, etc.)
    }
  }, [selectedMaterials]);

  useEffect(() => {
    if (!briefingMaterialsKey) return;
    if (materialsKey !== briefingMaterialsKey) {
      setSustainabilityBriefing(null);
      setBriefingPayload(null);
      setBriefingMaterialsKey(null);
      setBriefingInvalidatedMessage(
        'Materials palette changed. Please create a new moodboard and sustainability briefing.'
      );
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(BRIEFING_CACHE_KEY);
        } catch {
          // Ignore storage errors (quota, private mode, etc.)
        }
      }
      briefingCacheRef.current = null;
    }
  }, [materialsKey, briefingMaterialsKey]);

  useEffect(() => {
    if (!isHelpOpen || typeof window === 'undefined') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsHelpOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isHelpOpen]);

  const handleRestoreGeneration = ({
    targetPage,
    board,
    generationImageUrl,
    sourceType,
  }: {
    targetPage: 'moodboard' | 'apply';
    board: MaterialOption[];
    generationImageUrl: string | null;
    sourceType: 'moodboard' | 'applyMaterials' | 'upscale' | 'materialIcon' | 'sustainabilityBriefing';
  }) => {
    setSelectedMaterials(board);

    if (targetPage === 'moodboard') {
      setMoodboardRenderUrl(generationImageUrl);
      setCurrentPage('moodboard');
      return;
    }

    if (generationImageUrl && (sourceType === 'applyMaterials' || sourceType === 'upscale')) {
      setAppliedRenderUrl(generationImageUrl);
    }
    setCurrentPage('apply');
  };

  const renderPage = () => {
    switch(currentPage) {
      case 'concept':
        return <Concept onNavigate={setCurrentPage} />;
      case 'materials':
        return (
          <MaterialSelection
            onNavigate={setCurrentPage}
            board={selectedMaterials}
            onBoardChange={setSelectedMaterials}
          />
        );
      case 'moodboard':
        return (
          <Moodboard
            onNavigate={setCurrentPage}
            initialBoard={selectedMaterials}
            onBoardChange={setSelectedMaterials}
            moodboardRenderUrl={moodboardRenderUrl}
            onMoodboardRenderUrlChange={setMoodboardRenderUrl}
            sustainabilityBriefing={sustainabilityBriefing}
            onSustainabilityBriefingChange={setSustainabilityBriefing}
            briefingPayload={briefingPayload}
            onBriefingPayloadChange={setBriefingPayload}
            onBriefingMaterialsKeyChange={setBriefingMaterialsKey}
            briefingInvalidatedMessage={briefingInvalidatedMessage}
            onBriefingInvalidatedMessageChange={setBriefingInvalidatedMessage}
          />
        );
      case 'apply':
        return (
          <ApplyMaterials
            onNavigate={setCurrentPage}
            board={selectedMaterials}
            onBoardChange={setSelectedMaterials}
            moodboardRenderUrl={moodboardRenderUrl}
            appliedRenderUrl={appliedRenderUrl}
            onAppliedRenderUrlChange={setAppliedRenderUrl}
          />
        );
      case 'product':
        return <Product onNavigate={setCurrentPage} />;
      case 'privacy':
        return <PrivacyPolicy />;
      case 'terms':
        return <TermsOfService />;
      case 'contact':
        return <Contact />;
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} onRestoreGeneration={handleRestoreGeneration} />;
      case 'material-admin':
        return <MaterialAdmin onNavigate={setCurrentPage} />;
      default:
        return <Concept onNavigate={setCurrentPage} />;
    }
  };

  const showAds = currentPage !== 'moodboard' && currentPage !== 'apply';
  const adRailPadding = showAds ? 'xl:px-[210px] 2xl:px-[260px]' : '';

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        boardCount={selectedMaterials.length}
        moodboardReady={Boolean(moodboardRenderUrl)}
      />

      <main className={`flex-grow relative ${adRailPadding}`}>
        {showAds && (
          <>
            <AdRail side="left" />
            <AdRail side="right" />
          </>
        )}
        <div className="relative">
          {renderPage()}
        </div>
      </main>

      <CookieBanner
        openPreferences={openConsentPreferences}
        onClosePreferences={() => setOpenConsentPreferences(false)}
      />

      <footer className="bg-arch-black text-white py-12 border-t border-gray-800">
        <div className={`max-w-screen-2xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-6 md:items-center ${adRailPadding}`}>
          <div>
            <h4 className="font-display font-bold uppercase tracking-widest text-lg">Moodboard Lab</h4>
            <div className="mt-3 flex flex-wrap gap-4 font-mono text-[11px] uppercase tracking-widest text-gray-400">
              <button onClick={() => setCurrentPage('product')} className="hover:text-white transition-colors">Product</button>
              <button onClick={() => setIsHelpOpen(true)} className="hover:text-white transition-colors">Help</button>
              <button onClick={() => setCurrentPage('privacy')} className="hover:text-white transition-colors">Privacy</button>
              <button onClick={() => setCurrentPage('terms')} className="hover:text-white transition-colors">Terms</button>
              <button onClick={() => setCurrentPage('contact')} className="hover:text-white transition-colors">Contact</button>
              <button onClick={() => setOpenConsentPreferences(true)} className="hover:text-white transition-colors">Privacy & Cookies</button>
            </div>
          </div>
          <div className="font-mono text-xs text-gray-500 uppercase tracking-widest text-center md:text-right">
            <p>&copy; {new Date().getFullYear()} Moodboard & Material Workspace.</p>
            <p className="mt-1">Built for fast material curation and rendering.</p>
          </div>
        </div>
      </footer>

      {isHelpOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 py-8"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsHelpOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
        >
          <div className="w-full max-w-2xl bg-white text-gray-900 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2
                  id="help-modal-title"
                  className="font-display text-xl uppercase tracking-widest"
                >
                  Student Quick Guide
                </h2>
                <p className="mt-1 text-xs font-mono uppercase tracking-widest text-gray-500">
                  Moodboard Lab
                </p>
              </div>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="text-xs font-mono uppercase tracking-widest text-gray-600 hover:text-black"
              >
                Close
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              <div>
                <h3 className="font-display uppercase tracking-widest text-sm mb-2">What You Can Do</h3>
                <ul className="text-sm text-gray-700 font-sans space-y-2 list-disc list-inside">
                  <li>Build a materials board by browsing categories and adding items.</li>
                  <li>Generate a photorealistic moodboard render and download the image.</li>
                  <li>Create a Sustainability Briefing and download the PDF.</li>
                  <li>Download a Materials Sheet PDF for documentation or presentations.</li>
                  <li>Apply your palette to a sketch/photo, then edit or upscale the render.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-display uppercase tracking-widest text-sm mb-2">Quick Steps</h3>
                <ol className="text-sm text-gray-700 font-sans space-y-2 list-decimal list-inside">
                  <li>Go to `Materials`, search or browse, then click `Add to Board`.</li>
                  <li>Open `Moodboard Lab` and click `Create Moodboard`.</li>
                  <li>In the Sustainability Briefing section, review the summary and download PDFs.</li>
                  <li>Open `Apply`, upload a JPG/PNG, then `Render with Upload` and refine.</li>
                </ol>
              </div>

              <div>
                <h3 className="font-display uppercase tracking-widest text-sm mb-2">Important Notes</h3>
                <ul className="text-sm text-gray-700 font-sans space-y-2 list-disc list-inside">
                  <li>Sign in may be required to add materials or generate images.</li>
                  <li>The `Apply` tab unlocks only after you create a moodboard.</li>
                  <li>Generations are limited and reset on a schedule.</li>
                  <li>
                    AI-generated content must be used carefully. Verify materials, performance claims,
                    and sustainability insights with reliable sources before using in real projects.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
