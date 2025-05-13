
import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileNavigation from '@/components/MobileNavigation';
import { isAppRoute, isWebsiteRoute } from './RouteHelpers';
import { useOnboarding } from '@/hooks/use-onboarding';

const ViewportManager: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { onboardingComplete } = useOnboarding();
  
  // Check if the current route is an onboarding route - more comprehensive check
  const isOnboardingRoute = 
    location.pathname.includes('/onboarding') || 
    location.pathname.includes('/app/onboarding');
  
  // Extended list of routes where navigation should be hidden
  const hiddenRoutes = [
    '/app/onboarding',
    '/app/auth',
    '/onboarding',
    '/auth'
  ];
  
  const isHiddenRoute = hiddenRoutes.some(route => 
    location.pathname.startsWith(route) || location.pathname === route
  );
  
  // Debug log to understand route detection
  console.log('ViewportManager - Path:', location.pathname, {
    isAppRoute: isAppRoute(location.pathname),
    isWebsiteRoute: isWebsiteRoute(location.pathname),
    isOnboardingRoute,
    isHiddenRoute,
    onboardingComplete,
    user: !!user
  });
  
  // Render the appropriate layout based on route and device
  return (
    <>
      <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} overflow-x-hidden`}>
        <Outlet />
      </div>
      
      {/* 
        Display mobile navigation ONLY when:
        1. On an app route 
        2. User is logged in
        3. Not on an onboarding route or any hidden route
        4. Onboarding is explicitly complete (true), not just null or false
      */}
      {isAppRoute(location.pathname) && 
       user && 
       !isOnboardingRoute && 
       !isHiddenRoute && 
       onboardingComplete === true && (
        <MobileNavigation onboardingComplete={onboardingComplete} />
      )}
    </>
  );
};

export default ViewportManager;
