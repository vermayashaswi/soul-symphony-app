
// Empty debug panel export with no-op functions that accept arguments but do nothing
export const debugLogger = {
  log: (..._: any[]) => {},
  logInfo: (..._: any[]) => {},
  logError: (..._: any[]) => {},
  logWarning: (..._: any[]) => {},
  setLastProfileError: (..._: any[]) => {}
};

// Define these functions to accept parameters but do nothing with them
export const logInfo = (..._: any[]) => {};
export const logError = (..._: any[]) => {};
export const logAuthError = (..._: any[]) => {};
export const logProfile = (..._: any[]) => {};
export const logAuth = (..._: any[]) => {};

const DebugPanel = () => null;
export default DebugPanel;
