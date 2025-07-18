
import React, { useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileNavigation from '@/components/MobileNavigation';
import { isAppRoute, isWebsiteRoute } from './RouteHelpers';
import { useOnboarding } from '@/hooks/use-onboarding';
import { forceEnableScrolling } from '@/hooks/use-scroll-restoration';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

const ViewportManager: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { onboardingComplete } = useOnboarding();
  const isNative = nativeIntegrationService.isRunningNatively();
  
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
  
  // Pull-to-refresh for native apps
  const { refresh } = usePullToRefresh({
    onRefresh: async () => {
      console.log('[ViewportManager] Pull-to-refresh triggered');
      // Refresh page content
      window.location.reload();
    },
    enabled: isNative && isAppRoute(location.pathname) && !isOnboardingOrAuth
  });
  
  // Debug log to understand route detection
  console.log('ViewportManager - Path:', location.pathname, {
    isAppRoute: isAppRoute(location.pathname),
    isWebsiteRoute: isWebsiteRoute(location.pathname),
    isHomePage,
    user: !!user,
    isOnboardingOrAuth,
    onboardingComplete,
    isNative,
    hideNavigation: 
      isOnboardingOrAuth || 
      !user || 
      (location.pathname === '/app' && !onboardingComplete)
  });
  
  // Setup native app layout and safe area handling
  useEffect(() => {
    if (isNative) {
      console.log('[ViewportManager] Setting up native app layout');
      document.body.classList.add('native-app');
      
      // Add status bar background for native apps
      const statusBar = document.createElement('div');
      statusBar.className = 'native-status-bar';
      statusBar.id = 'native-status-bar';
      
      // Remove existing status bar if present
      const existingStatusBar = document.getElementById('native-status-bar');
      if (existingStatusBar) {
        existingStatusBar.remove();
      }
      
      document.body.appendChild(statusBar);
      
      return () => {
        document.body.classList.remove('native-app');
        const statusBarEl = document.getElementById('native-status-bar');
        if (statusBarEl) {
          statusBarEl.remove();
        }
      };
    }
  }, [isNative]);
  
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
  
  // Get container classes for native app layout
  const getContainerClasses = () => {
    const baseClasses = `app-container ${isMobile ? 'mobile-view' : 'desktop-view'} ${isHomePage ? 'overflow-hidden' : 'overflow-x-hidden'}`;
    
    if (isNative) {
      return `${baseClasses} native-app-container`;
    }
    
    return baseClasses;
  };
  
  // Render the appropriate layout based on route and device
  return (
    <>
      <div className={getContainerClasses()}>
        <Outlet />
      </div>
      
      {/* Only display mobile navigation when:
          1. We're on an app route
          2. User is logged in
          3. We're not on onboarding/auth screens
          4. If we're on /app, we also check if onboarding is complete */}
      {isAppRoute(location.pathname) && 
       user && 
       !isOnboardingOrAuth && 
       onboardingComplete && (
        <MobileNavigation onboardingComplete={onboardingComplete} />
      )}
    </>
  );
};

export default ViewportManager;
