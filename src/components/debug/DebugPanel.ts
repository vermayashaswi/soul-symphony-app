
// Stub implementation with no-op functions that accept any arguments
export const debugLogger = {
  log: (...args: any[]) => {},
  logInfo: (...args: any[]) => {},
  logError: (...args: any[]) => {},
  logWarning: (...args: any[]) => {},
  setLastProfileError: (...args: any[]) => {}
};

export const logInfo = (...args: any[]) => {};
export const logError = (...args: any[]) => {};
export const logAuthError = (...args: any[]) => {};
export const logProfile = (...args: any[]) => {};
export const logAuth = (...args: any[]) => {};

// Empty component
const DebugPanel = () => null;
export default DebugPanel;
