import { useState, useEffect } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { enhancedPlatformService } from '@/services/enhancedPlatformService';
import { mobileOptimizationService } from '@/services/mobileOptimizationService';
import { logger } from '@/utils/logger';

interface StreamlinedInitializationState {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  timeout: boolean;
  stage: 'starting' | 'platform' | 'native' | 'optimization' | 'complete' | 'error';
}

/**
 * Simplified initialization hook that only handles critical services
 * Non-critical services (subscription, RevenueCat) are deferred to background
 */
export const useStreamlinedInitialization = () => {
  const [state, setState] = useState<StreamlinedInitializationState>({
    isInitialized: false,
    isInitializing: false,
    error: null,
    timeout: false,
    stage: 'starting'
  });

  useEffect(() => {
    const initLogger = logger.createLogger('StreamlinedInit');
    let timeoutId: NodeJS.Timeout;
    let isAborted = false;

    const initializeApp = async () => {
      if (isAborted) return;
      
      setState(prev => ({ ...prev, isInitializing: true, stage: 'starting' }));
      
      // Emergency timeout - ABSOLUTE maximum initialization time
      timeoutId = setTimeout(() => {
        if (!isAborted) {
          initLogger.warn('Emergency timeout reached - forcing initialization complete');
          setState(prev => ({ 
            ...prev, 
            isInitialized: true, 
            isInitializing: false, 
            timeout: true,
            stage: 'complete'
          }));
        }
      }, 3000); // 3 seconds ABSOLUTE maximum

      try {
        initLogger.info('Starting streamlined initialization');

        // Stage 1: Platform detection (critical)
        if (isAborted) return;
        setState(prev => ({ ...prev, stage: 'platform' }));
        
        try {
          initLogger.debug('Detecting platform');
          await enhancedPlatformService.detectPlatform();
        } catch (error) {
          initLogger.warn('Platform detection failed (non-critical)', error);
        }

        // Stage 2: Native services (only if native, with timeout)
        if (isAborted) return;
        setState(prev => ({ ...prev, stage: 'native' }));
        
        const isNative = nativeIntegrationService.isRunningNatively();
        if (isNative) {
          initLogger.debug('Initializing critical native services');
          
          // Native initialization with its own timeout
          const nativeTimeout = new Promise<void>((resolve) => {
            setTimeout(() => {
              initLogger.warn('Native initialization timeout, continuing');
              resolve();
            }, 1000); // 1 second for native
          });

          const nativeInit = nativeIntegrationService.initialize().catch((error) => {
            initLogger.warn('Native initialization failed (non-critical)', error);
          });

          await Promise.race([nativeInit, nativeTimeout]);
        }

        // Stage 3: Mobile optimization (non-blocking)
        if (isAborted) return;
        setState(prev => ({ ...prev, stage: 'optimization' }));
        
        // Don't await this - let it happen in background
        mobileOptimizationService.initialize().catch((error) => {
          initLogger.warn('Mobile optimization failed (non-critical)', error);
        });

        // URL cleanup (critical for routing)
        const currentPath = window.location.pathname;
        if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
          window.history.replaceState(null, '', '/');
        }

        // Apply theme class
        document.body.classList.add('app-initialized');

        if (isAborted) return;
        
        // Success - clear timeout and mark as complete
        clearTimeout(timeoutId);
        initLogger.info('Streamlined initialization completed successfully');
        
        setState(prev => ({ 
          ...prev, 
          isInitialized: true, 
          isInitializing: false, 
          stage: 'complete'
        }));

      } catch (error) {
        if (isAborted) return;
        
        initLogger.error('Critical initialization error', error);
        clearTimeout(timeoutId);
        
        setState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : String(error),
          isInitializing: false,
          stage: 'error'
        }));
      }
    };

    initializeApp();

    // Cleanup function
    return () => {
      isAborted = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return state;
};