
import { useEffect, useState } from 'react';
import { journalReminderService } from '@/services/journalReminderService';

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
        
        // Initialize journal reminder service
        await journalReminderService.initializeOnAppStart();
        
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
