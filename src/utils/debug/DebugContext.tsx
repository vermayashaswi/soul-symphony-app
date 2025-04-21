import React, { createContext, useContext, useState } from 'react';
import { DebugLogContextType, LogLevel } from './debugLogTypes';

// Define the debug step type
export type DebugStep = {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'error' | 'in-progress';
  timestamp?: number;
  details?: string;
  duration?: number;
};

// Create the context
const DebugContext = createContext<DebugLogContextType>({
  logs: [],
  addLog: (...args: any[]) => {},
  addEvent: (...args: any[]) => {},
  clearLogs: () => {},
  isEnabled: false,
  toggleEnabled: () => {},
  getLogs: () => [],
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

  const addEvent = (category: string, message: string, level: LogLevel = 'info', details?: any) => {
    if (!isEnabled) return;
    
    const timestamp = new Date();
    setLogs(prevLogs => [
      ...prevLogs,
      {
        id: timestamp.getTime() + Math.random().toString(36).substring(2, 9),
        event: category,
        message,
        level,
        timestamp: timestamp.toISOString(),
        details
      }
    ]);
    
    // Also log to console if enabled
    console.log(`[DEBUG][${level.toUpperCase()}][${category}]`, message, details || '');
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const toggleEnabled = () => {
    const newState = !isEnabled;
    localStorage.setItem('debugEnabled', newState.toString());
    setIsEnabled(newState);
  };

  // Add the getLogs method to get formatted logs
  const getLogs = () => {
    return logs.filter(log => log.event && log.message).map(log => ({
      id: log.id,
      event: log.event,
      message: log.message,
      level: log.level || 'info',
      timestamp: typeof log.timestamp === 'string' ? log.timestamp : new Date(log.timestamp).toISOString()
    }));
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
    getLogs
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
};

// Hook for using the debug context
export const useDebugLog = () => useContext(DebugContext);
