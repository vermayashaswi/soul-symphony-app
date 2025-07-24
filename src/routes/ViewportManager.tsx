
import React, { useEffect, useMemo } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileNavigation from '@/components/MobileNavigation';
import StatusBarManager from '@/components/StatusBarManager';
import { isAppRoute, isWebsiteRoute } from './RouteHelpers';
import { useOnboarding } from '@/hooks/use-onboarding';
import { forceEnableScrolling } from '@/hooks/use-scroll-restoration';

const ViewportManager: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { onboardingComplete } = useOnboarding();
  
  // Memoize route calculations to prevent re-computation on every render
  const routeInfo = useMemo(() => {
    const currentPath = location.pathname;
    const isApp = isAppRoute(currentPath);
    const isWebsite = isWebsiteRoute(currentPath);
    const isHomePage = currentPath === '/app/home';
    
    // Comprehensive list of routes where navigation should be hidden
    const onboardingOrAuthPaths = [
      '/app/onboarding',
      '/app/auth',
      '/onboarding',
      '/auth',
      '/' // Also hide on root path
    ];
    
    const isOnboardingOrAuth = onboardingOrAuthPaths.includes(currentPath);
    
    return {
      isApp,
      isWebsite,
      isHomePage,
      isOnboardingOrAuth,
      currentPath
    };
  }, [location.pathname]);
  
  // Memoize navigation visibility calculation
  const shouldHideNavigation = useMemo(() => {
    return routeInfo.isOnboardingOrAuth || 
           !user || 
           (location.pathname === '/app' && !onboardingComplete);
  }, [routeInfo.isOnboardingOrAuth, user, location.pathname, onboardingComplete]);
  
  // Ensure proper scrolling behavior on route changes
  useEffect(() => {
    // Force enable scrolling on website routes and non-home app routes
    if (routeInfo.isWebsite || (routeInfo.isApp && !routeInfo.isHomePage)) {
      forceEnableScrolling();
    }
    
    // Disable scrolling on home page
    if (routeInfo.isHomePage) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.top = '0';
      document.body.style.left = '0';
    }
    
    // Cleanup when unmounting
    return () => {
      if (routeInfo.isHomePage) {
        // Only restore these if we're navigating away from home
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.body.style.top = '';
        document.body.style.left = '';
      }
    };
  }, [routeInfo]);
  
  // Render the appropriate layout based on route and device
  return (
    <StatusBarManager>
      <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} ${routeInfo.isHomePage ? 'overflow-hidden' : 'overflow-x-hidden'}`}>
        <Outlet />
      </div>
      
      {/* Only display mobile navigation when:
          1. We're on an app route
          2. User is logged in
          3. We're not on onboarding/auth screens
          4. If we're on /app, we also check if onboarding is complete */}
      {routeInfo.isApp && 
       user && 
       !shouldHideNavigation && 
       onboardingComplete && (
        <MobileNavigation onboardingComplete={onboardingComplete} />
      )}
    </StatusBarManager>
  );
};

export default ViewportManager;
