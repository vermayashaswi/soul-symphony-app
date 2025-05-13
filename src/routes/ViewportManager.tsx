
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
  
  // Don't show nav on onboarding or auth screens
  const isOnboardingOrAuth = location.pathname === '/app/onboarding' || 
                             location.pathname === '/app/auth' ||
                             location.pathname === '/onboarding' || 
                             location.pathname === '/auth' ||
                             location.pathname === '/app';
  
  // Debug log to understand route detection
  console.log('ViewportManager - Path:', location.pathname, {
    isAppRoute: isAppRoute(location.pathname),
    isWebsiteRoute: isWebsiteRoute(location.pathname),
    user: !!user,
    isOnboardingOrAuth
  });
  
  // Render the appropriate layout based on route and device
  return (
    <>
      <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} overflow-x-hidden`}>
        <Outlet />
      </div>
      
      {/* Display mobile navigation ONLY on actual app routes, when user is logged in, and not on onboarding/auth */}
      {isAppRoute(location.pathname) && user && !isOnboardingOrAuth && (
        <MobileNavigation onboardingComplete={onboardingComplete} />
      )}
    </>
  );
};

export default ViewportManager;
