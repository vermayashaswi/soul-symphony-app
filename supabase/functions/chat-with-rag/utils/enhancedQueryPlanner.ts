
// Enhanced query planning with database-aware theme/emotion context
import { createThemeEmotionService } from '../../_shared/themeEmotionService.ts';

export interface EnhancedQueryPlan {
  strategy: string;
  complexity: 'simple' | 'complex' | 'multi_part';
  requiresTimeFilter: boolean;
  requiresAggregation: boolean;
  searchStrategy: 'dual_vector_sql' | 'dual_parallel' | 'dual_sequential';
  expectedResponseType: 'direct' | 'analysis' | 'aggregated' | 'narrative';
  dualSearchEnabled: boolean;
  executionMode: 'parallel' | 'sequential';
  databaseValidation: boolean;
  themeFilters: string[];
  emotionFilters: string[];
  availableThemes: string[];
  availableEmotions: string[];
  confidence: number;
}

export async function planEnhancedQuery(message: string, timeRange?: any): Promise<EnhancedQueryPlan> {
  const lowerMessage = message.toLowerCase();
  
  // Get database context for theme/emotion validation
  const themeEmotionService = createThemeEmotionService();
  const { themes: availableThemes, emotions: availableEmotions } = await themeEmotionService.getThemeEmotionContext();
  
  // Determine complexity
  let complexity: 'simple' | 'complex' | 'multi_part' = 'simple';
  
  const questionMarkers = (lowerMessage.match(/\?/g) || []).length;
  const andMarkers = (lowerMessage.match(/\band\b/g) || []).length;
  const alsoMarkers = (lowerMessage.match(/\balso\b/g) || []).length;
  
  if (questionMarkers > 1 || (andMarkers > 0 && (questionMarkers > 0 || alsoMarkers > 0))) {
    complexity = 'multi_part';
  } else if (/\b(pattern|trend|analysis|compare|correlation|top\s+\d+|most\s+(common|frequent)|when do|what time|how often|frequency|usually|typically)\b/i.test(lowerMessage)) {
    complexity = 'complex';
  }
  
  // Determine if time filtering is required
  const requiresTimeFilter = !!(timeRange || /\b(last|this|current|recent|past)\s+(week|month|year|day)\b/i.test(lowerMessage));
  
  // Determine if aggregation is required
  const requiresAggregation = /\b(top\s+\d+|most\s+(common|frequent)|average|total|sum|count|how\s+many|how\s+often|when do|what time|frequency|usually|typically|pattern|trend)\b/i.test(lowerMessage);
  
  // Enhanced theme filtering using database themes
  const themeFilters: string[] = [];
  availableThemes.forEach(theme => {
    const themeWords = theme.toLowerCase().split(/[\s&]+/);
    if (themeWords.some(word => lowerMessage.includes(word))) {
      themeFilters.push(theme);
    }
  });
  
  // Enhanced emotion filtering using database emotions
  const emotionFilters: string[] = [];
  availableEmotions.forEach(emotion => {
    if (lowerMessage.includes(emotion.toLowerCase())) {
      emotionFilters.push(emotion);
    }
  });
  
  // Always use dual search strategy with database validation
  let searchStrategy: 'dual_vector_sql' | 'dual_parallel' | 'dual_sequential' = 'dual_vector_sql';
  let executionMode: 'parallel' | 'sequential' = 'parallel';
  
  // Determine execution mode based on complexity and database filters
  if (complexity === 'complex' || requiresAggregation || complexity === 'multi_part' || themeFilters.length > 0 || emotionFilters.length > 0) {
    searchStrategy = 'dual_parallel';
    executionMode = 'parallel';
  } else if (requiresTimeFilter) {
    searchStrategy = 'dual_sequential';
    executionMode = 'sequential';
  }
  
  // Determine expected response type
  let expectedResponseType: 'direct' | 'analysis' | 'aggregated' | 'narrative' = 'narrative';
  
  if (/^(what\s+are\s+the\s+dates?|when\s+(is|was))\b/i.test(lowerMessage)) {
    expectedResponseType = 'direct';
  } else if (requiresAggregation || /\btop\s+\d+\b/i.test(lowerMessage) || /\b(when do|what time|how often|frequency|usually|typically)\b/i.test(lowerMessage)) {
    expectedResponseType = 'aggregated';
  } else if (/\b(analyze|analysis|insight|pattern|trend)\b/i.test(lowerMessage)) {
    expectedResponseType = 'analysis';
  }
  
  // Calculate confidence based on database matches
  let confidence = 0.7; // Base confidence
  if (themeFilters.length > 0) confidence += 0.1;
  if (emotionFilters.length > 0) confidence += 0.1;
  if (complexity === 'simple') confidence += 0.05;
  confidence = Math.min(confidence, 1.0);
  
  // Determine strategy with database awareness
  let strategy = 'dual_search_database_aware';
  
  if (complexity === 'multi_part') {
    strategy = 'dual_search_database_segmented_processing';
  } else if (expectedResponseType === 'aggregated') {
    strategy = 'dual_search_database_aggregation';
  } else if (expectedResponseType === 'analysis') {
    strategy = 'dual_search_database_pattern_analysis';
  } else if (requiresTimeFilter) {
    strategy = 'dual_search_database_time_filtered';
  } else if (themeFilters.length > 0 || emotionFilters.length > 0) {
    strategy = 'dual_search_database_filtered';
  }
  
  return {
    strategy,
    complexity,
    requiresTimeFilter,
    requiresAggregation,
    searchStrategy,
    expectedResponseType,
    dualSearchEnabled: true,
    executionMode,
    databaseValidation: true,
    themeFilters,
    emotionFilters,
    availableThemes,
    availableEmotions,
    confidence
  };
}

export function shouldUseComprehensiveSearch(plan: EnhancedQueryPlan): boolean {
  // With database-aware dual search, we're always comprehensive
  return plan.databaseValidation && plan.dualSearchEnabled;
}

export function getMaxEntries(plan: EnhancedQueryPlan): number {
  // Adjust entry limits for database-aware dual search
  if (plan.searchStrategy === 'dual_parallel' && (plan.themeFilters.length > 0 || plan.emotionFilters.length > 0)) {
    return 150; // More entries when we have specific filters
  } else if (plan.searchStrategy === 'dual_parallel') {
    return 100;
  } else if (plan.complexity === 'complex') {
    return 50;
  } else {
    return 20;
  }
}

export function shouldUseAnalyticalFormatting(plan: EnhancedQueryPlan, message: string): boolean {
  // Enhanced detection with database awareness
  const analyticalKeywords = [
    'pattern', 'trend', 'analysis', 'when do', 'what time', 'how often',
    'frequency', 'usually', 'typically', 'most', 'least', 'statistics',
    'insights', 'breakdown', 'summary', 'overview', 'comparison'
  ];
  
  const hasAnalyticalKeywords = analyticalKeywords.some(keyword => message.toLowerCase().includes(keyword));
  const hasFilters = plan.themeFilters.length > 0 || plan.emotionFilters.length > 0;
  
  return plan.expectedResponseType === 'analysis' ||
         plan.expectedResponseType === 'aggregated' ||
         hasAnalyticalKeywords ||
         (hasFilters && plan.complexity !== 'simple');
}
