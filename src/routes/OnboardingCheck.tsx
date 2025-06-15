
import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';

interface OnboardingCheckProps {
  children: ReactNode;
}

const OnboardingCheck: React.FC<OnboardingCheckProps> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const { onboardingComplete, loading: onboardingLoading } = useOnboarding();

  if (authLoading || onboardingLoading) {
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
