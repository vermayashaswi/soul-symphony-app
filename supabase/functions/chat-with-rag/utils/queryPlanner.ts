
// Enhanced query planning for chat-with-rag function
export interface QueryPlan {
  strategy: string;
  complexity: 'simple' | 'complex' | 'multi_part';
  requiresTimeFilter: boolean;
  requiresAggregation: boolean;
  searchStrategy: 'vector' | 'hybrid' | 'comprehensive';
  expectedResponseType: 'direct' | 'analysis' | 'aggregated' | 'narrative';
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
  } else if (/\b(pattern|trend|analysis|compare|correlation|top\s+\d+|most\s+(common|frequent))\b/i.test(lowerMessage)) {
    complexity = 'complex';
  }
  
  // Determine if time filtering is required
  const requiresTimeFilter = !!(timeRange || /\b(last|this|current|recent|past)\s+(week|month|year|day)\b/i.test(lowerMessage));
  
  // Determine if aggregation is required
  const requiresAggregation = /\b(top\s+\d+|most\s+(common|frequent)|average|total|sum|count|how\s+many|how\s+often)\b/i.test(lowerMessage);
  
  // Determine search strategy
  let searchStrategy: 'vector' | 'hybrid' | 'comprehensive' = 'vector';
  
  if (complexity === 'complex' || requiresAggregation) {
    searchStrategy = 'comprehensive';
  } else if (requiresTimeFilter) {
    searchStrategy = 'hybrid';
  }
  
  // Determine expected response type
  let expectedResponseType: 'direct' | 'analysis' | 'aggregated' | 'narrative' = 'narrative';
  
  if (/^(what\s+are\s+the\s+dates?|when\s+(is|was))\b/i.test(lowerMessage)) {
    expectedResponseType = 'direct';
  } else if (requiresAggregation || /\btop\s+\d+\b/i.test(lowerMessage)) {
    expectedResponseType = 'aggregated';
  } else if (/\b(analyze|analysis|insight|pattern|trend)\b/i.test(lowerMessage)) {
    expectedResponseType = 'analysis';
  }
  
  // Determine strategy
  let strategy = 'default';
  
  if (complexity === 'multi_part') {
    strategy = 'segmented_processing';
  } else if (expectedResponseType === 'aggregated') {
    strategy = 'data_aggregation';
  } else if (expectedResponseType === 'analysis') {
    strategy = 'pattern_analysis';
  } else if (requiresTimeFilter) {
    strategy = 'time_filtered_search';
  }
  
  return {
    strategy,
    complexity,
    requiresTimeFilter,
    requiresAggregation,
    searchStrategy,
    expectedResponseType
  };
}

export function shouldUseComprehensiveSearch(plan: QueryPlan): boolean {
  return plan.searchStrategy === 'comprehensive' || 
         plan.requiresAggregation || 
         plan.complexity === 'complex';
}

export function getMaxEntries(plan: QueryPlan): number {
  if (plan.searchStrategy === 'comprehensive') {
    return 100;
  } else if (plan.complexity === 'complex') {
    return 50;
  } else {
    return 10;
  }
}
