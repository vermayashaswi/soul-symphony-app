
import React, { useEffect } from 'react';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';
import HeroSection from '@/components/website/sections/HeroSection';
import SoulNetTranslationIndicator from '@/components/translation/SoulNetTranslationIndicator';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { forceEnableScrolling } from '@/hooks/use-scroll-restoration';

// No app providers on marketing page – safe to use only DOM effects
const HomePage = () => {
  useEffect(() => {
    // Ensure scrolling is always enabled on marketing
    forceEnableScrolling();
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.body.style.top = '';
    document.body.style.left = '';
  }, []);

  // Store buttons – fine for marketing
  const openAppStore = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const appStoreUrl = 'https://apps.apple.com/app/soulo';
    if (isIOS) {
      window.location.href = 'itms-apps://itunes.apple.com/app/soulo';
      setTimeout(() => { window.location.href = appStoreUrl; }, 500);
    } else {
      window.open(appStoreUrl, '_blank');
    }
  };

  const openPlayStore = () => {
    const isAndroid = /Android/.test(navigator.userAgent);
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.soulo.app';
    if (isAndroid) {
      window.location.href = 'market://details?id=com.soulo.app';
      setTimeout(() => { window.location.href = playStoreUrl; }, 500);
    } else {
      window.open(playStoreUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Navbar />
      {/* SoulNet Translation Indicator can stay for marketing if not using app context */}
      <SoulNetTranslationIndicator className="fixed top-20 right-4 z-50 bg-background/90 backdrop-blur-sm px-3 py-2 rounded-lg border" />
      <HeroSection 
        openAppStore={openAppStore}
        openPlayStore={openPlayStore}
      />
      <Footer />
    </div>
  );
};

export default HomePage;
