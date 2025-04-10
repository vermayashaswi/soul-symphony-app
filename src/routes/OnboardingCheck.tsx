
import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isNativeApp, isAppRoute } from './RouteHelpers';

interface OnboardingCheckProps {
  onboardingComplete: boolean | null;
  onboardingLoading: boolean;
  children: React.ReactNode;
}

const OnboardingCheck: React.FC<OnboardingCheckProps> = ({ 
  onboardingComplete, 
  onboardingLoading, 
  children 
}) => {
  const { user } = useAuth();
  const location = useLocation();
  
  const isAuthRoute = location.pathname === '/app/auth' || location.pathname === '/auth';
  const isOnboardingRoute = location.pathname === '/app/onboarding' || location.pathname === '/app';
  const isOnboardingBypassedRoute = isAuthRoute || 
    location.pathname.includes('debug') || 
    location.pathname.includes('admin');
  
  // Debug logs for visibility
  console.log("OnboardingCheck - Current route:", location.pathname);
  console.log("OnboardingCheck - Is auth route:", isAuthRoute);
  console.log("OnboardingCheck - Is onboarding route:", isOnboardingRoute);
  console.log("OnboardingCheck - Is bypassed route:", isOnboardingBypassedRoute);
  console.log("OnboardingCheck - User exists:", !!user);
  console.log("OnboardingCheck - Onboarding complete:", onboardingComplete);
  
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
      !onboardingComplete && 
      !isOnboardingBypassedRoute &&
      !isOnboardingRoute;
    
    console.log("OnboardingCheck - Should show onboarding:", shouldShowOnboarding);
    
    if (shouldShowOnboarding) {
      return <Navigate to="/app" replace />;
    }
  }
  
  return <>{children}</>;
};

export default OnboardingCheck;
