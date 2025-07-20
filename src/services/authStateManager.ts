import { User, Session } from '@supabase/supabase-js';
import { nativeIntegrationService } from './nativeIntegrationService';
import { detectTWAEnvironment } from '@/utils/twaDetection';

/**
 * Central auth state manager for handling authentication flows
 * Provides consistent auth state management across native and web environments
 */
class AuthStateManager {
  private authCompleteCallbacks: Set<() => void> = new Set();
  private currentAuthState: { user: User | null; session: Session | null } = {
    user: null,
    session: null
  };

  /**
   * Register callback for when auth state is complete and stable
   */
  onAuthComplete(callback: () => void) {
    this.authCompleteCallbacks.add(callback);
    return () => this.authCompleteCallbacks.delete(callback);
  }

  /**
   * Update current auth state and notify listeners
   */
  updateAuthState(user: User | null, session: Session | null) {
    console.log('[AuthStateManager] Updating auth state', {
      hasUser: !!user,
      previousHadUser: !!this.currentAuthState.user,
      isNative: nativeIntegrationService.isRunningNatively()
    });

    this.currentAuthState = { user, session };
    
    // Notify all listeners that auth state is complete
    this.authCompleteCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('[AuthStateManager] Error in auth complete callback:', error);
      }
    });
  }

  /**
   * Get current auth state
   */
  getCurrentAuthState() {
    return { ...this.currentAuthState };
  }

  /**
   * Handle successful authentication with environment-specific navigation
   */
  async handleAuthSuccess(user: User, redirectPath?: string) {
    console.log('[AuthStateManager] Handling auth success', {
      userId: user.id,
      redirectPath,
      isNative: nativeIntegrationService.isRunningNatively()
    });

    const isNative = nativeIntegrationService.isRunningNatively();
    const twaEnv = detectTWAEnvironment();

    // For native apps, navigate immediately without delays
    if (isNative) {
      const targetPath = redirectPath || '/app/home';
      console.log(`[AuthStateManager] Native auth success - navigating to: ${targetPath}`);
      
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        window.location.href = targetPath;
      }, 50);
      return;
    }

    // For web/TWA, use existing logic with appropriate delays
    const navigationDelay = twaEnv.isTWA ? 500 : 200;
    const targetPath = redirectPath || '/app/home';
    
    console.log(`[AuthStateManager] Web auth success - navigating to: ${targetPath} in ${navigationDelay}ms`);
    
    setTimeout(() => {
      window.location.href = targetPath;
    }, navigationDelay);
  }

  /**
   * Handle authentication failure
   */
  async handleAuthFailure(error: Error) {
    console.error('[AuthStateManager] Auth failure:', error);
    
    const isNative = nativeIntegrationService.isRunningNatively();
    
    // For native apps, redirect immediately to onboarding
    if (isNative) {
      console.log('[AuthStateManager] Native auth failure - redirecting to onboarding');
      setTimeout(() => {
        window.location.href = '/app/onboarding';
      }, 100);
      return;
    }

    // For web, show error and redirect
    console.log('[AuthStateManager] Web auth failure - redirecting to onboarding');
    setTimeout(() => {
      window.location.href = '/app/onboarding';
    }, 500);
  }

  /**
   * Determine redirect path after auth based on environment and onboarding status
   */
  async getRedirectPath(user: User): Promise<string> {
    const isNative = nativeIntegrationService.isRunningNatively();
    
    try {
      // Check onboarding status
      const onboardingComplete = localStorage.getItem('onboarding_completed') === 'true';
      
      if (!onboardingComplete) {
        console.log('[AuthStateManager] Onboarding not complete, redirecting to onboarding');
        return '/app/onboarding';
      }

      // For authenticated users with completed onboarding, go to home
      console.log('[AuthStateManager] Auth complete, onboarding done, redirecting to home');
      return '/app/home';
      
    } catch (error) {
      console.error('[AuthStateManager] Error determining redirect path:', error);
      // Default to home for authenticated users
      return '/app/home';
    }
  }

  /**
   * Check if current session is valid and user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.currentAuthState.user && !!this.currentAuthState.session;
  }
}

export const authStateManager = new AuthStateManager();