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
import { MaterialOption } from './types';
import type {
  SustainabilityBriefingPayload,
  SustainabilityBriefingResponse,
} from './utils/sustainabilityBriefing';
import { getBriefingMaterialsKey } from './utils/sustainabilityBriefing';

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
  const briefingCacheRef = useRef<BriefingCache | null>(null);
  const boardCacheRestoredRef = useRef(false);

  const materialsKey = useMemo(() => getBriefingMaterialsKey(selectedMaterials), [selectedMaterials]);

  useEffect(() => {
    briefingCacheRef.current = readBriefingCache();
  }, []);

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
        return <Dashboard onNavigate={setCurrentPage} />;
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
    </div>
  );
};

export default App;
