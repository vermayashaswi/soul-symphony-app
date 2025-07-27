
import { useEffect, useState } from 'react';
import { journalReminderService } from '@/services/journalReminderService';
import { initializeServiceWorker } from '@/utils/serviceWorker';
import { enhancedPlatformService } from '@/services/enhancedPlatformService';

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
        // Initialize service worker for background notifications
        await initializeServiceWorker();
        
        // Initialize platform detection
        await enhancedPlatformService.detectPlatform();
        
        // Initialize journal reminder service
        await journalReminderService.initializeOnAppStart();
        setState({
          isInitialized: true,
          isInitializing: false,
          error: null
        });
      } catch (error) {
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
