/**
 * Enhanced debugging service for authentication issues
 * Specifically designed to help with Android/Capacitor debugging
 */

export interface AuthDebugEvent {
  timestamp: string;
  event: string;
  context: string;
  data?: any;
  level: 'info' | 'warn' | 'error';
}

class AuthDebugService {
  private events: AuthDebugEvent[] = [];
  private maxEvents = 100;

  log(event: string, context: string, data?: any, level: 'info' | 'warn' | 'error' = 'info') {
    const debugEvent: AuthDebugEvent = {
      timestamp: new Date().toISOString(),
      event,
      context,
      data,
      level
    };

    this.events.unshift(debugEvent);
    
    // Keep only the most recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }

    // Also log to console with appropriate level
    const logMessage = `[${context}] ${event}`;
    switch (level) {
      case 'error':
        console.error(logMessage, data);
        break;
      case 'warn':
        console.warn(logMessage, data);
        break;
      default:
        console.log(logMessage, data);
    }
  }

  logError(message: string, context: string, error?: any) {
    this.log(message, context, { error: error?.message || error }, 'error');
  }

  logWarning(message: string, context: string, data?: any) {
    this.log(message, context, data, 'warn');
  }

  logInfo(message: string, context: string, data?: any) {
    this.log(message, context, data, 'info');
  }

  // Profile-specific logging
  logProfile(message: string, context: string, data?: any) {
    this.log(`PROFILE: ${message}`, context, data, 'info');
  }

  logProfileError(message: string, context: string, error?: any) {
    this.log(`PROFILE ERROR: ${message}`, context, { error: error?.message || error }, 'error');
  }

  // Native app specific logging
  logNative(message: string, context: string, data?: any) {
    this.log(`NATIVE: ${message}`, context, data, 'info');
  }

  // Authentication flow logging
  logAuthFlow(step: string, context: string, data?: any) {
    this.log(`AUTH_FLOW: ${step}`, context, data, 'info');
  }

  // Get recent events for debugging
  getRecentEvents(count = 20): AuthDebugEvent[] {
    return this.events.slice(0, count);
  }

  // Get events by context
  getEventsByContext(context: string, count = 10): AuthDebugEvent[] {
    return this.events.filter(event => event.context === context).slice(0, count);
  }

  // Get error events only
  getErrorEvents(count = 10): AuthDebugEvent[] {
    return this.events.filter(event => event.level === 'error').slice(0, count);
  }

  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify(this.events, null, 2);
  }

  // Clear logs
  clearLogs() {
    this.events = [];
    console.log('[AuthDebugService] Logs cleared');
  }

  // Check for specific error patterns
  hasRecentErrors(contextFilter?: string, timeMinutes = 5): boolean {
    const cutoffTime = new Date(Date.now() - timeMinutes * 60 * 1000);
    
    return this.events.some(event => {
      const eventTime = new Date(event.timestamp);
      const isRecent = eventTime > cutoffTime;
      const isError = event.level === 'error';
      const matchesContext = !contextFilter || event.context === contextFilter;
      
      return isRecent && isError && matchesContext;
    });
  }

  // Get authentication session info for debugging
  getAuthSessionInfo(): { hasUser: boolean; hasSession: boolean; isNative: boolean } {
    return {
      hasUser: false, // Will be set by calling code
      hasSession: false, // Will be set by calling code
      isNative: window.location.href.includes('capacitor://') || 
                (window as any).Capacitor?.isPluginAvailable('App')
    };
  }
}

export const authDebugService = new AuthDebugService();
