
import React, { useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useKeyboardState } from '@/hooks/use-keyboard-state';
import MobileNavigation from '@/components/MobileNavigation';
import { isAppRoute, isWebsiteRoute } from './RouteHelpers';
import { useOnboarding } from '@/hooks/use-onboarding';
import { forceEnableScrolling } from '@/hooks/use-scroll-restoration';

const ViewportManager: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { isMobile, isWebtonative } = useIsMobile();
  const { keyboardState } = useKeyboardState();
  const { onboardingComplete } = useOnboarding();
  
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
  
  // Is this an auth page that needs special viewport handling?
  const isAuthPage = location.pathname === '/app/auth' || location.pathname === '/auth';
  
  // Debug log to understand route detection
  console.log('ViewportManager - Path:', location.pathname, {
    isAppRoute: isAppRoute(location.pathname),
    isWebsiteRoute: isWebsiteRoute(location.pathname),
    isHomePage,
    isAuthPage,
    user: !!user,
    isOnboardingOrAuth,
    onboardingComplete,
    keyboardOpen: keyboardState.isOpen,
    isWebtonative,
    hideNavigation: 
      isOnboardingOrAuth || 
      !user || 
      (location.pathname === '/app' && !onboardingComplete)
  });
  
  // Enhanced route-specific viewport management
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    
    // Clean up previous route classes
    body.classList.remove(
      'viewport-home', 'viewport-auth', 'viewport-app', 'viewport-website',
      'route-optimized', 'auth-optimized', 'webtonative-auth-flow'
    );
    
    // Apply route-specific classes
    if (isAuthPage) {
      body.classList.add('viewport-auth', 'auth-optimized');
      html.classList.add('auth-route');
      
      if (isWebtonative) {
        body.classList.add('webtonative-auth-flow');
        html.classList.add('webtonative-auth-environment');
        
        // Set up OAuth-optimized viewport for webtonative
        const setAuthViewport = () => {
          const vh = window.innerHeight * 0.01;
          html.style.setProperty('--vh', `${vh}px`);
          html.style.setProperty('--auth-viewport-height', `${window.innerHeight}px`);
          
          if (window.visualViewport) {
            const visualVh = window.visualViewport.height * 0.01;
            html.style.setProperty('--visual-vh', `${visualVh}px`);
          }
        };
        
        setAuthViewport();
        window.addEventListener('resize', setAuthViewport);
        window.addEventListener('orientationchange', () => {
          setTimeout(setAuthViewport, 300);
        });
        
        return () => {
          window.removeEventListener('resize', setAuthViewport);
          window.removeEventListener('orientationchange', setAuthViewport);
        };
      }
    } else if (isHomePage) {
      body.classList.add('viewport-home');
      html.classList.add('home-route');
      
      // Disable scrolling on home page
      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.width = '100%';
      body.style.height = '100%';
      body.style.top = '0';
      body.style.left = '0';
    } else if (isAppRoute(location.pathname)) {
      body.classList.add('viewport-app', 'route-optimized');
      html.classList.add('app-route');
      
      // Ensure proper scrolling for app routes
      forceEnableScrolling();
    } else if (isWebsiteRoute(location.pathname)) {
      body.classList.add('viewport-website');
      html.classList.add('website-route');
      
      // Ensure proper scrolling for website routes
      forceEnableScrolling();
    }
    
    // Cleanup when route changes
    return () => {
      if (isHomePage) {
        body.style.overflow = '';
        body.style.position = '';
        body.style.width = '';
        body.style.height = '';
        body.style.top = '';
        body.style.left = '';
      }
      
      html.classList.remove(
        'auth-route', 'home-route', 'app-route', 'website-route',
        'webtonative-auth-environment'
      );
    };
  }, [location.pathname, isHomePage, isAuthPage, isWebtonative]);
  
  // Render the appropriate layout based on route and device
  return (
    <>
      <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} ${isHomePage ? 'overflow-hidden' : 'overflow-x-hidden'} ${keyboardState.isOpen ? 'keyboard-active' : ''}`}>
        <Outlet />
      </div>
      
      {/* Enhanced mobile navigation with keyboard awareness */}
      {isAppRoute(location.pathname) && 
       user && 
       !isOnboardingOrAuth && 
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
