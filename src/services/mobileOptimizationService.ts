
import { nativeIntegrationService } from './nativeIntegrationService';
import { mobileErrorHandler } from './mobileErrorHandler';

class MobileOptimizationService {
  private static instance: MobileOptimizationService;
  private isInitialized = false;

  static getInstance(): MobileOptimizationService {
    if (!MobileOptimizationService.instance) {
      MobileOptimizationService.instance = new MobileOptimizationService();
    }
    return MobileOptimizationService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[MobileOptimization] Initializing mobile optimizations');

      // Critical optimizations first
      this.applyMobileCSSOptimizations();
      this.setupMemoryManagement();
      
      // Defer non-critical optimizations
      setTimeout(() => {
        try {
          this.setupTouchOptimizations();
          this.setupPerformanceMonitoring();
          this.setupViewportOptimizations();
        } catch (error) {
          console.warn('[MobileOptimization] Deferred optimizations failed:', error);
        }
      }, 200);

      this.isInitialized = true;
      console.log('[MobileOptimization] Mobile optimizations initialized');

    } catch (error) {
      console.error('[MobileOptimization] Failed to initialize:', error);
      mobileErrorHandler.handleError({
        type: 'unknown',
        message: `Mobile optimization initialization failed: ${error}`
      });
    }
  }

  private applyMobileCSSOptimizations(): void {
    const style = document.createElement('style');
    style.textContent = `
      /* Mobile-specific optimizations */
      * {
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
      }

      input, textarea, [contenteditable] {
        -webkit-user-select: text;
        user-select: text;
      }

      body {
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-y: contain;
        touch-action: pan-y;
      }

      /* Prevent zoom on input focus */
      input, select, textarea {
        font-size: 16px !important;
      }

      /* Optimize scrolling performance */
      .scroll-container {
        transform: translateZ(0);
        will-change: scroll-position;
      }

      /* Reduce motion for better performance */
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private setupTouchOptimizations(): void {
    // Prevent default touch behaviors that can cause issues
    document.addEventListener('touchstart', (e) => {
      // Allow normal touch behavior for form elements
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement) {
        return;
      }
    }, { passive: true });

    // Optimize scroll performance
    document.addEventListener('touchmove', (e) => {
      // Prevent rubber band scrolling at document level
      if (e.target === document.body) {
        e.preventDefault();
      }
    }, { passive: false });

    // Add visual feedback for touch interactions
    document.addEventListener('touchstart', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]')) {
        target.style.opacity = '0.7';
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]')) {
        setTimeout(() => {
          target.style.opacity = '';
        }, 150);
      }
    }, { passive: true });
  }

  private setupPerformanceMonitoring(): void {
    // Monitor performance metrics
    if ('performance' in window && 'PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'navigation') {
              // Cast to PerformanceNavigationTiming for navigation entries
              const navEntry = entry as PerformanceNavigationTiming;
              console.log('[MobileOptimization] Navigation timing:', {
                loadTime: navEntry.loadEventEnd - navEntry.loadEventStart,
                domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
                type: navEntry.type
              });
            }
          });
        });

        observer.observe({ entryTypes: ['navigation', 'measure'] });
      } catch (error) {
        console.warn('[MobileOptimization] Performance observer not supported:', error);
      }
    }
  }

  private setupMemoryManagement(): void {
    // Clean up unused resources when app goes to background
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.cleanupResources();
      }
    });

    // Less aggressive memory monitoring (reduced from 10s to 60s)
    if ('memory' in performance) {
      setInterval(() => {
        const memInfo = (performance as any).memory;
        if (memInfo) {
          const usedMB = memInfo.usedJSHeapSize / 1048576;
          const totalMB = memInfo.totalJSHeapSize / 1048576;
          
          // Only warn if memory usage is critically high (increased threshold)
          if (usedMB / totalMB > 0.95) {
            console.warn('[MobileOptimization] Critical memory usage detected:', {
              used: `${usedMB.toFixed(2)}MB`,
              total: `${totalMB.toFixed(2)}MB`
            });
            this.cleanupResources();
          }
        }
      }, 60000); // Check every 60 seconds instead of 10
    }
  }

  private setupViewportOptimizations(): void {
    // Fix iOS viewport issues
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
    }

    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
      // Force viewport recalculation
      setTimeout(() => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      }, 100);
    });

    // Initial viewport height calculation
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }

  private cleanupResources(): void {
    try {
      // Clear any cached data that's not essential
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes('temp') || name.includes('cache')) {
              caches.delete(name);
            }
          });
        });
      }

      // Trigger garbage collection if available
      if ('gc' in window) {
        (window as any).gc();
      }

      console.log('[MobileOptimization] Resources cleaned up');
    } catch (error) {
      console.warn('[MobileOptimization] Resource cleanup failed:', error);
    }
  }

  // Public methods for manual optimization
  optimizeForLowMemory(): void {
    this.cleanupResources();
    
    // Reduce animation quality
    document.body.classList.add('low-memory-mode');
    
    // Disable non-essential features temporarily
    const style = document.createElement('style');
    style.id = 'low-memory-optimizations';
    style.textContent = `
      .low-memory-mode * {
        animation: none !important;
        transition: none !important;
      }
      .low-memory-mode img:not(.critical) {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  restoreNormalMode(): void {
    document.body.classList.remove('low-memory-mode');
    const style = document.getElementById('low-memory-optimizations');
    if (style) {
      style.remove();
    }
  }
}

export const mobileOptimizationService = MobileOptimizationService.getInstance();
