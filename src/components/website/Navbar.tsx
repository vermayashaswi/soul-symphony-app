
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MarketingSouloLogo from '@/components/marketing/MarketingSouloLogo';
import { MarketingTranslatableText } from '@/components/marketing/MarketingTranslatableText';
import { MarketingLanguageSelector } from '@/components/marketing/MarketingLanguageSelector';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3 shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <MarketingSouloLogo size="normal" />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          <Link to="/" className="text-gray-600 hover:text-primary text-sm">
            <MarketingTranslatableText text="Home" />
          </Link>
          <Link to="/blog" className="text-gray-600 hover:text-primary text-sm">
            <MarketingTranslatableText text="Blog" />
          </Link>
          <Link to="/faq" className="text-gray-600 hover:text-primary text-sm">
            <MarketingTranslatableText text="FAQ" />
          </Link>
          <Button size="sm" asChild>
            <a href="https://apps.apple.com/app/soulo" target="_blank" rel="noopener noreferrer">
              <MarketingTranslatableText text="Download on App Store" />
            </a>
          </Button>
          <MarketingLanguageSelector />
        </div>

        {/* Mobile Navigation Toggle */}
        <div className="md:hidden flex items-center">
          <Button variant="ghost" size="sm" className="ml-2" onClick={toggleMenu}>
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 py-4">
          <div className="container mx-auto flex flex-col space-y-4 px-4">
            <Link to="/" className="text-gray-600 hover:text-primary" onClick={toggleMenu}>
              <MarketingTranslatableText text="Home" />
            </Link>
            <Link to="/blog" className="text-gray-600 hover:text-primary" onClick={toggleMenu}>
              <MarketingTranslatableText text="Blog" />
            </Link>
            <Link to="/faq" className="text-gray-600 hover:text-primary" onClick={toggleMenu}>
              <MarketingTranslatableText text="FAQ" />
            </Link>
            <Button size="sm" className="w-full" asChild>
              <a href="https://apps.apple.com/app/soulo" target="_blank" rel="noopener noreferrer">
                <MarketingTranslatableText text="Download on App Store" />
              </a>
            </Button>
            <MarketingLanguageSelector />
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
