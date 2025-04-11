
/**
 * Types for the debug logger
 */
export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export type DebugLogEntry = {
  id: string;
  timestamp: number;
  category: string;
  message: string;
  level: LogLevel;
  details?: any;
};

export type DebugLogState = {
  entries: DebugLogEntry[];
  enabled: boolean;
};

export type DebugLogContextType = {
  logs: DebugLogEntry[];
  addEvent: (category: string, message: string, level: LogLevel, details?: any) => void;
  addLog: (category: string, message: string, level: LogLevel, details?: any) => void; // Added for backwards compatibility
  clearLogs: () => void;
  isEnabled: boolean;
  toggleEnabled: () => void;
};
