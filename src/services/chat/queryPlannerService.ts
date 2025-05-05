
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { 
  addDays, 
  endOfDay, 
  endOfMonth, 
  endOfWeek, 
  endOfYear, 
  startOfDay, 
  startOfMonth, 
  startOfWeek, 
  startOfYear, 
  subDays, 
  subMonths, 
  subWeeks, 
  subYears 
} from "date-fns";

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

/**
 * Calculates relative date ranges based on time expressions
 * @param timePeriod - The time period expression (e.g., "this month", "last week")
 * @param timezoneOffset - User's timezone offset in minutes
 * @returns Date range with start and end dates
 */
export function calculateRelativeDateRange(timePeriod: string, timezoneOffset: number = 0): { startDate: string, endDate: string, periodName: string } {
  // Validate the timezone offset
  if (typeof timezoneOffset !== 'number') {
    console.error(`Invalid timezone offset: ${timezoneOffset}, using default 0`);
    timezoneOffset = 0;
  }
  
  // Enforce timezone offset limits (-12:00 to +14:00)
  if (timezoneOffset < -720 || timezoneOffset > 840) {
    console.error(`Timezone offset out of range: ${timezoneOffset}, clamping to valid range`);
    timezoneOffset = Math.max(-720, Math.min(840, timezoneOffset));
  }
  
  // Convert timezone offset to milliseconds
  const offsetMs = timezoneOffset * 60 * 1000;
  
  // Get current date in user's timezone
  const now = new Date(Date.now() - offsetMs);
  let startDate: Date;
  let endDate: Date;
  let periodName = timePeriod;
  
  console.log(`Calculating date range for "${timePeriod}" with timezone offset ${timezoneOffset} minutes`);
  console.log(`User's local time: ${now.toISOString()} (${now.toLocaleDateString()})`);
  
  const lowerTimePeriod = timePeriod.toLowerCase();
  
  try {
    if (lowerTimePeriod.includes('today') || lowerTimePeriod.includes('this day')) {
      // Today
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      periodName = 'today';
    } 
    else if (lowerTimePeriod.includes('yesterday')) {
      // Yesterday
      const yesterday = subDays(now, 1);
      startDate = startOfDay(yesterday);
      endDate = endOfDay(yesterday);
      periodName = 'yesterday';
    } 
    else if (lowerTimePeriod.includes('this week')) {
      // This week (Monday to Sunday)
      startDate = startOfWeek(now, { weekStartsOn: 1 }); // Start on Monday
      endDate = endOfWeek(now, { weekStartsOn: 1 }); // End on Sunday
      periodName = 'this week';
    } 
    else if (lowerTimePeriod.includes('last week')) {
      // Last week (previous Monday to Sunday)
      const lastWeek = subWeeks(now, 1);
      startDate = startOfWeek(lastWeek, { weekStartsOn: 1 }); // Start on last Monday
      endDate = endOfWeek(lastWeek, { weekStartsOn: 1 }); // End on last Sunday
      periodName = 'last week';
    } 
    else if (lowerTimePeriod.includes('this month')) {
      // This month
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
      periodName = 'this month';
    } 
    else if (lowerTimePeriod.includes('last month')) {
      // Last month
      const lastMonth = subMonths(now, 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
      periodName = 'last month';
    } 
    else if (lowerTimePeriod.includes('this year')) {
      // This year
      startDate = startOfYear(now);
      endDate = endOfYear(now);
      periodName = 'this year';
    } 
    else if (lowerTimePeriod.includes('last year')) {
      // Last year
      const lastYear = subYears(now, 1);
      startDate = startOfYear(lastYear);
      endDate = endOfYear(lastYear);
      periodName = 'last year';
    } 
    else {
      // Default to last 30 days if no specific period matched
      startDate = startOfDay(subDays(now, 30));
      endDate = endOfDay(now);
      periodName = 'last 30 days';
    }
  } catch (calcError) {
    console.error('Error in date calculation:', calcError);
    // Fallback to a simple date range calculation
    startDate = startOfDay(subDays(now, 7));
    endDate = endOfDay(now);
    periodName = 'last 7 days (error fallback)';
  }

  // Add back the timezone offset to convert to UTC for storage
  // Create new Date objects to avoid modifying the originals
  const utcStartDate = new Date(startDate.getTime() + offsetMs);
  const utcEndDate = new Date(endDate.getTime() + offsetMs);
  
  // Validate the date range
  if (utcEndDate < utcStartDate) {
    console.error("Invalid date range calculated: end date is before start date");
    console.error(`Start: ${utcStartDate.toISOString()}, End: ${utcEndDate.toISOString()}`);
    
    // Fallback to last 7 days as a safe default
    const fallbackStart = startOfDay(subDays(now, 7));
    const fallbackEnd = endOfDay(now);
    
    return {
      startDate: new Date(fallbackStart.getTime() + offsetMs).toISOString(),
      endDate: new Date(fallbackEnd.getTime() + offsetMs).toISOString(),
      periodName: 'last 7 days (fallback)'
    };
  }
  
  // Log the calculated dates for debugging
  console.log(`Date range calculated: 
    Start: ${utcStartDate.toISOString()} (${utcStartDate.toLocaleDateString()})
    End: ${utcEndDate.toISOString()} (${utcEndDate.toLocaleDateString()})
    Period: ${periodName}
    Duration in days: ${Math.round((utcEndDate.getTime() - utcStartDate.getTime()) / (1000 * 60 * 60 * 24))}`);
  
  return {
    startDate: utcStartDate.toISOString(),
    endDate: utcEndDate.toISOString(),
    periodName
  };
}
