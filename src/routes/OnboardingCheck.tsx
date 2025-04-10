
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isNativeApp } from './RouteHelpers';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';
import { MobilePreviewWrapper } from './RouteHelpers';

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
  
  const isAuthRoute = location.pathname === '/auth';
  const isOnboardingRoute = location.pathname === '/onboarding';
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
  
  const shouldShowOnboarding = 
    !user && 
    !onboardingComplete && 
    !isOnboardingBypassedRoute &&
    !isOnboardingRoute && 
    isNativeApp();
  
  if (shouldShowOnboarding) {
    return (
      <MobilePreviewWrapper>
        <OnboardingScreen />
      </MobilePreviewWrapper>
    );
  }
  
  return <>{children}</>;
};

export default OnboardingCheck;
