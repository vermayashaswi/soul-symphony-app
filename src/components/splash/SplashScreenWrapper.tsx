
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

  return (
    <>
      <SplashScreen 
        isVisible={isVisible}
        onComplete={hideSplashScreen}
      />
      
      {/* Only render app content when ready and splash is hidden */}
      {isAppReady && !isVisible && children}
    </>
  );
};
