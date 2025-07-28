// Simplified navigation service aligned with web patterns
import { nativeIntegrationService } from './nativeIntegrationService';

class SimpleNavigationService {
  private static instance: SimpleNavigationService;

  static getInstance(): SimpleNavigationService {
    if (!SimpleNavigationService.instance) {
      SimpleNavigationService.instance = new SimpleNavigationService();
    }
    return SimpleNavigationService.instance;
  }

  navigateToPath(path: string, options: { replace?: boolean } = {}) {
    console.log('[SimpleNavigation] Navigating to:', path);
    
    try {
      if (options.replace) {
        window.history.replaceState({}, '', path);
      } else {
        window.history.pushState({}, '', path);
      }
      
      // Trigger React Router update
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (error) {
      console.error('[SimpleNavigation] Navigation failed:', error);
      // Fallback to direct navigation
      window.location.href = path;
    }
  }

  navigateToAuth(redirectPath?: string) {
    const authPath = redirectPath ? `/app/auth?redirect=${encodeURIComponent(redirectPath)}` : '/app/auth';
    this.navigateToPath(authPath, { replace: true });
  }

  navigateToHome() {
    this.navigateToPath('/app/home', { replace: true });
  }

  navigateToOnboarding() {
    this.navigateToPath('/app/onboarding', { replace: true });
  }

  handleAuthSuccess() {
    console.log('[SimpleNavigation] Auth success - navigating to home');
    this.navigateToHome();
  }

  getCurrentPath(): string {
    return window.location.pathname;
  }

  isOnPath(path: string): boolean {
    return this.getCurrentPath() === path;
  }
}

export const simpleNavigationService = SimpleNavigationService.getInstance();