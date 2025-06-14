
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { pwaService } from '@/services/pwaService';
import HomePage from '@/pages/website/HomePage';
import { createLogger } from '@/utils/logger';
import { useTranslation } from '@/contexts/TranslationContext';

const logger = createLogger('Index');

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // Track translation loading before rendering
  const { prefetchTranslationsForRoute, currentLanguage, isTranslating } = useTranslation();
  const [translationsReady, setTranslationsReady] = useState(currentLanguage === "en");

  // Prefetch route-based translations before showing homepage
  useEffect(() => {
    let isMounted = true;
    const go = async () => {
      if (currentLanguage === "en") {
        setTranslationsReady(true);
        return;
      }
      setTranslationsReady(false);
      await prefetchTranslationsForRoute("/");
      if (isMounted) setTranslationsReady(true);
    };
    go();
    return () => { isMounted = false; };
  }, [currentLanguage, prefetchTranslationsForRoute]);

  // Only redirect to app routes if explicitly requested or in standalone PWA mode
  useEffect(() => {
    logger.debug('Checking for app redirection needs');
    const pwaInfo = pwaService.getPWAInfo();
    const isStandaloneApp = pwaInfo.isStandalone;
    logger.debug('App context detection', {
      isStandalone: isStandaloneApp,
      platform: pwaInfo.platform,
      userAgent: navigator.userAgent.slice(0, 100)
    });
    // Only redirect to app if in standalone PWA mode
    if (isStandaloneApp) {
      logger.debug('Standalone PWA detected, redirecting to app splash');
      navigate('/app/splash', { replace: true });
      return;
    }
    // Check URL parameters for explicit app access
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('app') || urlParams.has('mobile')) {
      logger.debug('Explicit app access requested via URL params');
      navigate('/app/splash', { replace: true });
      return;
    }
    logger.debug('Rendering marketing homepage for route "/"');
  }, [navigate]);

  // Enhanced performance optimization for mobile web users
  useEffect(() => {
    if (isMobile.isMobile) {
      logger.debug('Mobile web user detected, optimizing for mobile experience');
      document.documentElement.style.setProperty('--mobile-viewport-height', '100vh');
      document.body.style.touchAction = 'manipulation';
      // Preload key app icons in case user navigates to app later
      const preloadImage = (src: string) => {
        const img = new Image();
        img.src = src;
      };
      preloadImage('/icons/icon-192x192.png');
      preloadImage('/icons/icon-512x512.png');
    }
  }, [isMobile.isMobile]);

  // Do not render page until translations are ready (no flash of English)
  if (!translationsReady || isTranslating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" aria-label="Loading..." />
      </div>
    );
  }

  return <HomePage />;
};

export default Index;
