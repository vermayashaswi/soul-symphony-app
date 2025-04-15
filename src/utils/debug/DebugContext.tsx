
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { createLogEntry } from './debugUtils';
import { DebugLogContextType, DebugLogEntry, LogLevel } from './debugLogTypes';

// Create the context with a default value
const DebugLogContext = createContext<DebugLogContextType>({
  logs: [],
  addEvent: () => {},
  addLog: () => {}, // Added for backwards compatibility 
  clearLogs: () => {},
  isEnabled: false,
  toggleEnabled: () => {}
});

// Debug provider component
export const DebugLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  
  // Local storage key for saving debug preferences
  const STORAGE_KEY = 'debug_preferences';
  
  // Initialize from local storage
  React.useEffect(() => {
    const savedPreferences = localStorage.getItem(STORAGE_KEY);
    if (savedPreferences) {
      try {
        const { enabled } = JSON.parse(savedPreferences);
        setIsEnabled(enabled || false);
      } catch (e) {
        console.error("Error parsing debug preferences:", e);
      }
    }
  }, []);

  // Save preferences to local storage
  const savePreferences = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: isEnabled }));
    } catch (e) {
      console.error("Error saving debug preferences:", e);
    }
  }, [isEnabled]);

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
  }, []);
  
  // Toggle debug mode
  const toggleEnabled = useCallback(() => {
    setIsEnabled(prev => {
      const newState = !prev;
      // Schedule saving the new state
      setTimeout(() => savePreferences(), 0);
      return newState;
    });
  }, [savePreferences]);
  
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
