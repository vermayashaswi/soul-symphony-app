import { loadingStateManager } from './loadingStateManager';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface RecoveryOptions {
  clearAuth?: boolean;
  clearStorage?: boolean;
  reloadApp?: boolean;
  showErrorMessage?: boolean;
  forceNavigation?: string;
}

class AppRecoveryService {
  private static instance: AppRecoveryService;
  private recoveryAttempts: Map<string, number> = new Map();
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private isRecovering = false;

  static getInstance(): AppRecoveryService {
    if (!AppRecoveryService.instance) {
      AppRecoveryService.instance = new AppRecoveryService();
    }
    return AppRecoveryService.instance;
  }

  async triggerRecovery(reason: string, options: RecoveryOptions = {}): Promise<void> {
    // Prevent multiple simultaneous recovery attempts
    if (this.isRecovering) {
      console.log(`[AppRecovery] Recovery already in progress, ignoring: ${reason}`);
      return;
    }

    const attempts = this.recoveryAttempts.get(reason) || 0;
    
    if (attempts >= this.MAX_RECOVERY_ATTEMPTS) {
      console.error(`[AppRecovery] Max recovery attempts reached for: ${reason}`);
      if (options.showErrorMessage !== false) {
        toast.error('Unable to recover from error. Please refresh the page.');
      }
      
      // Force navigation as last resort
      if (options.forceNavigation) {
        window.location.href = options.forceNavigation;
      }
      return;
    }

    this.isRecovering = true;
    this.recoveryAttempts.set(reason, attempts + 1);
    
    console.log(`[AppRecovery] Triggering recovery for: ${reason} (attempt ${attempts + 1})`);
    
    try {
      // Clear all loading states first
      loadingStateManager.clearAll();
      
      if (options.clearAuth) {
        await this.clearAuthData();
      }
      
      if (options.clearStorage) {
        await this.clearAppStorage();
      }
      
      // Force navigation if specified
      if (options.forceNavigation) {
        console.log(`[AppRecovery] Force navigating to: ${options.forceNavigation}`);
        window.location.href = options.forceNavigation;
        return;
      }
      
      if (options.reloadApp) {
        await this.reloadApplication();
      }
      
      if (options.showErrorMessage !== false) {
        toast.info('Recovering from error...');
      }
    } finally {
      this.isRecovering = false;
    }
  }

  private async clearAuthData(): Promise<void> {
    try {
      console.log('[AppRecovery] Clearing auth data');
      
      // Clear Supabase session safely
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.warn('[AppRecovery] Error signing out (non-critical):', error);
      }
      
      // Clear auth-related localStorage
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.includes('supabase') || 
        key.includes('auth') || 
        key.includes('session') ||
        key.includes('onboarding')
      );
      
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.warn(`[AppRecovery] Failed to remove key ${key}:`, error);
        }
      });
    } catch (error) {
      console.error('[AppRecovery] Error clearing auth data:', error);
    }
  }

  private async clearAppStorage(): Promise<void> {
    try {
      console.log('[AppRecovery] Clearing app storage');
      
      // Clear non-essential localStorage items
      const keysToKeep = ['theme', 'language', 'user-preferences'];
      const allKeys = Object.keys(localStorage);
      
      allKeys.forEach(key => {
        if (!keysToKeep.some(keepKey => key.includes(keepKey))) {
          try {
            localStorage.removeItem(key);
          } catch (error) {
            console.warn(`[AppRecovery] Failed to remove storage key ${key}:`, error);
          }
        }
      });
      
      // Clear sessionStorage
      try {
        sessionStorage.clear();
      } catch (error) {
        console.warn('[AppRecovery] Failed to clear sessionStorage:', error);
      }
      
    } catch (error) {
      console.error('[AppRecovery] Error clearing app storage:', error);
    }
  }

  private async reloadApplication(): Promise<void> {
    try {
      console.log('[AppRecovery] Reloading application');
      
      // Add a small delay to ensure any cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      window.location.reload();
    } catch (error) {
      console.error('[AppRecovery] Error reloading application:', error);
      // Fallback: force navigation to home
      window.location.href = '/app/home';
    }
  }

  // Public method to check if recovery is in progress
  isRecoveryInProgress(): boolean {
    return this.isRecovering;
  }

  // Public method to reset recovery attempts for testing
  resetRecoveryAttempts(reason?: string): void {
    if (reason) {
      this.recoveryAttempts.delete(reason);
    } else {
      this.recoveryAttempts.clear();
    }
  }

  // Emergency recovery method
  async emergencyRecovery(): Promise<void> {
    console.warn('[AppRecovery] Emergency recovery initiated');
    
    await this.triggerRecovery('emergency', {
      clearAuth: true,
      clearStorage: true,
      forceNavigation: '/app/onboarding',
      showErrorMessage: true
    });
  }
}

export const appRecoveryService = AppRecoveryService.getInstance();