
import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';

interface OnboardingCheckProps {
  children: ReactNode;
}

const OnboardingCheck: React.FC<OnboardingCheckProps> = ({ children }) => {
  console.log('[OnboardingCheck] Component mounting...');
  
  try {
    const { user, isLoading: authLoading } = useAuth();
    const { onboardingComplete, loading: onboardingLoading } = useOnboarding();

    console.log('[OnboardingCheck] State:', {
      hasUser: !!user,
      userId: user?.id,
      authLoading,
      onboardingComplete,
      onboardingLoading,
      currentPath: window.location.pathname
    });

    if (authLoading || onboardingLoading) {
      console.log('[OnboardingCheck] Still loading, showing spinner');
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!user) {
      console.log('[OnboardingCheck] No user, redirecting to onboarding');
      return <Navigate to="/app/onboarding" replace />;
    }

    if (!onboardingComplete) {
      console.log('[OnboardingCheck] Onboarding not complete, redirecting to onboarding');
      return <Navigate to="/app/onboarding" replace />;
    }

    console.log('[OnboardingCheck] All checks passed, rendering children');
    return <>{children}</>;
  } catch (error) {
    console.error('[OnboardingCheck] Error in component:', error);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Onboarding Check Error</h2>
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <button 
            onClick={() => window.location.href = '/app/onboarding'} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Go to Onboarding
          </button>
        </div>
      </div>
    );
  }
};

export default OnboardingCheck;
