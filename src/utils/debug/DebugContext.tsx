
import React, { createContext, useContext } from 'react';

// Create a simple no-op context
const DebugContext = createContext({
  logs: [],
  addLog: (...args: any[]) => {},
  addEvent: (...args: any[]) => {},
  clearLogs: () => {},
  isEnabled: false,
  toggleEnabled: () => {},
  getLogs: () => []
});

// Create a simple provider that doesn't do anything
export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <DebugContext.Provider value={{
      logs: [],
      addLog: () => {},
      addEvent: () => {},
      clearLogs: () => {},
      isEnabled: false,
      toggleEnabled: () => {},
      getLogs: () => []
    }}>
      {children}
    </DebugContext.Provider>
  );
};

// Hook for using the debug context
export const useDebugLog = () => useContext(DebugContext);
