
// No-op debugging utilities that accept any arguments

export const debugLog = (...args: any[]) => {};
export const debugInfo = (...args: any[]) => {};
export const debugError = (...args: any[]) => {};
export const debugWarn = (...args: any[]) => {};
export const debugTrace = (...args: any[]) => {};

export const createDebugger = (namespace: string) => ({
  log: (...args: any[]) => {},
  info: (...args: any[]) => {},
  error: (...args: any[]) => {},
  warn: (...args: any[]) => {},
  trace: (...args: any[]) => {},
});

export default {
  log: debugLog,
  info: debugInfo,
  error: debugError,
  warn: debugWarn,
  trace: debugTrace,
  create: createDebugger,
};
