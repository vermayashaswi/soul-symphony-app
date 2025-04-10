
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
import Auth from '@/pages/Auth';

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
  
  // Debug logs for routing logic
  useEffect(() => {
    console.log("Current path:", location.pathname);
    console.log("User authenticated:", !!user);
    console.log("Onboarding complete:", onboardingComplete);
  }, [location.pathname, user, onboardingComplete]);
  
  return (
    <>
      <ViewportManager />
      <ScrollToTop />
      
      <OnboardingCheck 
        onboardingComplete={onboardingComplete} 
        onboardingLoading={onboardingLoading}
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
          
          {/* Explicit route for /app to ensure onboarding is shown */}
          <Route
            path="/app"
            element={
              <AppRouteWrapper element={<OnboardingScreen />} requiresAuth={false} />
            }
          />
          
          {/* Auth route at /app/auth */}
          <Route
            path="/app/auth"
            element={<Auth />}
          />
          
          {/* Auth route at /auth (redirects to /app/auth) */}
          <Route
            path="/auth"
            element={<RedirectRoute to="/app/auth" />}
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
