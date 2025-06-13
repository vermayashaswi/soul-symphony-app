
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { pwaService } from '@/services/pwaService';
import HomePage from '@/pages/website/HomePage';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    // Only redirect to app routes if explicitly requested or in standalone PWA mode
    const handleAppRedirection = async () => {
      console.log('[Index] Checking for app redirection needs');
      
      // Check if this is a PWA standalone mode (actual app installation)
      const pwaInfo = pwaService.getPWAInfo();
      const isStandaloneApp = pwaInfo.isStandalone;
      
      console.log('[Index] App context detection:', {
        isStandalone: isStandaloneApp,
        platform: pwaInfo.platform,
        userAgent: navigator.userAgent.slice(0, 100)
      });

      // Only redirect to app if in standalone PWA mode
      if (isStandaloneApp) {
        console.log('[Index] Standalone PWA detected, redirecting to app splash');
        navigate('/app/splash', { replace: true });
        return;
      }

      // Check URL parameters for explicit app access
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('app') || urlParams.has('mobile')) {
        console.log('[Index] Explicit app access requested via URL params');
        navigate('/app/splash', { replace: true });
        return;
      }

      // For all other cases (including mobile web), stay on marketing homepage
      console.log('[Index] Rendering marketing homepage for route "/"');
    };

    handleAppRedirection();
  }, [navigate]);

  // Enhanced performance optimization for mobile web users
  useEffect(() => {
    if (isMobile.isMobile) {
      console.log('[Index] Mobile web user detected, optimizing for mobile experience');
      
      // Set mobile-specific optimizations for the marketing page
      document.documentElement.style.setProperty('--mobile-viewport-height', '100vh');
      document.body.style.touchAction = 'manipulation';
      
      // Preload app assets for potential future navigation
      const preloadImage = (src: string) => {
        const img = new Image();
        img.src = src;
      };
      
      // Preload key app icons in case user navigates to app later
      preloadImage('/icons/icon-192x192.png');
      preloadImage('/icons/icon-512x512.png');
    }
  }, [isMobile.isMobile]);

  // Render the marketing homepage directly
  return <HomePage />;
};

export default Index;
