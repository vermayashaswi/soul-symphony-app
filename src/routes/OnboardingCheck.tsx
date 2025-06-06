
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
  
  // Special paths that don't need onboarding checks
  const specialPaths = [
    '/app/onboarding',
    '/app/auth',
    '/onboarding',
    '/auth'
  ];
  
  const isSpecialPath = specialPaths.includes(location.pathname);
  
  console.log('OnboardingCheck rendering at path:', location.pathname, {
    user: !!user, 
    onboardingComplete,
    isAppRoute: isAppRoute(location.pathname),
    isWebsiteRoute: isWebsiteRoute(location.pathname),
    isSpecialPath,
    language: currentLanguage
  });
  
  // For website routes, no checks needed - just render children
  if (isWebsiteRoute(location.pathname)) {
    console.log('Website route detected, no onboarding check needed');
    return <>{children}</>;
  }
  
  // For special paths (auth/onboarding), no checks needed
  if (isSpecialPath) {
    console.log('Special path detected, no onboarding check needed');
    return <>{children}</>;
  }
  
  if (onboardingLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="animate-spin w-8 h-8 border-4 border-theme border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Special handling for the root /app route
  if (location.pathname === '/app') {
    console.log('Root app route detected, user:', !!user);
    if (user) {
      if (onboardingComplete) {
        console.log('User is logged in and onboarding complete, redirecting to /app/home');
        return <Navigate to="/app/home" replace />;
      } else {
        console.log('User is logged in but onboarding incomplete, redirecting to /app/onboarding');
        return <Navigate to="/app/onboarding" replace />;
      }
    } else {
      // If user is not logged in, redirect to onboarding (public)
      console.log('User not logged in, redirecting to /app/onboarding');
      return <Navigate to="/app/onboarding" replace />;
    }
  }
  
  return <>{children}</>;
};

export default OnboardingCheck;
