
import React, { createContext, useContext, useState, useCallback } from 'react';

// Provide a context with active debug logic but simplified UI
export type DebugStep = {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'error' | 'in-progress' | 'warning';
  timestamp?: number;
  details?: string;
  duration?: number;
};

interface DebugContextType {
  logs: any[];
  addLog: (...args: any[]) => void;
  addEvent: (name: string, details?: string, type?: 'info' | 'error' | 'success' | 'warning', data?: any) => void;
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
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [recorderSteps, setRecorderSteps] = useState<DebugStep[]>([]);
  const [showRecorderDebug, setShowRecorderDebug] = useState<boolean>(false);

  // Add a log entry
  const addLog = useCallback((...args: any[]) => {
    if (!isEnabled) return;
    
    console.log(...args); // Always echo to console
    
    setLogs((currentLogs) => [
      ...currentLogs, 
      { 
        timestamp: new Date().toISOString(),
        content: args,
      }
    ]);
  }, [isEnabled]);

  // Add a structured event
  const addEvent = useCallback((name: string, details?: string, type: 'info' | 'error' | 'success' | 'warning' = 'info', data?: any) => {
    if (!isEnabled) return;
    
    // Log to console with appropriate styling
    const styles = {
      info: 'color: #3b82f6',
      error: 'color: #ef4444',
      success: 'color: #10b981',
      warning: 'color: #f59e0b'
    };
    
    if (data) {
      console.log(`%c[${name}]`, styles[type], details || '', data);
    } else {
      console.log(`%c[${name}]`, styles[type], details || '');
    }
    
    setLogs((currentLogs) => [
      ...currentLogs, 
      { 
        timestamp: new Date().toISOString(),
        type,
        name,
        details,
        data
      }
    ]);
  }, [isEnabled]);

  // Clear all logs
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Toggle debug mode
  const toggleEnabled = useCallback(() => {
    setIsEnabled((current) => !current);
  }, []);

  // Add a recorder step
  const addRecorderStep = useCallback((step: DebugStep) => {
    setRecorderSteps((currentSteps) => [...currentSteps, step]);
  }, []);

  // Update a recorder step
  const updateRecorderStep = useCallback((id: string, updates: Partial<DebugStep>) => {
    setRecorderSteps((currentSteps) => 
      currentSteps.map((step) => 
        step.id === id ? { ...step, ...updates } : step
      )
    );
  }, []);

  // Reset recorder steps
  const resetRecorderSteps = useCallback(() => {
    setRecorderSteps([]);
  }, []);

  // Toggle recorder debug visibility
  const toggleRecorderDebug = useCallback(() => {
    setShowRecorderDebug((current) => !current);
  }, []);

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
      toggleRecorderDebug
    }}>
      {children}
    </DebugContext.Provider>
  );
};

export const useDebugLog = () => useContext(DebugContext);
