
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
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';
import NotFound from '@/pages/NotFound';

const ScrollToTop = () => {
  useScrollRestoration();
  return null;
};

const AppRoutes = () => {
  const { user } = useAuth();
  const { onboardingComplete, loading: onboardingLoading } = useOnboarding();
  const location = useLocation();
  
  useEffect(() => {
    console.log("Setting up Supabase auth debugging listener");
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event outside React context:", event, session?.user?.email);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // Find the NotFound route
  const notFoundRoute = specialRoutes.find(route => route.path === '*');
  
  return (
    <>
      <ViewportManager />
      <ScrollToTop />
      
      <OnboardingCheck 
        onboardingComplete={onboardingComplete} 
        onboardingLoading={onboardingLoading}
        user={user} // Pass user as a prop
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
