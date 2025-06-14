
import React from 'react';
import { SplashScreen } from './SplashScreen';
import { useSplashScreen } from '@/hooks/use-splash-screen';

interface SplashScreenWrapperProps {
  children: React.ReactNode;
  enabledInDev?: boolean;
  minDisplayTime?: number;
}

export const SplashScreenWrapper: React.FC<SplashScreenWrapperProps> = ({
  children,
  enabledInDev = false,
  minDisplayTime = 1500
}) => {
  const currentPath = window.location.pathname;
  
  console.log('[SplashScreenWrapper] Rendering with path:', currentPath);

  // For marketing routes, ALWAYS render children immediately without any splash logic
  const isMarketingRoute = currentPath === '/' || 
                          currentPath.startsWith('/blog') ||
                          currentPath.startsWith('/faq') ||
                          currentPath.startsWith('/privacy') ||
                          currentPath.startsWith('/download');

  if (isMarketingRoute) {
    console.log('[SplashScreenWrapper] Marketing route detected - rendering children directly');
    return <>{children}</>;
  }

  // For app routes, use splash screen logic
  const { isVisible, isAppReady, hideSplashScreen } = useSplashScreen({
    enabledInDev,
    minDisplayTime
  });

  console.log('[SplashScreenWrapper] App route - splash state:', {
    isVisible,
    isAppReady,
    enabledInDev
  });

  return (
    <>
      {/* Show splash screen only for app routes when explicitly visible */}
      {isVisible && currentPath.startsWith('/app/') && (
        <SplashScreen 
          isVisible={isVisible}
          onComplete={hideSplashScreen}
        />
      )}
      
      {/* Always render children for marketing routes, or when app is ready */}
      {(isAppReady || isMarketingRoute) && children}
    </>
  );
};
