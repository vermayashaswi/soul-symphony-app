
import React, { useEffect } from 'react';
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
  
  // Routes where navigation should be hidden
  const hideNavigationPaths = [
    '/app/onboarding',
    '/app/auth',
    '/onboarding',
    '/auth',
    '/'
  ];
  
  const shouldHideNavigation = hideNavigationPaths.includes(location.pathname);
  const isHomePage = location.pathname === '/app/home';
  
  console.log('ViewportManager:', {
    path: location.pathname,
    isAppRoute: isAppRoute(location.pathname),
    isWebsiteRoute: isWebsiteRoute(location.pathname),
    shouldHideNavigation,
    user: !!user,
    onboardingComplete
  });
  
  // Handle scrolling behavior
  useEffect(() => {
    if (isHomePage) {
      // Disable scrolling on home page
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    } else {
      // Enable scrolling on other pages
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    }
    
    // Cleanup
    return () => {
      if (isHomePage) {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
      }
    };
  }, [isHomePage]);
  
  const showMobileNavigation = 
    isAppRoute(location.pathname) && 
    user && 
    !shouldHideNavigation && 
    onboardingComplete;
  
  return (
    <>
      <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} ${isHomePage ? 'overflow-hidden' : 'overflow-x-hidden'}`}>
        <Outlet />
      </div>
      
      {showMobileNavigation && (
        <MobileNavigation onboardingComplete={onboardingComplete} />
      )}
    </>
  );
};

export default ViewportManager;
