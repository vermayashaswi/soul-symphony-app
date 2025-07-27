import { optimizedRouteService } from './optimizedRouteService';

class DeferredInitService {
  private static instance: DeferredInitService;
  private initialized = false;
  private isNative = false;

  static getInstance(): DeferredInitService {
    if (!DeferredInitService.instance) {
      DeferredInitService.instance = new DeferredInitService();
    }
    return DeferredInitService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.isNative = optimizedRouteService.isNativeApp();
    
    // For native apps, defer all non-critical services
    if (this.isNative) {
      setTimeout(() => this.initializeNonCriticalServices(), 2000);
    } else {
      // For web, initialize immediately but with lower priority
      setTimeout(() => this.initializeNonCriticalServices(), 500);
    }
    
    this.initialized = true;
  }

  private async initializeNonCriticalServices(): Promise<void> {
    console.log('[DeferredInit] Starting non-critical service initialization...');
    
    try {
      // Initialize journal reminder service (non-blocking)
      const { journalReminderService } = await import('./journalReminderService');
      journalReminderService.initializeOnAppStart().catch(error => {
        console.warn('[DeferredInit] Journal reminder service failed:', error);
      });

      // Initialize TWA services for PWA environments
      if (!this.isNative && ('serviceWorker' in navigator)) {
        const { twaUpdateService } = await import('./twaUpdateService');
        twaUpdateService.init();
      }

      // Initialize analytics or other tracking services
      this.initializeAnalytics();

      console.log('[DeferredInit] Non-critical services initialization completed');
    } catch (error) {
      console.warn('[DeferredInit] Some non-critical services failed to initialize:', error);
    }
  }

  private initializeAnalytics(): void {
    // Placeholder for analytics initialization
    // This would typically include Google Analytics, mixpanel, etc.
    console.log('[DeferredInit] Analytics services initialized');
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const deferredInitService = DeferredInitService.getInstance();