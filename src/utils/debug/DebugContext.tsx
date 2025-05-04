
import React, { createContext, useContext } from 'react';

// Provide a context with no active debug logic or UI
export type DebugStep = {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'error' | 'in-progress';
  timestamp?: number;
  details?: string;
  duration?: number;
};

interface DebugContextType {
  logs: any[];
  addLog: (...args: any[]) => void;
  addEvent: (...args: any[]) => void;
  clearLogs: () => void;
  isEnabled: boolean;
  toggleEnabled: () => void;
  recorderSteps: DebugStep[];
  addRecorderStep: (step: DebugStep) => void;
  updateRecorderStep: (id: string, updates: Partial<DebugStep>) => void;
  resetRecorderSteps: () => void;
  showRecorderDebug: boolean;
  toggleRecorderDebug: () => void;
}

const DebugContext = createContext<DebugContextType>({
  logs: [],
  addLog: () => {},
  addEvent: () => {},
  clearLogs: () => {},
  isEnabled: false,
  toggleEnabled: () => {},
  recorderSteps: [],
  addRecorderStep: () => {},
  updateRecorderStep: () => {},
  resetRecorderSteps: () => {},
  showRecorderDebug: false,
  toggleRecorderDebug: () => {},
});

export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <DebugContext.Provider value={{
    logs: [],
    addLog: () => {},
    addEvent: () => {},
    clearLogs: () => {},
    isEnabled: false,
    toggleEnabled: () => {},
    recorderSteps: [],
    addRecorderStep: () => {},
    updateRecorderStep: () => {},
    resetRecorderSteps: () => {},
    showRecorderDebug: false,
    toggleRecorderDebug: () => {},
  }}>{children}</DebugContext.Provider>;
};

export const useDebugLog = () => useContext(DebugContext);
