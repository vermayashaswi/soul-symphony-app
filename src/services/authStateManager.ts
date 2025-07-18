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

  // Enhanced authentication state debugging
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
        this.error('Error getting session for debug info:', error);
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

  // Set processing state with automatic timeout
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

  // Queue navigation request to prevent race conditions
  public queueNavigation(path: string, options?: { replace?: boolean; force?: boolean }): void {
    const request: NavigationRequest = {
      path,
      options,
      timestamp: Date.now()
    };

    this.log('Queueing navigation request:', request);
    this.navigationQueue.push(request);

    // Process immediately if not currently processing
    if (!this.isProcessing) {
      this.processNavigationQueue();
    }
  }

  // Process queued navigation requests
  private async processNavigationQueue(): Promise<void> {
    if (this.isProcessing || this.navigationQueue.length === 0) {
      return;
    }

    this.setProcessing(true, 3000);

    try {
      // Get the most recent navigation request (ignore older ones)
      const request = this.navigationQueue[this.navigationQueue.length - 1];
      this.navigationQueue = [];

      this.log('Processing navigation request:', request);

      // Add small delay to ensure auth state has settled
      await new Promise(resolve => setTimeout(resolve, 100));

      // Execute navigation
      nativeNavigationService.navigateToPath(request.path, request.options);

      this.log('Navigation completed successfully');
    } catch (error) {
      this.error('Navigation processing failed:', error);
    } finally {
      this.setProcessing(false);
    }
  }

  // Reset auth state and clear any pending operations
  public async resetAuthState(): Promise<void> {
    this.log('Resetting auth state');
    
    try {
      // Clear processing state
      this.setProcessing(false);
      
      // Clear navigation queue
      this.navigationQueue = [];
      
      // Clear any stored redirect paths
      localStorage.removeItem('authRedirectTo');
      
      // Get fresh auth state
      const debugInfo = await this.getAuthDebugInfo();
      this.lastAuthState = debugInfo;
      
      this.log('Auth state reset complete', debugInfo);
    } catch (error) {
      this.error('Failed to reset auth state:', error);
    }
  }

  // Handle successful authentication - CENTRALIZED NAVIGATION CONTROL
  public async handleAuthSuccess(redirectPath?: string): Promise<void> {
    const now = Date.now();
    
    // Debounce rapid navigation calls
    if (this.navigationInProgress && (now - this.lastNavigationTime) < this.NAVIGATION_DEBOUNCE_MS) {
      this.log('Navigation debounced - too rapid', { timeSinceLastNav: now - this.lastNavigationTime });
      return;
    }
    
    this.log('Handling auth success', { redirectPath, isNative: nativeIntegrationService.isRunningNatively() });
    
    if (this.isProcessing) {
      this.log('Already processing auth success, skipping');
      return;
    }

    this.navigationInProgress = true;
    this.lastNavigationTime = now;
    this.setProcessing(true, 5000); // Longer timeout for bundled assets

    try {
      // Get current auth state for debugging
      const debugInfo = await this.getAuthDebugInfo();
      this.lastAuthState = debugInfo;
      
      if (!debugInfo.sessionExists || !debugInfo.userExists) {
        this.error('Auth success called but no valid session found', debugInfo);
        toast.error('Authentication error. Please try again.');
        this.executeNavigation('/app/auth');
        return;
      }

      this.log('Valid session confirmed', debugInfo);

      // Determine redirect path
      const finalPath = this.getFinalRedirectPath(redirectPath);
      this.log('Final redirect path determined:', finalPath);

      // Clear any stored redirect
      localStorage.removeItem('authRedirectTo');

      // Show success message
      toast.success('Welcome! You\'re now logged in.');

      // Execute navigation with retry for native apps
      await this.executeNavigation(finalPath);

    } catch (error) {
      this.error('Error handling auth success:', error);
      toast.error('Something went wrong. Please try again.');
      
      // Fallback navigation
      await this.executeNavigation('/app/home');
    } finally {
      this.navigationInProgress = false;
      setTimeout(() => this.setProcessing(false), 2000);
    }
  }

  // OPTIMIZED NAVIGATION EXECUTION for bundled assets
  private async executeNavigation(path: string): Promise<void> {
    this.log('Executing navigation to:', path);

    if (nativeIntegrationService.isRunningNatively()) {
      // For native apps with bundled assets - use direct navigation with retry
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          this.log(`Native navigation attempt ${attempts}/${maxAttempts} to: ${path}`);
          
          // Use direct window.location.href for bundled assets
          window.location.href = path;
          
          // Add verification delay
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check if navigation was successful
          if (window.location.pathname === path) {
            this.log('Native navigation successful');
            return;
          }
          
          if (attempts === maxAttempts) {
            this.error('Native navigation failed after all attempts');
            // Force reload as last resort
            window.location.reload();
          }
          
        } catch (error) {
          this.error(`Native navigation attempt ${attempts} failed:`, error);
          if (attempts === maxAttempts) {
            // Last resort - reload to clear any stuck state
            window.location.reload();
          }
        }
      }
    } else {
      // For web apps - use queue system
      this.queueNavigation(path, { replace: true, force: true });
      await this.processNavigationQueue();
    }
  }

  // Handle authentication failure
  public handleAuthFailure(error: any): void {
    this.log('Handling auth failure', error);

    // Reset processing state
    this.setProcessing(false);

    // Clear navigation queue
    this.navigationQueue = [];

    // Show error message
    if (error?.message) {
      toast.error(`Authentication failed: ${error.message}`);
    } else {
      toast.error('Authentication failed. Please try again.');
    }

    // Ensure we're on the auth page
    this.queueNavigation('/app/auth');
  }

  // Get final redirect path considering various factors
  private getFinalRedirectPath(providedPath?: string): string {
    // Priority order:
    // 1. Provided path
    // 2. Stored redirect path
    // 3. Check onboarding status
    // 4. Default to home

    if (providedPath && providedPath !== '/app/auth') {
      this.log('Using provided redirect path:', providedPath);
      return providedPath;
    }

    const storedRedirect = localStorage.getItem('authRedirectTo');
    if (storedRedirect && storedRedirect !== '/app/auth') {
      this.log('Using stored redirect path:', storedRedirect);
      return storedRedirect;
    }

    // Check onboarding status
    const onboardingComplete = localStorage.getItem('onboardingComplete') === 'true';
    if (!onboardingComplete) {
      this.log('Redirecting to onboarding - not completed');
      return '/app/onboarding';
    }

    this.log('Using default redirect to home');
    return '/app/home';
  }

  // Get current auth debug information
  public async getCurrentAuthState(): Promise<AuthDebugInfo> {
    const debugInfo = await this.getAuthDebugInfo();
    this.lastAuthState = debugInfo;
    return debugInfo;
  }

  // Get last known auth state
  public getLastAuthState(): AuthDebugInfo | null {
    return this.lastAuthState;
  }

  // Check if user needs onboarding
  public async checkOnboardingStatus(): Promise<boolean> {
    try {
      const debugInfo = await this.getAuthDebugInfo();
      
      if (!debugInfo.sessionExists || !debugInfo.userExists) {
        return false; // Not authenticated, can't check onboarding
      }

      // Check database first
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', debugInfo.userId)
        .single();

      if (error) {
        this.error('Error checking onboarding status:', error);
        // Fall back to localStorage
        return localStorage.getItem('onboardingComplete') === 'true';
      }

      const isComplete = profile?.onboarding_completed || false;
      this.log('Onboarding status checked:', { isComplete, source: 'database' });
      
      // Sync with localStorage
      localStorage.setItem('onboardingComplete', isComplete.toString());
      
      return isComplete;
    } catch (error) {
      this.error('Failed to check onboarding status:', error);
      return localStorage.getItem('onboardingComplete') === 'true';
    }
  }

  // Enable/disable debug logging
  public setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.log(`Debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }
}

export const authStateManager = AuthStateManager.getInstance();