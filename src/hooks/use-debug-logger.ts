
import { useDebug } from '@/contexts/debug/DebugContext';
import { useCallback, useRef, useEffect } from 'react';

export const useDebugLogger = () => {
  const { addLog } = useDebug();
  const addLogRef = useRef(addLog);
  
  // Update the ref when addLog changes, but don't trigger re-renders
  useEffect(() => {
    addLogRef.current = addLog;
  }, [addLog]);
  
  // Use stable callback functions that don't change on re-renders
  const logAction = useCallback((message: string, details?: any) => {
    // Use setTimeout to prevent cascading effects and render loops
    setTimeout(() => {
      if (addLogRef.current) {
        addLogRef.current('action', message, details);
      }
    }, 0);
  }, []);
  
  const logError = useCallback((message: string, error?: any) => {
    console.error(message, error); // Also log to console
    setTimeout(() => {
      if (addLogRef.current) {
        addLogRef.current('error', message, error);
      }
    }, 0);
  }, []);
  
  const logInfo = useCallback((message: string, details?: any) => {
    setTimeout(() => {
      if (addLogRef.current) {
        addLogRef.current('info', message, details);
      }
    }, 0);
  }, []);
  
  const logNetwork = useCallback((message: string, details?: any) => {
    setTimeout(() => {
      if (addLogRef.current) {
        addLogRef.current('network', message, details);
      }
    }, 0);
  }, []);
  
  const logSession = useCallback((message: string, details?: any) => {
    setTimeout(() => {
      if (addLogRef.current) {
        addLogRef.current('session', message, details);
      }
    }, 0);
  }, []);
  
  return {
    logAction,
    logError,
    logInfo,
    logNetwork,
    logSession
  };
};
