import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Concept from './components/Concept';
import Moodboard from './components/Moodboard';
import AdRail from './components/AdRail';
import Product from './components/Product';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import Contact from './components/Contact';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('concept');

  const renderPage = () => {
    switch(currentPage) {
      case 'concept':
        return <Concept onNavigate={setCurrentPage} />;
      case 'moodboard':
        return <Moodboard onNavigate={setCurrentPage} />;
      case 'product':
        return <Product onNavigate={setCurrentPage} />;
      case 'privacy':
        return <PrivacyPolicy />;
      case 'terms':
        return <TermsOfService />;
      case 'contact':
        return <Contact />;
      default:
        return <Concept onNavigate={setCurrentPage} />;
    }
  };

  const showAds = currentPage !== 'moodboard';
  const adRailPadding = showAds ? 'xl:px-[210px] 2xl:px-[260px]' : '';

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar currentPage={currentPage} onNavigate={setCurrentPage} />
      
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

      <footer className="bg-arch-black text-white py-12 border-t border-gray-800">
        <div className={`max-w-screen-2xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-6 md:items-center ${adRailPadding}`}>
          <div>
            <h4 className="font-display font-bold uppercase tracking-widest text-lg">Moodboard Lab</h4>
            <div className="mt-3 flex flex-wrap gap-4 font-mono text-[11px] uppercase tracking-widest text-gray-400">
              <button onClick={() => setCurrentPage('product')} className="hover:text-white transition-colors">Product</button>
              <button onClick={() => setCurrentPage('privacy')} className="hover:text-white transition-colors">Privacy</button>
              <button onClick={() => setCurrentPage('terms')} className="hover:text-white transition-colors">Terms</button>
              <button onClick={() => setCurrentPage('contact')} className="hover:text-white transition-colors">Contact</button>
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
