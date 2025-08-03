import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AuthError {
  id: string;
  user_id: string;
  error_type: string;
  error_message: string;
  context?: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

class AuthErrorService {
  private static instance: AuthErrorService;

  static getInstance(): AuthErrorService {
    if (!AuthErrorService.instance) {
      AuthErrorService.instance = new AuthErrorService();
    }
    return AuthErrorService.instance;
  }

  /**
   * Log an authentication error to the database
   */
  async logAuthError(
    errorType: string,
    errorMessage: string,
    context?: string,
    userId?: string
  ): Promise<void> {
    try {
      console.error(`[AuthError] ${errorType}:`, {
        message: errorMessage,
        context,
        userId,
        timestamp: new Date().toISOString()
      });

      // Log to console for debugging (database logging removed)
      setTimeout(() => {
        console.info('[AuthErrorService] Auth error logged:', {
          errorType,
          errorMessage,
          context,
          userId,
          timestamp: new Date().toISOString()
        });
      }, 0);
    } catch (error) {
      console.warn('[AuthErrorService] Failed to log auth error:', error);
    }
  }

  /**
   * Get auth errors for the current user (client-side only)
   */
  async getUserAuthErrors(): Promise<AuthError[]> {
    console.info('[AuthErrorService] Auth errors are now logged to console only');
    return [];
  }

  /**
   * Mark an auth error as resolved (client-side only)
   */
  async resolveAuthError(errorId: string): Promise<void> {
    console.info('[AuthErrorService] Error marked as resolved (client-side):', errorId);
  }

  /**
   * Enhanced error handling with user-friendly messages
   */
  handleAuthError(error: any, context: string = 'authentication'): void {
    let userMessage = 'Authentication failed. Please try again.';
    let errorType = 'auth_error';

    // Parse common authentication errors
    if (error?.message) {
      const message = error.message.toLowerCase();
      
      if (message.includes('network') || message.includes('connection')) {
        userMessage = 'Network error. Please check your connection and try again.';
        errorType = 'network_error';
      } else if (message.includes('timeout')) {
        userMessage = 'Authentication timed out. Please try again.';
        errorType = 'timeout_error';
      } else if (message.includes('cancelled') || message.includes('canceled')) {
        userMessage = 'Sign-in was cancelled.';
        errorType = 'user_cancelled';
      } else if (message.includes('invalid token') || message.includes('token')) {
        userMessage = 'Authentication token is invalid. Please try signing in again.';
        errorType = 'invalid_token';
      } else if (message.includes('configuration') || message.includes('client')) {
        userMessage = 'Authentication configuration error. Please contact support.';
        errorType = 'config_error';
      } else if (message.includes('not available') || message.includes('unavailable')) {
        userMessage = 'Authentication service is temporarily unavailable. Please try again later.';
        errorType = 'service_unavailable';
      }
    }

    // Log the error
    this.logAuthError(errorType, error?.message || 'Unknown error', context);

    // Show user-friendly toast (only if not cancelled)
    if (errorType !== 'user_cancelled') {
      toast.error(userMessage);
    } else {
      toast.info(userMessage);
    }
  }

  /**
   * Test auth flow and return debug information
   */
  async testAuthFlow(): Promise<any> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No user found');
      }

      // Call test function
      const { data, error } = await supabase.rpc('test_auth_flow', {
        test_user_id: user.id
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[AuthErrorService] Auth flow test failed:', error);
      this.logAuthError('test_auth_flow_failed', error.message, 'debug');
      throw error;
    }
  }

  /**
   * Debug user auth state
   */
  async debugUserAuth(): Promise<any> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No user found');
      }

      // Call debug function
      const { data, error } = await supabase.rpc('debug_user_auth', {
        target_user_id: user.id
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[AuthErrorService] Auth debug failed:', error);
      this.logAuthError('debug_user_auth_failed', error.message, 'debug');
      throw error;
    }
  }
}

export const authErrorService = AuthErrorService.getInstance();