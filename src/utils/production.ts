/**
 * Production environment optimizations and utilities
 */

// Check if we're in production
export const isProduction = import.meta.env.PROD;
export const isDevelopment = import.meta.env.DEV;

// Production-safe console replacement
export const productionConsole = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // Always allow errors, but sanitize in production
    if (isDevelopment) {
      console.error(...args);
    } else {
      // In production, log minimal error info
      console.error('An error occurred');
    }
  },
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  }
};

// Performance monitoring (only in development)
export const performanceMonitor = {
  mark: (name: string) => {
    if (isDevelopment && 'performance' in window) {
      performance.mark(name);
    }
  },
  measure: (name: string, startMark: string, endMark?: string) => {
    if (isDevelopment && 'performance' in window) {
      try {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name, 'measure')[0];
        console.log(`Performance: ${name} took ${measure.duration.toFixed(2)}ms`);
      } catch (e) {
        // Ignore performance errors
      }
    }
  }
};

// Network request sanitization
export const sanitizeNetworkRequest = (url: string, options?: RequestInit) => {
  // In production, remove sensitive headers and data
  if (isProduction && options) {
    const sanitizedOptions = { ...options };
    
    // Remove authorization headers from logs
    if (sanitizedOptions.headers) {
      const headers = new Headers(sanitizedOptions.headers);
      headers.delete('authorization');
      headers.delete('x-api-key');
      sanitizedOptions.headers = headers;
    }
    
    return { url: url.replace(/\/\/.*@/, '//***@'), options: sanitizedOptions };
  }
  
  return { url, options };
};

// Error reporting for production
export const reportError = (error: Error, context?: string) => {
  if (isProduction) {
    // In a real app, send to error reporting service
    // For now, store locally
    try {
      const errorData = {
        message: error.message,
        stack: error.stack?.substring(0, 500), // Limit stack trace
        context,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent.substring(0, 100) // Limit user agent
      };
      
      const stored = localStorage.getItem('production_errors');
      const errors = stored ? JSON.parse(stored) : [];
      errors.push(errorData);
      
      // Keep only last 5 errors
      if (errors.length > 5) {
        errors.splice(0, errors.length - 5);
      }
      
      localStorage.setItem('production_errors', JSON.stringify(errors));
    } catch (e) {
      // Ignore storage errors
    }
  }
};

// Analytics wrapper (production-safe)
export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    if (isProduction) {
      // In a real app, send to analytics service
      // For now, just store the event type
      try {
        const eventData = {
          event,
          timestamp: Date.now(),
          // Don't store sensitive properties in production
          properties: properties ? Object.keys(properties) : undefined
        };
        
        const stored = localStorage.getItem('analytics_events');
        const events = stored ? JSON.parse(stored) : [];
        events.push(eventData);
        
        // Keep only last 10 events
        if (events.length > 10) {
          events.splice(0, events.length - 10);
        }
        
        localStorage.setItem('analytics_events', JSON.stringify(events));
      } catch (e) {
        // Ignore storage errors
      }
    } else {
      console.log('Analytics event:', event, properties);
    }
  }
};

// Feature flags for production
export const featureFlags = {
  isEnabled: (flag: string): boolean => {
    // In development, all features are enabled
    if (isDevelopment) {
      return true;
    }
    
    // In production, check environment variables or remote config
    const enabledFlags = import.meta.env.VITE_ENABLED_FEATURES?.split(',') || [];
    return enabledFlags.includes(flag);
  }
};

// Memory usage monitoring (development only)
export const memoryMonitor = {
  log: () => {
    if (isDevelopment && 'performance' in window && 'memory' in (performance as any)) {
      const memory = (performance as any).memory;
      console.log('Memory usage:', {
        used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
      });
    }
  }
};
