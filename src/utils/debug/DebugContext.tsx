import React, { createContext, useContext, useState } from 'react';

// Provide a context with debugging functionality
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

// Create a debugging context
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
  const [logs, setLogs] = useState<any[]>([]);
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [recorderSteps, setRecorderSteps] = useState<DebugStep[]>([]);
  const [showRecorderDebug, setShowRecorderDebug] = useState<boolean>(false);

  const addLog = (...args: any[]) => {
    setLogs(prevLogs => [...prevLogs, ...args]);
    console.log(...args);
  };

  const addEvent = (...args: any[]) => {
    setLogs(prevLogs => [...prevLogs, { event: args }]);
    console.debug('Event:', ...args);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const toggleEnabled = () => {
    setIsEnabled(prev => !prev);
  };

  const addRecorderStep = (step: DebugStep) => {
    setRecorderSteps(prevSteps => [...prevSteps, { ...step, timestamp: Date.now() }]);
  };

  const updateRecorderStep = (id: string, updates: Partial<DebugStep>) => {
    setRecorderSteps(prevSteps =>
      prevSteps.map(step => (step.id === id ? { ...step, ...updates, duration: Date.now() - (step.timestamp || Date.now()) } : step))
    );
  };

  const resetRecorderSteps = () => {
    setRecorderSteps([]);
  };

  const toggleRecorderDebug = () => {
    setShowRecorderDebug(prev => !prev);
  };

  return (
    <DebugContext.Provider value={{
      logs,
      addLog,
      addEvent,
      clearLogs,
      isEnabled,
      toggleEnabled,
      recorderSteps,
      addRecorderStep,
      updateRecorderStep,
      resetRecorderSteps,
      showRecorderDebug,
      toggleRecorderDebug,
    }}>
      {children}
    </DebugContext.Provider>
  );
};

export const useDebugLog = () => useContext(DebugContext);
