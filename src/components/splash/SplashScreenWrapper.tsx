
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
  const { isVisible, isAppReady, hideSplashScreen } = useSplashScreen({
    enabledInDev,
    minDisplayTime
  });

  const currentPath = window.location.pathname;
  
  console.log('[SplashScreenWrapper] Rendering with state:', {
    currentPath,
    isVisible,
    isAppReady,
    enabledInDev
  });

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

  // For app routes, show splash only if visible and ready
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
