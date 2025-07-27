import React, { useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useSimpleOnboarding } from '@/hooks/useSimpleOnboarding';
import { useIsMobile } from '@/hooks/use-mobile';
import { optimizedRouteService } from '@/services/optimizedRouteService';
import { forceEnableScrolling } from '@/hooks/use-scroll-restoration';
import OptimizedMobileNavigation from '@/components/navigation/OptimizedMobileNavigation';
import StatusBarManager from '@/components/StatusBarManager';

const OptimizedViewportManager: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated } = useOptimizedAuth();
  const { onboardingComplete } = useSimpleOnboarding();
  const isMobile = useIsMobile();

  // Memoized route type detection
  const routeInfo = useMemo(() => {
    const pathname = location.pathname;
    return {
      isAppRoute: optimizedRouteService.isAppRoute(pathname),
      isWebsiteRoute: optimizedRouteService.isWebsiteRoute(pathname),
      isHomePage: pathname === '/app/home',
      isAuthOrOnboarding: ['/app/auth', '/app/onboarding', '/auth', '/onboarding'].includes(pathname)
    };
  }, [location.pathname]);

  // Memoized mobile navigation visibility
  const shouldShowMobileNav = useMemo(() => {
    return routeInfo.isAppRoute && 
           isAuthenticated && 
           !routeInfo.isAuthOrOnboarding && 
           onboardingComplete !== false;
  }, [routeInfo.isAppRoute, isAuthenticated, routeInfo.isAuthOrOnboarding, onboardingComplete]);

  // Optimized scroll management
  useEffect(() => {
    console.log('[OptimizedViewportManager] Managing scroll for route:', {
      pathname: location.pathname,
      isHomePage: routeInfo.isHomePage,
      isAppRoute: routeInfo.isAppRoute
    });

    if (routeInfo.isHomePage) {
      // Disable scrolling for home page
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100vh';
      document.body.style.top = '0';
    } else {
      // Enable scrolling for all other routes
      forceEnableScrolling();
    }

    // Cleanup on unmount
    return () => {
      forceEnableScrolling();
    };
  }, [routeInfo.isHomePage, location.pathname]);

  // Apply CSS classes to container
  const containerClasses = useMemo(() => {
    const classes = ['app-container'];
    
    if (isMobile.isMobile) {
      classes.push('is-mobile');
    }
    
    if (routeInfo.isHomePage) {
      classes.push('is-home');
    }
    
    return classes.join(' ');
  }, [isMobile.isMobile, routeInfo.isHomePage]);

  console.log('[OptimizedViewportManager] Render state:', {
    pathname: location.pathname,
    shouldShowMobileNav,
    containerClasses,
    routeInfo
  });

  return (
    <StatusBarManager>
      <main className={containerClasses}>
        <Outlet />
        {shouldShowMobileNav && <OptimizedMobileNavigation />}
      </main>
    </StatusBarManager>
  );
};

export default OptimizedViewportManager;