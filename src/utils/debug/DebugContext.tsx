
import React, { createContext, useContext, ReactNode } from 'react';
import { DebugLogContextType } from './debugLogTypes';

// Create a stub context with no-op functions
const DebugLogContext = createContext<DebugLogContextType>({
  logs: [],
  addEvent: () => {},
  addLog: () => {},
  clearLogs: () => {},
  isEnabled: false,
  toggleEnabled: () => {}
});

// Stub provider that doesn't actually do anything
export const DebugLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// Hook that returns the stub implementation
export const useDebugLog = () => useContext(DebugLogContext);
