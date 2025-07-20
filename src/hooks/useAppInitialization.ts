
import { useEffect, useState } from 'react';
import { journalReminderService } from '@/services/journalReminderService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { detectTWAEnvironment } from '@/utils/twaDetection';

interface AppInitializationState {
  isInitialized: boolean;
  isInitializing: boolean;
  authReady: boolean;
  sessionRestored: boolean;
  error: string | null;
}

export const useAppInitialization = () => {
  const [state, setState] = useState<AppInitializationState>({
    isInitialized: false,
    isInitializing: true,
    authReady: false,
    sessionRestored: false,
    error: null
  });

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[AppInit] Starting app initialization...');
        const twaEnv = detectTWAEnvironment();
        const isNative = nativeIntegrationService.isRunningNatively();
        
        // Initialize services based on environment
        if (isNative) {
          console.log('[AppInit] Native environment detected - initializing native services');
          await nativeIntegrationService.initialize();
        }
        
        // Initialize journal reminder service
        await journalReminderService.initializeOnAppStart();
        
        // Set shorter delays for native environments
        const initDelay = isNative || twaEnv.isTWA ? 200 : 500;
        
        setTimeout(() => {
          console.log('[AppInit] App initialization completed');
          setState({
            isInitialized: true,
            isInitializing: false,
            authReady: true,
            sessionRestored: true,
            error: null
          });
        }, initDelay);
        
      } catch (error) {
        console.error('[AppInit] App initialization failed:', error);
        setState({
          isInitialized: false,
          isInitializing: false,
          authReady: false,
          sessionRestored: false,
          error: error instanceof Error ? error.message : 'Initialization failed'
        });
      }
    };

    initializeApp();
  }, []);

  return state;
};
