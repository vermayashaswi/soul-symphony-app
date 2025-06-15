
import React from 'react';
import { Navigate } from 'react-router-dom';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';

interface OnboardingCheckProps {
  onboardingComplete: boolean;
  onboardingLoading: boolean;
  user: any;
  children: React.ReactNode;
}

const OnboardingCheck: React.FC<OnboardingCheckProps> = ({ 
  onboardingComplete, 
  onboardingLoading, 
  user, 
  children 
}) => {
  if (onboardingLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/app/auth" replace />;
  }

  if (!onboardingComplete) {
    return <Navigate to="/app/onboarding" replace />;
  }

  return <>{children}</>;
};

export default OnboardingCheck;
