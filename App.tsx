import React, { useEffect, useMemo, useState } from 'react';
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

  const materialsKey = useMemo(() => getBriefingMaterialsKey(selectedMaterials), [selectedMaterials]);

  useEffect(() => {
    if (!briefingMaterialsKey) return;
    if (materialsKey !== briefingMaterialsKey) {
      setSustainabilityBriefing(null);
      setBriefingPayload(null);
      setBriefingMaterialsKey(null);
      setBriefingInvalidatedMessage(
        'Materials palette changed. Please create a new moodboard and sustainability briefing.'
      );
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
