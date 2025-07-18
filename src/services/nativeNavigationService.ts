import { nativeIntegrationService } from './nativeIntegrationService';

export class NativeNavigationService {
  private static instance: NativeNavigationService;

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
   * Navigate immediately after authentication success
   * This method bypasses any processing delays for immediate navigation
   */
  public navigateImmediatelyAfterAuth(path: string): void {
    console.log('[NativeNav] Immediate post-auth navigation to:', path);
    
    if (nativeIntegrationService.isRunningNatively()) {
      // For native apps, use direct location change immediately
      console.log('[NativeNav] Direct native navigation to:', path);
      window.location.href = path;
    } else {
      // For web, use standard navigation
      this.navigateToPath(path, { replace: true, force: true });
    }
  }

  /**
   * Handle post-authentication success with direct navigation for native apps
   * This provides a more reliable redirection than the standard flow
   */
  public handleAuthSuccess(): void {
    console.log('[NativeNav] Handling authentication success');
    
    if (nativeIntegrationService.isRunningNatively()) {
      console.log('[NativeNav] Native app detected - using immediate direct navigation');
      // For native apps, use immediate direct navigation without delays
      try {
        console.log('[NativeNav] Setting window.location.href to /app/home');
        window.location.href = '/app/home';
        
        // Fallback: If navigation doesn't happen immediately, force reload
        setTimeout(() => {
          console.log('[NativeNav] Fallback: Forcing page reload');
          window.location.reload();
        }, 1000);
      } catch (error) {
        console.error('[NativeNav] Navigation error, forcing reload:', error);
        window.location.reload();
      }
    } else {
      // For web, use standard navigation flow
      console.log('[NativeNav] Web app detected - using standard navigation');
      this.navigateToAuthenticatedHome();
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