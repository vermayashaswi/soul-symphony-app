
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

      // Apply mobile-specific CSS optimizations
      this.applyMobileCSSOptimizations();

      // Setup touch event optimizations
      this.setupTouchOptimizations();

      // Setup performance monitoring
      this.setupPerformanceMonitoring();

      // Setup memory management
      this.setupMemoryManagement();

      // Setup viewport optimizations
      this.setupViewportOptimizations();

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
              console.log('[MobileOptimization] Navigation timing:', {
                loadTime: entry.loadEventEnd - entry.loadEventStart,
                domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
                type: entry.type
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
    // Clean up unused resources periodically
    setInterval(() => {
      if (document.visibilityState === 'hidden') {
        // Clean up when app is in background
        this.cleanupResources();
      }
    }, 30000); // Every 30 seconds

    // Listen for memory pressure warnings
    if ('memory' in performance) {
      setInterval(() => {
        const memInfo = (performance as any).memory;
        if (memInfo) {
          const usedMB = memInfo.usedJSHeapSize / 1048576;
          const totalMB = memInfo.totalJSHeapSize / 1048576;
          
          if (usedMB / totalMB > 0.9) {
            console.warn('[MobileOptimization] High memory usage detected:', {
              used: `${usedMB.toFixed(2)}MB`,
              total: `${totalMB.toFixed(2)}MB`
            });
            this.cleanupResources();
          }
        }
      }, 10000); // Check every 10 seconds
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
