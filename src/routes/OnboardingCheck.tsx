
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';

export interface OnboardingCheckProps {
  children: React.ReactNode;
  onboardingComplete?: boolean | null;
  onboardingLoading?: boolean;
  user?: any;
}

const OnboardingCheck: React.FC<OnboardingCheckProps> = ({ children }) => {
  const { user } = useAuth();
  const { profile } = useUserProfile();

  // If user is not logged in, redirect to onboarding
  if (!user) {
    return <Navigate to="/app/onboarding" replace />;
  }

  // If onboarding is not completed, redirect to onboarding
  if (profile && profile.subscription_status === null) {
    return <Navigate to="/app/onboarding" replace />;
  }

  return <>{children}</>;
};

export default OnboardingCheck;
