import React from 'react';
import { Menu } from 'lucide-react';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const navItems = [
    { id: 'concept', label: 'Home' },
    { id: 'moodboard', label: 'Moodboard' }
  ];

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-screen-2xl mx-auto px-6 h-20 flex items-center justify-between">
        <div 
          className="flex flex-col cursor-pointer group" 
          onClick={() => onNavigate('concept')}
        >
          <h1 className="font-display font-bold text-xl tracking-tighter uppercase group-hover:opacity-70 transition-opacity">
            Moodboard Lab
          </h1>
          <span className="font-mono text-xs text-gray-500 tracking-widest uppercase">
            Moodboard & Material Workspace
          </span>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="hidden md:flex gap-8 font-mono text-xs uppercase tracking-widest text-gray-600">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`hover:text-black transition-colors relative py-1 ${
                  currentPage === item.id ? 'text-black font-bold' : ''
                }`}
              >
                {item.label}
                {currentPage === item.id && (
                  <span className="absolute bottom-0 left-0 w-full h-[1px] bg-black"></span>
                )}
              </button>
            ))}
          </div>
          <button className="md:hidden">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
