
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useDebugLog } from '@/utils/debug/DebugContext';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesGrid from '@/components/landing/FeaturesGrid';
import EnergyAnimation from '@/components/EnergyAnimation';

const Index = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const isMobile = useIsMobile();
  const { resetOnboarding } = useOnboarding();
  const { addEvent } = useDebugLog();

  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile.isMobile || mobileDemo;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.2
      }
    }
  };

  // Log translation status for the Index page
  useEffect(() => {
    addEvent('i18n', 'Index page translation check', 'info', {
      mainTagline: t('mainTagline'),
      mainTaglineTranslated: t('mainTagline') !== 'mainTagline',
      currentLanguage: i18n.language
    });
    
    // Apply data-i18n attributes to help with debugging
    const applyI18nAttributes = () => {
      document.querySelectorAll('h1, h2, h3, p, button, a').forEach((el, index) => {
        if (!el.hasAttribute('data-i18n-key') && !el.hasAttribute('data-i18n-section')) {
          el.setAttribute('data-i18n-auto', `element-${index}`);
        }
      });
    };
    
    // Run once on mount and whenever language changes
    applyI18nAttributes();
    
    // Fixed: Don't use the return value of i18n.on in a conditional statement
    const handleLanguageChange = () => {
      addEvent('i18n', 'Language changed in Index page', 'info', {
        to: i18n.language
      });
      applyI18nAttributes();
    };
    
    // Listen for language changes - store the unsubscribe function
    const unsubscribe = i18n.on('languageChanged', handleLanguageChange);
    
    return () => {
      // Fixed: Only call unsubscribe if it's a function
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [t, i18n, addEvent]);

  useEffect(() => {
    if (shouldRenderMobile) {
      const metaViewport = document.querySelector('meta[name="viewport"]');
      if (metaViewport) {
        metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
    }
  }, [shouldRenderMobile]);

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      {/* Full-width and height animation with bottom navbar offset */}
      <EnergyAnimation fullScreen={true} bottomNavOffset={shouldRenderMobile} />
      
      <Navbar />
      
      <motion.main
        className={cn(
          "flex-1 container mx-auto px-4 py-8 relative z-10",
          shouldRenderMobile ? "max-w-md" : "",
          shouldRenderMobile ? "pb-28 pt-24" : "pt-24"
        )}
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        data-i18n-section="index-page"
      >
        <HeroSection user={user} />
        
        {/* Main Tagline with translation */}
        <div className="text-center my-12">
          <h2 className="text-2xl md:text-3xl font-medium" data-i18n-key="mainTagline">{t('mainTagline')}</h2>
        </div>
        
        <FeaturesGrid />
      </motion.main>
    </div>
  );
};

export default Index;
