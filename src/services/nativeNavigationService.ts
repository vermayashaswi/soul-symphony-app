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
   */
  public navigateToPath(path: string, options?: { replace?: boolean }): void {
    console.log('[NativeNav] Navigating to:', path, 'options:', options);
    
    if (nativeIntegrationService.isRunningNatively()) {
      // For native apps, use location.href for reliable navigation
      if (options?.replace) {
        window.location.replace(path);
      } else {
        window.location.href = path;
      }
    } else {
      // For web, use normal navigation
      if (options?.replace) {
        window.history.replaceState(null, '', path);
      } else {
        window.history.pushState(null, '', path);
      }
      // Trigger a navigation event
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  /**
   * Navigate to home after successful authentication
   */
  public navigateToAuthenticatedHome(): void {
    console.log('[NativeNav] Navigating to authenticated home');
    this.navigateToPath('/app/home', { replace: true });
  }

  /**
   * Navigate to onboarding
   */
  public navigateToOnboarding(): void {
    console.log('[NativeNav] Navigating to onboarding');
    this.navigateToPath('/app/onboarding', { replace: true });
  }

  /**
   * Navigate to auth page
   */
  public navigateToAuth(redirectPath?: string): void {
    const authPath = redirectPath ? `/app/auth?redirect=${encodeURIComponent(redirectPath)}` : '/app/auth';
    console.log('[NativeNav] Navigating to auth:', authPath);
    this.navigateToPath(authPath, { replace: true });
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