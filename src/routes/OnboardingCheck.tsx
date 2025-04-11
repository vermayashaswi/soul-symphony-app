
import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { isAppRoute } from './RouteHelpers';

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
  console.log('OnboardingCheck rendering at path:', location.pathname, {user: !!user, onboardingComplete});
  
  const isAuthRoute = location.pathname === '/app/auth' || location.pathname === '/auth';
  const isOnboardingRoute = location.pathname === '/app/onboarding';
  const isRootAppRoute = location.pathname === '/app';
  const isOnboardingBypassedRoute = isAuthRoute || 
    location.pathname.includes('debug') || 
    location.pathname.includes('admin');
    
  if (onboardingLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="animate-spin w-8 h-8 border-4 border-theme border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Special handling for the root /app route
  if (isRootAppRoute) {
    console.log('Root app route detected, user:', !!user);
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
  
  // For other app routes, check if user should be redirected to onboarding
  if (isAppRoute(location.pathname)) {
    const shouldShowOnboarding = 
      !user && 
      !onboardingComplete && 
      !isOnboardingBypassedRoute &&
      !isOnboardingRoute;
    
    // If user is not logged in and it's a protected route (not onboarding or auth)
    if (shouldShowOnboarding) {
      console.log('Redirecting to onboarding from:', location.pathname);
      return <Navigate to="/app/onboarding" replace />;
    }
  }
  
  return <>{children}</>;
};

export default OnboardingCheck;
