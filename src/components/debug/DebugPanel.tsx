
// This file has been emptied as part of the Debug Mode removal.
// It remains in place to prevent import errors, but its functionality has been removed.

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'profile' | 'auth';

export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  source: string;
  timestamp: string;
  details?: any;
  stack?: string;
}

// Empty component that returns null
export default function DebugPanel() {
  return null;
}

// No-op functions
export const debugLogger = {
  setLastProfileError: (_: any) => {},
  log: (..._: any[]) => {},
  getLogs: () => [],
  clearLogs: () => {},
  setEnabled: () => {},
  isEnabled: () => false,
  subscribe: () => () => {},
  getFilteredLogs: () => [],
  getErrorCount: () => 0,
  getWarnCount: () => 0,
  getLastProfileError: () => null
};

export const logInfo = () => {};
export const logWarn = () => {};
export const logError = () => {};
export const logDebug = () => {};
export const logProfile = () => {};
export const logAuth = () => {};
export const logAuthError = () => {};
export const logRender = () => {};
export const logAPI = () => {};
export const logAction = () => {};
