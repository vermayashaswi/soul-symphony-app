
import { supabase } from '@/integrations/supabase/client';
import { nativeNavigationService } from './nativeNavigationService';
import { nativeIntegrationService } from './nativeIntegrationService';
import { toast } from 'sonner';

interface NavigationRequest {
  path: string;
  options?: { replace?: boolean; force?: boolean };
  timestamp: number;
}

interface AuthDebugInfo {
  sessionExists: boolean;
  userExists: boolean;
  sessionId?: string;
  userId?: string;
  hasAccessToken: boolean;
  tokenExpiry?: number;
  isExpired?: boolean;
  timestamp: number;
}

class AuthStateManager {
  private static instance: AuthStateManager;
  private isProcessing = false;
  private processingTimeout?: NodeJS.Timeout;
  private navigationQueue: NavigationRequest[] = [];
  private lastAuthState: AuthDebugInfo | null = null;
  private debugEnabled = true;
  private navigationInProgress = false;
  private lastNavigationTime = 0;
  private readonly NAVIGATION_DEBOUNCE_MS = 1000;
  private authSuccessHandled = false;
  private lastSuccessTime = 0;
  private readonly SUCCESS_DEBOUNCE_MS = 2000;

  static getInstance(): AuthStateManager {
    if (!AuthStateManager.instance) {
      AuthStateManager.instance = new AuthStateManager();
    }
    return AuthStateManager.instance;
  }

  private log(message: string, data?: any) {
    if (this.debugEnabled) {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
      console.log(`[AuthStateManager:${timestamp}] ${message}`, data || '');
    }
  }

  private error(message: string, error?: any) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    console.error(`[AuthStateManager:${timestamp}] ERROR: ${message}`, error || '');
  }

  private async getAuthDebugInfo(): Promise<AuthDebugInfo> {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      const debugInfo: AuthDebugInfo = {
        sessionExists: !!data.session,
        userExists: !!data.session?.user,
        sessionId: data.session?.access_token ? data.session.access_token.substring(0, 10) + '...' : undefined,
        userId: data.session?.user?.id,
        hasAccessToken: !!data.session?.access_token,
        tokenExpiry: data.session?.expires_at,
        isExpired: data.session?.expires_at ? Date.now() / 1000 > data.session.expires_at : undefined,
        timestamp: Date.now()
      };

      if (error) {
        this.log('Session check error (non-critical):', error);
      }

      return debugInfo;
    } catch (error) {
      this.error('Failed to get auth debug info:', error);
      return {
        sessionExists: false,
        userExists: false,
        hasAccessToken: false,
        timestamp: Date.now()
      };
    }
  }

  public setProcessing(processing: boolean, timeoutMs = 5000): void {
    this.log(`Setting processing state: ${processing}`);
    
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = undefined;
    }

    this.isProcessing = processing;

    if (processing && timeoutMs > 0) {
      this.processingTimeout = setTimeout(() => {
        this.error('Processing timeout reached, forcing reset');
        this.isProcessing = false;
        this.processingTimeout = undefined;
        this.processNavigationQueue();
      }, timeoutMs);
    }
  }

  public getProcessingState(): boolean {
    return this.isProcessing;
  }

  public queueNavigation(path: string, options?: { replace?: boolean; force?: boolean }): void {
    const request: NavigationRequest = {
      path,
      options,
      timestamp: Date.now()
    };

    this.log('Queueing navigation request:', request);
    this.navigationQueue.push(request);

    if (!this.isProcessing) {
      this.processNavigationQueue();
    }
  }

  private async processNavigationQueue(): Promise<void> {
    if (this.isProcessing || this.navigationQueue.length === 0) {
      return;
    }

    this.setProcessing(true, 3000);

    try {
      const request = this.navigationQueue[this.navigationQueue.length - 1];
      this.navigationQueue = [];

      this.log('Processing navigation request:', request);

      await new Promise(resolve => setTimeout(resolve, 100));

      nativeNavigationService.navigateToPath(request.path, request.options);

      this.log('Navigation completed successfully');
    } catch (error) {
      this.error('Navigation processing failed:', error);
    } finally {
      this.setProcessing(false);
    }
  }

  public async resetAuthState(): Promise<void> {
    this.log('Resetting auth state');
    
    try {
      this.setProcessing(false);
      this.navigationQueue = [];
      this.authSuccessHandled = false;
      this.lastSuccessTime = 0;
      localStorage.removeItem('authRedirectTo');
      
      const debugInfo = await this.getAuthDebugInfo();
      this.lastAuthState = debugInfo;
      
      this.log('Auth state reset complete', debugInfo);
    } catch (error) {
      this.error('Failed to reset auth state:', error);
    }
  }

  public async handleAuthSuccess(redirectPath?: string): Promise<void> {
    const now = Date.now();
    
    if (this.authSuccessHandled && (now - this.lastSuccessTime) < this.SUCCESS_DEBOUNCE_MS) {
      this.log('Auth success already handled recently, skipping', { 
        timeSinceLastSuccess: now - this.lastSuccessTime 
      });
      return;
    }
    
    if (this.navigationInProgress && (now - this.lastNavigationTime) < this.NAVIGATION_DEBOUNCE_MS) {
      this.log('Navigation debounced - too rapid', { timeSinceLastNav: now - this.lastNavigationTime });
      return;
    }
    
    this.log('Handling auth success', { 
      redirectPath, 
      isNative: nativeIntegrationService.isRunningNatively(),
      wasAlreadyHandled: this.authSuccessHandled
    });
    
    if (this.isProcessing) {
      this.log('Already processing auth success, skipping');
      return;
    }

    this.authSuccessHandled = true;
    this.lastSuccessTime = now;
    this.navigationInProgress = true;
    this.lastNavigationTime = now;
    this.setProcessing(true, 5000);

    try {
      const debugInfo = await this.getAuthDebugInfo();
      this.lastAuthState = debugInfo;
      
      if (!debugInfo.sessionExists || !debugInfo.userExists) {
        this.error('Auth success called but no valid session found', debugInfo);
        this.log('Session validation failed during auth transition - this is normal, not showing error');
        this.executeNavigation('/app/auth');
        return;
      }

      this.log('Valid session confirmed for auth success', debugInfo);

      // Enhanced onboarding status check with database verification
      const onboardingComplete = await this.verifyOnboardingStatus();
      
      const finalPath = this.getFinalRedirectPath(redirectPath, onboardingComplete);
      this.log('Final redirect path determined:', finalPath);

      localStorage.removeItem('authRedirectTo');

      if (!this.authSuccessHandled || (now - this.lastSuccessTime) > this.SUCCESS_DEBOUNCE_MS) {
        toast.success('Welcome! You\'re now logged in.');
      }

      await this.executeNavigation(finalPath);

    } catch (error) {
      this.error('Error handling auth success:', error);
      if (error instanceof Error && !error.message.includes('session') && !error.message.includes('transition')) {
        toast.error('Something went wrong. Please try again.');
      }
      
      await this.executeNavigation('/app/home');
    } finally {
      this.navigationInProgress = false;
      setTimeout(() => {
        this.authSuccessHandled = false;
        this.setProcessing(false);
      }, this.SUCCESS_DEBOUNCE_MS);
    }
  }

  private async executeNavigation(path: string): Promise<void> {
    this.log('Executing navigation to:', path);

    if (nativeIntegrationService.isRunningNatively()) {
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          this.log(`Native navigation attempt ${attempts}/${maxAttempts} to: ${path}`);
          
          window.location.href = path;
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (window.location.pathname === path) {
            this.log('Native navigation successful');
            return;
          }
          
          if (attempts === maxAttempts) {
            this.error('Native navigation failed after all attempts');
            window.location.reload();
          }
          
        } catch (error) {
          this.error(`Native navigation attempt ${attempts} failed:`, error);
          if (attempts === maxAttempts) {
            window.location.reload();
          }
        }
      }
    } else {
      this.queueNavigation(path, { replace: true, force: true });
      await this.processNavigationQueue();
    }
  }

  public handleAuthFailure(error: any, isRealFailure = true): void {
    this.log('Handling auth failure', { error, isRealFailure });

    this.setProcessing(false);
    this.authSuccessHandled = false;
    this.navigationQueue = [];

    if (isRealFailure && error) {
      if (error.message && 
          !error.message.includes('session') && 
          !error.message.includes('timing') &&
          !error.message.includes('cancelled') &&
          !error.message.includes('transition')) {
        toast.error(`Authentication failed: ${error.message}`);
      } else if (!error.message) {
        toast.error('Authentication failed. Please try again.');
      } else {
        this.log('Suppressing non-critical auth error toast:', error.message);
      }
    } else {
      this.log('Auth failure flagged as non-critical, not showing error toast');
    }

    this.queueNavigation('/app/auth');
  }

  private getFinalRedirectPath(providedPath?: string, onboardingComplete?: boolean): string {
    if (providedPath && providedPath !== '/app/auth') {
      this.log('Using provided redirect path:', providedPath);
      return providedPath;
    }

    const storedRedirect = localStorage.getItem('authRedirectTo');
    if (storedRedirect && storedRedirect !== '/app/auth') {
      this.log('Using stored redirect path:', storedRedirect);
      return storedRedirect;
    }

    // Use verified onboarding status if provided, otherwise check localStorage
    const isOnboardingComplete = onboardingComplete !== undefined 
      ? onboardingComplete 
      : localStorage.getItem('onboardingComplete') === 'true';
      
    if (!isOnboardingComplete) {
      this.log('Redirecting to onboarding - not completed');
      return '/app/onboarding';
    }

    this.log('Using default redirect to home');
    return '/app/home';
  }

  public async getCurrentAuthState(): Promise<AuthDebugInfo> {
    const debugInfo = await this.getAuthDebugInfo();
    this.lastAuthState = debugInfo;
    return debugInfo;
  }

  public getLastAuthState(): AuthDebugInfo | null {
    return this.lastAuthState;
  }

  private async verifyOnboardingStatus(): Promise<boolean> {
    try {
      const debugInfo = await this.getAuthDebugInfo();
      
      if (!debugInfo.sessionExists || !debugInfo.userExists) {
        this.log('No valid session for onboarding check');
        return false;
      }

      // Check database first for authoritative status
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', debugInfo.userId)
        .single();

      let isComplete = false;

      if (error) {
        this.error('Error checking onboarding status from database:', error);
        // Fallback to localStorage
        isComplete = localStorage.getItem('onboardingComplete') === 'true';
        this.log('Using localStorage onboarding status as fallback:', isComplete);
      } else {
        isComplete = profile?.onboarding_completed || false;
        this.log('Onboarding status from database:', { isComplete, userId: debugInfo.userId });
        
        // Sync localStorage with database
        localStorage.setItem('onboardingComplete', isComplete.toString());
      }
      
      return isComplete;
    } catch (error) {
      this.error('Failed to verify onboarding status:', error);
      return localStorage.getItem('onboardingComplete') === 'true';
    }
  }

  public async checkOnboardingStatus(): Promise<boolean> {
    return this.verifyOnboardingStatus();
  }

  public setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.log(`Debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }
}

export const authStateManager = AuthStateManager.getInstance();
