
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

class DebugLogger {
  private static instance: DebugLogger;
  
  private constructor() {}
  
  public static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }
  
  public log(): void {}
  public getLogs(): LogEntry[] { return []; }
  public clearLogs(): void {}
  public setEnabled(): void {}
  public isEnabled(): boolean { return false; }
  public subscribe(): () => void { return () => {}; }
  public getFilteredLogs(): LogEntry[] { return []; }
  public getErrorCount(): number { return 0; }
  public getWarnCount(): number { return 0; }
  public setLastProfileError(): void {}
  public getLastProfileError(): string | null { return null; }
}

export const debugLogger = DebugLogger.getInstance();

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

export default function DebugPanel() {
  return null;
}
