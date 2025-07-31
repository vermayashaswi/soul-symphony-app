
import React, { useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileNavigation from '@/components/MobileNavigation';
import StatusBarManager from '@/components/StatusBarManager';
import { isAppRoute, isWebsiteRoute } from './RouteHelpers';
import { useOnboarding } from '@/hooks/use-onboarding';
import { forceEnableScrolling } from '@/hooks/use-scroll-restoration';
import { AppContextProvider } from '@/contexts/AppContextProvider';

const ViewportManager: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { onboardingComplete } = useOnboarding();
  
  // Comprehensive list of routes where navigation should be hidden
  const onboardingOrAuthPaths = [
    '/app/onboarding',
    '/app/auth',
    '/onboarding',
    '/auth',
    '/' // Also hide on root path
  ];
  
  // Check if current path is in the list of paths where navigation should be hidden
  const isOnboardingOrAuth = onboardingOrAuthPaths.includes(location.pathname);
  
  // Is this the home page where scrolling should be disabled?
  const isHomePage = location.pathname === '/app/home';
  
  // Debug log to understand route detection
  console.log('ViewportManager - Path:', location.pathname, {
    isAppRoute: isAppRoute(location.pathname),
    isWebsiteRoute: isWebsiteRoute(location.pathname),
    isHomePage,
    user: !!user,
    isOnboardingOrAuth,
    onboardingComplete,
    hideNavigation: 
      isOnboardingOrAuth || 
      !user || 
      (location.pathname === '/app' && !onboardingComplete)
  });
  
  // Ensure proper scrolling behavior on route changes
  useEffect(() => {
    // Force enable scrolling on website routes and non-home app routes
    if (isWebsiteRoute(location.pathname) || (isAppRoute(location.pathname) && !isHomePage)) {
      console.log('ViewportManager: Non-home route detected, ensuring scrolling is enabled');
      forceEnableScrolling();
    }
    
    // Disable scrolling on home page
    if (isHomePage) {
      console.log('ViewportManager: Home page detected, disabling scrolling');
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
  }, [location.pathname, isHomePage]);
  
  // Render the appropriate layout based on route and device
  return (
    <StatusBarManager>
      {/* Wrap app routes with AppContextProvider for subscription context */}
      {isAppRoute(location.pathname) ? (
        <AppContextProvider>
          <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} ${isHomePage ? 'overflow-hidden' : 'overflow-x-hidden'}`}>
            <Outlet />
          </div>
          
          {/* Only display mobile navigation when:
              1. We're on an app route
              2. User is logged in
              3. We're not on onboarding/auth screens
              4. If we're on /app, we also check if onboarding is complete */}
          {user && 
           !isOnboardingOrAuth && 
           onboardingComplete && (
            <MobileNavigation onboardingComplete={onboardingComplete} />
          )}
        </AppContextProvider>
      ) : (
        <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} ${isHomePage ? 'overflow-hidden' : 'overflow-x-hidden'}`}>
          <Outlet />
        </div>
      )}
    </StatusBarManager>
  );
};

export default ViewportManager;
