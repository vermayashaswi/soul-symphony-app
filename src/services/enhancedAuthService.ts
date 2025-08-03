import { supabase } from '@/integrations/supabase/client';

import * as authService from './authService';
import { toast } from 'sonner';

export interface AuthRetryConfig {
  maxRetries: number;
  retryDelay: number;
  timeoutMs: number;
}

class EnhancedAuthService {
  private static instance: EnhancedAuthService;
  private retryConfig: AuthRetryConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    timeoutMs: 30000
  };

  static getInstance(): EnhancedAuthService {
    if (!EnhancedAuthService.instance) {
      EnhancedAuthService.instance = new EnhancedAuthService();
    }
    return EnhancedAuthService.instance;
  }

  /**
   * Enhanced sign-in with retry logic and comprehensive error handling
   */
  async signInWithRetry(
    method: 'google' | 'apple' | 'email',
    credentials?: { email: string; password: string }
  ): Promise<void> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        console.log(`[EnhancedAuth] Sign-in attempt ${attempt}/${this.retryConfig.maxRetries} with ${method}`);
        
        // Add timeout wrapper
        const signInPromise = this.executeSignIn(method, credentials);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Sign-in timed out after ${this.retryConfig.timeoutMs}ms`));
          }, this.retryConfig.timeoutMs);
        });

        await Promise.race([signInPromise, timeoutPromise]);
        
        console.log(`[EnhancedAuth] Sign-in successful on attempt ${attempt}`);
        toast.success('Signed in successfully');
        
        // Log successful auth
        console.log(`[EnhancedAuth] ${method} sign-in successful on attempt ${attempt}`);
        
        return;
        
      } catch (error: any) {
        lastError = error;
        console.error(`[EnhancedAuth] Sign-in attempt ${attempt} failed:`, error);
        
        // Log each attempt
        console.error(`[EnhancedAuth] ${method} sign-in attempt ${attempt} failed:`, error.message);
        
        // Don't retry for certain errors
        if (this.shouldNotRetry(error)) {
          console.log(`[EnhancedAuth] Not retrying due to error type: ${error.message}`);
          break;
        }
        
        // Wait before retry (except on last attempt)
        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.retryConfig.retryDelay * attempt;
          console.log(`[EnhancedAuth] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All attempts failed
    console.error(`[EnhancedAuth] All ${this.retryConfig.maxRetries} sign-in attempts failed`);
    console.error(`[EnhancedAuth] Final ${method} sign-in failure:`, lastError);
    throw lastError;
  }

  /**
   * Execute the actual sign-in based on method
   */
  private async executeSignIn(
    method: 'google' | 'apple' | 'email',
    credentials?: { email: string; password: string }
  ): Promise<void> {
    switch (method) {
      case 'google':
        return await authService.signInWithGoogle();
      case 'apple':
        return await authService.signInWithApple();
      case 'email':
        if (!credentials) {
          throw new Error('Email credentials required');
        }
        return await authService.signInWithEmail(credentials.email, credentials.password);
      default:
        throw new Error(`Unsupported sign-in method: ${method}`);
    }
  }

  /**
   * Determine if an error should not be retried
   */
  private shouldNotRetry(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    
    return (
      message.includes('cancelled') ||
      message.includes('canceled') ||
      message.includes('invalid credentials') ||
      message.includes('invalid_grant') ||
      message.includes('access_denied') ||
      message.includes('configuration') ||
      message.includes('not available') ||
      message.includes('not supported')
    );
  }

  /**
   * Verify profile creation after sign-in
   */
  async verifyProfileCreation(userId: string, maxAttempts: number = 5): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[EnhancedAuth] Verifying profile creation attempt ${attempt}/${maxAttempts}`);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, created_at, subscription_status, is_premium')
          .eq('id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error(`[EnhancedAuth] Profile verification error:`, error);
          throw error;
        }

        if (profile) {
          console.log(`[EnhancedAuth] Profile verified successfully:`, {
            profileId: profile.id,
            subscriptionStatus: profile.subscription_status,
            isPremium: profile.is_premium,
            createdAt: profile.created_at
          });
          return true;
        }

        // Wait before retry
        if (attempt < maxAttempts) {
          const delay = 1000 * attempt;
          console.log(`[EnhancedAuth] Profile not found, waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        console.error(`[EnhancedAuth] Profile verification attempt ${attempt} failed:`, error);
        
        if (attempt === maxAttempts) {
          throw error;
        }
      }
    }
    
    console.error(`[EnhancedAuth] Profile verification failed after ${maxAttempts} attempts`);
    
    return false;
  }

  /**
   * Enhanced session validation
   */
  async validateSession(): Promise<boolean> {
    try {
      console.log('[EnhancedAuth] Validating session...');
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[EnhancedAuth] Session validation error:', error);
        return false;
      }

      if (!session) {
        console.log('[EnhancedAuth] No active session found');
        return false;
      }

      // Check if session is expired
      const now = Date.now() / 1000;
      if (session.expires_at && session.expires_at < now) {
        console.log('[EnhancedAuth] Session is expired');
        return false;
      }

      // Verify profile exists
      if (session.user) {
        const profileExists = await this.verifyProfileCreation(session.user.id, 1);
        if (!profileExists) {
          console.error('[EnhancedAuth] Session valid but profile missing');
          return false;
        }
      }

      console.log('[EnhancedAuth] Session validation successful');
      return true;
      
    } catch (error: any) {
      console.error('[EnhancedAuth] Session validation failed:', error);
      return false;
    }
  }

  /**
   * Enhanced sign-out with cleanup
   */
  async signOut(): Promise<void> {
    try {
      console.log('[EnhancedAuth] Starting enhanced sign-out...');
      
      // Use the standard auth service sign-out
      await authService.signOut();
      
      console.log('[EnhancedAuth] Sign-out completed successfully');
      
    } catch (error: any) {
      console.error('[EnhancedAuth] Enhanced sign-out failed:', error);
      throw error;
    }
  }

  /**
   * Run comprehensive auth diagnostics
   */
  async runDiagnostics(): Promise<any> {
    try {
      console.log('[EnhancedAuth] Running auth diagnostics...');
      
      const results = {
        timestamp: new Date().toISOString(),
        sessionValid: false,
        profileExists: false
      };

      // Check session
      results.sessionValid = await this.validateSession();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check profile
        results.profileExists = await this.verifyProfileCreation(user.id, 1);
      }

      console.log('[EnhancedAuth] Diagnostics completed:', results);
      return results;
      
    } catch (error: any) {
      console.error('[EnhancedAuth] Diagnostics failed:', error);
      throw error;
    }
  }
}

export const enhancedAuthService = EnhancedAuthService.getInstance();