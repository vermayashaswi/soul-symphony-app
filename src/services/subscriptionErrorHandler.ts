
import { toast } from 'sonner';

export interface SubscriptionError {
  type: 'network' | 'authentication' | 'permission' | 'unknown';
  message: string;
  code?: string;
  silent?: boolean;
}

class SubscriptionErrorHandler {
  private lastErrorTime: number = 0;
  private errorCooldown: number = 10000; // 10 seconds cooldown between error notifications
  private shownErrors: Set<string> = new Set();

  handleError(error: any, context: string = 'subscription'): SubscriptionError {
    const errorType = this.categorizeError(error);
    const errorKey = `${errorType.type}-${errorType.code || 'unknown'}`;
    
    // Check if we should show this error
    const now = Date.now();
    const shouldShow = this.shouldShowError(errorKey, now);
    
    if (shouldShow && !errorType.silent) {
      this.showErrorNotification(errorType, context);
      this.lastErrorTime = now;
      this.shownErrors.add(errorKey);
    }
    
    // Log all errors for debugging
    console.warn(`[${context}] Subscription error:`, {
      type: errorType.type,
      message: errorType.message,
      code: errorType.code,
      originalError: error,
      shown: shouldShow
    });
    
    return errorType;
  }

  private categorizeError(error: any): SubscriptionError {
    // Network-related errors
    if (error?.message?.includes('fetch') || error?.message?.includes('network') || error?.code === 'NETWORK_ERROR') {
      return {
        type: 'network',
        message: 'Unable to check subscription status due to network issues',
        code: 'NETWORK_ERROR',
        silent: true // Don't show network errors to users
      };
    }

    // Authentication errors
    if (error?.message?.includes('auth') || error?.message?.includes('401') || error?.code === 'UNAUTHORIZED') {
      return {
        type: 'authentication',
        message: 'Authentication required to check subscription',
        code: 'AUTH_ERROR',
        silent: true // Don't show auth errors during normal flow
      };
    }

    // Permission errors
    if (error?.message?.includes('permission') || error?.message?.includes('403') || error?.code === 'FORBIDDEN') {
      return {
        type: 'permission',
        message: 'Permission denied accessing subscription data',
        code: 'PERMISSION_ERROR',
        silent: true
      };
    }

    // RevenueCat specific errors that should be silent
    if (error?.message?.includes('RevenueCat') || error?.message?.includes('purchases')) {
      return {
        type: 'unknown',
        message: 'Subscription service temporarily unavailable',
        code: 'REVENUECAT_ERROR',
        silent: true
      };
    }

    // Unknown errors - only show if critical
    return {
      type: 'unknown',
      message: error?.message || 'An unexpected error occurred with subscription service',
      code: 'UNKNOWN_ERROR',
      silent: true // Default to silent for unknown errors
    };
  }

  private shouldShowError(errorKey: string, now: number): boolean {
    // Don't show if we've already shown this error type
    if (this.shownErrors.has(errorKey)) {
      return false;
    }

    // Don't show if we're in cooldown period
    if (now - this.lastErrorTime < this.errorCooldown) {
      return false;
    }

    return true;
  }

  private showErrorNotification(error: SubscriptionError, context: string) {
    toast.error(`${context}: ${error.message}`, {
      duration: 5000,
      description: error.code ? `Error code: ${error.code}` : undefined
    });
  }

  // Reset error tracking (useful for testing or when user logs out)
  reset() {
    this.shownErrors.clear();
    this.lastErrorTime = 0;
  }

  // Check if an error type should be completely ignored
  shouldIgnoreError(error: any): boolean {
    const errorStr = JSON.stringify(error).toLowerCase();
    
    // Ignore common RevenueCat initialization errors
    if (errorStr.includes('revenuecat') || errorStr.includes('purchases')) {
      return true;
    }

    // Ignore network errors during app startup
    if (errorStr.includes('fetch') || errorStr.includes('network')) {
      return true;
    }

    return false;
  }
}

export const subscriptionErrorHandler = new SubscriptionErrorHandler();
