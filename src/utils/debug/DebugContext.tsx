
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { createLogEntry } from './debugUtils';
import { DebugLogContextType, DebugLogEntry, LogLevel } from './debugLogTypes';

// Create the context with a default value
const DebugLogContext = createContext<DebugLogContextType>({
  logs: [],
  addEvent: () => {},
  addLog: () => {}, // Added for backwards compatibility 
  clearLogs: () => {},
  isEnabled: true,
  toggleEnabled: () => {}
});

// Debug provider component
export const DebugLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  
  // Add a new event log (primary method name)
  const addEvent = useCallback((
    category: string, 
    message: string, 
    level: LogLevel = 'info',
    details?: any
  ) => {
    if (!isEnabled) return;
    
    setLogs(prev => {
      const newEntry = createLogEntry(category, message, level, details);
      return [...prev, newEntry];
    });
    
    // Also log to console for easier debugging during development
    const logLevel = level === 'error' ? 'error' : 
                    level === 'warning' ? 'warn' : 'log';
    console[logLevel](`[${category}] ${message}`, details);
  }, [isEnabled]);
  
  // Add for backward compatibility
  const addLog = useCallback((
    category: string, 
    message: string, 
    level: LogLevel = 'info',
    details?: any
  ) => {
    addEvent(category, message, level, details);
  }, [addEvent]);
  
  // Clear all logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    console.log('[DebugContext] Cleared all logs');
  }, []);
  
  // Toggle debug mode
  const toggleEnabled = useCallback(() => {
    setIsEnabled(prev => !prev);
  }, []);
  
  // The context value
  const value = {
    logs,
    addEvent,
    addLog, // Added for backwards compatibility
    clearLogs,
    isEnabled,
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
