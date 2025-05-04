
import React, { useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isAppRoute, isWebsiteRoute } from './RouteHelpers';
import { useOnboarding } from '@/hooks/use-onboarding';

const OnboardingCheck: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { onboardingComplete, loading: onboardingLoading } = useOnboarding();
  
  useEffect(() => {
    console.log('OnboardingCheck rendering at path:', location.pathname, {
      user: !!user, 
      onboardingComplete,
      onboardingLoading,
      isAppRoute: isAppRoute(location.pathname),
      isWebsiteRoute: isWebsiteRoute(location.pathname)
    });
  }, [location.pathname, user, onboardingComplete, onboardingLoading]);
  
  // For website routes, no checks needed - just render children
  if (isWebsiteRoute(location.pathname)) {
    console.log('Website route detected, no onboarding check needed');
    return <Outlet />;
  }
  
  const isAuthRoute = location.pathname === '/app/auth' || location.pathname === '/auth';
  const isOnboardingRoute = location.pathname === '/app/onboarding' || location.pathname === '/onboarding';
  const isRootAppRoute = location.pathname === '/app';
  
  // Do not run checks on special routes
  const isOnboardingBypassedRoute = isAuthRoute || isOnboardingRoute ||
    location.pathname.includes('debug') || 
    location.pathname.includes('admin');
    
  if (onboardingLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <div className="ml-3">Loading onboarding status...</div>
      </div>
    );
  }

  // Special handling for the root /app route
  if (isRootAppRoute) {
    console.log('Root app route detected, redirecting appropriately');
    // If user is logged in, redirect to home
    if (user) {
      console.log('User is logged in, redirecting to /app/home');
      return <Navigate to="/app/home" replace />;
    } else {
      // If user is not logged in, redirect to onboarding
      console.log('User not logged in, redirecting to /app/onboarding');
      return <Navigate to="/app/onboarding" replace />;
    }
  }
  
  // For other app routes, check if user should be redirected to auth
  if (isAppRoute(location.pathname)) {
    const shouldRedirectToAuth = 
      !user && 
      !isOnboardingBypassedRoute;
    
    // If user is not logged in and it's a protected route (not auth or onboarding)
    if (shouldRedirectToAuth) {
      console.log('Redirecting to auth from:', location.pathname);
      return <Navigate to="/app/auth" replace />;
    }
  }
  
  // If all checks pass, render the child routes
  console.log('All onboarding checks passed, rendering children for path:', location.pathname);
  return <Outlet />;
};

export default OnboardingCheck;
