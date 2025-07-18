
import { nativeIntegrationService } from './nativeIntegrationService';
import { mobileErrorHandler } from './mobileErrorHandler';

interface PullToRefreshConfig {
  onRefresh: () => Promise<void>;
  threshold?: number;
  resistance?: number;
  enabled?: boolean;
}

class PullToRefreshService {
  private static instance: PullToRefreshService;
  private isEnabled = false;
  private currentConfig: PullToRefreshConfig | null = null;
  private touchStartY = 0;
  private touchCurrentY = 0;
  private pullDistance = 0;
  private isRefreshing = false;
  private pullElement: HTMLElement | null = null;
  private refreshIndicator: HTMLElement | null = null;

  static getInstance(): PullToRefreshService {
    if (!PullToRefreshService.instance) {
      PullToRefreshService.instance = new PullToRefreshService();
    }
    return PullToRefreshService.instance;
  }

  initialize(config: PullToRefreshConfig): void {
    console.log('[PullToRefresh] Initializing pull-to-refresh service');
    
    // Only enable in native apps
    if (!nativeIntegrationService.isRunningNatively()) {
      console.log('[PullToRefresh] Not in native app, skipping initialization');
      return;
    }

    this.currentConfig = {
      threshold: 80,
      resistance: 0.5,
      enabled: true,
      ...config
    };

    this.setupPullToRefresh();
    this.isEnabled = true;
    console.log('[PullToRefresh] Pull-to-refresh initialized');
  }

  private setupPullToRefresh(): void {
    // Remove existing listeners
    this.cleanup();

    // Create refresh indicator
    this.createRefreshIndicator();

    // Add touch event listeners
    document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
  }

  private createRefreshIndicator(): void {
    if (this.refreshIndicator) {
      this.refreshIndicator.remove();
    }

    this.refreshIndicator = document.createElement('div');
    this.refreshIndicator.id = 'pull-to-refresh-indicator';
    this.refreshIndicator.className = 'fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground text-center py-2 transform -translate-y-full transition-transform duration-300';
    this.refreshIndicator.innerHTML = `
      <div class="flex items-center justify-center space-x-2">
        <div class="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
        <span>Pull to refresh</span>
      </div>
    `;
    document.body.appendChild(this.refreshIndicator);
  }

  private handleTouchStart(e: TouchEvent): void {
    if (!this.isEnabled || !this.currentConfig || this.isRefreshing) return;

    const touch = e.touches[0];
    this.touchStartY = touch.clientY;
    this.pullDistance = 0;

    // Check if we're at the top of the page
    if (window.scrollY === 0) {
      this.pullElement = document.documentElement;
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!this.isEnabled || !this.currentConfig || !this.pullElement || this.isRefreshing) return;

    const touch = e.touches[0];
    this.touchCurrentY = touch.clientY;
    const deltaY = this.touchCurrentY - this.touchStartY;

    // Only handle downward pulls when at top of page
    if (deltaY > 0 && window.scrollY === 0) {
      e.preventDefault();
      
      const resistance = this.currentConfig.resistance || 0.5;
      this.pullDistance = deltaY * resistance;

      // Update visual feedback
      this.updatePullIndicator(this.pullDistance);
      
      // Apply transform to body for visual feedback
      document.body.style.transform = `translateY(${Math.min(this.pullDistance, 100)}px)`;
      document.body.style.transition = 'none';
    }
  }

  private handleTouchEnd(): void {
    if (!this.isEnabled || !this.currentConfig || !this.pullElement || this.isRefreshing) return;

    const threshold = this.currentConfig.threshold || 80;

    // Reset body transform
    document.body.style.transform = '';
    document.body.style.transition = 'transform 0.3s ease';

    if (this.pullDistance > threshold) {
      this.triggerRefresh();
    } else {
      this.resetPullIndicator();
    }

    this.pullElement = null;
    this.pullDistance = 0;
  }

  private updatePullIndicator(distance: number): void {
    if (!this.refreshIndicator || !this.currentConfig) return;

    const threshold = this.currentConfig.threshold || 80;
    const progress = Math.min(distance / threshold, 1);
    
    if (progress > 0) {
      this.refreshIndicator.style.transform = `translateY(${progress * 100 - 100}%)`;
      
      if (progress >= 1) {
        this.refreshIndicator.innerHTML = `
          <div class="flex items-center justify-center space-x-2">
            <div class="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
            <span>Release to refresh</span>
          </div>
        `;
      }
    }
  }

  private async triggerRefresh(): Promise<void> {
    if (!this.currentConfig || this.isRefreshing) return;

    console.log('[PullToRefresh] Triggering refresh');
    this.isRefreshing = true;

    try {
      // Show refreshing state
      if (this.refreshIndicator) {
        this.refreshIndicator.style.transform = 'translateY(0)';
        this.refreshIndicator.innerHTML = `
          <div class="flex items-center justify-center space-x-2">
            <div class="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
            <span>Refreshing...</span>
          </div>
        `;
      }

      // Add haptic feedback
      await nativeIntegrationService.vibrate(50);

      // Trigger refresh callback
      await this.currentConfig.onRefresh();

      // Show success briefly
      if (this.refreshIndicator) {
        this.refreshIndicator.innerHTML = `
          <div class="flex items-center justify-center space-x-2">
            <span>✓ Refreshed</span>
          </div>
        `;
      }

      // Hide after delay
      setTimeout(() => {
        this.resetPullIndicator();
      }, 1000);

    } catch (error) {
      console.error('[PullToRefresh] Refresh error:', error);
      mobileErrorHandler.handleError({
        type: 'unknown',
        message: `Pull to refresh failed: ${error}`
      });

      // Show error state
      if (this.refreshIndicator) {
        this.refreshIndicator.innerHTML = `
          <div class="flex items-center justify-center space-x-2">
            <span>⚠ Refresh failed</span>
          </div>
        `;
      }

      setTimeout(() => {
        this.resetPullIndicator();
      }, 2000);
    } finally {
      this.isRefreshing = false;
    }
  }

  private resetPullIndicator(): void {
    if (this.refreshIndicator) {
      this.refreshIndicator.style.transform = 'translateY(-100%)';
      this.refreshIndicator.innerHTML = `
        <div class="flex items-center justify-center space-x-2">
          <div class="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
          <span>Pull to refresh</span>
        </div>
      `;
    }
  }

  disable(): void {
    console.log('[PullToRefresh] Disabling pull-to-refresh');
    this.isEnabled = false;
    this.cleanup();
  }

  enable(): void {
    console.log('[PullToRefresh] Enabling pull-to-refresh');
    if (this.currentConfig) {
      this.isEnabled = true;
      this.setupPullToRefresh();
    }
  }

  private cleanup(): void {
    document.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    document.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    document.removeEventListener('touchend', this.handleTouchEnd.bind(this));

    if (this.refreshIndicator) {
      this.refreshIndicator.remove();
      this.refreshIndicator = null;
    }

    // Reset body styles
    document.body.style.transform = '';
    document.body.style.transition = '';
  }

  destroy(): void {
    console.log('[PullToRefresh] Destroying pull-to-refresh service');
    this.cleanup();
    this.currentConfig = null;
    this.isEnabled = false;
  }
}

export const pullToRefreshService = PullToRefreshService.getInstance();
