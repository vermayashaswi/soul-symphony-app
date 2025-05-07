
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
  
  // Debug log to understand route detection
  console.log('ViewportManager - Path:', location.pathname, {
    isAppRoute: isAppRoute(location.pathname),
    isWebsiteRoute: isWebsiteRoute(location.pathname),
    user: !!user
  });
  
  // Check if current route is an onboarding route
  const isOnboardingRoute = location.pathname.includes('onboarding');
  const isSettingsRoute = location.pathname.includes('settings');
  
  // Render the appropriate layout based on route and device
  return (
    <>
      <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} overflow-x-hidden`}>
        <Outlet />
      </div>
      
      {/* Display mobile navigation ONLY on actual app routes AND when user is logged in AND not on onboarding routes */}
      {isAppRoute(location.pathname) && user && !isOnboardingRoute && (
        <MobileNavigation onboardingComplete={onboardingComplete} />
      )}
    </>
  );
};

export default ViewportManager;
