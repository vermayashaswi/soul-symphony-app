
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { createLogEntry } from './debugUtils';
import { DebugLogContextType, DebugLogEntry, LogLevel } from './debugLogTypes';

// Create the context with a default value
const DebugLogContext = createContext<DebugLogContextType>({
  logs: [],
  addEvent: () => {},
  addLog: () => {}, // Added for backwards compatibility 
  clearLogs: () => {},
  isEnabled: true, // Default to true
  toggleEnabled: () => {}
});

// Debug provider component
export const DebugLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [isEnabled, setIsEnabled] = useState<boolean>(true); // Default to enabled for debugging
  
  // Local storage key for saving debug preferences
  const STORAGE_KEY = 'debug_preferences';
  
  // Initialize from local storage
  useEffect(() => {
    console.log('[DebugContext] Initializing debug context');
    try {
      const savedPreferences = localStorage.getItem(STORAGE_KEY);
      if (savedPreferences) {
        const { enabled } = JSON.parse(savedPreferences);
        setIsEnabled(enabled !== false); // Default to true if not explicitly false
        console.log('[DebugContext] Loaded preferences:', { enabled });
      } else {
        console.log('[DebugContext] No saved preferences, using default (enabled)');
      }
    } catch (e) {
      console.error("[DebugContext] Error parsing debug preferences:", e);
    }
  }, []);

  // Save preferences to local storage
  const savePreferences = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: isEnabled }));
      console.log('[DebugContext] Saved preferences:', { enabled: isEnabled });
    } catch (e) {
      console.error("[DebugContext] Error saving debug preferences:", e);
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
    setIsEnabled(prev => {
      const newState = !prev;
      console.log('[DebugContext] Debug mode toggled:', { newState });
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
  
  useEffect(() => {
    console.log('[DebugContext] Debug context initialized, enabled:', isEnabled);
    addEvent('DebugContext', 'Debug context initialized', 'info', { enabled: isEnabled });
  }, []);
  
  return (
    <DebugLogContext.Provider value={value}>
      {children}
    </DebugLogContext.Provider>
  );
};

// Hook to use the debug log context
export const useDebugLog = () => useContext(DebugLogContext);
