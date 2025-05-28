
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

  console.log('OnboardingCheck:', { 
    hasUser: !!user, 
    profileSubscriptionStatus: profile?.subscription_status,
    shouldRedirectToOnboarding: profile && profile.subscription_status === null
  });

  // If user is not logged in, redirect to auth
  if (!user) {
    console.log('OnboardingCheck: No user, redirecting to /app/auth');
    return <Navigate to="/app/auth" replace />;
  }

  // If onboarding is not completed (subscription_status is null), redirect to onboarding
  if (profile && profile.subscription_status === null) {
    console.log('OnboardingCheck: Onboarding not complete, redirecting to /app/onboarding');
    return <Navigate to="/app/onboarding" replace />;
  }

  console.log('OnboardingCheck: All checks passed, rendering children');
  return <>{children}</>;
};

export default OnboardingCheck;
