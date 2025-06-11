
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
    try {
      setLogs(prevLogs => [...prevLogs, ...args]);
      console.log(...args);
    } catch (error) {
      console.error('Debug log error:', error);
    }
  };

  const addEvent = (...args: any[]) => {
    try {
      setLogs(prevLogs => [...prevLogs, { event: args }]);
      console.debug('Event:', ...args);
    } catch (error) {
      console.error('Debug event error:', error);
    }
  };

  const clearLogs = () => {
    try {
      setLogs([]);
    } catch (error) {
      console.error('Clear logs error:', error);
    }
  };

  const toggleEnabled = () => {
    try {
      setIsEnabled(prev => !prev);
    } catch (error) {
      console.error('Toggle enabled error:', error);
    }
  };

  const addRecorderStep = (step: DebugStep) => {
    try {
      setRecorderSteps(prevSteps => [...prevSteps, { ...step, timestamp: Date.now() }]);
    } catch (error) {
      console.error('Add recorder step error:', error);
    }
  };

  const updateRecorderStep = (id: string, updates: Partial<DebugStep>) => {
    try {
      setRecorderSteps(prevSteps =>
        prevSteps.map(step => (step.id === id ? { ...step, ...updates, duration: Date.now() - (step.timestamp || Date.now()) } : step))
      );
    } catch (error) {
      console.error('Update recorder step error:', error);
    }
  };

  const resetRecorderSteps = () => {
    try {
      setRecorderSteps([]);
    } catch (error) {
      console.error('Reset recorder steps error:', error);
    }
  };

  const toggleRecorderDebug = () => {
    try {
      setShowRecorderDebug(prev => !prev);
    } catch (error) {
      console.error('Toggle recorder debug error:', error);
    }
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

export const useDebugLog = () => {
  try {
    return useContext(DebugContext);
  } catch (error) {
    console.error('useDebugLog error:', error);
    return {
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
    };
  }
};
