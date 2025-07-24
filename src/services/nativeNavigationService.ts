import { nativeIntegrationService } from './nativeIntegrationService';
import { loadingStateManager } from './loadingStateManager';

export class NativeNavigationService {
  private static instance: NativeNavigationService;
  private lastNavigationTime = 0;
  private readonly NAVIGATION_DEBOUNCE_MS = 500;

  public static getInstance(): NativeNavigationService {
    if (!NativeNavigationService.instance) {
      NativeNavigationService.instance = new NativeNavigationService();
    }
    return NativeNavigationService.instance;
  }

  /**
   * Navigate to a specific path with native app considerations
   * @param path Path to navigate to
   * @param options Navigation options: 
   *   - replace: Replace current history entry instead of pushing a new one
   *   - force: Force navigation even if we're already on this path (used for auth redirects)
   */
  public navigateToPath(path: string, options?: { replace?: boolean; force?: boolean }): void {
    console.log('[NativeNav] Navigating to:', path, 'options:', options);
    
    // Skip navigation if we're already on this path and force isn't enabled
    const currentPath = window.location.pathname;
    if (currentPath === path && !options?.force) {
      console.log('[NativeNav] Already on path, skipping navigation');
      return;
    }
    
    // Add a small delay for native apps to ensure auth state is settled
    const performNavigation = () => {
      if (nativeIntegrationService.isRunningNatively()) {
        // For native apps, use location.href for reliable navigation
        console.log('[NativeNav] Using direct location change for native app');
        if (options?.replace) {
          console.log('[NativeNav] Replacing location with:', path);
          window.location.replace(path);
        } else {
          console.log('[NativeNav] Setting location href to:', path);
          window.location.href = path;
        }
      } else {
        // For web, use history API
        console.log('[NativeNav] Using history API for web');
        if (options?.replace) {
          window.history.replaceState(null, '', path);
        } else {
          window.history.pushState(null, '', path);
        }
        // Trigger a navigation event to notify React Router
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    };

    // For native apps, add a small delay to prevent race conditions
    if (nativeIntegrationService.isRunningNatively()) {
      setTimeout(performNavigation, 100);
    } else {
      performNavigation();
    }
  }

  /**
   * Navigate to home after successful authentication
   */
  public navigateToAuthenticatedHome(): void {
    console.log('[NativeNav] Navigating to authenticated home');
    // Clear any pending navigation and force immediate navigation
    this.navigateToPath('/app/home', { replace: true, force: true });
  }

  /**
   * Navigate to onboarding
   */
  public navigateToOnboarding(): void {
    console.log('[NativeNav] Navigating to onboarding');
    this.navigateToPath('/app/onboarding', { replace: true, force: true });
  }

  /**
   * Navigate to auth page
   */
  public navigateToAuth(redirectPath?: string): void {
    const authPath = redirectPath ? `/app/auth?redirectTo=${encodeURIComponent(redirectPath)}` : '/app/auth';
    console.log('[NativeNav] Navigating to auth:', authPath);
    this.navigateToPath(authPath, { replace: true, force: true });
  }

  /**
   * Navigate immediately after authentication success - OPTIMIZED FOR BUNDLED ASSETS
   * This method bypasses any processing delays for immediate navigation
   */
  public navigateImmediatelyAfterAuth(path: string): void {
    const now = Date.now();
    
    // Debounce to prevent rapid navigation calls
    if ((now - this.lastNavigationTime) < this.NAVIGATION_DEBOUNCE_MS) {
      console.log('[NativeNav] Navigation debounced, too rapid');
      return;
    }
    
    this.lastNavigationTime = now;
    console.log('[NativeNav] Immediate post-auth navigation to:', path);
    
    // Clear any loading states that might cause blank screens
    try {
      loadingStateManager.clearAll();
    } catch (error) {
      console.warn('[NativeNav] Failed to clear loading states:', error);
    }
    
    if (nativeIntegrationService.isRunningNatively()) {
      // For native apps with bundled assets - use direct navigation
      console.log('[NativeNav] Direct native navigation to:', path);
      this.performNativeNavigation(path);
    } else {
      // For web, use standard navigation
      this.navigateToPath(path, { replace: true, force: true });
    }
  }

  /**
   * Optimized native navigation with retry mechanism
   */
  private performNativeNavigation(path: string): void {
    try {
      console.log('[NativeNav] Performing native navigation to:', path);
      
      // For bundled assets, direct window.location change is most reliable
      window.location.href = path;
      
      // Add fallback check after a delay
      setTimeout(() => {
        if (window.location.pathname !== path) {
          console.log('[NativeNav] Navigation verification failed, retrying...');
          // Retry once more
          window.location.href = path;
        }
      }, 1000);
      
    } catch (error) {
      console.error('[NativeNav] Native navigation error:', error);
      // Last resort - force page reload to clear any stuck state
      setTimeout(() => {
        console.log('[NativeNav] Using fallback reload');
        window.location.reload();
      }, 500);
    }
  }

  /**
   * Handle post-authentication success with session-aware navigation
   * Enhanced for reliable native app redirection - PREVENTS BLANK SCREEN
   */
  public handleAuthSuccess(): void {
    console.log('[NativeNav] Handling authentication success');
    
    // Clear any stuck loading states that might cause blank screens
    try {
      loadingStateManager.clearAll();
    } catch (error) {
      console.warn('[NativeNav] Failed to clear loading states:', error);
    }
    
    if (nativeIntegrationService.isRunningNatively()) {
      console.log('[NativeNav] Native app detected - using direct navigation to prevent blank screen');
      
      // For native apps, use immediate navigation to prevent blank screen
      this.performNativeNavigation('/app/home');
    } else {
      // For web, use standard navigation flow
      console.log('[NativeNav] Web app detected - using standard navigation');
      this.navigateToAuthenticatedHome();
    }
  }

  /**
   * Validate session exists before navigating (for native apps)
   */
  private validateSessionAndNavigate(targetPath: string): void {
    try {
      // Check if we have a valid session in storage
      const storedSession = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
      
      if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        const now = Date.now() / 1000;
        
        if (sessionData?.access_token && sessionData?.expires_at && sessionData.expires_at > now) {
          console.log('[NativeNav] Valid session confirmed, proceeding with navigation');
          this.performNativeNavigation(targetPath);
          return;
        }
      }
      
      console.log('[NativeNav] No valid session found, using fallback navigation');
      this.performNativeNavigation(targetPath);
      
    } catch (error) {
      console.error('[NativeNav] Session validation error, using direct navigation:', error);
      this.performNativeNavigation(targetPath);
    }
  }

  /**
   * Get the current path
   */
  public getCurrentPath(): string {
    return window.location.pathname;
  }

  /**
   * Check if we're on a specific path
   */
  public isOnPath(path: string): boolean {
    return this.getCurrentPath() === path;
  }

  /**
   * Force a page reload - useful for native apps when navigation gets stuck
   */
  public forceReload(): void {
    console.log('[NativeNav] Force reloading page');
    window.location.reload();
  }
}

export const nativeNavigationService = NativeNavigationService.getInstance();