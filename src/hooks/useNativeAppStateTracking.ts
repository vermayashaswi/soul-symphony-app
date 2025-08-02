import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { sessionTrackingService } from '@/services/sessionTrackingService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

export const useNativeAppStateTracking = () => {
  useEffect(() => {
    // Only set up native app state tracking if running in native environment
    if (!nativeIntegrationService.isRunningNatively()) {
      return;
    }

    let appStateListener: any;
    let backButtonListener: any;

    const setupNativeListeners = async () => {
      try {
        // Listen for app state changes
        appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
          console.log('[NativeAppState] App state changed:', isActive ? 'foreground' : 'background');
          
          if (isActive) {
            // App came to foreground
            sessionTrackingService.handleAppStateChange('foreground');
          } else {
            // App went to background
            sessionTrackingService.handleAppStateChange('background');
          }
        });

        // Listen for back button press (Android)
        backButtonListener = await App.addListener('backButton', ({ canGoBack }) => {
          console.log('[NativeAppState] Back button pressed, canGoBack:', canGoBack);
          
          if (!canGoBack) {
            // User is trying to exit the app
            // Don't force close the session, just minimize the app
            sessionTrackingService.handleAppStateChange('background');
          }
        });

        console.log('[NativeAppState] Native app state listeners set up');
      } catch (error) {
        console.error('[NativeAppState] Error setting up native listeners:', error);
      }
    };

    setupNativeListeners();

    // Cleanup listeners on unmount
    return () => {
      if (appStateListener) {
        appStateListener.remove();
      }
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, []);

  // Handle app termination (this is tricky to detect reliably)
  useEffect(() => {
    if (!nativeIntegrationService.isRunningNatively()) {
      return;
    }

    const handleAppTermination = () => {
      console.log('[NativeAppState] App termination detected');
      sessionTrackingService.handleAppStateChange('terminated');
    };

    // Listen for page unload as a proxy for app termination
    window.addEventListener('beforeunload', handleAppTermination);
    
    return () => {
      window.removeEventListener('beforeunload', handleAppTermination);
    };
  }, []);
};