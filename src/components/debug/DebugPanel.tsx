
// Simple debug logger utility for audio processing
export const debugLogger = {
  log: (level: 'info' | 'error' | 'warn', ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} ${level}:`, ...args);
  },
  
  logInfo: (...args: any[]) => {
    debugLogger.log('info', ...args);
  },
  
  logError: (...args: any[]) => {
    debugLogger.log('error', ...args);
  },
  
  logWarning: (...args: any[]) => {
    debugLogger.log('warn', ...args);
  }
};

// Re-export for backward compatibility
export const logInfo = debugLogger.logInfo;
export const logError = debugLogger.logError;
export const logWarning = debugLogger.logWarning;

const DebugPanel = () => {
  return null; // No UI for now
};

export default DebugPanel;
