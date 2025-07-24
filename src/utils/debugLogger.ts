/**
 * Enhanced Debug Logger for Auth Issues
 * Provides comprehensive logging for debugging auth flows
 */

export interface AuthDebugInfo {
  timestamp: string;
  context: string;
  sessionExists: boolean;
  userExists: boolean;
  sessionValid: boolean;
  currentPath: string;
  isNative: boolean;
  sessionKey?: string;
  error?: string;
  additionalData?: Record<string, any>;
}

class DebugLogger {
  private static instance: DebugLogger;
  private logs: AuthDebugInfo[] = [];
  private maxLogs = 50;

  private constructor() {}

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  log(context: string, data: Partial<AuthDebugInfo>, error?: string) {
    const logEntry: AuthDebugInfo = {
      timestamp: new Date().toISOString(),
      context,
      sessionExists: data.sessionExists ?? false,
      userExists: data.userExists ?? false,
      sessionValid: data.sessionValid ?? false,
      currentPath: window.location.pathname,
      isNative: this.isNativeApp(),
      sessionKey: data.sessionKey,
      error,
      additionalData: data.additionalData
    };

    this.logs.push(logEntry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output with structured format
    const logLevel = error ? 'error' : 'info';
    console[logLevel](`[AuthDebug:${context}]`, {
      ...logEntry,
      sessionSummary: {
        exists: data.sessionExists,
        valid: data.sessionValid,
        user: data.userExists
      }
    });
  }

  logNavigationAttempt(context: string, targetPath: string, options?: any) {
    this.log(`Navigation:${context}`, {
      additionalData: { targetPath, options }
    });
  }

  logSessionValidation(context: string, session: any, isValid: boolean) {
    this.log(`SessionValidation:${context}`, {
      sessionExists: !!session,
      userExists: !!session?.user,
      sessionValid: isValid,
      sessionKey: session ? 'detected' : 'none',
      additionalData: {
        hasAccessToken: !!session?.access_token,
        hasRefreshToken: !!session?.refresh_token,
        expiresAt: session?.expires_at
      }
    });
  }

  logError(context: string, error: any, additionalData?: Record<string, any>) {
    this.log(context, {
      additionalData: {
        ...additionalData,
        errorType: error?.constructor?.name,
        errorMessage: error?.message
      }
    }, error?.message || String(error));
  }

  getLogs(): AuthDebugInfo[] {
    return [...this.logs];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  clearLogs() {
    this.logs = [];
    console.log('[AuthDebug] Logs cleared');
  }

  private isNativeApp(): boolean {
    return !!(window as any).Capacitor;
  }
}

export const debugLogger = DebugLogger.getInstance();
