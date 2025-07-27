/**
 * Simplified Native Initialization Hook
 * Replaces complex initialization chain with streamlined approach
 */

import { useEffect, useState } from 'react';
import { simpleNativeInitService, SimpleInitState } from '@/services/simpleNativeInitService';

export const useSimpleNativeInit = () => {
  const [initState, setInitState] = useState<SimpleInitState>(
    simpleNativeInitService.getInitState()
  );

  useEffect(() => {
    let mounted = true;

    const initializeNative = async () => {
      try {
        console.log('[SimpleNativeInit] Starting initialization...');
        
        const success = await simpleNativeInitService.initialize();
        
        if (mounted) {
          const newState = simpleNativeInitService.getInitState();
          setInitState(newState);
          
          if (success) {
            console.log('[SimpleNativeInit] Initialization completed successfully');
          } else {
            console.error('[SimpleNativeInit] Initialization failed');
          }
        }
      } catch (error) {
        console.error('[SimpleNativeInit] Initialization error:', error);
        
        if (mounted) {
          const newState = simpleNativeInitService.getInitState();
          setInitState(newState);
        }
      }
    };

    // Only initialize once
    if (!initState.isInitialized && !initState.isInitializing) {
      initializeNative();
    }

    return () => {
      mounted = false;
    };
  }, []);

  return {
    ...initState,
    reset: () => {
      simpleNativeInitService.reset();
      setInitState(simpleNativeInitService.getInitState());
    }
  };
};