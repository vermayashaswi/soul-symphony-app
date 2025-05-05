
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";

export type SearchStrategy = 'vector' | 'sql' | 'hybrid';

export interface QueryPlan {
  searchStrategy: SearchStrategy;
  filters: {
    dateRange?: {
      startDate: string | null;
      endDate: string | null;
      periodName: string;
    };
    emotions?: string[];
    sentiment?: string[];
    themes?: string[];
    entities?: Array<{type: string, name: string}>;
  };
  matchCount: number;
  needsDataAggregation: boolean;
  needsMoreContext: boolean;
  isSegmented?: boolean;
  subqueries?: string[];
  reasoning?: string;
}

/**
 * Converts a GPT-generated plan to our internal QueryPlan format
 */
export function convertGptPlanToQueryPlan(gptPlan: any): QueryPlan {
  if (!gptPlan) {
    return createDefaultQueryPlan();
  }

  try {
    // Map GPT strategy to our SearchStrategy
    let searchStrategy: SearchStrategy = 'vector';
    if (gptPlan.strategy) {
      switch(gptPlan.strategy.toLowerCase()) {
        case 'vector': 
          searchStrategy = 'vector'; 
          break;
        case 'sql': 
          searchStrategy = 'sql'; 
          break;
        case 'hybrid': 
          searchStrategy = 'hybrid'; 
          break;
        default:
          searchStrategy = 'vector'; // Default to vector for unknown strategies
          break;
      }
    }

    // Extract all filters
    const filters: QueryPlan['filters'] = {};
    
    // Add date range if provided
    if (gptPlan.filters?.date_range) {
      // Use the date range directly from the GPT plan
      filters.dateRange = {
        startDate: gptPlan.filters.date_range.startDate || null,
        endDate: gptPlan.filters.date_range.endDate || null,
        periodName: gptPlan.filters.date_range.periodName || ''
      };
    }
    
    // Add emotions if provided
    if (gptPlan.filters?.emotions && Array.isArray(gptPlan.filters.emotions)) {
      filters.emotions = gptPlan.filters.emotions;
    }
    
    // Add sentiment if provided
    if (gptPlan.filters?.sentiment && Array.isArray(gptPlan.filters.sentiment)) {
      filters.sentiment = gptPlan.filters.sentiment;
    }
    
    // Add themes if provided
    if (gptPlan.filters?.themes && Array.isArray(gptPlan.filters.themes)) {
      filters.themes = gptPlan.filters.themes;
    }
    
    // Add entities if provided
    if (gptPlan.filters?.entities && Array.isArray(gptPlan.filters.entities)) {
      filters.entities = gptPlan.filters.entities;
    }
    
    // Create our query plan
    const queryPlan: QueryPlan = {
      searchStrategy,
      filters,
      matchCount: gptPlan.match_count || 15,
      needsDataAggregation: gptPlan.needs_data_aggregation || false,
      needsMoreContext: gptPlan.needs_more_context || false,
      isSegmented: gptPlan.is_segmented || false,
      subqueries: gptPlan.subqueries || [],
      reasoning: gptPlan.reasoning || ''
    };

    // For rating or analysis requests, ensure we need data aggregation
    const hasRatingKeywords = gptPlan.reasoning?.toLowerCase().includes('rate') || 
                            gptPlan.reasoning?.toLowerCase().includes('score') ||
                            gptPlan.reasoning?.toLowerCase().includes('analyze') ||
                            gptPlan.reasoning?.toLowerCase().includes('evaluate');
                            
    if (hasRatingKeywords && !queryPlan.needsDataAggregation) {
      queryPlan.needsDataAggregation = true;
      queryPlan.matchCount = Math.max(queryPlan.matchCount, 30); // Ensure we get enough data
    }
    
    return queryPlan;
  } catch (error) {
    console.error("Error converting GPT plan to query plan:", error);
    return createDefaultQueryPlan();
  }
}

/**
 * Creates a default query plan when none is provided
 */
export function createDefaultQueryPlan(): QueryPlan {
  return {
    searchStrategy: 'vector',
    filters: {},
    matchCount: 15,
    needsDataAggregation: false,
    needsMoreContext: false
  };
}

/**
 * Creates a fallback query plan based on the user's question
 */
export function createFallbackQueryPlan(query: string): QueryPlan {
  const queryTypes = analyzeQueryTypes(query);
  
  // Check if this is a rating or evaluation request
  const isRatingRequest = /rate|score|analyze|evaluate|assess|rank/i.test(query);
  
  // Default plan uses vector search
  const plan: QueryPlan = {
    searchStrategy: 'vector',
    filters: {},
    needsDataAggregation: queryTypes.needsDataAggregation || isRatingRequest,
    needsMoreContext: queryTypes.needsMoreContext,
    matchCount: 15
  };
  
  // Add time range if detected
  if (queryTypes.timeRange) {
    plan.filters.dateRange = queryTypes.timeRange;
  }
  
  // Adjust match count for aggregation queries or rating requests
  if (queryTypes.needsDataAggregation || 
      isRatingRequest ||
      query.toLowerCase().includes('all') || 
      query.toLowerCase().includes('every')) {
    plan.matchCount = 30; // Return more entries for comprehensive analysis
  }
  
  return plan;
}
