import React, { useEffect, useState } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { SplashScreen } from '@capacitor/splash-screen';

interface SplashScreenManagerProps {
  children: React.ReactNode;
  isAppInitialized: boolean;
  maxSplashDuration?: number; // Maximum time to show splash in ms
}

export const SplashScreenManager: React.FC<SplashScreenManagerProps> = ({
  children,
  isAppInitialized,
  maxSplashDuration = 8000 // 8 seconds max
}) => {
  const [isSplashHidden, setIsSplashHidden] = useState(false);
  const [forceHideTriggered, setForceHideTriggered] = useState(false);

  useEffect(() => {
    const isNative = nativeIntegrationService.isRunningNatively();
    
    if (!isNative) {
      // Not a native app, no splash screen to manage
      setIsSplashHidden(true);
      return;
    }

    console.log('[SplashManager] Managing native splash screen...');

    // Force hide splash screen after maximum duration regardless of initialization status
    const forceHideTimeout = setTimeout(() => {
      if (!isSplashHidden && !forceHideTriggered) {
        console.warn('[SplashManager] Force hiding splash screen due to timeout');
        setForceHideTriggered(true);
        
        SplashScreen.hide().then(() => {
          console.log('[SplashManager] Splash screen force hidden');
          setIsSplashHidden(true);
        }).catch((error) => {
          console.error('[SplashManager] Force hide failed:', error);
          // Mark as hidden anyway to show the app
          setIsSplashHidden(true);
        });
      }
    }, maxSplashDuration);

    // Hide splash when app is initialized (but respect minimum show time)
    if (isAppInitialized && !isSplashHidden && !forceHideTriggered) {
      console.log('[SplashManager] App initialized, hiding splash screen');
      
      // Add small delay to ensure smooth transition
      const hideDelay = setTimeout(() => {
        SplashScreen.hide({
          fadeOutDuration: 300
        }).then(() => {
          console.log('[SplashManager] Splash screen hidden after initialization');
          setIsSplashHidden(true);
          clearTimeout(forceHideTimeout);
        }).catch((error) => {
          console.warn('[SplashManager] Animated hide failed, trying basic hide:', error);
          
          SplashScreen.hide().then(() => {
            console.log('[SplashManager] Splash screen hidden (fallback)');
            setIsSplashHidden(true);
            clearTimeout(forceHideTimeout);
          }).catch((fallbackError) => {
            console.error('[SplashManager] All hide attempts failed:', fallbackError);
            // Mark as hidden anyway to show the app
            setIsSplashHidden(true);
            clearTimeout(forceHideTimeout);
          });
        });
      }, 500); // 500ms delay for smooth transition

      return () => {
        clearTimeout(hideDelay);
        clearTimeout(forceHideTimeout);
      };
    }

    return () => {
      clearTimeout(forceHideTimeout);
    };
  }, [isAppInitialized, isSplashHidden, forceHideTriggered, maxSplashDuration]);

  // In native apps, don't render the app content until splash is handled
  if (nativeIntegrationService.isRunningNatively() && !isSplashHidden) {
    return null;
  }

  return <>{children}</>;
};