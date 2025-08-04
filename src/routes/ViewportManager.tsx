
import React, { useEffect } from 'react';
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
  
  // Routes where navigation should be hidden
  const navigationHiddenPaths = [
    '/app/onboarding',
    '/app/auth',
    '/onboarding', 
    '/auth'
  ];
  
  // Check if current path should hide navigation
  const shouldHideNavigation = navigationHiddenPaths.includes(location.pathname);
  
  // Handle special transitional routes that need proper navigation
  const isTransitionalRoute = location.pathname === '/app' || location.pathname === '/';
  const isInAppContext = isAppRoute(location.pathname);
  
  // Is this the home page where scrolling should be disabled?
  const isHomePage = location.pathname === '/app/home';
  
  // Determine if navigation should be visible
  const shouldShowNavigation = isInAppContext && 
    user && 
    !shouldHideNavigation && 
    onboardingComplete &&
    // Show navigation even on transitional routes if user is authenticated and onboarded
    (onboardingComplete || !isTransitionalRoute);

  // Debug log to understand route detection
  console.log('ViewportManager - Path:', location.pathname, {
    isAppRoute: isAppRoute(location.pathname),
    isWebsiteRoute: isWebsiteRoute(location.pathname),
    isHomePage,
    user: !!user,
    shouldHideNavigation,
    onboardingComplete,
    isTransitionalRoute,
    isInAppContext,
    shouldShowNavigation
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
      <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} ${isHomePage ? 'overflow-hidden' : 'overflow-x-hidden'}`}>
        <Outlet />
      </div>
      
      {/* Display mobile navigation when all conditions are met */}
      {shouldShowNavigation && (
        <MobileNavigation onboardingComplete={onboardingComplete} />
      )}
    </StatusBarManager>
  );
};

export default ViewportManager;
