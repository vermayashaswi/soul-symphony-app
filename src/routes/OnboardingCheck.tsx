
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAutoTrialActivation } from '@/hooks/useAutoTrialActivation';

export interface OnboardingCheckProps {
  children: React.ReactNode;
  onboardingComplete?: boolean | null;
  onboardingLoading?: boolean;
  user?: any;
}

const OnboardingCheck: React.FC<OnboardingCheckProps> = ({ children }) => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  
  // Auto-activate trial for new users
  useAutoTrialActivation();

  // Check if user has seen onboarding screens
  const hasSeenOnboardingScreens = localStorage.getItem("onboardingScreensSeen") === "true";
  const isOnboardingComplete = localStorage.getItem("onboardingComplete") === "true";

  console.log('OnboardingCheck:', { 
    hasUser: !!user, 
    profileSubscriptionStatus: profile?.subscription_status,
    hasSeenOnboardingScreens,
    isOnboardingComplete,
    shouldRedirectToOnboarding: !hasSeenOnboardingScreens && !isOnboardingComplete
  });

  // If user is not logged in, redirect to auth
  if (!user) {
    console.log('OnboardingCheck: No user, redirecting to /app/auth');
    return <Navigate to="/app/auth" replace />;
  }

  // If user hasn't seen onboarding screens and onboarding isn't complete, redirect to onboarding
  if (!hasSeenOnboardingScreens && !isOnboardingComplete) {
    console.log('OnboardingCheck: Onboarding screens not seen, redirecting to /app/onboarding');
    return <Navigate to="/app/onboarding" replace />;
  }

  // If user has seen onboarding screens but onboarding isn't complete, complete it now
  if (hasSeenOnboardingScreens && !isOnboardingComplete && user) {
    console.log('OnboardingCheck: User authenticated after seeing onboarding screens, completing onboarding');
    localStorage.setItem("onboardingComplete", "true");
    localStorage.removeItem("onboardingScreensSeen"); // Clean up
  }

  console.log('OnboardingCheck: All checks passed, rendering children');
  return <>{children}</>;
};

export default OnboardingCheck;
