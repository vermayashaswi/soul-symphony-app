/**
 * Phase 1: Query complexity scoring and routing
 * Phase 3: Intelligent search strategy
 */

import { QueryComplexityMetrics } from './queryComplexityAnalyzer';

export interface SearchStrategy {
  name: 'vector_only' | 'sql_only' | 'hybrid' | 'dual_parallel' | 'dual_sequential';
  vectorThreshold: number;
  maxEntries: number;
  timeoutMs: number;
  useEntitySearch: boolean;
  useEmotionSearch: boolean;
  useThemeSearch: boolean;
  priority: 'speed' | 'accuracy' | 'comprehensiveness';
}

export interface QueryRoute {
  routeName: string;
  searchStrategy: SearchStrategy;
  responseOptimization: {
    maxTokens: number;
    temperature: number;
    useStreaming: boolean;
  };
  cacheStrategy: 'none' | 'short' | 'medium' | 'long';
  fallbackRoute?: string;
}

export class SmartQueryRouter {
  private performanceHistory: Map<string, number[]> = new Map();
  private routeConfigs: Map<string, QueryRoute> = new Map();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Phase 1: Fast track for simple queries
    this.routeConfigs.set('fast_track', {
      routeName: 'fast_track',
      searchStrategy: {
        name: 'vector_only',
        vectorThreshold: 0.3,
        maxEntries: 5,
        timeoutMs: 2000,
        useEntitySearch: false,
        useEmotionSearch: true,
        useThemeSearch: false,
        priority: 'speed'
      },
      responseOptimization: {
        maxTokens: 200,
        temperature: 0.3,
        useStreaming: false
      },
      cacheStrategy: 'short',
      fallbackRoute: 'standard'
    });

    // Standard route for moderate complexity
    this.routeConfigs.set('standard', {
      routeName: 'standard',
      searchStrategy: {
        name: 'hybrid',
        vectorThreshold: 0.2,
        maxEntries: 10,
        timeoutMs: 5000,
        useEntitySearch: true,
        useEmotionSearch: true,
        useThemeSearch: true,
        priority: 'accuracy'
      },
      responseOptimization: {
        maxTokens: 400,
        temperature: 0.5,
        useStreaming: false
      },
      cacheStrategy: 'medium',
      fallbackRoute: 'comprehensive'
    });

    // Phase 3: Comprehensive route for complex queries
    this.routeConfigs.set('comprehensive', {
      routeName: 'comprehensive',
      searchStrategy: {
        name: 'dual_parallel',
        vectorThreshold: 0.1,
        maxEntries: 20,
        timeoutMs: 8000,
        useEntitySearch: true,
        useEmotionSearch: true,
        useThemeSearch: true,
        priority: 'comprehensiveness'
      },
      responseOptimization: {
        maxTokens: 600,
        temperature: 0.6,
        useStreaming: true
      },
      cacheStrategy: 'long',
      fallbackRoute: 'emergency'
    });

    // Emergency fallback route
    this.routeConfigs.set('emergency', {
      routeName: 'emergency',
      searchStrategy: {
        name: 'sql_only',
        vectorThreshold: 0.0,
        maxEntries: 5,
        timeoutMs: 3000,
        useEntitySearch: false,
        useEmotionSearch: true,
        useThemeSearch: false,
        priority: 'speed'
      },
      responseOptimization: {
        maxTokens: 300,
        temperature: 0.4,
        useStreaming: false
      },
      cacheStrategy: 'none'
    });
  }

  // Phase 1: Route queries based on complexity analysis
  routeQuery(
    complexity: QueryComplexityMetrics,
    contextFactors: {
      hasPersonalPronouns: boolean;
      hasTimeReferences: boolean;
      hasEmotionKeywords: boolean;
      conversationDepth: number;
      userPreferences?: { prefersFast?: boolean; prefersDetailed?: boolean };
    }
  ): {
    primaryRoute: QueryRoute;
    fallbackRoute?: QueryRoute;
    routingReason: string;
  } {
    
    let selectedRoute = 'standard';
    let routingReason = 'Default routing';

    // Phase 1: Complexity-based routing
    switch (complexity.recommendedStrategy) {
      case 'fast_track':
        selectedRoute = 'fast_track';
        routingReason = 'Simple query - optimized for speed';
        break;
        
      case 'standard':
        selectedRoute = 'standard';
        routingReason = 'Moderate complexity - balanced approach';
        break;
        
      case 'comprehensive':
        selectedRoute = 'comprehensive';
        routingReason = 'Complex query - comprehensive analysis needed';
        break;
        
      case 'intelligent_orchestration':
        selectedRoute = 'comprehensive';
        routingReason = 'Very complex query - full analysis required';
        break;
    }

    // Phase 3: Context-based route adjustments
    if (contextFactors.hasPersonalPronouns && contextFactors.hasEmotionKeywords) {
      selectedRoute = 'comprehensive';
      routingReason += ' + Personal emotional query requires comprehensive analysis';
    }

    if (contextFactors.conversationDepth > 5 && contextFactors.userPreferences?.prefersFast) {
      selectedRoute = 'fast_track';
      routingReason += ' + User preference for speed in deep conversation';
    }

    if (contextFactors.hasTimeReferences && complexity.complexityLevel === 'complex') {
      selectedRoute = 'comprehensive';
      routingReason += ' + Temporal analysis requires comprehensive search';
    }

    // Get performance history for optimization
    const avgPerformance = this.getAveragePerformance(selectedRoute);
    if (avgPerformance > 10000) { // If route is consistently slow
      const fallbackRoute = this.routeConfigs.get(selectedRoute)?.fallbackRoute;
      if (fallbackRoute) {
        selectedRoute = fallbackRoute;
        routingReason += ' + Performance optimization fallback';
      }
    }

    const primaryRoute = this.routeConfigs.get(selectedRoute)!;
    const fallbackRoute = primaryRoute.fallbackRoute ? 
      this.routeConfigs.get(primaryRoute.fallbackRoute) : undefined;

    return {
      primaryRoute,
      fallbackRoute,
      routingReason
    };
  }

  // Phase 3: Intelligent search strategy selection
  optimizeSearchStrategy(
    route: QueryRoute,
    queryContext: {
      hasEntities: boolean;
      hasEmotions: boolean;
      hasThemes: boolean;
      timeConstrained: boolean;
      userContext?: any;
    }
  ): SearchStrategy {
    const baseStrategy = { ...route.searchStrategy };

    // Dynamic optimization based on query content
    if (!queryContext.hasEntities) {
      baseStrategy.useEntitySearch = false;
      baseStrategy.maxEntries += 2; // Can search more efficiently
    }

    if (!queryContext.hasEmotions) {
      baseStrategy.useEmotionSearch = false;
      baseStrategy.maxEntries += 2;
    }

    if (!queryContext.hasThemes) {
      baseStrategy.useThemeSearch = false;
      baseStrategy.maxEntries += 2;
    }

    // Time-constrained optimization
    if (queryContext.timeConstrained) {
      baseStrategy.timeoutMs = Math.min(baseStrategy.timeoutMs, 3000);
      baseStrategy.maxEntries = Math.min(baseStrategy.maxEntries, 10);
      
      if (baseStrategy.name === 'dual_parallel') {
        baseStrategy.name = 'hybrid'; // Faster alternative
      }
    }

    // Performance-based adjustments
    const recentPerformance = this.getRecentPerformance(route.routeName);
    if (recentPerformance > baseStrategy.timeoutMs * 0.8) {
      // If recent queries are taking close to timeout, be more conservative
      baseStrategy.maxEntries = Math.floor(baseStrategy.maxEntries * 0.8);
      baseStrategy.timeoutMs = Math.floor(baseStrategy.timeoutMs * 0.9);
    }

    return baseStrategy;
  }

  // Performance tracking for continuous optimization
  recordPerformance(routeName: string, executionTimeMs: number, success: boolean) {
    if (!this.performanceHistory.has(routeName)) {
      this.performanceHistory.set(routeName, []);
    }

    const history = this.performanceHistory.get(routeName)!;
    history.push(success ? executionTimeMs : executionTimeMs * 2); // Penalize failures

    // Keep only recent 50 measurements
    if (history.length > 50) {
      history.shift();
    }
  }

  private getAveragePerformance(routeName: string): number {
    const history = this.performanceHistory.get(routeName);
    if (!history || history.length === 0) return 0;
    
    return history.reduce((sum, time) => sum + time, 0) / history.length;
  }

  private getRecentPerformance(routeName: string): number {
    const history = this.performanceHistory.get(routeName);
    if (!history || history.length === 0) return 0;
    
    const recentEntries = history.slice(-5); // Last 5 queries
    return recentEntries.reduce((sum, time) => sum + time, 0) / recentEntries.length;
  }

  // Get routing analytics for monitoring
  getRoutingAnalytics(): {
    routeUsage: Record<string, number>;
    averagePerformance: Record<string, number>;
    successRates: Record<string, number>;
  } {
    const routeUsage: Record<string, number> = {};
    const averagePerformance: Record<string, number> = {};
    const successRates: Record<string, number> = {};

    for (const [routeName, history] of this.performanceHistory.entries()) {
      routeUsage[routeName] = history.length;
      averagePerformance[routeName] = this.getAveragePerformance(routeName);
      
      // Calculate success rate (assuming failures are > 15 seconds)
      const successes = history.filter(time => time < 15000).length;
      successRates[routeName] = history.length > 0 ? successes / history.length : 0;
    }

    return {
      routeUsage,
      averagePerformance,
      successRates
    };
  }
}
