
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
  minDisplayTime = 2000 // Reduced default time
}) => {
  const { isVisible, isAppReady, hideSplashScreen } = useSplashScreen({
    enabledInDev,
    minDisplayTime
  });

  // Always render children in development mode for faster iteration
  if (process.env.NODE_ENV === 'development' && !enabledInDev) {
    return <>{children}</>;
  }

  return (
    <>
      <SplashScreen 
        isVisible={isVisible}
        onComplete={hideSplashScreen}
      />
      
      {/* Render app content when ready OR when splash is hidden */}
      {(isAppReady || !isVisible) && children}
    </>
  );
};
