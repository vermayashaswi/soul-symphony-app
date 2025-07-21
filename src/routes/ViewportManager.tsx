
import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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
  
  // Paths where navigation should be hidden
  const onboardingOrAuthPaths = [
    '/app/onboarding',
    '/app/auth',
    '/onboarding',
    '/auth',
    '/'
  ];
  
  const isOnboardingOrAuth = onboardingOrAuthPaths.includes(location.pathname);
  const isHomePage = location.pathname === '/app/home';
  
  // Manage scrolling behavior
  useEffect(() => {
    if (isWebsiteRoute(location.pathname) || (isAppRoute(location.pathname) && !isHomePage)) {
      forceEnableScrolling();
    }
    
    if (isHomePage) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.top = '0';
      document.body.style.left = '0';
    }
    
    return () => {
      if (isHomePage) {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.body.style.top = '';
        document.body.style.left = '';
      }
    };
  }, [location.pathname, isHomePage]);
  
  return (
    <StatusBarManager>
      <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} ${isHomePage ? 'overflow-hidden' : 'overflow-x-hidden'}`}>
        <Outlet />
      </div>
      
      {isAppRoute(location.pathname) && 
       user && 
       !isOnboardingOrAuth && 
       onboardingComplete && (
        <MobileNavigation onboardingComplete={onboardingComplete} />
      )}
    </StatusBarManager>
  );
};

export default ViewportManager;
