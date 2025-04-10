
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
    // If user is at the root app path (/app) and logged in, redirect to home
    if (location.pathname === '/app' && user) {
      return <Navigate to="/app/home" replace />;
    }
    
    // If not logged in, not at onboarding route, and not at a bypassed route, redirect to onboarding
    const shouldShowOnboarding = 
      !user && 
      !onboardingComplete && 
      !isOnboardingBypassedRoute &&
      !isOnboardingRoute;
    
    if (shouldShowOnboarding) {
      return <Navigate to="/app" replace />;
    }
  }
  
  return <>{children}</>;
};

export default OnboardingCheck;
