
import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileNavigation from '@/components/MobileNavigation';
import { isAppRoute, isWebsiteRoute } from './RouteHelpers';
import { useOnboarding } from '@/hooks/use-onboarding';
import { forceEnableScrolling } from '@/hooks/use-scroll-restoration';

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
    '/app',
    '/' // Also hide on root path
  ];
  
  // Check if current path is in the list of paths where navigation should be hidden
  const isOnboardingOrAuth = onboardingOrAuthPaths.includes(location.pathname);
  
  // Explicit check for app root path with authenticated user - needs special handling
  const isAppRootWithUser = location.pathname === '/app' && !!user;
  
  // Debug log to understand route detection
  console.log('ViewportManager - Path:', location.pathname, {
    isAppRoute: isAppRoute(location.pathname),
    isWebsiteRoute: isWebsiteRoute(location.pathname),
    user: !!user,
    isOnboardingOrAuth,
    onboardingComplete,
    isAppRootWithUser,
    hideNavigation: 
      isOnboardingOrAuth || 
      !user || 
      (location.pathname === '/app' && !onboardingComplete)
  });
  
  // Ensure proper scrolling behavior on route changes
  useEffect(() => {
    // Force enable scrolling on website routes
    if (isWebsiteRoute(location.pathname)) {
      console.log('ViewportManager: Website route detected, ensuring scrolling is enabled');
      forceEnableScrolling();
    }
  }, [location.pathname]);
  
  // If we're at /app and the user is logged in, redirect to /app/home
  if (isAppRootWithUser && onboardingComplete) {
    console.log('Redirecting authenticated user from /app to /app/home');
    return <Navigate to="/app/home" replace />;
  }
  
  // Render the appropriate layout based on route and device
  return (
    <>
      <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} overflow-x-hidden`}>
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
       !(location.pathname === '/app' && !onboardingComplete) && (
        <MobileNavigation onboardingComplete={onboardingComplete} />
      )}
    </>
  );
};

export default ViewportManager;
