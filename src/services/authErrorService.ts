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

      // Don't block the UI if logging fails
      setTimeout(async () => {
        try {
          const { error } = await supabase
            .from('auth_errors')
            .insert({
              user_id: userId || null,
              error_type: errorType,
              error_message: errorMessage,
              context: context || null,
              resolved: false
            });

          if (error) {
            console.warn('[AuthErrorService] Failed to log auth error:', error);
          }
        } catch (logError) {
          console.warn('[AuthErrorService] Error logging auth error:', logError);
        }
      }, 0);
    } catch (error) {
      console.warn('[AuthErrorService] Failed to log auth error:', error);
    }
  }

  /**
   * Get auth errors for the current user
   */
  async getUserAuthErrors(): Promise<AuthError[]> {
    try {
      const { data, error } = await supabase
        .from('auth_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[AuthErrorService] Failed to fetch auth errors:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[AuthErrorService] Error fetching auth errors:', error);
      return [];
    }
  }

  /**
   * Mark an auth error as resolved
   */
  async resolveAuthError(errorId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('auth_errors')
        .update({
          resolved: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', errorId);

      if (error) {
        console.error('[AuthErrorService] Failed to resolve auth error:', error);
      }
    } catch (error) {
      console.error('[AuthErrorService] Error resolving auth error:', error);
    }
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