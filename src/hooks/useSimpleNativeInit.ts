// Simplified native initialization aligned with web patterns
import { useEffect, useState } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface SimpleNativeInitState {
  isInitialized: boolean;
  isNativeApp: boolean;
  error: string | null;
}

export const useSimpleNativeInit = () => {
  const [state, setState] = useState<SimpleNativeInitState>({
    isInitialized: false,
    isNativeApp: false,
    error: null
  });

  useEffect(() => {
    const initializeNative = async () => {
      try {
        console.log('[SimpleNativeInit] Starting initialization...');
        
        // Simple initialization - just check if we're native
        const isNative = nativeIntegrationService.isRunningNatively();
        
        if (isNative) {
          console.log('[SimpleNativeInit] Native environment detected, initializing...');
          await nativeIntegrationService.initialize();
        }
        
        setState({
          isInitialized: true,
          isNativeApp: isNative,
          error: null
        });
        
        console.log('[SimpleNativeInit] Initialization complete:', { isNative });
      } catch (error) {
        console.error('[SimpleNativeInit] Initialization failed:', error);
        setState({
          isInitialized: true, // Still mark as initialized to not block the app
          isNativeApp: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    initializeNative();
  }, []);

  return state;
};