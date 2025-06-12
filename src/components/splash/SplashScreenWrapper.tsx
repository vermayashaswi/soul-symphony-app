
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
  minDisplayTime = 3000
}) => {
  const { isVisible, isAppReady, hideSplashScreen } = useSplashScreen({
    enabledInDev,
    minDisplayTime
  });

  // Always render children to prevent app blocking
  // Splash screen is an overlay, not a blocker
  return (
    <>
      {isVisible && (
        <SplashScreen 
          isVisible={isVisible}
          onComplete={hideSplashScreen}
        />
      )}
      
      {/* Always render app content, splash is just an overlay */}
      <div style={{ visibility: isVisible ? 'hidden' : 'visible' }}>
        {children}
      </div>
    </>
  );
};
