
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SouloLogoSafe from '@/components/SouloLogoSafe';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { LanguageSelector } from '@/components/translation/LanguageSelector';
import { useTranslation } from '@/contexts/TranslationContext';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { prefetchTranslationsForRoute } = useTranslation();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  
  // Prefetch translations for navbar items on mount and route change
  useEffect(() => {
    const route = location.pathname;
    
    if (prefetchTranslationsForRoute) {
      prefetchTranslationsForRoute(route);
    }
  }, [location.pathname, prefetchTranslationsForRoute]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3 shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <SouloLogoSafe size="normal" useColorTheme={true} disableTheme={true} />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          <Link to="/" className="text-gray-600 hover:text-primary text-sm">
            <TranslatableText text="Home" />
          </Link>
          <Link to="/blog" className="text-gray-600 hover:text-primary text-sm">
            <TranslatableText text="Blog" />
          </Link>
          <Link to="/faq" className="text-gray-600 hover:text-primary text-sm">
            <TranslatableText text="FAQ" />
          </Link>
          <Button size="sm" asChild>
            <a href="https://apps.apple.com/app/soulo" target="_blank" rel="noopener noreferrer">
              <TranslatableText text="Download on App Store" />
            </a>
          </Button>
          <LanguageSelector />
        </div>

        {/* Mobile Navigation Toggle */}
        <div className="md:hidden flex items-center">
          <Button
            size="icon"
            className={`
              ml-2 rounded-full bg-primary/80 text-white shadow-lg 
              hover:bg-primary/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 
              transition-colors duration-200
            `}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            onClick={toggleMenu}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 py-4">
          <div className="container mx-auto flex flex-col space-y-4 px-4">
            <Link to="/" className="text-gray-600 hover:text-primary" onClick={toggleMenu}>
              <TranslatableText text="Home" />
            </Link>
            <Link to="/blog" className="text-gray-600 hover:text-primary" onClick={toggleMenu}>
              <TranslatableText text="Blog" />
            </Link>
            <Link to="/faq" className="text-gray-600 hover:text-primary" onClick={toggleMenu}>
              <TranslatableText text="FAQ" />
            </Link>
            <Button size="sm" className="w-full" asChild>
              <a href="https://apps.apple.com/app/soulo" target="_blank" rel="noopener noreferrer">
                <TranslatableText text="Download on App Store" />
              </a>
            </Button>
            <LanguageSelector />
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
