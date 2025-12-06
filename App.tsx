import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Gallery from './components/Gallery';
import ProjectSpecs from './components/ProjectSpecs';
import Concept from './components/Concept';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('concept');

  const renderPage = () => {
    switch(currentPage) {
      case 'concept':
        return <Concept onNavigate={setCurrentPage} />;
      case 'visuals':
        return <Gallery />;
      case 'specs':
        return <ProjectSpecs />;
      default:
        return <Concept onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar currentPage={currentPage} onNavigate={setCurrentPage} />
      
      <main className="flex-grow">
        {renderPage()}
      </main>

      <footer className="bg-arch-black text-white py-12 border-t border-gray-800">
        <div className="max-w-screen-2xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
                <h4 className="font-display font-bold uppercase tracking-widest text-lg">UWE Bristol</h4>
            </div>
            <div className="font-mono text-xs text-gray-500 uppercase tracking-widest text-center md:text-right">
                <p>&copy; {new Date().getFullYear()} Engineering Department Proposal.</p>
                <p className="mt-1">Designed by Jonathan Bassindale.</p>
            </div>
        </div>
      </footer>
    </div>
  );
};

export default App;