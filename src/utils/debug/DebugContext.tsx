
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { createLogEntry } from './debugUtils';
import { DebugLogContextType, DebugLogEntry, LogLevel } from './debugLogTypes';

// Create the context with a default value
const DebugLogContext = createContext<DebugLogContextType>({
  logs: [],
  addEvent: () => {},
  addLog: () => {},
  clearLogs: () => {},
  isEnabled: false,
  toggleEnabled: () => {}
});

// Debug provider component - now a simple pass-through
export const DebugLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // The context value - all functions are now no-ops
  const value = {
    logs: [],
    addEvent: () => {},
    addLog: () => {},
    clearLogs: () => {},
    isEnabled: false,
    toggleEnabled: () => {}
  };
  
  return (
    <DebugLogContext.Provider value={value}>
      {children}
    </DebugLogContext.Provider>
  );
};

// Hook to use the debug log context
export const useDebugLog = () => useContext(DebugLogContext);
