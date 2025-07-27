import { useState, useEffect, useCallback } from 'react';

/**
 * Simplified onboarding hook that relies primarily on localStorage
 * for immediate mobile navigation responsiveness
 */
export function useSimpleOnboarding() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  // Quick localStorage check for immediate UI responsiveness
  const checkLocalOnboarding = useCallback((): boolean => {
    return localStorage.getItem('onboardingComplete') === 'true';
  }, []);

  // Initialize onboarding state immediately from localStorage
  useEffect(() => {
    const isComplete = checkLocalOnboarding();
    setOnboardingComplete(isComplete);
    console.log('[SimpleOnboarding] Initialized from localStorage:', isComplete);
  }, [checkLocalOnboarding]);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem('onboardingComplete', 'true');
    setOnboardingComplete(true);
    console.log('[SimpleOnboarding] Onboarding marked as complete');
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem('onboardingComplete');
    setOnboardingComplete(false);
    console.log('[SimpleOnboarding] Onboarding reset');
  }, []);

  return {
    onboardingComplete,
    completeOnboarding,
    resetOnboarding,
    checkLocalOnboarding
  };
}