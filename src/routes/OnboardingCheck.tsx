
import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { isAppRoute, isWebsiteRoute } from './RouteHelpers';

interface OnboardingCheckProps {
  onboardingComplete: boolean | null;
  onboardingLoading: boolean;
  user: User | null;
  children: React.ReactNode;
}

const OnboardingCheck: React.FC<OnboardingCheckProps> = ({ 
  onboardingComplete, 
  onboardingLoading, 
  user,
  children 
}) => {
  const location = useLocation();
  
  console.log('OnboardingCheck rendering at path:', location.pathname, {
    user: !!user, 
    onboardingComplete,
    isAppRoute: isAppRoute(location.pathname),
    isWebsiteRoute: isWebsiteRoute(location.pathname)
  });
  
  // For website routes, no checks needed - just render children
  if (isWebsiteRoute(location.pathname)) {
    console.log('Website route detected, no onboarding check needed');
    return <>{children}</>;
  }
  
  if (onboardingLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="animate-spin w-8 h-8 border-4 border-theme border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Simplified root app route handling
  if (location.pathname === '/app') {
    console.log('Root app route detected, user:', !!user);
    if (user) {
      return <Navigate to="/app/home" replace />;
    } else {
      return <Navigate to="/app/auth" replace />;
    }
  }
  
  // For other app routes, check authentication
  if (isAppRoute(location.pathname)) {
    const isAuthRoute = location.pathname === '/app/auth';
    const isOnboardingRoute = location.pathname === '/app/onboarding';
    
    if (!user && !isAuthRoute && !isOnboardingRoute) {
      console.log('Redirecting to auth from:', location.pathname);
      return <Navigate to="/app/auth" replace />;
    }
  }
  
  return <>{children}</>;
};

export default OnboardingCheck;
