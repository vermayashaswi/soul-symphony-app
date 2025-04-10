
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SouloLogo from '@/components/SouloLogo';
import LanguageSelector from './LanguageSelector';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Handle scrolling effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return (
    <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
      isScrolled ? 'bg-background/90 shadow-md backdrop-blur-md py-2' : 'bg-transparent py-4'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <SouloLogo size="large" useColorTheme={true} />
            <span className="text-xl font-bold">SOuLO</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            <Link to="/#features" className="text-foreground/90 hover:text-primary transition-colors">
              Features
            </Link>
            <Link to="/blog" className="text-foreground/90 hover:text-primary transition-colors">
              Blog
            </Link>
            <Link to="/pricing" className="text-foreground/90 hover:text-primary transition-colors">
              Pricing
            </Link>
            <LanguageSelector variant="minimal" />
            <Button size="sm" asChild className="ml-2">
              <Link to="/app">Try Now</Link>
            </Button>
          </div>
          
          <button
            className="md:hidden text-foreground"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-background shadow-lg mt-2">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
            <Link
              to="/#features"
              className="text-foreground/90 hover:text-primary py-2 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Features
            </Link>
            <Link
              to="/blog"
              className="text-foreground/90 hover:text-primary py-2 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Blog
            </Link>
            <Link
              to="/pricing"
              className="text-foreground/90 hover:text-primary py-2 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Pricing
            </Link>
            <div className="flex justify-between items-center">
              <LanguageSelector />
              <Button size="sm" asChild>
                <Link to="/app" onClick={() => setIsOpen(false)}>
                  Try Now
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
