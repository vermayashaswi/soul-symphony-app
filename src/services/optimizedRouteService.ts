import { nativeIntegrationService } from './nativeIntegrationService';

/**
 * Optimized route service with caching and minimal computation
 * Reduces redundant route checking and improves performance
 */
class OptimizedRouteService {
  private routeCache = new Map<string, boolean>();
  private appRouteCache = new Map<string, boolean>();
  private websiteRouteCache = new Map<string, boolean>();
  
  // Cache TTL in milliseconds (5 minutes)
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private cacheTimestamps = new Map<string, number>();

  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;
    return Date.now() - timestamp < this.CACHE_TTL;
  }

  private setCacheEntry(key: string, value: boolean): void {
    this.routeCache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Check if current environment is native app
   * Cached for performance
   */
  isNativeApp(): boolean {
    const cacheKey = 'isNative';
    if (this.isCacheValid(cacheKey) && this.routeCache.has(cacheKey)) {
      return this.routeCache.get(cacheKey)!;
    }

    const isNative = nativeIntegrationService.isRunningNatively();
    this.setCacheEntry(cacheKey, isNative);
    return isNative;
  }

  /**
   * Optimized app route checking with caching
   */
  isAppRoute(pathname: string): boolean {
    const cacheKey = `app-${pathname}`;
    if (this.isCacheValid(cacheKey) && this.appRouteCache.has(cacheKey)) {
      return this.appRouteCache.get(cacheKey)!;
    }

    let result: boolean;

    // For native apps, ALL routes are considered app routes
    if (this.isNativeApp()) {
      result = true;
    } else {
      // For web apps, app routes must start with /app/ or be exactly /app
      result = pathname.startsWith('/app/') || pathname === '/app';
    }

    this.appRouteCache.set(cacheKey, result);
    this.cacheTimestamps.set(cacheKey, Date.now());
    return result;
  }

  /**
   * Optimized website route checking with caching
   */
  isWebsiteRoute(pathname: string): boolean {
    const cacheKey = `website-${pathname}`;
    if (this.isCacheValid(cacheKey) && this.websiteRouteCache.has(cacheKey)) {
      return this.websiteRouteCache.get(cacheKey)!;
    }

    let result: boolean;

    // For native apps, NO routes are website routes
    if (this.isNativeApp()) {
      result = false;
    } else {
      // If it's an app route, it's not a website route
      if (this.isAppRoute(pathname)) {
        result = false;
      } else {
        // Define website routes for web mode
        const websitePrefixes = ['/', '/about', '/pricing', '/terms', '/privacy', '/blog', '/contact', '/faq', '/download'];
        
        result = websitePrefixes.some(prefix => 
          pathname === prefix || pathname.startsWith(`${prefix}/`)
        );
      }
    }

    this.websiteRouteCache.set(cacheKey, result);
    this.cacheTimestamps.set(cacheKey, Date.now());
    return result;
  }

  /**
   * Clear all caches - useful for testing or when environment changes
   */
  clearCache(): void {
    this.routeCache.clear();
    this.appRouteCache.clear();
    this.websiteRouteCache.clear();
    this.cacheTimestamps.clear();
    console.log('[OptimizedRouteService] Caches cleared');
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    return {
      routeCacheSize: this.routeCache.size,
      appRouteCacheSize: this.appRouteCache.size,
      websiteRouteCacheSize: this.websiteRouteCache.size,
      timestampsSize: this.cacheTimestamps.size,
      cacheTTL: this.CACHE_TTL
    };
  }
}

export const optimizedRouteService = new OptimizedRouteService();