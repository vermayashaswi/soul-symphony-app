import { nativeIntegrationService } from './nativeIntegrationService';
import { Capacitor } from '@capacitor/core';

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
   * Handles both internal app paths and external URLs appropriately
   */
  private performNativeNavigation(path: string): void {
    console.log('[NativeNav] Performing native navigation to:', path);
    
    // Check if this is from a push notification (external URL) vs internal app path
    const isExternalUrl = path.startsWith('http://') || path.startsWith('https://');
    const isInternalPath = path.startsWith('/') || !isExternalUrl;
    
    if (Capacitor.isNativePlatform() && isExternalUrl) {
      // For external URLs from push notifications, check if it's our own app URL
      const appBaseUrl = 'https://571d731e-b54b-453e-9f48-a2c79a572930.lovableproject.com';
      if (path.startsWith(appBaseUrl)) {
        // Extract the internal path and navigate within the app
        const internalPath = path.replace(appBaseUrl, '') || '/';
        console.log('[NativeNav] Converting external app URL to internal path:', internalPath);
        this.navigateToPath(internalPath);
        return;
      } else {
        // For truly external URLs, use Browser plugin
        console.log('[NativeNav] Opening external URL in browser');
        import('@capacitor/browser').then(({ Browser }) => {
          Browser.open({ url: path });
        }).catch(error => {
          console.error('[NativeNav] Error opening external URL:', error);
          window.open(path, '_blank');
        });
        return;
      }
    }
    
    // For internal paths or web platform, use standard navigation
    try {
      if (isInternalPath) {
        this.navigateToPath(path);
      } else {
        window.location.href = path;
      }
      
      // Add fallback check after a delay for direct URL changes
      if (!isInternalPath) {
        setTimeout(() => {
          if (window.location.href !== path) {
            console.log('[NativeNav] Navigation verification failed, retrying...');
            window.location.href = path;
          }
        }, 1000);
      }
      
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
   * Enhanced for reliable native app redirection
   */
  public handleAuthSuccess(): void {
    console.log('[NativeNav] Handling authentication success');
    
    if (nativeIntegrationService.isRunningNatively()) {
      console.log('[NativeNav] Native app detected - using session-aware navigation');
      
      // Validate session before navigation
      this.validateSessionAndNavigate('/app/home');
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