
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
      // Ensure dates are properly formatted with timezone consideration
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
  
  // Default plan uses vector search
  const plan: QueryPlan = {
    searchStrategy: 'vector',
    filters: {},
    needsDataAggregation: queryTypes.needsDataAggregation,
    needsMoreContext: queryTypes.needsMoreContext,
    matchCount: 15
  };
  
  // Add time range if detected
  if (queryTypes.timeRange) {
    plan.filters.dateRange = queryTypes.timeRange;
  }
  
  // Adjust match count for aggregation queries
  if (queryTypes.needsDataAggregation || 
      query.toLowerCase().includes('all') || 
      query.toLowerCase().includes('every')) {
    plan.matchCount = 30; // Return more entries for comprehensive analysis
  }
  
  return plan;
}

/**
 * Calculates relative date ranges based on time expressions
 * @param timePeriod - The time period expression (e.g., "this month", "last week")
 * @param timezoneOffset - User's timezone offset in minutes
 * @returns Date range with start and end dates
 */
export function calculateRelativeDateRange(timePeriod: string, timezoneOffset: number = 0): { startDate: string, endDate: string, periodName: string } {
  // Convert timezone offset to milliseconds
  const offsetMs = timezoneOffset * 60 * 1000;
  
  // Get current date in user's timezone
  const now = new Date(Date.now() - offsetMs);
  let startDate = new Date(now);
  let endDate = new Date(now);
  let periodName = timePeriod;
  
  const lowerTimePeriod = timePeriod.toLowerCase();
  
  if (lowerTimePeriod.includes('today') || lowerTimePeriod.includes('this day')) {
    // Today: Start at midnight, end at 23:59:59
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'today';
  } 
  else if (lowerTimePeriod.includes('yesterday')) {
    // Yesterday: Start at previous day midnight, end at previous day 23:59:59
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(endDate.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'yesterday';
  } 
  else if (lowerTimePeriod.includes('this week')) {
    // This week: Start at current week Sunday, end at Saturday 23:59:59
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(endDate.getDate() + (6 - dayOfWeek));
    endDate.setHours(23, 59, 59, 999);
    periodName = 'this week';
  } 
  else if (lowerTimePeriod.includes('last week')) {
    // Last week: Start at previous week Sunday, end at previous week Saturday 23:59:59
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek - 7);
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'last week';
  } 
  else if (lowerTimePeriod.includes('this month')) {
    // This month: Start at 1st of current month, end at last day of month 23:59:59
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
    periodName = 'this month';
  } 
  else if (lowerTimePeriod.includes('last month')) {
    // Last month: Start at 1st of previous month, end at last day of previous month 23:59:59
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
    periodName = 'last month';
  } 
  else if (lowerTimePeriod.includes('this year')) {
    // This year: Start at January 1st, end at December 31st 23:59:59
    startDate = new Date(startDate.getFullYear(), 0, 1, 0, 0, 0, 0);
    endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    periodName = 'this year';
  } 
  else if (lowerTimePeriod.includes('last year')) {
    // Last year: Start at January 1st of previous year, end at December 31st of previous year 23:59:59
    startDate = new Date(startDate.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    periodName = 'last year';
  } 
  else {
    // Default to last 30 days if no specific period matched
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'last 30 days';
  }

  // Add back the timezone offset to convert to UTC for storage
  startDate = new Date(startDate.getTime() + offsetMs);
  endDate = new Date(endDate.getTime() + offsetMs);
  
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    periodName
  };
}
