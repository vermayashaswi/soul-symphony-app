
import React from 'react';

// This is a stub implementation that doesn't do any debug logging
export interface DebugEventType {
  id: string;
  type: string;
  message: string;
  details?: any;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
}

interface DebugContextType {
  events: DebugEventType[];
  addEvent: (type: string, message: string, level?: 'info' | 'warning' | 'error' | 'success', details?: any) => void;
  clearEvents: () => void;
  exportEvents: () => void;
}

export const DebugContext = React.createContext<DebugContextType>({
  events: [],
  addEvent: () => {},
  clearEvents: () => {},
  exportEvents: () => {},
});

export const DebugLogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Just return children, no actual debug functionality
  return <React.Fragment>{children}</React.Fragment>;
};

export const useDebugLog = (): DebugContextType => {
  return {
    events: [],
    addEvent: () => {},
    clearEvents: () => {},
    exportEvents: () => {},
  };
};
