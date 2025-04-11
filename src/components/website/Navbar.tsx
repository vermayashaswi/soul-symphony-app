
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import SouloLogo from '@/components/SouloLogo';
import { Button } from '@/components/ui/button';
import LanguageSelector from '@/components/LanguageSelector';

const Navbar = () => {
  console.log("Website Navbar rendering"); // Debug log
  const { t } = useTranslation();

  const scrollToDownloadSection = () => {
    const downloadSection = document.getElementById('download-section');
    if (downloadSection) {
      downloadSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      console.log("Download section not found");
      // Fallback: scroll to a reasonable position if section not found
      window.scrollTo({
        top: document.body.scrollHeight - window.innerHeight,
        behavior: 'smooth'
      });
    }
  };

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
          {/* Removed SOULo text as requested */}
        </Link>
        
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link to="/">{t('navbar.home')}</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/blog">{t('navbar.blog')}</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/faq">{t('navbar.faq')}</Link>
          </Button>
          <Button 
            variant="default" 
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={scrollToDownloadSection}
          >
            {t('navbar.download')}
          </Button>
          <LanguageSelector />
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
