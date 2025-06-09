
import React, { useEffect, useState } from 'react';
import Navbar from '@/components/website/Navbar';
import Footer from '@/components/website/Footer';
import HeroSection from '@/components/website/sections/HeroSection';
import SoulNetTranslationIndicator from '@/components/translation/SoulNetTranslationIndicator';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { forceEnableScrolling } from '@/hooks/use-scroll-restoration';

const HomePage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Force enable scrolling for website pages
  useEffect(() => {
    try {
      console.log('[HomePage] Initializing website home page');
      
      // Force enable scrolling for website
      forceEnableScrolling();
      
      // Explicitly ensure scrolling is enabled for website
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      
      // Add website-specific class
      document.body.classList.add('website-page');
      
      console.log('[HomePage] Website home page initialized successfully');
      setIsLoading(false);
      
    } catch (error) {
      console.error('[HomePage] Error initializing home page:', error);
      setHasError(true);
      setIsLoading(false);
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('website-page');
      console.log('[HomePage] Website home page cleanup completed');
    };
  }, []);

  const openAppStore = () => {
    try {
      console.log('[HomePage] Opening App Store');
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const appStoreUrl = 'https://apps.apple.com/app/soulo';
      
      if (isIOS) {
        window.location.href = 'itms-apps://itunes.apple.com/app/soulo';
        setTimeout(() => {
          window.location.href = appStoreUrl;
        }, 500);
      } else {
        window.open(appStoreUrl, '_blank');
      }
    } catch (error) {
      console.error('[HomePage] Error opening App Store:', error);
    }
  };

  const openPlayStore = () => {
    try {
      console.log('[HomePage] Opening Play Store');
      const isAndroid = /Android/.test(navigator.userAgent);
      const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.soulo.app';
      
      if (isAndroid) {
        window.location.href = 'market://details?id=com.soulo.app';
        setTimeout(() => {
          window.location.href = playStoreUrl;
        }, 500);
      } else {
        window.open(playStoreUrl, '_blank');
      }
    } catch (error) {
      console.error('[HomePage] Error opening Play Store:', error);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading website...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (hasError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold mb-4">Website Loading Error</h1>
          <p className="text-muted-foreground mb-6">
            We're having trouble loading the website. Please try refreshing the page.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  console.log('[HomePage] Rendering website home page successfully');

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Navbar />
      
      {/* SoulNet Translation Indicator */}
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
