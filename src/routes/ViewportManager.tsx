
import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileNavigation from '@/components/MobileNavigation';
import { isAppRoute, isWebsiteRoute } from './RouteHelpers';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useTutorial } from '@/contexts/TutorialContext';
import { AnimatePresence, motion } from 'framer-motion';

const ViewportManager: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { onboardingComplete } = useOnboarding();
  const { isNavigating } = useTutorial();
  
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
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} overflow-x-hidden`}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
      
      {/* Display mobile navigation ONLY on actual app routes AND when user is logged in AND not on onboarding routes */}
      {isAppRoute(location.pathname) && user && !isOnboardingRoute && (
        <MobileNavigation onboardingComplete={onboardingComplete} />
      )}
    </>
  );
};

export default ViewportManager;
