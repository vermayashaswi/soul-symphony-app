/**
 * Lightweight performance monitoring service
 * Designed to track critical metrics without blocking the UI
 */

interface PerformanceEntry {
  name: string;
  startTime: number;
  duration: number;
  success: boolean;
}

class LightweightPerformanceService {
  private static instance: LightweightPerformanceService;
  private entries: PerformanceEntry[] = [];
  private maxEntries = 50; // Keep memory usage low
  private slowThreshold = 2000; // 2 seconds

  static getInstance(): LightweightPerformanceService {
    if (!LightweightPerformanceService.instance) {
      LightweightPerformanceService.instance = new LightweightPerformanceService();
    }
    return LightweightPerformanceService.instance;
  }

  // Track any operation
  track<T>(name: string, operation: Promise<T>): Promise<T> {
    const startTime = performance.now();
    
    return operation
      .then(result => {
        this.recordEntry(name, startTime, true);
        return result;
      })
      .catch(error => {
        this.recordEntry(name, startTime, false);
        throw error;
      });
  }

  // Track synchronous operations
  trackSync<T>(name: string, operation: () => T): T {
    const startTime = performance.now();
    
    try {
      const result = operation();
      this.recordEntry(name, startTime, true);
      return result;
    } catch (error) {
      this.recordEntry(name, startTime, false);
      throw error;
    }
  }

  private recordEntry(name: string, startTime: number, success: boolean) {
    const duration = performance.now() - startTime;
    
    // Add to entries
    this.entries.push({ name, startTime, duration, success });
    
    // Keep only recent entries
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    
    // Log slow operations
    if (duration > this.slowThreshold) {
      console.warn(`[Performance] Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }
  }

  // Get performance summary
  getSummary() {
    const now = performance.now();
    const recentEntries = this.entries.filter(e => now - e.startTime < 60000); // Last minute
    
    if (recentEntries.length === 0) return null;
    
    const successful = recentEntries.filter(e => e.success);
    const failed = recentEntries.filter(e => !e.success);
    const slow = recentEntries.filter(e => e.duration > this.slowThreshold);
    
    const avgDuration = successful.reduce((sum, e) => sum + e.duration, 0) / successful.length;
    
    return {
      totalOperations: recentEntries.length,
      successRate: (successful.length / recentEntries.length) * 100,
      avgDuration: Math.round(avgDuration),
      slowOperations: slow.length,
      failedOperations: failed.length,
      slowestOperation: slow.length > 0 ? slow.reduce((max, e) => e.duration > max.duration ? e : max) : null
    };
  }

  // Clear old entries
  cleanup() {
    const now = performance.now();
    this.entries = this.entries.filter(e => now - e.startTime < 300000); // Keep last 5 minutes
  }
}

export const performanceService = LightweightPerformanceService.getInstance();

// Auto-cleanup every 5 minutes
setInterval(() => {
  performanceService.cleanup();
}, 300000);
