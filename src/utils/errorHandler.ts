/**
 * Production-safe error handling utility
 */

import { logger } from './logger';

export interface ErrorReport {
  message: string;
  stack?: string;
  component?: string;
  timestamp: number;
  url: string;
  userAgent: string;
  userId?: string;
}

class ProductionErrorHandler {
  private isDevelopment = import.meta.env.DEV;

  // Handle JavaScript errors
  handleError(error: Error, component?: string, context?: any) {
    const errorReport: ErrorReport = {
      message: error.message,
      stack: error.stack,
      component,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    // Always log errors (they're filtered in logger)
    logger.error(
      `Error in ${component || 'unknown component'}: ${error.message}`,
      { error, context },
      component
    );

    // In production, you might want to send to error reporting service
    if (!this.isDevelopment) {
      this.reportToService(errorReport);
    }

    return errorReport;
  }

  // Handle async errors
  async handleAsyncError(
    operation: () => Promise<any>,
    component?: string,
    fallback?: any
  ) {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error as Error, component);
      return fallback;
    }
  }

  // Handle network errors
  handleNetworkError(error: any, endpoint: string, component?: string) {
    const message = `Network error at ${endpoint}: ${error.message || 'Unknown error'}`;
    
    logger.error(message, { error, endpoint }, component);

    // In production, you might want to retry or provide fallback
    if (!this.isDevelopment) {
      this.reportNetworkError(endpoint, error);
    }
  }

  // Report to external service (placeholder)
  private reportToService(errorReport: ErrorReport) {
    // In a real app, you'd send to services like Sentry, LogRocket, etc.
    // For now, we'll just store locally for potential batch sending
    try {
      const stored = localStorage.getItem('error_reports');
      const reports = stored ? JSON.parse(stored) : [];
      reports.push(errorReport);
      
      // Keep only last 10 reports
      if (reports.length > 10) {
        reports.splice(0, reports.length - 10);
      }
      
      localStorage.setItem('error_reports', JSON.stringify(reports));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  private reportNetworkError(endpoint: string, error: any) {
    // Similar to reportToService but for network issues
    logger.error('Network error reported', { endpoint, error });
  }

  // Global error handler setup
  setupGlobalHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        new Error(`Unhandled promise rejection: ${event.reason}`),
        'Global'
      );
    });

    // Handle global JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(
        new Error(`Global error: ${event.message}`),
        'Global',
        { filename: event.filename, line: event.lineno, column: event.colno }
      );
    });
  }
}

// Export singleton
export const errorHandler = new ProductionErrorHandler();

// Convenience functions
export const handleError = (error: Error, component?: string, context?: any) =>
  errorHandler.handleError(error, component, context);

export const handleAsyncError = (
  operation: () => Promise<any>,
  component?: string,
  fallback?: any
) => errorHandler.handleAsyncError(operation, component, fallback);

export const handleNetworkError = (error: any, endpoint: string, component?: string) =>
  errorHandler.handleNetworkError(error, endpoint, component);

// Setup global handlers
errorHandler.setupGlobalHandlers();
