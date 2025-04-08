
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { createLogEntry } from './debugUtils';
import { DebugLogContextType, DebugLogEntry, LogLevel } from './debugLogTypes';

// Create the context with a default value
const DebugLogContext = createContext<DebugLogContextType>({
  logs: [],
  addEvent: () => {},
  clearLogs: () => {},
  isEnabled: false,
  toggleEnabled: () => {}
});

// Debug provider component - now with UI components removed
export const DebugLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  
  // Add a new event log - now just logs to console in development
  const addEvent = useCallback((
    category: string, 
    message: string, 
    level: LogLevel = 'info',
    details?: any
  ) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${level.toUpperCase()}][${category}] ${message}`, details || '');
    }
  }, []);
  
  // Clear all logs - no-op in production
  const clearLogs = useCallback(() => {
    // No visible UI, so nothing to clear
  }, []);
  
  // Toggle debug mode - no-op in production
  const toggleEnabled = useCallback(() => {
    // Debug mode always disabled in production
  }, []);
  
  // The context value
  const value = {
    logs,
    addEvent,
    clearLogs,
    isEnabled: false, // Always false in production
    toggleEnabled
  };
  
  return (
    <DebugLogContext.Provider value={value}>
      {children}
    </DebugLogContext.Provider>
  );
};

// Hook to use the debug log context
export const useDebugLog = () => useContext(DebugLogContext);
