
import React, { useEffect, useState } from 'react';
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
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Auto-activate trial for new users
  useAutoTrialActivation();

  // Get onboarding state from localStorage
  const hasSeenOnboardingScreens = localStorage.getItem("onboardingScreensSeen") === "true";
  const isOnboardingComplete = localStorage.getItem("onboardingComplete") === "true";

  console.log('OnboardingCheck render:', { 
    hasUser: !!user, 
    userId: user?.id,
    profileSubscriptionStatus: profile?.subscription_status,
    hasSeenOnboardingScreens,
    isOnboardingComplete,
    isProcessing,
    shouldRedirectToOnboarding: !hasSeenOnboardingScreens && !isOnboardingComplete
  });

  // Handle onboarding completion when user signs in after seeing screens
  useEffect(() => {
    if (hasSeenOnboardingScreens && !isOnboardingComplete && user && !isProcessing) {
      console.log('OnboardingCheck: User authenticated after seeing onboarding screens, completing onboarding');
      setIsProcessing(true);
      
      // Complete onboarding
      localStorage.setItem("onboardingComplete", "true");
      localStorage.removeItem("onboardingScreensSeen");
      
      // Reset processing state after a brief delay
      setTimeout(() => {
        setIsProcessing(false);
      }, 100);
    }
  }, [hasSeenOnboardingScreens, isOnboardingComplete, user, isProcessing]);

  // If user is not logged in, redirect to auth
  if (!user) {
    console.log('OnboardingCheck: No user, redirecting to /app/auth');
    return <Navigate to="/app/auth" replace />;
  }

  // If user hasn't seen onboarding screens and onboarding isn't complete, redirect to onboarding
  if (!hasSeenOnboardingScreens && !isOnboardingComplete && !isProcessing) {
    console.log('OnboardingCheck: Onboarding screens not seen, redirecting to /app/onboarding');
    return <Navigate to="/app/onboarding" replace />;
  }

  // Show loading state while processing onboarding completion
  if (isProcessing) {
    console.log('OnboardingCheck: Processing onboarding completion');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  console.log('OnboardingCheck: All checks passed, rendering children');
  return <>{children}</>;
};

export default OnboardingCheck;
