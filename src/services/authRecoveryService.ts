import { supabase } from '@/integrations/supabase/client';
import { loadingStateManager } from './loadingStateManager';
import { appRecoveryService } from './appRecoveryService';
import { toast } from 'sonner';

class AuthRecoveryService {
  private static instance: AuthRecoveryService;
  private recoveryInProgress = false;
  private lastRecoveryTime = 0;
  private readonly RECOVERY_COOLDOWN = 5000; // 5 seconds

  static getInstance(): AuthRecoveryService {
    if (!AuthRecoveryService.instance) {
      AuthRecoveryService.instance = new AuthRecoveryService();
    }
    return AuthRecoveryService.instance;
  }

  async detectAndRecoverFromAuthLoop(): Promise<boolean> {
    const now = Date.now();
    
    // Prevent rapid recovery attempts
    if (this.recoveryInProgress || (now - this.lastRecoveryTime) < this.RECOVERY_COOLDOWN) {
      return false;
    }

    // Check for signs of auth loop
    const isLoopDetected = await this.detectAuthLoop();
    
    if (isLoopDetected) {
      console.warn('[AuthRecovery] Auth loop detected, initiating recovery');
      return await this.performAuthRecovery();
    }

    return false;
  }

  private async detectAuthLoop(): Promise<boolean> {
    try {
      // Check if we've been loading for too long
      const loadingState = loadingStateManager.getActiveLoadingState();
      if (loadingState && loadingState.message.includes('Checking authentication')) {
        const loadingDuration = Date.now() - loadingState.timestamp;
        if (loadingDuration > 10000) { // 10 seconds
          console.log('[AuthRecovery] Detected prolonged auth loading');
          return true;
        }
      }

      // Check for session inconsistencies
      const storedSession = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
      if (storedSession) {
        try {
          const sessionData = JSON.parse(storedSession);
          const now = Date.now() / 1000;
          
          // Check if stored session is expired but still present
          if (sessionData?.expires_at && sessionData.expires_at < now) {
            console.log('[AuthRecovery] Detected expired stored session');
            return true;
          }
        } catch (error) {
          console.log('[AuthRecovery] Detected corrupted session data');
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('[AuthRecovery] Error detecting auth loop:', error);
      return false;
    }
  }

  private async performAuthRecovery(): Promise<boolean> {
    this.recoveryInProgress = true;
    this.lastRecoveryTime = Date.now();

    try {
      console.log('[AuthRecovery] Starting auth recovery process');
      
      // Clear all loading states
      loadingStateManager.clearAll();
      
      // Clear expired or corrupted session data
      await this.clearCorruptedAuthData();
      
      // Try to get fresh session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[AuthRecovery] Session validation failed during recovery:', error);
        
        // Complete auth reset as last resort
        await appRecoveryService.triggerRecovery('auth_recovery_session_failed', {
          clearAuth: true,
          forceNavigation: '/app/onboarding',
          showErrorMessage: false
        });
        
        return true;
      }

      if (!session) {
        console.log('[AuthRecovery] No valid session found, redirecting to onboarding');
        window.location.href = '/app/onboarding';
        return true;
      }

      console.log('[AuthRecovery] Valid session recovered, redirecting to app');
      window.location.href = '/app/home';
      return true;

    } catch (error) {
      console.error('[AuthRecovery] Auth recovery failed:', error);
      
      // Emergency fallback
      await appRecoveryService.triggerRecovery('auth_recovery_failed', {
        clearAuth: true,
        clearStorage: true,
        forceNavigation: '/app/onboarding'
      });
      
      return true;
    } finally {
      this.recoveryInProgress = false;
    }
  }

  private async clearCorruptedAuthData(): Promise<void> {
    try {
      // Check and clear expired sessions
      const storedSession = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
      if (storedSession) {
        try {
          const sessionData = JSON.parse(storedSession);
          const now = Date.now() / 1000;
          
          if (sessionData?.expires_at && sessionData.expires_at < now) {
            console.log('[AuthRecovery] Clearing expired session');
            localStorage.removeItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
          }
        } catch (error) {
          console.log('[AuthRecovery] Clearing corrupted session data');
          localStorage.removeItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
        }
      }

      // Clear any stuck loading states
      const authLoadingKeys = ['auth-session', 'auth-init', 'auth-google', 'auth-apple'];
      authLoadingKeys.forEach(key => loadingStateManager.clearLoading(key));

    } catch (error) {
      console.error('[AuthRecovery] Error clearing corrupted auth data:', error);
    }
  }

  // Public method to manually trigger recovery
  async forceAuthRecovery(): Promise<void> {
    console.log('[AuthRecovery] Manual auth recovery triggered');
    await this.performAuthRecovery();
  }
}

export const authRecoveryService = AuthRecoveryService.getInstance();