
import React, { createContext, useContext, useState } from 'react';

// Define the debug step type
export type DebugStep = {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'error' | 'in-progress';
  timestamp?: number;
  details?: string;
  duration?: number;
};

// Define the context type
interface DebugContextType {
  logs: any[];
  addLog: (...args: any[]) => void;
  addEvent: (...args: any[]) => void;
  clearLogs: () => void;
  isEnabled: boolean;
  toggleEnabled: () => void;
  // Voice recorder debugging
  recorderSteps: DebugStep[];
  addRecorderStep: (step: DebugStep) => void;
  updateRecorderStep: (id: string, updates: Partial<DebugStep>) => void;
  resetRecorderSteps: () => void;
  showRecorderDebug: boolean;
  toggleRecorderDebug: () => void;
}

// Create the context
const DebugContext = createContext<DebugContextType>({
  logs: [],
  addLog: (...args: any[]) => {},
  addEvent: (...args: any[]) => {},
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

// Create the provider component
export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isEnabled, setIsEnabled] = useState<boolean>(
    localStorage.getItem('debugEnabled') === 'true'
  );
  const [recorderSteps, setRecorderSteps] = useState<DebugStep[]>([]);
  const [showRecorderDebug, setShowRecorderDebug] = useState<boolean>(
    localStorage.getItem('showRecorderDebug') === 'true'
  );

  const addLog = (...args: any[]) => {
    if (!isEnabled) return;
    
    const timestamp = new Date();
    setLogs(prevLogs => [
      ...prevLogs,
      {
        id: timestamp.getTime() + Math.random().toString(36).substring(2, 9),
        timestamp,
        data: args,
      }
    ]);
    
    // Also log to console if enabled
    if (isEnabled) {
      console.log('[DEBUG]', ...args);
    }
  };

  const addEvent = (...args: any[]) => {
    addLog('[EVENT]', ...args);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const toggleEnabled = () => {
    const newState = !isEnabled;
    localStorage.setItem('debugEnabled', newState.toString());
    setIsEnabled(newState);
  };

  // Voice recorder debug methods
  const addRecorderStep = (step: DebugStep) => {
    setRecorderSteps(prev => [...prev, {
      ...step,
      timestamp: step.timestamp || Date.now()
    }]);
  };

  const updateRecorderStep = (id: string, updates: Partial<DebugStep>) => {
    setRecorderSteps(prev => {
      const index = prev.findIndex(step => step.id === id);
      if (index === -1) return prev;

      const newSteps = [...prev];
      newSteps[index] = {
        ...newSteps[index],
        ...updates,
        ...(updates.status === 'success' && !updates.duration && newSteps[index].timestamp 
          ? { duration: (Date.now() - newSteps[index].timestamp!) / 1000 }
          : {})
      };
      return newSteps;
    });
  };

  const resetRecorderSteps = () => {
    setRecorderSteps([]);
  };

  const toggleRecorderDebug = () => {
    const newState = !showRecorderDebug;
    localStorage.setItem('showRecorderDebug', newState.toString());
    setShowRecorderDebug(newState);
  };

  const value = {
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
    toggleRecorderDebug
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
};

// Hook for using the debug context
export const useDebugLog = () => useContext(DebugContext);
