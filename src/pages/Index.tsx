
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnboarding } from '@/hooks/use-onboarding';
import { pwaService } from '@/services/pwaService';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const isMobile = useIsMobile();
  const { onboardingComplete, checkOnboardingStatus } = useOnboarding();

  useEffect(() => {
    // Immediate redirect to splash for mobile app experience
    const handleMobileAppFlow = async () => {
      console.log('[Index] Starting mobile app flow detection');
      
      // Check if this is a PWA or native app context
      const pwaInfo = pwaService.getPWAInfo();
      const isAppContext = pwaInfo.isStandalone || isMobile.isMobile || window.location.href.includes('app');
      
      console.log('[Index] App context detection:', {
        isStandalone: pwaInfo.isStandalone,
        isMobile: isMobile.isMobile,
        platform: pwaInfo.platform,
        isAppContext
      });

      // For mobile/app contexts, always start with splash
      if (isAppContext) {
        console.log('[Index] Mobile/app context detected, redirecting to splash');
        navigate('/app/splash', { replace: true });
        return;
      }

      // For desktop web, check URL parameters for explicit app access
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('app') || urlParams.has('mobile')) {
        console.log('[Index] Explicit app access requested via URL params');
        navigate('/app/splash', { replace: true });
        return;
      }

      // Default behavior for desktop web - stay on website homepage
      console.log('[Index] Desktop web context, staying on homepage');
    };

    handleMobileAppFlow();
  }, [navigate, isMobile.isMobile]);

  // Enhanced performance optimization for mobile
  useEffect(() => {
    // Preload critical app resources when mobile is detected
    if (isMobile.isMobile) {
      console.log('[Index] Preloading mobile app resources');
      
      // Preload splash screen assets
      const preloadImage = (src: string) => {
        const img = new Image();
        img.src = src;
      };

      // Preload key icons
      preloadImage('/icons/icon-192x192.png');
      preloadImage('/icons/icon-512x512.png');
      
      // Set mobile-specific optimizations
      document.documentElement.style.setProperty('--mobile-viewport-height', '100vh');
      document.body.style.touchAction = 'manipulation';
    }
  }, [isMobile.isMobile]);

  // Loading state for smooth transition
  return (
    <div className="flex items-center justify-center min-h-screen bg-purple-900">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-purple-300 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white text-lg">Loading SOULo...</p>
      </div>
    </div>
  );
};

export default Index;
