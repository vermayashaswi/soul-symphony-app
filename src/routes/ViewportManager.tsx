
import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useKeyboardState } from '@/hooks/use-keyboard-state';
import MobileNavigation from '@/components/MobileNavigation';
import { isAppRoute, isWebsiteRoute } from './RouteHelpers';
import { useOnboarding } from '@/hooks/use-onboarding';

const ViewportManager: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { isMobile, isWebtonative } = useIsMobile();
  const { keyboardState } = useKeyboardState();
  const { onboardingComplete } = useOnboarding();
  
  // Paths where navigation should be hidden
  const hideNavigationPaths = [
    '/app/onboarding',
    '/app/auth',
    '/onboarding',
    '/auth',
    '/'
  ];
  
  const shouldHideNavigation = hideNavigationPaths.includes(location.pathname);
  const isAuthPage = location.pathname === '/app/auth' || location.pathname === '/auth';
  
  console.log('[ViewportManager] Route state:', {
    path: location.pathname,
    isAppRoute: isAppRoute(location.pathname),
    isAuthPage,
    hasUser: !!user,
    shouldHideNavigation,
    onboardingComplete,
    keyboardOpen: keyboardState.isOpen,
    isWebtonative
  });
  
  // Enhanced viewport management
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    
    // Clean up previous classes
    body.classList.remove(
      'viewport-home', 'viewport-auth', 'viewport-app', 'viewport-website',
      'auth-optimized', 'webtonative-auth-flow'
    );
    html.classList.remove('auth-route', 'app-route', 'website-route');
    
    // Apply route-specific optimizations
    if (isAuthPage) {
      body.classList.add('viewport-auth', 'auth-optimized');
      html.classList.add('auth-route');
      
      if (isWebtonative) {
        body.classList.add('webtonative-auth-flow');
        
        // Enhanced viewport handling for OAuth
        const setAuthViewport = () => {
          const vh = window.innerHeight * 0.01;
          html.style.setProperty('--vh', `${vh}px`);
          html.style.setProperty('--auth-viewport-height', `${window.innerHeight}px`);
          
          if (window.visualViewport) {
            const visualVh = window.visualViewport.height * 0.01;
            html.style.setProperty('--visual-vh', `${visualVh}px`);
            html.style.setProperty('--available-height', `${window.visualViewport.height}px`);
          }
        };
        
        setAuthViewport();
        
        const handleResize = () => {
          console.log('[ViewportManager] Auth viewport resize');
          setTimeout(setAuthViewport, 100);
        };
        
        const handleOrientationChange = () => {
          console.log('[ViewportManager] Auth orientation change');
          setTimeout(setAuthViewport, 300);
        };
        
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleOrientationChange);
        
        return () => {
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('orientationchange', handleOrientationChange);
        };
      }
    } else if (isAppRoute(location.pathname)) {
      body.classList.add('viewport-app');
      html.classList.add('app-route');
    } else if (isWebsiteRoute(location.pathname)) {
      body.classList.add('viewport-website');
      html.classList.add('website-route');
    }
    
    // Cleanup on route change
    return () => {
      html.classList.remove('auth-route', 'app-route', 'website-route');
    };
  }, [location.pathname, isAuthPage, isWebtonative]);
  
  return (
    <>
      <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} ${
        keyboardState.isOpen ? 'keyboard-active' : ''
      }`}>
        <Outlet />
      </div>
      
      {/* Enhanced mobile navigation */}
      {isAppRoute(location.pathname) && 
       user && 
       !shouldHideNavigation && 
       onboardingComplete && (
        <MobileNavigation 
          onboardingComplete={onboardingComplete}
          className={keyboardState.isOpen ? 'keyboard-hidden' : ''}
        />
      )}
    </>
  );
};

export default ViewportManager;
