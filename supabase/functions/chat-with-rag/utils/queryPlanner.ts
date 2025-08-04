
// Enhanced query planning for chat-with-rag function with dual search support
export interface QueryPlan {
  strategy: string;
  complexity: 'simple' | 'complex' | 'multi_part';
  requiresTimeFilter: boolean;
  requiresAggregation: boolean;
  searchStrategy: 'dual_vector_sql' | 'dual_parallel' | 'dual_sequential';
  expectedResponseType: 'direct' | 'analysis' | 'aggregated' | 'narrative';
  dualSearchEnabled: boolean;
  executionMode: 'parallel' | 'sequential';
}

export function planQuery(message: string, timeRange?: any): QueryPlan {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced complexity determination with progress tracking and meditation indicators
  let complexity: 'simple' | 'complex' | 'multi_part' = 'simple';
  
  const questionMarkers = (lowerMessage.match(/\?/g) || []).length;
  const andMarkers = (lowerMessage.match(/\band\b/g) || []).length;
  const alsoMarkers = (lowerMessage.match(/\balso\b/g) || []).length;
  
  // Enhanced complexity patterns including progress and temporal indicators
  const complexPatterns = [
    /\b(pattern|trend|analysis|compare|correlation|top\s+\d+|most\s+(common|frequent)|when do|what time|how often|frequency|usually|typically)\b/i,
    /\b(progress|journey|development|evolution|growth|improvement|change|transformation)\b/i,
    /\b(meditation|practice|mindfulness|spiritual|wellness)\b.*\b(since|started|began|going|been|over time)\b/i,
    /\b(how.*been|how.*going|since.*started|since.*began|over.*time|throughout)\b/i,
    /\b(better|worse|improve|decline|positive|negative).*\b(since|over|throughout|during)\b/i
  ];
  
  if (questionMarkers > 1 || (andMarkers > 0 && (questionMarkers > 0 || alsoMarkers > 0))) {
    complexity = 'multi_part';
  } else if (complexPatterns.some(pattern => pattern.test(lowerMessage))) {
    complexity = 'complex';
  }
  
  // Enhanced time filtering detection including progress tracking indicators
  const requiresTimeFilter = !!(timeRange || 
    /\b(last|this|current|recent|past)\s+(week|month|year|day)\b/i.test(lowerMessage) ||
    /\b(since|started|began|over.*time|throughout|during)\b/i.test(lowerMessage));
  
  // Enhanced aggregation detection for progress and meditation analysis
  const requiresAggregation = /\b(top\s+\d+|most\s+(common|frequent)|average|total|sum|count|how\s+many|how\s+often|when do|what time|frequency|usually|typically|pattern|trend|progress|journey|how.*been|how.*going)\b/i.test(lowerMessage);
  
  // Always use dual search strategy - this is the key change
  let searchStrategy: 'dual_vector_sql' | 'dual_parallel' | 'dual_sequential' = 'dual_vector_sql';
  let executionMode: 'parallel' | 'sequential' = 'parallel';
  
  // Determine execution mode based on complexity and requirements
  if (complexity === 'complex' || requiresAggregation || complexity === 'multi_part') {
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
  
  // Enhanced strategy determination with progress and meditation tracking
  let strategy = 'dual_search_default';
  
  // Domain-specific strategies
  if (/\b(meditation|practice|mindfulness)\b/i.test(lowerMessage) && requiresTimeFilter) {
    strategy = 'dual_search_meditation_progress';
  } else if (/\b(how.*been|how.*going|progress|journey)\b/i.test(lowerMessage)) {
    strategy = 'dual_search_progress_tracking';
  } else if (complexity === 'multi_part') {
    strategy = 'dual_search_segmented_processing';
  } else if (expectedResponseType === 'aggregated') {
    strategy = 'dual_search_data_aggregation';
  } else if (expectedResponseType === 'analysis') {
    strategy = 'dual_search_pattern_analysis';
  } else if (requiresTimeFilter) {
    strategy = 'dual_search_time_filtered';
  }
  
  return {
    strategy,
    complexity,
    requiresTimeFilter,
    requiresAggregation,
    searchStrategy,
    expectedResponseType,
    dualSearchEnabled: true, // Always enabled
    executionMode
  };
}

export function shouldUseComprehensiveSearch(plan: QueryPlan): boolean {
  // With dual search, we're always comprehensive
  return plan.dualSearchEnabled;
}

export function getMaxEntries(plan: QueryPlan): number {
  // Adjust entry limits for dual search
  if (plan.searchStrategy === 'dual_parallel') {
    return 100;
  } else if (plan.complexity === 'complex') {
    return 50;
  } else {
    return 20;
  }
}

export function shouldUseAnalyticalFormatting(plan: QueryPlan, message: string): boolean {
  // Enhanced analytical formatting detection including progress and meditation queries
  const analyticalKeywords = [
    'pattern', 'trend', 'analysis', 'when do', 'what time', 'how often',
    'frequency', 'usually', 'typically', 'most', 'least', 'statistics',
    'insights', 'breakdown', 'summary', 'overview', 'comparison',
    'progress', 'journey', 'how.*been', 'how.*going', 'since.*started',
    'meditation.*progress', 'practice.*evolution', 'development', 'growth'
  ];
  
  return plan.expectedResponseType === 'analysis' ||
         plan.expectedResponseType === 'aggregated' ||
         plan.strategy?.includes('progress') ||
         plan.strategy?.includes('meditation') ||
         analyticalKeywords.some(keyword => message.toLowerCase().includes(keyword));
}
