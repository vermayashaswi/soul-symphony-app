/**
 * Production-safe logging utility
 * Automatically disables debug/info logs in production while preserving error logs
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  userId?: string;
  timestamp?: string;
  [key: string]: any;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private minLevel: LogLevel = this.isDevelopment ? 'debug' : 'error';

  private getLevelPriority(level: LogLevel): number {
    const priorities = { debug: 0, info: 1, warn: 2, error: 3 };
    return priorities[level];
  }

  private shouldLog(level: LogLevel): boolean {
    return this.getLevelPriority(level) >= this.getLevelPriority(this.minLevel);
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const component = context?.component ? `[${context.component}]` : '';
    return `${timestamp} ${level.toUpperCase()}:${component} ${message}`;
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;
    console.log(this.formatMessage('debug', message, context), context || '');
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;
    console.log(this.formatMessage('info', message, context), context || '');
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;
    console.warn(this.formatMessage('warn', message, context), context || '');
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    if (!this.shouldLog('error')) return;
    console.error(this.formatMessage('error', message, context), error || '', context || '');
  }

  // Create component-specific logger
  createLogger(component: string) {
    return {
      debug: (message: string, context?: LogContext) => 
        this.debug(message, { ...context, component }),
      info: (message: string, context?: LogContext) => 
        this.info(message, { ...context, component }),
      warn: (message: string, context?: LogContext) => 
        this.warn(message, { ...context, component }),
      error: (message: string, error?: Error | any, context?: LogContext) => 
        this.error(message, error, { ...context, component }),
    };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default for backwards compatibility
export default logger;