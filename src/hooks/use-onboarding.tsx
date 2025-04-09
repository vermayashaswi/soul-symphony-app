
import { useState, useEffect } from 'react';

export function useOnboarding() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if onboarding is complete
    const isComplete = localStorage.getItem('onboardingComplete') === 'true';
    setOnboardingComplete(isComplete);
    setLoading(false);
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('onboardingComplete', 'true');
    setOnboardingComplete(true);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('onboardingComplete');
    setOnboardingComplete(false);
  };

  return {
    onboardingComplete,
    loading,
    completeOnboarding,
    resetOnboarding
  };
}
