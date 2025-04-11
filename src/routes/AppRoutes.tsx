
import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';
import { websiteRoutes, appRoutes, specialRoutes } from './routeConfig';
import { 
  isNativeApp, 
  isAppRoute,
  AppRouteWrapper, 
  WebsiteRouteWrapper, 
  RedirectRoute
} from './RouteHelpers';
import ViewportManager from './ViewportManager';
import OnboardingCheck from './OnboardingCheck';
import MobileNavigation from './MobileNavigation';
import HomePage from '@/pages/website/HomePage';
import NotFound from '@/pages/NotFound';
import Navbar from '@/components/website/Navbar'; // Import the website Navbar component

const ScrollToTop = () => {
  useScrollRestoration();
  return null;
};

const AppRoutes = () => {
  const { user } = useAuth();
  const { onboardingComplete, loading: onboardingLoading } = useOnboarding();
  const location = useLocation();
  
  // Find the NotFound route
  const notFoundRoute = specialRoutes.find(route => route.path === '*');
  
  // Determine if we should show the website navbar
  const shouldShowWebsiteNavbar = !isNativeApp() && !isAppRoute(location.pathname);
  
  return (
    <>
      <ViewportManager />
      <ScrollToTop />
      
      {/* Render website navbar when not in app routes and not in native app */}
      {shouldShowWebsiteNavbar && <Navbar />}
      
      <OnboardingCheck 
        onboardingComplete={onboardingComplete} 
        onboardingLoading={onboardingLoading}
        user={user}
      >
        <Routes>
          {/* Home route - always shows website for web visitors */}
          <Route 
            path="/" 
            element={
              isNativeApp() ? (
                user ? (
                  <RedirectRoute to="/app/home" />
                ) : (
                  <RedirectRoute to="/app" />
                )
              ) : (
                <WebsiteRouteWrapper><HomePage /></WebsiteRouteWrapper>
              )
            } 
          />
          
          {/* Website routes */}
          {websiteRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<WebsiteRouteWrapper>{route.element}</WebsiteRouteWrapper>}
            />
          ))}
          
          {/* App routes */}
          {appRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                route.redirectPath ? (
                  <RedirectRoute to={route.redirectPath} />
                ) : (
                  <AppRouteWrapper 
                    element={route.element} 
                    requiresAuth={route.requiresAuth}
                  />
                )
              }
            />
          ))}
          
          {/* Catch all (404) */}
          <Route
            path="*"
            element={<WebsiteRouteWrapper>{notFoundRoute ? notFoundRoute.element : <NotFound />}</WebsiteRouteWrapper>}
          />
        </Routes>
        
        {isAppRoute(location.pathname) && (
          <MobileNavigation onboardingComplete={onboardingComplete} />
        )}
      </OnboardingCheck>
    </>
  );
};

export default AppRoutes;
