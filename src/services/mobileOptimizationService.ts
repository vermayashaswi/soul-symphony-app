
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
    style.id = 'mobile-optimizations';
    style.textContent = `
      /* Mobile-specific optimizations - enhanced for keyboard compatibility */
      * {
        -webkit-tap-highlight-color: transparent;
      }

      /* Selective touch and user-select policies */
      body:not(.keyboard-visible) {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
      }

      /* Input elements always allow text selection and touch */
      input, textarea, select, [contenteditable], 
      [role="textbox"], [role="searchbox"], [role="combobox"],
      .input-field, [data-input="true"] {
        -webkit-user-select: text !important;
        user-select: text !important;
        -webkit-touch-callout: default !important;
        touch-action: manipulation !important;
      }

      /* Enhanced body touch policies based on keyboard state */
      body {
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-y: contain;
      }
      
      body:not(.keyboard-visible) {
        touch-action: pan-y;
      }
      
      body.keyboard-visible {
        touch-action: manipulation;
      }

      /* Prevent zoom on input focus while maintaining accessibility */
      input, select, textarea {
        font-size: max(16px, 1rem) !important;
        zoom: 1;
      }

      /* Optimize scrolling performance */
      .scroll-container {
        transform: translateZ(0);
        will-change: scroll-position;
      }

      /* Keyboard-aware scroll containers */
      .keyboard-visible .scroll-container {
        touch-action: pan-y pinch-zoom;
      }

      /* Input container optimizations */
      .mobile-chat-input-container,
      .chat-input-container {
        touch-action: manipulation;
        -webkit-user-select: text;
        user-select: text;
      }

      /* Platform-specific input optimizations */
      .platform-ios input, .platform-ios textarea {
        -webkit-appearance: none;
        border-radius: 0;
      }

      .platform-android input, .platform-android textarea {
        outline: none;
      }

      /* Reduce motion for better performance */
      @media (prefers-reduced-motion: reduce) {
        *:not(input):not(textarea):not([contenteditable]) {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }

      /* Debug styles for input detection */
      .debug-mode input:focus,
      .debug-mode textarea:focus,
      .debug-mode [contenteditable]:focus {
        outline: 2px solid #00ff00 !important;
      }
    `;
    document.head.appendChild(style);
  }

  private setupTouchOptimizations(): void {
    let keyboardVisible = false;
    let debugMode = false;
    
    // Enhanced input element detection
    const isInputElement = (element: HTMLElement): boolean => {
      const inputTags = ['INPUT', 'TEXTAREA', 'SELECT'];
      if (inputTags.includes(element.tagName)) return true;
      if (element.isContentEditable) return true;
      
      const role = element.getAttribute('role');
      if (role && ['textbox', 'searchbox', 'combobox'].includes(role)) return true;
      
      if (element.classList.contains('input-field') || element.dataset.input === 'true') return true;
      if (element.closest('input, textarea, select, [contenteditable], [role="textbox"], [role="searchbox"], [role="combobox"]')) return true;
      
      return false;
    };

    // Listen for keyboard state changes
    const handleKeyboardOpen = () => {
      keyboardVisible = true;
      console.log('[MobileOptimization] Keyboard opened - adjusting touch policies');
    };

    const handleKeyboardClose = () => {
      keyboardVisible = false;
      console.log('[MobileOptimization] Keyboard closed - restoring touch policies');
    };

    window.addEventListener('keyboardOpen', handleKeyboardOpen);
    window.addEventListener('keyboardClose', handleKeyboardClose);

    // Enhanced touch start handling
    document.addEventListener('touchstart', (e) => {
      const target = e.target as HTMLElement;
      
      // Always allow normal touch behavior for input elements
      if (target && isInputElement(target)) {
        if (debugMode) {
          console.log('[MobileOptimization] Touch allowed on input:', target.tagName, target.className);
        }
        return;
      }

      // Respect keyboard state
      if (keyboardVisible) {
        if (debugMode) {
          console.log('[MobileOptimization] Touch modified due to keyboard visibility');
        }
      }
    }, { passive: true });

    // Optimized scroll performance with keyboard awareness
    document.addEventListener('touchmove', (e) => {
      const target = e.target as HTMLElement;
      
      // Allow scrolling in input elements when keyboard is visible
      if (keyboardVisible && target && isInputElement(target)) {
        return;
      }
      
      // Prevent rubber band scrolling at document level only when safe
      if (e.target === document.body && !keyboardVisible) {
        e.preventDefault();
      }
    }, { passive: false });

    // Enhanced visual feedback for touch interactions
    document.addEventListener('touchstart', (e) => {
      const target = e.target as HTMLElement;
      
      // Skip visual feedback for input elements to avoid interference
      if (target && isInputElement(target)) {
        return;
      }
      
      if (target.closest('button') || target.closest('[role="button"]')) {
        target.style.opacity = '0.7';
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const target = e.target as HTMLElement;
      
      if (target && !isInputElement(target) && 
          (target.closest('button') || target.closest('[role="button"]'))) {
        setTimeout(() => {
          target.style.opacity = '';
        }, 150);
      }
    }, { passive: true });

    // Debug mode toggle
    (window as any).toggleMobileOptimizationDebug = () => {
      debugMode = !debugMode;
      document.body.classList.toggle('debug-mode', debugMode);
      console.log('[MobileOptimization] Debug mode:', debugMode ? 'enabled' : 'disabled');
    };
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
