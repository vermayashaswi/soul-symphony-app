
import { nativeNavigationService } from './nativeNavigationService';
import { nativeIntegrationService } from './nativeIntegrationService';
import { mobileErrorHandler } from './mobileErrorHandler';

interface AuthState {
  isAuthenticated: boolean;
  isProcessing: boolean;
  lastAuthEvent: string | null;
  timestamp: number;
}

class AuthStateManager {
  private static instance: AuthStateManager;
  private authState: AuthState = {
    isAuthenticated: false,
    isProcessing: false,
    lastAuthEvent: null,
    timestamp: Date.now()
  };

  static getInstance(): AuthStateManager {
    if (!AuthStateManager.instance) {
      AuthStateManager.instance = new AuthStateManager();
    }
    return AuthStateManager.instance;
  }

  async handleAuthSuccess(redirectPath?: string): Promise<void> {
    console.log('[AuthStateManager] Handling auth success, redirectPath:', redirectPath);
    
    // Prevent multiple simultaneous auth processing
    if (this.authState.isProcessing) {
      console.log('[AuthStateManager] Already processing auth, skipping');
      return;
    }

    this.authState.isProcessing = true;
    this.authState.isAuthenticated = true;
    this.authState.lastAuthEvent = 'success';
    this.authState.timestamp = Date.now();

    try {
      // Determine final redirect path
      const finalPath = redirectPath || '/app/home';
      console.log('[AuthStateManager] Final redirect path:', finalPath);

      // CRITICAL: For native apps, use specialized navigation
      if (nativeIntegrationService.isRunningNatively()) {
        console.log('[AuthStateManager] Native app detected, using native navigation');
        
        // Add a small delay to ensure auth state is fully settled
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Use native navigation service for reliable navigation
        nativeNavigationService.handleAuthSuccess();
        
        return;
      }

      // For web apps, use standard navigation
      console.log('[AuthStateManager] Web app detected, using standard navigation');
      nativeNavigationService.navigateToPath(finalPath, { replace: true, force: true });

    } catch (error) {
      console.error('[AuthStateManager] Auth success navigation error:', error);
      mobileErrorHandler.handleError({
        type: 'unknown',
        message: `Auth success navigation failed: ${error}`
      });
    } finally {
      // Reset processing state after a delay
      setTimeout(() => {
        this.authState.isProcessing = false;
      }, 2000);
    }
  }

  handleAuthFailure(error: any): void {
    console.error('[AuthStateManager] Auth failure:', error);
    
    this.authState.isAuthenticated = false;
    this.authState.isProcessing = false;
    this.authState.lastAuthEvent = 'failure';
    this.authState.timestamp = Date.now();

    mobileErrorHandler.handleError({
      type: 'auth',
      message: `Authentication failed: ${error.message || error}`
    });
  }

  async getCurrentAuthState(): Promise<AuthState> {
    return { ...this.authState };
  }

  getProcessingState(): boolean {
    return this.authState.isProcessing;
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  reset(): void {
    console.log('[AuthStateManager] Resetting auth state');
    this.authState = {
      isAuthenticated: false,
      isProcessing: false,
      lastAuthEvent: null,
      timestamp: Date.now()
    };
  }
}

export const authStateManager = AuthStateManager.getInstance();
