import React, { useEffect, useState } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { SplashScreen } from '@capacitor/splash-screen';
import { logger } from '@/utils/logger';

interface EmergencySplashManagerProps {
  children: React.ReactNode;
  isAppInitialized: boolean;
  maxEmergencyTimeout?: number; // Emergency timeout in ms
}

/**
 * Emergency splash screen manager with absolute timeout guarantee
 * This ensures the splash screen NEVER blocks the app indefinitely
 */
export const EmergencySplashManager: React.FC<EmergencySplashManagerProps> = ({
  children,
  isAppInitialized,
  maxEmergencyTimeout = 2500 // 2.5 seconds absolute maximum
}) => {
  const [isSplashHidden, setIsSplashHidden] = useState(false);
  const [emergencyHide, setEmergencyHide] = useState(false);
  const splashLogger = logger.createLogger('EmergencySplash');

  useEffect(() => {
    const isNative = nativeIntegrationService.isRunningNatively();
    
    if (!isNative) {
      // Not a native app, no splash screen to manage
      setIsSplashHidden(true);
      return;
    }

    splashLogger.info('Managing emergency splash screen', { maxEmergencyTimeout });

    // EMERGENCY TIMEOUT - This ALWAYS fires regardless of initialization status
    const emergencyTimeout = setTimeout(() => {
      if (!isSplashHidden) {
        splashLogger.warn('EMERGENCY: Force hiding splash screen due to absolute timeout');
        setEmergencyHide(true);
        
        // Try multiple hide strategies in sequence
        const hideStrategies = [
          () => SplashScreen.hide({ fadeOutDuration: 100 }),
          () => SplashScreen.hide(),
          () => Promise.resolve() // Final fallback
        ];

        const tryHideSequence = async () => {
          for (const strategy of hideStrategies) {
            try {
              await strategy();
              splashLogger.info('Emergency splash hide successful');
              setIsSplashHidden(true);
              break;
            } catch (error) {
              splashLogger.warn('Emergency hide strategy failed, trying next', error);
            }
          }
          
          // Force mark as hidden even if all strategies failed
          if (!isSplashHidden) {
            splashLogger.warn('All emergency hide strategies failed, marking as hidden anyway');
            setIsSplashHidden(true);
          }
        };

        tryHideSequence();
      }
    }, maxEmergencyTimeout);

    // Normal hide when app is initialized (but only if emergency hasn't fired)
    if (isAppInitialized && !emergencyHide && !isSplashHidden) {
      splashLogger.info('App initialized, hiding splash screen normally');
      
      const normalHide = setTimeout(() => {
        SplashScreen.hide({ fadeOutDuration: 300 })
          .then(() => {
            splashLogger.info('Normal splash hide successful');
            setIsSplashHidden(true);
            clearTimeout(emergencyTimeout);
          })
          .catch((error) => {
            splashLogger.warn('Normal splash hide failed, emergency will handle it', error);
          });
      }, 200); // Small delay for smooth transition

      return () => {
        clearTimeout(normalHide);
        clearTimeout(emergencyTimeout);
      };
    }

    return () => {
      clearTimeout(emergencyTimeout);
    };
  }, [isAppInitialized, emergencyHide, isSplashHidden, maxEmergencyTimeout, splashLogger]);

  // In native apps, don't render content until splash is handled
  if (nativeIntegrationService.isRunningNatively() && !isSplashHidden) {
    return null;
  }

  return <>{children}</>;
};