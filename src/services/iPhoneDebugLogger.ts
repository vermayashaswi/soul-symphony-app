/**
 * iPhone-specific debug logging service for troubleshooting Smart Chat loading issues
 */

interface iPhoneDebugEntry {
  timestamp: string;
  stage: string;
  data: any;
  userAgent: string;
  isIPhone: boolean;
}

class IPhoneDebugLogger {
  private logs: iPhoneDebugEntry[] = [];
  private maxLogs = 50;

  private _isIPhoneCache: boolean | null = null;
  
  private isIPhoneDevice(): boolean {
    // Cache the result to avoid repeated user agent parsing
    if (this._isIPhoneCache === null) {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      this._isIPhoneCache = /iphone/i.test(userAgent.toLowerCase());
    }
    return this._isIPhoneCache;
  }

  log(stage: string, data: any = {}) {
    if (!this.isIPhoneDevice()) return; // Only log for iPhone devices

    const entry: iPhoneDebugEntry = {
      timestamp: new Date().toISOString(),
      stage,
      data: {
        ...data,
        currentUrl: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash
      },
      userAgent: navigator.userAgent,
      isIPhone: true
    };

    this.logs.unshift(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Console log for immediate debugging
    console.log(`[iPhone Debug] ${stage}:`, entry.data);

    // Store in localStorage for persistence
    this.saveLogs();
  }

  private saveLogs() {
    try {
      localStorage.setItem('iphone-debug-logs', JSON.stringify(this.logs));
    } catch (error) {
      console.warn('[iPhone Debug] Failed to save logs:', error);
    }
  }

  private loadLogs() {
    try {
      const stored = localStorage.getItem('iphone-debug-logs');
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[iPhone Debug] Failed to load logs:', error);
      this.logs = [];
    }
  }

  getLogs(): iPhoneDebugEntry[] {
    this.loadLogs();
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
    localStorage.removeItem('iphone-debug-logs');
    console.log('[iPhone Debug] Logs cleared');
  }

  // Specific logging methods for different stages
  logAuthStart(data: any = {}) {
    this.log('AUTH_START', data);
  }

  logAuthStateChange(event: string, hasUser: boolean, data: any = {}) {
    this.log('AUTH_STATE_CHANGE', { event, hasUser, ...data });
  }

  logSubscriptionCheck(data: any = {}) {
    this.log('SUBSCRIPTION_CHECK', data);
  }

  logSmartChatMount(data: any = {}) {
    this.log('SMART_CHAT_MOUNT', data);
  }

  logPremiumGuardCheck(data: any = {}) {
    this.log('PREMIUM_GUARD_CHECK', data);
  }

  logMobileDetection(data: any = {}) {
    this.log('MOBILE_DETECTION', data);
  }

  logLoadingTimeout(stage: string, timeoutMs: number) {
    this.log('LOADING_TIMEOUT', { stage, timeoutMs });
  }

  logError(stage: string, error: any) {
    this.log('ERROR', { 
      stage, 
      error: error.message || error,
      stack: error.stack,
      name: error.name
    });
  }

  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify(this.getLogs(), null, 2);
  }
}

export const iPhoneDebugLogger = new IPhoneDebugLogger();

// Expose to window for manual debugging
declare global {
  interface Window {
    iPhoneDebugLogger: typeof iPhoneDebugLogger;
  }
}

if (typeof window !== 'undefined') {
  window.iPhoneDebugLogger = iPhoneDebugLogger;
}
