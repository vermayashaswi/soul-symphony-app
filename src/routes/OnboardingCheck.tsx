
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
  
  // Only check onboarding for app routes
  if (isAppRoute(location.pathname)) {
    // If user is not logged in and tries to access /app, redirect to onboarding
    if (!user && isRootAppRoute) {
      return <Navigate to="/app/onboarding" replace />;
    }
    
    // If user is logged in and tries to access /app, redirect to home
    if (user && isRootAppRoute) {
      return <Navigate to="/app/home" replace />;
    }
    
    // For other app routes, check if user should be redirected to onboarding
    const shouldShowOnboarding = 
      !user && 
      !onboardingComplete && 
      !isOnboardingBypassedRoute &&
      !isOnboardingRoute;
    
    if (shouldShowOnboarding) {
      return <Navigate to="/app/onboarding" replace />;
    }
  }
  
  return <>{children}</>;
};

export default OnboardingCheck;
