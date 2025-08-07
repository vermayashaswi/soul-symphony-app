
import { useEffect, useState } from 'react';
import { journalReminderService } from '@/services/journalReminderService';
import { initializeServiceWorker } from '@/utils/serviceWorker';
import { enhancedPlatformService } from '@/services/enhancedPlatformService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface AppInitializationState {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  initializationTimeout: boolean;
}

export const useAppInitialization = () => {
  const [state, setState] = useState<AppInitializationState>({
    isInitialized: false,
    isInitializing: true,
    error: null,
    initializationTimeout: false
  });

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[AppInit] Initializing critical app services...');
        
        // Set initialization timeout for native apps to prevent splash screen hanging
        const isNative = nativeIntegrationService.isRunningNatively();
        let timeoutId: NodeJS.Timeout | null = null;
        
        if (isNative) {
          timeoutId = setTimeout(() => {
            console.warn('[AppInit] Initialization timeout reached, proceeding anyway');
            setState(prev => ({
              ...prev,
              isInitialized: true,
              isInitializing: false,
              initializationTimeout: true
            }));
          }, 5000); // 5 second timeout for native apps
        }
        
        // Core services that must complete for basic app functionality
        const coreInitPromises = [
          // Platform detection is critical for native functionality
          enhancedPlatformService.detectPlatform(),
          // Service worker for background capabilities
          initializeServiceWorker().catch(error => {
            console.warn('[AppInit] Service worker initialization failed (non-critical):', error);
          })
        ];
        
        // Wait for core services
        await Promise.all(coreInitPromises);
        
        // Secondary services that can initialize in background
        const backgroundInitPromises = [
          // Journal reminders can be initialized later
          journalReminderService.initializeOnAppStart().catch(error => {
            console.warn('[AppInit] Journal reminder service initialization failed (non-critical):', error);
          })
        ];
        
        // Start background initialization but don't wait for it
        Promise.all(backgroundInitPromises).then(() => {
          console.log('[AppInit] Background services initialized');
        }).catch(error => {
          console.warn('[AppInit] Some background services failed to initialize:', error);
        });
        
        // Clear timeout if we completed before it
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        console.log('[AppInit] Core app initialization completed');
        setState({
          isInitialized: true,
          isInitializing: false,
          error: null,
          initializationTimeout: false
        });
        
      } catch (error) {
        console.error('[AppInit] Critical app initialization failed:', error);
        setState({
          isInitialized: false,
          isInitializing: false,
          error: error instanceof Error ? error.message : 'Critical initialization failed',
          initializationTimeout: false
        });
      }
    };

    initializeApp();
  }, []);

  return state;
};
