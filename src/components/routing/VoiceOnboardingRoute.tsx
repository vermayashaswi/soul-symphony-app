import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppInitializationContext } from '@/contexts/AppInitializationContext';

interface VoiceOnboardingRouteProps {
  children: React.ReactNode;
}

const VoiceOnboardingRoute: React.FC<VoiceOnboardingRouteProps> = ({ children }) => {
  const { user } = useAuth();
  const { onboardingCompleted, voiceOnboardingCompleted } = useAppInitializationContext();

  // Not authenticated - redirect to auth
  if (!user) {
    return <Navigate to="/app/auth" replace />;
  }

  // Regular onboarding not completed - redirect to onboarding
  if (!onboardingCompleted) {
    return <Navigate to="/app/onboarding" replace />;
  }

  // Voice onboarding already completed - redirect to home
  if (voiceOnboardingCompleted) {
    return <Navigate to="/app/home" replace />;
  }

  // Show voice onboarding
  return <>{children}</>;
};

export default VoiceOnboardingRoute;