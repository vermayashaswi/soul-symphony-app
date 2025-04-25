
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileNavbar from '@/components/mobile/MobileNavbar';
import Navbar from '@/components/Navbar';
import { isAppRoute } from './RouteHelpers';
import { useOnboarding } from '@/hooks/use-onboarding';

const ViewportManager: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { onboardingComplete } = useOnboarding();
  
  // Determine which navigation to show
  const showNavigation = isAppRoute(location.pathname) && onboardingComplete;
  
  return (
    <>
      <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'}`}>
        {/* Show desktop navbar when not on mobile */}
        {!isMobile && showNavigation && <Navbar />}
        <Outlet />
      </div>
      
      {/* Show mobile navbar only on mobile */}
      {isMobile && showNavigation && <MobileNavbar />}
    </>
  );
};

export default ViewportManager;
