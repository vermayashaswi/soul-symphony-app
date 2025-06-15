
import React, { createContext, useContext, useState } from 'react';
import { logger } from '@/utils/logger';

// Production-safe debug context
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
  const [logs, setLogs] = useState<any[]>([]);
  const [isEnabled, setIsEnabled] = useState<boolean>(import.meta.env.DEV);
  const [recorderSteps, setRecorderSteps] = useState<DebugStep[]>([]);
  const [showRecorderDebug, setShowRecorderDebug] = useState<boolean>(false);

  const addLog = (...args: any[]) => {
    const logEntry = args.join(' ');
    setLogs(prevLogs => [...prevLogs, logEntry]);
    logger.debug(logEntry, undefined, 'DebugContext');
  };

  const addEvent = (...args: any[]) => {
    const eventData = { event: args };
    setLogs(prevLogs => [...prevLogs, eventData]);
    logger.debug('Event:', args, 'DebugContext');
  };

  const clearLogs = () => {
    setLogs([]);
    logger.clearLogs();
  };

  const toggleEnabled = () => {
    setIsEnabled(prev => !prev);
  };

  const addRecorderStep = (step: DebugStep) => {
    setRecorderSteps(prevSteps => [...prevSteps, { ...step, timestamp: Date.now() }]);
    logger.debug('Recorder step added', step, 'Recorder');
  };

  const updateRecorderStep = (id: string, updates: Partial<DebugStep>) => {
    setRecorderSteps(prevSteps =>
      prevSteps.map(step => (step.id === id ? { ...step, ...updates, duration: Date.now() - (step.timestamp || Date.now()) } : step))
    );
    logger.debug('Recorder step updated', { id, updates }, 'Recorder');
  };

  const resetRecorderSteps = () => {
    setRecorderSteps([]);
    logger.debug('Recorder steps reset', undefined, 'Recorder');
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
