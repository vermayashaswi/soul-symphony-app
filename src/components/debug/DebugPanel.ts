
// This file provides stub implementations for debugging functionality

export const debugLogger = {
  log: (level: 'info' | 'error' | 'warn', ...args: any[]) => {
    // Stub implementation - does nothing but prevents runtime errors
    console.log(`[Stub Debug] ${level}:`, ...args);
  },
  
  logInfo: (...args: any[]) => {
    console.log('[Stub Debug Info]:', ...args);
  },
  
  logError: (...args: any[]) => {
    console.error('[Stub Debug Error]:', ...args);
  },
  
  logWarning: (...args: any[]) => {},
  
  setLastProfileError: (_: any) => {}
};

export const logInfo = debugLogger.logInfo;
export const logError = debugLogger.logError;
export const logAuthError = (..._: any[]) => {};
export const logProfile = (..._: any[]) => {};
export const logAuth = (..._: any[]) => {};

// Create a null component for backward compatibility
const DebugPanel = () => null;
export default DebugPanel;
