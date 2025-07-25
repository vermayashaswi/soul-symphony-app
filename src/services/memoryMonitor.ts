interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

class MemoryMonitor {
  private static instance: MemoryMonitor;
  private isMonitoring = false;
  private memoryThreshold = 80 * 1024 * 1024; // 80MB threshold
  private checkInterval = 10000; // Check every 10 seconds
  private intervalId?: NodeJS.Timeout;

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  startMonitoring(): void {
    if (this.isMonitoring || !(performance as any).memory) {
      return;
    }

    this.isMonitoring = true;
    console.log('[MemoryMonitor] Starting memory monitoring...');

    this.intervalId = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);

    // Also check on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkMemoryUsage();
      }
    });
  }

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isMonitoring = false;
    console.log('[MemoryMonitor] Stopped memory monitoring');
  }

  private checkMemoryUsage(): void {
    try {
      const memory = (performance as any).memory as MemoryInfo;
      if (!memory) return;

      const usedMB = memory.usedJSHeapSize / (1024 * 1024);
      const totalMB = memory.totalJSHeapSize / (1024 * 1024);
      const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);

      const memoryUsagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

      // Log memory stats periodically
      if (Date.now() % 60000 < this.checkInterval) { // Every minute
        console.log(`[MemoryMonitor] Memory usage: ${usedMB.toFixed(1)}MB/${limitMB.toFixed(1)}MB (${memoryUsagePercent.toFixed(1)}%)`);
      }

      // Trigger cleanup if memory usage is high
      if (memory.usedJSHeapSize > this.memoryThreshold) {
        console.warn(`[MemoryMonitor] High memory usage detected: ${usedMB.toFixed(1)}MB`);
        this.triggerMemoryCleanup();
      }

      // Trigger aggressive cleanup if memory usage is critical
      if (memoryUsagePercent > 90) {
        console.error(`[MemoryMonitor] Critical memory usage: ${memoryUsagePercent.toFixed(1)}%`);
        this.triggerAggressiveCleanup();
      }

    } catch (error) {
      console.warn('[MemoryMonitor] Error checking memory usage:', error);
    }
  }

  private triggerMemoryCleanup(): void {
    try {
      // Clear any cached data
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            if (cacheName.includes('temp') || cacheName.includes('cache')) {
              caches.delete(cacheName);
            }
          });
        });
      }

      // Force garbage collection if available
      if ((window as any).gc) {
        (window as any).gc();
      }

      // Dispatch cleanup event for other services
      window.dispatchEvent(new CustomEvent('memoryCleanupNeeded', {
        detail: { level: 'normal' }
      }));

    } catch (error) {
      console.warn('[MemoryMonitor] Error during memory cleanup:', error);
    }
  }

  private triggerAggressiveCleanup(): void {
    try {
      console.log('[MemoryMonitor] Triggering aggressive memory cleanup...');

      // Clear all non-essential caches
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            if (!cacheName.includes('essential')) {
              caches.delete(cacheName);
            }
          });
        });
      }

      // Clear sessionStorage non-essential items
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('temp') || key.includes('cache'))) {
          sessionStorage.removeItem(key);
        }
      }

      // Dispatch aggressive cleanup event
      window.dispatchEvent(new CustomEvent('memoryCleanupNeeded', {
        detail: { level: 'aggressive' }
      }));

      // Force garbage collection
      if ((window as any).gc) {
        (window as any).gc();
      }

    } catch (error) {
      console.warn('[MemoryMonitor] Error during aggressive cleanup:', error);
    }
  }

  getCurrentMemoryUsage(): MemoryInfo | null {
    try {
      return (performance as any).memory || null;
    } catch {
      return null;
    }
  }

  isMemoryLow(): boolean {
    const memory = this.getCurrentMemoryUsage();
    if (!memory) return false;
    
    return memory.usedJSHeapSize > this.memoryThreshold;
  }
}

export const memoryMonitor = MemoryMonitor.getInstance();