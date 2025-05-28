
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

  // If user is not logged in, redirect to onboarding
  if (!user) {
    return <Navigate to="/app/onboarding" replace />;
  }

  // If onboarding is not completed (subscription_status is null), redirect to onboarding
  if (profile && profile.subscription_status === null) {
    return <Navigate to="/app/onboarding" replace />;
  }

  return <>{children}</>;
};

export default OnboardingCheck;
