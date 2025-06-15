
import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';

type OnboardingCheckProps = {
  onboardingComplete: boolean;
  onboardingLoading: boolean;
  user: User | null;
  children: ReactNode;
};

function OnboardingCheck(props: OnboardingCheckProps) {
  const { onboardingComplete, onboardingLoading, user, children } = props;

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
}

export default OnboardingCheck;
