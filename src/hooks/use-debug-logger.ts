import { useDebug } from '@/contexts/debug/DebugContext';
import { useCallback, useRef, useEffect } from 'react';

export const useDebugLogger = () => {
  const { addLog } = useDebug();
  const addLogRef = useRef(addLog);
  
  useEffect(() => {
    addLogRef.current = addLog;
  }, [addLog]);
  
  const logAction = useCallback((message: string, details?: any) => {
    addLogRef.current('action', message, details);
  }, []);
  
  const logError = useCallback((message: string, error?: any) => {
    console.error(message, error); // Also log to console
    addLogRef.current('error', message, error);
  }, []);
  
  const logInfo = useCallback((message: string, details?: any) => {
    addLogRef.current('info', message, details);
  }, []);
  
  const logNetwork = useCallback((message: string, details?: any) => {
    addLogRef.current('network', message, details);
  }, []);
  
  const logSession = useCallback((message: string, details?: any) => {
    addLogRef.current('session', message, details);
  }, []);
  
  return {
    logAction,
    logError,
    logInfo,
    logNetwork,
    logSession
  };
};
