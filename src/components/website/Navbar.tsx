
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SouloLogo from '@/components/SouloLogo';
import { Button } from '@/components/ui/button';

const Navbar = () => {
  return (
    <motion.nav 
      className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md shadow-sm py-4 px-4 md:px-8"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <SouloLogo size="normal" useColorTheme={true} />
          <span className="font-bold text-lg md:text-xl hidden sm:inline-block text-primary">SOULo</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link to="/blog">Blog</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/faq">FAQ</Link>
          </Button>
          <Button variant="default" asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/app">Open App</Link>
          </Button>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
