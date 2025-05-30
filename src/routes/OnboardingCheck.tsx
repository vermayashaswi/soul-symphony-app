
import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { isAppRoute, isWebsiteRoute } from './RouteHelpers';
import { useTranslation } from '@/contexts/TranslationContext';

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
  const { currentLanguage } = useTranslation();
  
  // Expanded list of onboarding/auth paths
  const onboardingOrAuthPaths = [
    '/app/onboarding',
    '/app/auth',
    '/onboarding',
    '/auth',
    '/app',
    '/' // Also consider root path
  ];
  
  // Check if current path is in the list
  const isOnboardingOrAuth = onboardingOrAuthPaths.includes(location.pathname);
  
  console.log('OnboardingCheck rendering at path:', location.pathname, {
    user: !!user, 
    onboardingComplete,
    isAppRoute: isAppRoute(location.pathname),
    isWebsiteRoute: isWebsiteRoute(location.pathname),
    isOnboardingOrAuth,
    language: currentLanguage
  });
  
  // For website routes, no checks needed - just render children
  if (isWebsiteRoute(location.pathname)) {
    console.log('Website route detected, no onboarding check needed');
    return <>{children}</>;
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
        <div className="animate-spin w-8 h-8 border-4 border-theme border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // FIXED: Special handling for the root /app route - simplified logic
  if (isRootAppRoute) {
    console.log('Root app route detected, user:', !!user);
    // If user is logged in, redirect to home
    if (user) {
      console.log('User is logged in, redirecting to /app/home');
      return <Navigate to="/app/home" replace />;
    } else {
      // If user is not logged in, redirect to auth (not onboarding)
      console.log('User not logged in, redirecting to /app/auth');
      return <Navigate to="/app/auth" replace />;
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
  
  return <>{children}</>;
};

export default OnboardingCheck;
