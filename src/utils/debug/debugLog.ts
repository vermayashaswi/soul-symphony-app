
/**
 * Debug logger utility
 */

// Enable debug logging
const DEBUG_ENABLED = true;

/**
 * Log debug messages to console with timestamp
 */
export function debugLog(message: string, data?: any): void {
  if (!DEBUG_ENABLED) return;
  
  const timestamp = new Date().toISOString();
  
  if (data) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

/**
 * Create a logger with a specific prefix
 */
export function createPrefixedLogger(prefix: string) {
  return {
    log: (message: string, data?: any) => debugLog(`[${prefix}] ${message}`, data),
    error: (message: string, error?: any) => {
      if (!DEBUG_ENABLED) return;
      
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [${prefix}] ERROR: ${message}`, error);
    },
    warn: (message: string, data?: any) => {
      if (!DEBUG_ENABLED) return;
      
      const timestamp = new Date().toISOString();
      console.warn(`[${timestamp}] [${prefix}] WARNING: ${message}`, data);
    }
  };
}

/**
 * Manually reset the debug state
 */
export function resetDebugState(): void {
  if (!DEBUG_ENABLED) return;
  
  console.clear();
  console.log(`[${new Date().toISOString()}] Debug state reset`);
}
