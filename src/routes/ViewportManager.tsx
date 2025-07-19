import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileNavigation from '@/components/MobileNavigation';
import { isAppRoute, isWebsiteRoute } from './RouteHelpers';
import { useOnboarding } from '@/hooks/use-onboarding';
import { forceEnableScrolling } from '@/hooks/use-scroll-restoration';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { LoadingScreen } from '@/components/common/LoadingScreen';

const ViewportManager: React.FC = () => {
  // CRITICAL: All hooks must be called at the top level, unconditionally
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const { onboardingComplete } = useOnboarding();
  const [nativeInitialized, setNativeInitialized] = useState(false);
  
  console.log('[ViewportManager] Rendering with hooks called:', {
    path: location.pathname,
    hasUser: !!user,
    authLoading,
    onboardingComplete,
    nativeInitialized
  });

  // Calculate derived values
  const onboardingOrAuthPaths = [
    '/app/onboarding',
    '/app/auth',
    '/onboarding',
    '/auth',
    '/'
  ];
  
  const isOnboardingOrAuth = onboardingOrAuthPaths.includes(location.pathname);
  const isHomePage = location.pathname === '/app/home';
  const currentIsAppRoute = isAppRoute(location.pathname);
  const currentIsWebsiteRoute = isWebsiteRoute(location.pathname);

  // Initialize native services
  useEffect(() => {
    const initializeNative = async () => {
      console.log('[ViewportManager] Initializing native services...');
      try {
        await nativeIntegrationService.initialize();
        console.log('[ViewportManager] Native services initialized');
        setNativeInitialized(true);
      } catch (error) {
        console.error('[ViewportManager] Native services initialization failed:', error);
        setNativeInitialized(true); // Continue anyway
      }
    };

    initializeNative();
  }, []);

  // Ensure proper scrolling behavior on route changes
  useEffect(() => {
    // Force enable scrolling on website routes and non-home app routes
    if (currentIsWebsiteRoute || (currentIsAppRoute && !isHomePage)) {
      console.log('[ViewportManager] Non-home route detected, ensuring scrolling is enabled');
      forceEnableScrolling();
    }
    
    // Disable scrolling on home page
    if (isHomePage) {
      console.log('[ViewportManager] Home page detected, disabling scrolling');
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.top = '0';
      document.body.style.left = '0';
    }
    
    // Cleanup when unmounting
    return () => {
      if (isHomePage) {
        // Only restore these if we're navigating away from home
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.body.style.top = '';
        document.body.style.left = '';
      }
    };
  }, [location.pathname, isHomePage, currentIsWebsiteRoute, currentIsAppRoute]);

  // Debug log to understand route detection
  console.log('[ViewportManager] Route analysis:', {
    path: location.pathname,
    isAppRoute: currentIsAppRoute,
    isWebsiteRoute: currentIsWebsiteRoute,
    isHomePage,
    hasUser: !!user,
    isOnboardingOrAuth,
    onboardingComplete,
    isNative: nativeIntegrationService.isRunningNatively(),
    hideNavigation: 
      isOnboardingOrAuth || 
      !user || 
      (location.pathname === '/app' && !onboardingComplete)
  });

  // Early returns after all hooks are called
  if (!nativeInitialized) {
    console.log('[ViewportManager] Waiting for native initialization...');
    return <LoadingScreen message="Initializing app..." />;
  }

  if (authLoading) {
    console.log('[ViewportManager] Waiting for auth to stabilize...');
    return <LoadingScreen message="Loading user data..." />;
  }
  
  // Calculate if mobile navigation should show
  const shouldShowMobileNav = 
    currentIsAppRoute && 
    user && 
    !isOnboardingOrAuth && 
    onboardingComplete;
  
  // Render the appropriate layout based on route and device
  return (
    <>
      <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} ${isHomePage ? 'overflow-hidden' : 'overflow-x-hidden'}`}>
        <Outlet />
      </div>
      
      {/* Only display mobile navigation when conditions are met */}
      {shouldShowMobileNav && (
        <MobileNavigation onboardingComplete={onboardingComplete} />
      )}
    </>
  );
};

export default ViewportManager;