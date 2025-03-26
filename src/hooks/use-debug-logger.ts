
import { useDebug } from '@/contexts/debug/DebugContext';
import { useCallback } from 'react';

export const useDebugLogger = () => {
  const { addLog } = useDebug();
  
  // Using useCallback to memoize these functions and prevent unnecessary re-renders
  const logAction = useCallback((message: string, details?: any) => {
    addLog('action', message, details);
  }, [addLog]);
  
  const logError = useCallback((message: string, error?: any) => {
    console.error(message, error); // Also log to console
    addLog('error', message, error);
  }, [addLog]);
  
  const logInfo = useCallback((message: string, details?: any) => {
    addLog('info', message, details);
  }, [addLog]);
  
  const logNetwork = useCallback((message: string, details?: any) => {
    addLog('network', message, details);
  }, [addLog]);
  
  const logSession = useCallback((message: string, details?: any) => {
    addLog('session', message, details);
  }, [addLog]);
  
  return {
    logAction,
    logError,
    logInfo,
    logNetwork,
    logSession
  };
};
