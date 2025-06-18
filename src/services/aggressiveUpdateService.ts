
import { toast } from 'sonner';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  updateSize?: string;
  mandatory?: boolean;
}

export interface UpdateConfiguration {
  checkInterval: number; // milliseconds
  forceUpdateTimeout: number; // milliseconds
  maxRetries: number;
  enableAggressiveMode: boolean;
}

class AggressiveUpdateService {
  private registration: ServiceWorkerRegistration | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private forceUpdateTimeout: NodeJS.Timeout | null = null;
  private updatePromptShown = false;
  private retryCount = 0;

  private config: UpdateConfiguration = {
    checkInterval: 10000, // Check every 10 seconds
    forceUpdateTimeout: 30000, // Force update after 30 seconds
    maxRetries: 5,
    enableAggressiveMode: true
  };

  async initialize(): Promise<void> {
    console.log('[AggressiveUpdate] Initializing aggressive update service...');
    
    try {
      this.registration = await navigator.serviceWorker.getRegistration();
      
      if (!this.registration) {
        console.warn('[AggressiveUpdate] No service worker registration found');
        return;
      }

      // Set up aggressive update checking
      this.startAggressiveChecking();
      
      // Listen for service worker state changes
      this.setupServiceWorkerListeners();
      
      // Listen for visibility changes to trigger updates
      this.setupVisibilityListeners();
      
      // Listen for focus events to trigger updates
      this.setupFocusListeners();
      
      console.log('[AggressiveUpdate] Aggressive update service initialized');
      
    } catch (error) {
      console.error('[AggressiveUpdate] Failed to initialize:', error);
    }
  }

  private startAggressiveChecking(): void {
    if (!this.config.enableAggressiveMode) return;
    
    console.log('[AggressiveUpdate] Starting aggressive update checking...');
    
    // Check immediately
    this.checkForUpdates();
    
    // Set up interval checking
    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, this.config.checkInterval);
  }

  private async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      if (!this.registration) {
        throw new Error('No service worker registration');
      }

      console.log('[AggressiveUpdate] Checking for updates...');
      
      // Force service worker to check for updates
      await this.registration.update();
      
      // Check if there's a waiting service worker
      const hasUpdate = !!this.registration.waiting;
      
      if (hasUpdate && !this.updatePromptShown) {
        console.log('[AggressiveUpdate] Update detected!');
        this.handleUpdateDetected();
      }
      
      return {
        hasUpdate,
        currentVersion: '1.0.0',
        latestVersion: hasUpdate ? 'Latest' : '1.0.0',
        updateSize: '~500KB',
        mandatory: this.retryCount >= this.config.maxRetries
      };
      
    } catch (error) {
      console.error('[AggressiveUpdate] Update check failed:', error);
      this.retryCount++;
      
      return {
        hasUpdate: false,
        currentVersion: '1.0.0',
        latestVersion: '1.0.0'
      };
    }
  }

  private handleUpdateDetected(): void {
    this.updatePromptShown = true;
    
    console.log('[AggressiveUpdate] Handling detected update...');
    
    if (this.retryCount >= this.config.maxRetries) {
      // Force update without user consent
      this.forceUpdate();
      return;
    }
    
    // Show immediate update prompt
    toast.info('App Update Available', {
      description: 'A new version is ready. Update now for the latest features.',
      duration: 10000,
      action: {
        label: 'Update Now',
        onClick: () => this.applyUpdate()
      }
    });
    
    // Set timeout to force update
    this.forceUpdateTimeout = setTimeout(() => {
      console.log('[AggressiveUpdate] Force update timeout reached');
      this.forceUpdate();
    }, this.config.forceUpdateTimeout);
  }

  private async forceUpdate(): Promise<void> {
    console.log('[AggressiveUpdate] Forcing update...');
    
    toast.info('Updating App...', {
      description: 'Installing latest version. App will restart momentarily.',
      duration: 3000
    });
    
    await this.applyUpdate();
  }

  private async applyUpdate(): Promise<boolean> {
    try {
      if (!this.registration?.waiting) {
        console.warn('[AggressiveUpdate] No waiting service worker to activate');
        return false;
      }

      console.log('[AggressiveUpdate] Applying update...');
      
      // Clear all caches first
      await this.clearAllCaches();
      
      // Skip waiting and activate new service worker
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Wait for controller change
      return new Promise((resolve) => {
        const handleControllerChange = () => {
          console.log('[AggressiveUpdate] Service worker updated, reloading...');
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
          
          // Force reload with cache bypass
          window.location.reload();
          resolve(true);
        };
        
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
        
        // Fallback timeout
        setTimeout(() => {
          console.log('[AggressiveUpdate] Timeout reached, forcing reload...');
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
          window.location.reload();
          resolve(true);
        }, 5000);
      });
      
    } catch (error) {
      console.error('[AggressiveUpdate] Failed to apply update:', error);
      return false;
    }
  }

  private async clearAllCaches(): Promise<void> {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('[AggressiveUpdate] All caches cleared');
    } catch (error) {
      console.error('[AggressiveUpdate] Failed to clear caches:', error);
    }
  }

  private setupServiceWorkerListeners(): void {
    if (!this.registration) return;
    
    this.registration.addEventListener('updatefound', () => {
      console.log('[AggressiveUpdate] Update found via updatefound event');
      const newWorker = this.registration!.installing;
      
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[AggressiveUpdate] New service worker installed');
            this.handleUpdateDetected();
          }
        });
      }
    });
  }

  private setupVisibilityListeners(): void {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('[AggressiveUpdate] App became visible, checking for updates...');
        this.checkForUpdates();
      }
    });
  }

  private setupFocusListeners(): void {
    window.addEventListener('focus', () => {
      console.log('[AggressiveUpdate] App gained focus, checking for updates...');
      this.checkForUpdates();
    });
  }

  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    if (this.forceUpdateTimeout) {
      clearTimeout(this.forceUpdateTimeout);
      this.forceUpdateTimeout = null;
    }
    
    console.log('[AggressiveUpdate] Aggressive update service stopped');
  }

  public setConfiguration(config: Partial<UpdateConfiguration>): void {
    this.config = { ...this.config, ...config };
    console.log('[AggressiveUpdate] Configuration updated:', this.config);
    
    // Restart checking with new configuration
    if (this.checkInterval) {
      this.stop();
      this.startAggressiveChecking();
    }
  }
}

export const aggressiveUpdateService = new AggressiveUpdateService();
