
// Stub implementation with no-op functions
export const debugLogger = {
  log: () => {},
  setLastProfileError: () => {}
};

// Export stub functions for backward compatibility
export const logInfo = () => {};
export const logError = () => {};
export const logAuthError = () => {};
export const logProfile = () => {};
export const logAuth = () => {};

// Empty component
const DebugPanel = () => null;
export default DebugPanel;
