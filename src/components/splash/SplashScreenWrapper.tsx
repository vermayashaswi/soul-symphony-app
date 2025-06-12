
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

  // For marketing routes, never show splash - just render children immediately
  const isMarketingRoute = window.location.pathname === '/' || 
                          window.location.pathname.startsWith('/blog') ||
                          window.location.pathname.startsWith('/faq') ||
                          window.location.pathname.startsWith('/privacy') ||
                          window.location.pathname.startsWith('/download');

  if (isMarketingRoute) {
    console.log('[SplashScreenWrapper] Marketing route, rendering children directly');
    return <>{children}</>;
  }

  // For development mode, don't show splash unless explicitly enabled
  if (process.env.NODE_ENV === 'development' && !enabledInDev) {
    return <>{children}</>;
  }

  // Emergency fallback - if something goes wrong, always show children
  const shouldShowChildren = isAppReady || !isVisible || isMarketingRoute;

  return (
    <>
      {/* Only show splash for app routes and when explicitly visible */}
      {isVisible && !isMarketingRoute && (
        <SplashScreen 
          isVisible={isVisible}
          onComplete={hideSplashScreen}
        />
      )}
      
      {/* Always render children for marketing routes, or when app is ready */}
      {shouldShowChildren && children}
    </>
  );
};
