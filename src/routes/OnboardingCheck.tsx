
import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { isNativeApp, isAppRoute } from './RouteHelpers';
import { debugAuthState } from '@/services/authService';

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
  
  // Log debug information
  React.useEffect(() => {
    console.log("OnboardingCheck rendering with:", {
      onboardingComplete,
      onboardingLoading,
      hasUser: !!user,
      pathname: location.pathname
    });
    
    // Debug auth state
    debugAuthState().catch(console.error);
  }, [onboardingComplete, onboardingLoading, user, location.pathname]);
  
  const isAuthRoute = location.pathname === '/app/auth';
  const isOnboardingRoute = location.pathname === '/app/onboarding' || location.pathname === '/app';
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
    const shouldShowOnboarding = 
      !user && 
      !onboardingComplete && 
      !isOnboardingBypassedRoute &&
      !isOnboardingRoute;
    
    if (shouldShowOnboarding) {
      console.log("Redirecting to onboarding from:", location.pathname, {
        hasUser: !!user,
        onboardingComplete,
        isOnboardingBypassedRoute,
        isOnboardingRoute
      });
      return <Navigate to="/app" replace />;
    }
  }
  
  return <>{children}</>;
};

export default OnboardingCheck;
