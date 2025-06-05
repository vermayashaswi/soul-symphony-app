
// Smart Query Router for intelligent processing path selection
export class SmartQueryRouter {
  private static routingHistory = new Map<string, {
    route: string;
    performance: number;
    timestamp: number;
    success: boolean;
  }>();
  
  private static readonly PERFORMANCE_THRESHOLD = 2000; // 2 seconds
  private static readonly HISTORY_LIMIT = 100;
  
  // Intelligent routing based on query characteristics and performance history
  static async routeQuery(
    queryContext: {
      message: string;
      userId: string;
      complexity: 'simple' | 'moderate' | 'complex';
      hasTimeContext: boolean;
      hasPersonalPronouns: boolean;
      entryCount: number;
      expectedResultType: 'factual' | 'analytical' | 'emotional';
    }
  ): Promise<{
    primaryRoute: string;
    fallbackRoute: string;
    optimizations: string[];
    skipOperations: string[];
    expectedPerformance: number;
  }> {
    console.log('[SmartQueryRouter] Analyzing optimal routing strategy');
    
    const { 
      message, 
      complexity, 
      hasTimeContext, 
      entryCount, 
      expectedResultType 
    } = queryContext;
    
    let primaryRoute = 'standard';
    let fallbackRoute = 'basic';
    const optimizations = ['smart_routing'];
    const skipOperations = [];
    
    // Performance-based routing
    const avgPerformance = this.getAveragePerformanceForQuery(message);
    
    // Route selection logic
    if (complexity === 'simple' && entryCount < 20) {
      primaryRoute = 'fast_track';
      fallbackRoute = 'standard';
      optimizations.push('aggressive_caching', 'minimal_processing');
      skipOperations.push('detailed_analysis', 'entity_extraction');
      
    } else if (complexity === 'complex' || entryCount > 100) {
      primaryRoute = 'comprehensive';
      fallbackRoute = 'standard';
      optimizations.push('parallel_processing', 'chunked_analysis');
      
    } else if (expectedResultType === 'emotional') {
      primaryRoute = 'emotion_focused';
      fallbackRoute = 'standard';
      optimizations.push('emotion_optimization', 'sentiment_prioritization');
      
    } else if (hasTimeContext) {
      primaryRoute = 'temporal_optimized';
      fallbackRoute = 'standard';
      optimizations.push('temporal_indexing', 'date_range_optimization');
      
    } else {
      primaryRoute = 'balanced';
      fallbackRoute = 'fast_track';
      optimizations.push('adaptive_processing');
    }
    
    // Performance-based adjustments
    if (avgPerformance > this.PERFORMANCE_THRESHOLD) {
      optimizations.push('performance_boost');
      skipOperations.push('non_essential_operations');
      
      // Downgrade route if performance is poor
      if (primaryRoute === 'comprehensive') {
        primaryRoute = 'standard';
        fallbackRoute = 'fast_track';
      }
    }
    
    const expectedPerformance = this.estimatePerformance(primaryRoute, queryContext);
    
    console.log(`[SmartQueryRouter] Selected route: ${primaryRoute} (expected: ${expectedPerformance}ms)`);
    
    return {
      primaryRoute,
      fallbackRoute,
      optimizations,
      skipOperations,
      expectedPerformance
    };
  }
  
  // Route-specific optimization configurations
  static getRouteConfiguration(route: string): {
    maxConcurrency: number;
    timeoutMs: number;
    cacheStrategy: string;
    processingLimits: any;
  } {
    const configurations = {
      fast_track: {
        maxConcurrency: 2,
        timeoutMs: 3000,
        cacheStrategy: 'aggressive',
        processingLimits: {
          maxEntries: 5,
          maxEmbeddings: 3,
          skipDetailedAnalysis: true
        }
      },
      standard: {
        maxConcurrency: 3,
        timeoutMs: 5000,
        cacheStrategy: 'balanced',
        processingLimits: {
          maxEntries: 10,
          maxEmbeddings: 8,
          skipDetailedAnalysis: false
        }
      },
      comprehensive: {
        maxConcurrency: 5,
        timeoutMs: 10000,
        cacheStrategy: 'performance',
        processingLimits: {
          maxEntries: 20,
          maxEmbeddings: 15,
          skipDetailedAnalysis: false
        }
      },
      emotion_focused: {
        maxConcurrency: 3,
        timeoutMs: 6000,
        cacheStrategy: 'emotion_optimized',
        processingLimits: {
          maxEntries: 12,
          maxEmbeddings: 10,
          prioritizeEmotionalContent: true
        }
      },
      temporal_optimized: {
        maxConcurrency: 4,
        timeoutMs: 7000,
        cacheStrategy: 'temporal_aware',
        processingLimits: {
          maxEntries: 15,
          maxEmbeddings: 12,
          useTemporalIndexing: true
        }
      }
    };
    
    return configurations[route] || configurations.standard;
  }
  
  // Adaptive routing based on real-time performance
  static async executeWithAdaptiveRouting(
    queryContext: any,
    executionFunction: (config: any) => Promise<any>
  ): Promise<{
    result: any;
    routeUsed: string;
    performanceMs: number;
    adaptationsApplied: string[];
  }> {
    console.log('[SmartQueryRouter] Executing with adaptive routing');
    
    const routing = await this.routeQuery(queryContext);
    let { primaryRoute, fallbackRoute } = routing;
    const adaptationsApplied = [];
    
    const startTime = Date.now();
    let result;
    let routeUsed = primaryRoute;
    
    try {
      // Try primary route first
      const primaryConfig = this.getRouteConfiguration(primaryRoute);
      result = await Promise.race([
        executionFunction(primaryConfig),
        this.createTimeoutPromise(primaryConfig.timeoutMs)
      ]);
      
    } catch (error) {
      console.log(`[SmartQueryRouter] Primary route ${primaryRoute} failed, trying fallback`);
      adaptationsApplied.push('fallback_route_used');
      
      // Try fallback route
      const fallbackConfig = this.getRouteConfiguration(fallbackRoute);
      routeUsed = fallbackRoute;
      
      try {
        result = await Promise.race([
          executionFunction(fallbackConfig),
          this.createTimeoutPromise(fallbackConfig.timeoutMs)
        ]);
      } catch (fallbackError) {
        console.log('[SmartQueryRouter] Fallback route also failed, using minimal processing');
        adaptationsApplied.push('minimal_processing_fallback');
        
        // Final fallback - minimal processing
        const minimalConfig = this.getRouteConfiguration('fast_track');
        routeUsed = 'emergency_fallback';
        result = await executionFunction(minimalConfig);
      }
    }
    
    const performanceMs = Date.now() - startTime;
    
    // Record performance for future routing decisions
    this.recordRoutingPerformance(queryContext.message, routeUsed, performanceMs, true);
    
    console.log(`[SmartQueryRouter] Completed with route: ${routeUsed} (${performanceMs}ms)`);
    
    return {
      result,
      routeUsed,
      performanceMs,
      adaptationsApplied
    };
  }
  
  // Performance monitoring and learning
  private static recordRoutingPerformance(
    query: string,
    route: string,
    performanceMs: number,
    success: boolean
  ): void {
    const queryHash = this.hashString(query);
    
    this.routingHistory.set(queryHash, {
      route,
      performance: performanceMs,
      timestamp: Date.now(),
      success
    });
    
    // Limit history size
    if (this.routingHistory.size > this.HISTORY_LIMIT) {
      const oldestKey = Array.from(this.routingHistory.keys())[0];
      this.routingHistory.delete(oldestKey);
    }
  }
  
  private static getAveragePerformanceForQuery(query: string): number {
    const queryHash = this.hashString(query);
    const history = this.routingHistory.get(queryHash);
    
    if (!history) {
      // Return average of all recorded performances
      if (this.routingHistory.size === 0) return 1500; // Default estimate
      
      const allPerformances = Array.from(this.routingHistory.values())
        .filter(h => h.success)
        .map(h => h.performance);
      
      return allPerformances.length > 0
        ? allPerformances.reduce((sum, p) => sum + p, 0) / allPerformances.length
        : 1500;
    }
    
    return history.performance;
  }
  
  private static estimatePerformance(route: string, queryContext: any): number {
    const baseEstimates = {
      fast_track: 800,
      standard: 1500,
      comprehensive: 3000,
      emotion_focused: 2000,
      temporal_optimized: 2200
    };
    
    let estimate = baseEstimates[route] || 1500;
    
    // Adjust based on context
    if (queryContext.entryCount > 50) estimate *= 1.5;
    if (queryContext.complexity === 'complex') estimate *= 1.3;
    if (queryContext.hasTimeContext) estimate *= 1.1;
    
    return Math.round(estimate);
  }
  
  private static createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Route timeout')), timeoutMs);
    });
  }
  
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  }
  
  // Analytics and monitoring
  static getRoutingAnalytics(): {
    totalQueries: number;
    routeDistribution: Record<string, number>;
    averagePerformance: Record<string, number>;
    successRates: Record<string, number>;
    adaptationFrequency: number;
  } {
    const routeDistribution: Record<string, number> = {};
    const performanceByRoute: Record<string, number[]> = {};
    const successByRoute: Record<string, { total: number; successful: number }> = {};
    
    for (const history of this.routingHistory.values()) {
      const route = history.route;
      
      routeDistribution[route] = (routeDistribution[route] || 0) + 1;
      
      if (!performanceByRoute[route]) performanceByRoute[route] = [];
      performanceByRoute[route].push(history.performance);
      
      if (!successByRoute[route]) successByRoute[route] = { total: 0, successful: 0 };
      successByRoute[route].total++;
      if (history.success) successByRoute[route].successful++;
    }
    
    const averagePerformance: Record<string, number> = {};
    for (const [route, performances] of Object.entries(performanceByRoute)) {
      averagePerformance[route] = performances.reduce((sum, p) => sum + p, 0) / performances.length;
    }
    
    const successRates: Record<string, number> = {};
    for (const [route, stats] of Object.entries(successByRoute)) {
      successRates[route] = stats.successful / stats.total;
    }
    
    return {
      totalQueries: this.routingHistory.size,
      routeDistribution,
      averagePerformance,
      successRates,
      adaptationFrequency: 0.15 // Would calculate from actual adaptation events
    };
  }
}
