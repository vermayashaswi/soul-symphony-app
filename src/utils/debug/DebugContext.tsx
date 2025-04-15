
import React, { createContext, useContext, useState } from 'react';

// Define the context type
interface DebugContextType {
  logs: any[];
  addLog: (...args: any[]) => void;
  addEvent: (...args: any[]) => void;
  clearLogs: () => void;
  isEnabled: boolean;
  toggleEnabled: () => void;
}

// Create a stub context with no-op functions
const DebugContext = createContext<DebugContextType>({
  logs: [],
  addLog: (...args: any[]) => {},
  addEvent: (...args: any[]) => {},
  clearLogs: () => {},
  isEnabled: false,
  toggleEnabled: () => {},
});

// Stub provider component
export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <DebugContext.Provider
      value={{
        logs: [],
        addLog: (...args: any[]) => {},
        addEvent: (...args: any[]) => {},
        clearLogs: () => {},
        isEnabled: false,
        toggleEnabled: () => {},
      }}
    >
      {children}
    </DebugContext.Provider>
  );
};

// Stub hook
export const useDebugLog = () => useContext(DebugContext);
