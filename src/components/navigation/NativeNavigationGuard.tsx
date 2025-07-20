
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingState } from '@/hooks/use-onboarding-state';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface NativeNavigationGuardProps {
  children: React.ReactNode;
  onNavigationReady: (path: string) => void;
}

export function NativeNavigationGuard({ children, onNavigationReady }: NativeNavigationGuardProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { onboardingComplete, loading: onboardingLoading, isReady } = useOnboardingState(user);
  const [navigationProcessed, setNavigationProcessed] = useState(false);

  useEffect(() => {
    const processNavigation = () => {
      // Only process if we're in native environment and all states are ready
      if (!nativeIntegrationService.isRunningNatively()) {
        return;
      }

      if (authLoading || onboardingLoading || !isReady || navigationProcessed) {
        return;
      }

      console.log('[NativeNavigationGuard] Processing navigation', {
        hasUser: !!user,
        onboardingComplete,
        authLoading,
        onboardingLoading,
        isReady
      });

      let targetPath = '/app/onboarding';

      if (user) {
        if (onboardingComplete) {
          targetPath = '/app/home';
        } else {
          targetPath = '/app/onboarding';
        }
      }

      console.log('[NativeNavigationGuard] Target path determined:', targetPath);
      setNavigationProcessed(true);
      onNavigationReady(targetPath);
    };

    processNavigation();
  }, [user, onboardingComplete, authLoading, onboardingLoading, isReady, navigationProcessed, onNavigationReady]);

  // Show loading while processing navigation for native apps
  if (nativeIntegrationService.isRunningNatively() && !navigationProcessed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
