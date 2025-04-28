
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SouloLogo from '@/components/SouloLogo';
import { TranslatableText } from '@/components/translation/TranslatableText';
import LanguageSelector from '@/components/translation/LanguageSelector';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3 shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <SouloLogo size="normal" useColorTheme={true} />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          <Link to="/" className="text-gray-600 hover:text-primary text-sm">
            <TranslatableText text="navbar.home" />
          </Link>
          <Link to="/blog" className="text-gray-600 hover:text-primary text-sm">
            <TranslatableText text="navbar.blog" />
          </Link>
          <Link to="/faq" className="text-gray-600 hover:text-primary text-sm">
            <TranslatableText text="navbar.faq" />
          </Link>
          <LanguageSelector />
          <Button size="sm" asChild>
            <a href="https://apps.apple.com/app/soulo" target="_blank" rel="noopener noreferrer">
              <TranslatableText text="download.appStore" />
            </a>
          </Button>
        </div>

        {/* Mobile Navigation Toggle */}
        <div className="md:hidden flex items-center">
          <LanguageSelector />
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
              <TranslatableText text="navbar.home" />
            </Link>
            <Link to="/blog" className="text-gray-600 hover:text-primary" onClick={toggleMenu}>
              <TranslatableText text="navbar.blog" />
            </Link>
            <Link to="/faq" className="text-gray-600 hover:text-primary" onClick={toggleMenu}>
              <TranslatableText text="navbar.faq" />
            </Link>
            <Button size="sm" className="w-full" asChild>
              <a href="https://apps.apple.com/app/soulo" target="_blank" rel="noopener noreferrer">
                <TranslatableText text="download.appStore" />
              </a>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
