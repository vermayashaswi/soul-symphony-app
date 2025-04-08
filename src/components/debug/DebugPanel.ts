
// This file has been emptied as part of the Debug Mode removal.
// It's kept in place to prevent import errors, but all functionality has been removed.

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

export const logInfo = (..._: any[]) => {};
export const logError = (..._: any[]) => {};
export const logAuthError = (..._: any[]) => {};
export const logProfile = (..._: any[]) => {};
export const logAuth = (..._: any[]) => {};
export const logWarn = (..._: any[]) => {};
export const logDebug = (..._: any[]) => {};
export const logRender = (..._: any[]) => {};
export const logAPI = (..._: any[]) => {};
export const logAction = (..._: any[]) => {};

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
