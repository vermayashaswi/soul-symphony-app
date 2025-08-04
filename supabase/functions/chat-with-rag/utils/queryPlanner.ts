
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
  
  // Determine strategy - always include dual search
  let strategy = 'dual_search_default';
  
  if (complexity === 'multi_part') {
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
  // Detect queries that need structured formatting
  const analyticalKeywords = [
    'pattern', 'trend', 'analysis', 'when do', 'what time', 'how often',
    'frequency', 'usually', 'typically', 'most', 'least', 'statistics',
    'insights', 'breakdown', 'summary', 'overview', 'comparison'
  ];
  
  return plan.expectedResponseType === 'analysis' ||
         plan.expectedResponseType === 'aggregated' ||
         analyticalKeywords.some(keyword => message.toLowerCase().includes(keyword));
}
