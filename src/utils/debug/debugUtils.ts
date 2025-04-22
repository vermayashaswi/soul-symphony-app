
// All debug utilities disabled for production build

export const debugLog = () => {};
export const debugInfo = () => {};
export const debugError = () => {};
export const debugWarn = () => {};
export const debugTrace = () => {};

export const createDebugger = (_: string) => ({
  log: () => {},
  info: () => {},
  error: () => {},
  warn: () => {},
  trace: () => {},
});

export default {
  log: debugLog,
  info: debugInfo,
  error: debugError,
  warn: debugWarn,
  trace: debugTrace,
  create: createDebugger,
};
