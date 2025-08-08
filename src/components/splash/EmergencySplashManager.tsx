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

  // Detect plugin availability up front
  const cap = (window as any).Capacitor;
  const hasCapacitor = !!cap;
  const hasSplashScreen = !!cap?.Plugins?.SplashScreen;
  const platform = hasCapacitor ? cap.getPlatform?.() : 'unknown';

  const shouldManage = Boolean(
    hasSplashScreen ||
    (platform === 'ios' || platform === 'android') ||
    isNative
  );
  
  splashLogger.info('EmergencySplashManager effect running', {
    isNative,
    isAppInitialized,
    isSplashHidden,
    emergencyHide,
    hasCapacitor,
    hasSplashScreen,
    platform,
    shouldManage,
    userAgent: navigator.userAgent.substring(0, 100)
  });
  
  if (!shouldManage) {
    // No native splash to manage
    splashLogger.info('No native splash to manage - marking as hidden');
    setIsSplashHidden(true);
    return;
  }

  if (!hasCapacitor || !hasSplashScreen) {
    splashLogger.warn('Capacitor or SplashScreen plugin not available - marking splash as hidden');
    setIsSplashHidden(true);
    return;
  }

    splashLogger.info('Managing emergency splash screen', { maxEmergencyTimeout });

    // EMERGENCY TIMEOUT - This ALWAYS fires regardless of initialization status
    const emergencyTimeout = setTimeout(() => {
      if (!isSplashHidden) {
        splashLogger.warn('🚨 EMERGENCY: Force hiding splash screen due to absolute timeout');
        setEmergencyHide(true);
        
        // Enhanced hide strategies with more debugging
        const hideStrategies = [
          {
            name: 'Fast fade',
            action: () => SplashScreen.hide({ fadeOutDuration: 100 })
          },
          {
            name: 'Instant hide',
            action: () => SplashScreen.hide()
          },
          {
            name: 'Direct plugin call',
            action: async () => {
              const splashPlugin = (window as any).Capacitor?.Plugins?.SplashScreen;
              if (splashPlugin && typeof splashPlugin.hide === 'function') {
                return splashPlugin.hide();
              }
              throw new Error('Direct plugin call failed');
            }
          },
          {
            name: 'Force resolve',
            action: () => Promise.resolve()
          }
        ];

        const tryHideSequence = async () => {
          splashLogger.info('Starting emergency hide sequence with strategies:', hideStrategies.map(s => s.name));
          
          for (const strategy of hideStrategies) {
            try {
              splashLogger.info(`Trying strategy: ${strategy.name}`);
              await Promise.race([
                strategy.action(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Strategy timeout')), 2000))
              ]);
              
              splashLogger.info(`✅ Emergency splash hide successful with strategy: ${strategy.name}`);
              setIsSplashHidden(true);
              break;
            } catch (error) {
              splashLogger.warn(`❌ Strategy '${strategy.name}' failed:`, error);
            }
          }
          
          // Force mark as hidden even if all strategies failed
          if (!isSplashHidden) {
            splashLogger.warn('🆘 All emergency hide strategies failed, marking as hidden anyway');
            setIsSplashHidden(true);
          }
        };

        tryHideSequence();
      }
    }, maxEmergencyTimeout);

    // Normal hide when app is initialized (but only if emergency hasn't fired)
    if (isAppInitialized && !emergencyHide && !isSplashHidden) {
      splashLogger.info('✅ App initialized, hiding splash screen normally');
      
      const normalHide = setTimeout(() => {
        splashLogger.info('Executing normal splash hide...');
        
        SplashScreen.hide({ fadeOutDuration: 300 })
          .then(() => {
            splashLogger.info('✅ Normal splash hide successful');
            setIsSplashHidden(true);
            clearTimeout(emergencyTimeout);
          })
          .catch((error) => {
            splashLogger.warn('❌ Normal splash hide failed, emergency will handle it', error);
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

  // In native apps (or when Splash plugin exists), don't render content until splash is handled
  const hasSplashPlugin = typeof window !== 'undefined' && !!(window as any).Capacitor?.Plugins?.SplashScreen;
  if ((nativeIntegrationService.isRunningNatively() || hasSplashPlugin) && !isSplashHidden) {
    return null;
  }

  return <>{children}</>;
};