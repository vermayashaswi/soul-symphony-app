
/**
 * Production-safe logging utility
 * Only logs in development environment, silently ignores in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: number;
  component?: string;
}

class ProductionLogger {
  private isDevelopment = import.meta.env.DEV;
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Keep last 100 logs in memory for debugging

  private shouldLog(level: LogLevel): boolean {
    // In production, only log errors for critical debugging
    if (!this.isDevelopment) {
      return level === 'error';
    }
    return true;
  }

  private addToMemory(entry: LogEntry) {
    if (this.logs.length >= this.maxLogs) {
      this.logs.shift();
    }
    this.logs.push(entry);
  }

  debug(message: string, data?: any, component?: string) {
    const entry: LogEntry = {
      level: 'debug',
      message,
      data,
      timestamp: Date.now(),
      component
    };

    this.addToMemory(entry);

    if (this.shouldLog('debug')) {
      const prefix = component ? `[${component}]` : '[Debug]';
      if (data) {
        console.debug(prefix, message, data);
      } else {
        console.debug(prefix, message);
      }
    }
  }

  info(message: string, data?: any, component?: string) {
    const entry: LogEntry = {
      level: 'info',
      message,
      data,
      timestamp: Date.now(),
      component
    };

    this.addToMemory(entry);

    if (this.shouldLog('info')) {
      const prefix = component ? `[${component}]` : '[Info]';
      if (data) {
        console.info(prefix, message, data);
      } else {
        console.info(prefix, message);
      }
    }
  }

  warn(message: string, data?: any, component?: string) {
    const entry: LogEntry = {
      level: 'warn',
      message,
      data,
      timestamp: Date.now(),
      component
    };

    this.addToMemory(entry);

    if (this.shouldLog('warn')) {
      const prefix = component ? `[${component}]` : '[Warning]';
      if (data) {
        console.warn(prefix, message, data);
      } else {
        console.warn(prefix, message);
      }
    }
  }

  error(message: string, error?: any, component?: string) {
    const entry: LogEntry = {
      level: 'error',
      message,
      data: error,
      timestamp: Date.now(),
      component
    };

    this.addToMemory(entry);

    if (this.shouldLog('error')) {
      const prefix = component ? `[${component}]` : '[Error]';
      if (error) {
        console.error(prefix, message, error);
      } else {
        console.error(prefix, message);
      }
    }
  }

  // Get logs for debugging (only available in development)
  getLogs(): LogEntry[] {
    return this.isDevelopment ? [...this.logs] : [];
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
  }

  // Create component-specific logger
  createComponentLogger(componentName: string) {
    return {
      debug: (message: string, data?: any) => this.debug(message, data, componentName),
      info: (message: string, data?: any) => this.info(message, data, componentName),
      warn: (message: string, data?: any) => this.warn(message, data, componentName),
      error: (message: string, error?: any) => this.error(message, error, componentName)
    };
  }
}

// Export singleton instance
export const logger = new ProductionLogger();

// Export individual methods for convenience
export const { debug, info, warn, error } = logger;

// Export component logger creator
export const createLogger = (componentName: string) => logger.createComponentLogger(componentName);

// Utility for performance logging (only in development)
export const performanceLog = (label: string, fn: () => void) => {
  if (!import.meta.env.DEV) {
    fn();
    return;
  }

  const start = performance.now();
  fn();
  const end = performance.now();
  logger.debug(`Performance: ${label} took ${(end - start).toFixed(2)}ms`);
};

// Export types
export type { LogLevel, LogEntry };
