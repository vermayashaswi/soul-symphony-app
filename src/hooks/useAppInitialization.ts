
import { useEffect, useState } from 'react';
import { enhancedJournalReminderService } from '@/services/enhancedJournalReminderService';
import { initializeServiceWorker } from '@/utils/serviceWorker';
import { enhancedPlatformService } from '@/services/enhancedPlatformService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface AppInitializationState {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
}

export const useAppInitialization = () => {
  const [state, setState] = useState<AppInitializationState>({
    isInitialized: false,
    isInitializing: true,
    error: null
  });

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[AppInit] Initializing app services...');
        
        // Initialize platform detection
        await enhancedPlatformService.detectPlatform();
        
        // Initialize native integration early to know environment
        await nativeIntegrationService.initialize();
        
        // Initialize service worker only for web/PWA
        if (!nativeIntegrationService.isRunningNatively()) {
          await initializeServiceWorker();
        } else {
          console.log('[AppInit] Skipping service worker on native environment');
        }
        
        // Initialize enhanced journal reminder service (non-blocking for native)
        if (nativeIntegrationService.isRunningNatively()) {
          // On native, don't block on journal reminder service
          enhancedJournalReminderService.initializeOnAppStart().catch(error => {
            console.error('[AppInit] Journal reminder service failed on native, continuing anyway:', error);
          });
        } else {
          await enhancedJournalReminderService.initializeOnAppStart();
        }
        
        // Safety: ensure splash screen is hidden if plugin exists
        await nativeIntegrationService.tryHideSplashScreenSafe();
        
        console.log('[AppInit] App initialization completed');
        setState({
          isInitialized: true,
          isInitializing: false,
          error: null
        });
      } catch (error) {
        console.error('[AppInit] App initialization failed:', error);
        setState({
          isInitialized: false,
          isInitializing: false,
          error: error instanceof Error ? error.message : 'Initialization failed'
        });
      }
    };

    initializeApp();
  }, []);

  return state;
};
