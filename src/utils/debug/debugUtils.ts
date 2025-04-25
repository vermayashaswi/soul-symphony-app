
// All debug utilities disabled for production build
// Accept arguments but do nothing with them

export const debugLog = (..._: any[]) => {};
export const debugInfo = (..._: any[]) => {};
export const debugError = (..._: any[]) => {};
export const debugWarn = (..._: any[]) => {};
export const debugTrace = (..._: any[]) => {};

declare global {
  interface Window {
    debugEvents?: {
      log: (type: string, target: string, details?: any) => any;
      clear: () => void;
      events: () => any[];
    };
  }
}

export const createDebugger = (_: string) => ({
  log: (..._: any[]) => {},
  info: (..._: any[]) => {},
  error: (..._: any[]) => {},
  warn: (..._: any[]) => {},
  trace: (..._: any[]) => {},
});

export default {
  log: debugLog,
  info: debugInfo,
  error: debugError,
  warn: debugWarn,
  trace: debugTrace,
  create: createDebugger,
};
