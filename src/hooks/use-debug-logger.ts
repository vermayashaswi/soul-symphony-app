
import { useCallback } from 'react';

/**
 * A simplified version of debug logger that doesn't depend on DebugContext
 * Simply logs to console directly instead of using the debug context
 */
export const useDebugLogger = () => {
  // Use stable callback functions that don't change on re-renders
  const logAction = useCallback((message: string, details?: any) => {
    console.log(`[Action] ${message}`, details || '');
  }, []);
  
  const logError = useCallback((message: string, error?: any) => {
    console.error(`[Error] ${message}`, error || '');
  }, []);
  
  const logInfo = useCallback((message: string, details?: any) => {
    console.log(`[Info] ${message}`, details || '');
  }, []);
  
  const logNetwork = useCallback((message: string, details?: any) => {
    console.log(`[Network] ${message}`, details || '');
  }, []);
  
  const logSession = useCallback((message: string, details?: any) => {
    console.log(`[Session] ${message}`, details || '');
  }, []);
  
  return {
    logAction,
    logError,
    logInfo,
    logNetwork,
    logSession
  };
};
