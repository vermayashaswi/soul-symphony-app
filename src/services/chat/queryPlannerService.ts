
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";
import { addDays, endOfDay, endOfMonth, endOfWeek, endOfYear, startOfDay, startOfMonth, startOfWeek, startOfYear, subDays, subMonths, subWeeks, subYears } from "date-fns";

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
  topicContext?: string; // Add a field to store the topic context
  previousTimeContext?: string; // Add field to store previous time reference
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
      reasoning: gptPlan.reasoning || '',
      topicContext: gptPlan.topic_context || null,
      previousTimeContext: gptPlan.previous_time_context || null
    };

    // For rating or analysis requests, ensure we need data aggregation
    const hasRatingKeywords = gptPlan.reasoning?.toLowerCase().includes('rate') || 
                            gptPlan.reasoning?.toLowerCase().includes('score') ||
                            gptPlan.reasoning?.toLowerCase().includes('analyze') ||
                            gptPlan.reasoning?.toLowerCase().includes('evaluate') ||
                            gptPlan.reasoning?.toLowerCase().includes('introvert') ||
                            gptPlan.reasoning?.toLowerCase().includes('extrovert') ||
                            gptPlan.reasoning?.toLowerCase().includes('personality');
                            
    if (hasRatingKeywords && !queryPlan.needsDataAggregation) {
      console.log("Rating keywords detected, forcing data aggregation");
      queryPlan.needsDataAggregation = true;
      queryPlan.matchCount = Math.max(queryPlan.matchCount, 30); // Ensure we get enough data
    }
    
    // Check for multi-question indicators
    const hasMultiQuestionIndicators = 
      gptPlan.reasoning?.toLowerCase().includes('multiple questions') ||
      gptPlan.reasoning?.toLowerCase().includes('multi-part') ||
      gptPlan.reasoning?.toLowerCase().includes('several aspects') ||
      (Array.isArray(gptPlan.subqueries) && gptPlan.subqueries.length > 1);
      
    if (hasMultiQuestionIndicators && !queryPlan.isSegmented) {
      console.log("Multi-question indicators detected, marking as segmented");
      queryPlan.isSegmented = true;
    }
    
    // Log the complete conversion results
    console.log(`Converted GPT plan to query plan:
      Strategy: ${queryPlan.searchStrategy}
      Match Count: ${queryPlan.matchCount}
      Needs Aggregation: ${queryPlan.needsDataAggregation}
      Is Segmented: ${queryPlan.isSegmented}
      Topic Context: ${queryPlan.topicContext}
      Time Context: ${queryPlan.previousTimeContext}`);
    
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
  console.log(`Creating fallback query plan for: ${query}`);
  
  const queryTypes = analyzeQueryTypes(query);
  
  // Enhanced detection for rating or evaluation requests
  const ratingPatterns = /rate|score|analyze|evaluate|assess|rank|review|am i|introvert|extrovert|my personality/i;
  const isRatingRequest = ratingPatterns.test(query.toLowerCase());
  
  if (isRatingRequest) {
    console.log("Rating/evaluation request detected in fallback plan creation");
  }
  
  // Better detection for multi-part questions
  const isMultiPartQuestion = 
    (query.match(/\?/g) || []).length > 1 || // Multiple question marks
    /\band\b|\balso\b|\balong with\b|\bas well as\b|\bin addition\b/i.test(query) || // Conjunction words
    /(\bfirst\b.*\bsecond\b|\bone\b.*\btwo\b)/i.test(query); // Enumeration indicators
    
  if (isMultiPartQuestion) {
    console.log("Multi-part question detected in fallback plan creation");
  }
  
  // Default plan uses vector search
  const plan: QueryPlan = {
    searchStrategy: 'vector',
    filters: {},
    needsDataAggregation: queryTypes.needsDataAggregation || isRatingRequest,
    needsMoreContext: queryTypes.needsMoreContext,
    matchCount: 15,
    isSegmented: isMultiPartQuestion
  };
  
  // Add time range if detected
  if (queryTypes.timeRange) {
    plan.filters.dateRange = queryTypes.timeRange;
    console.log(`Time range detected in fallback plan: ${plan.filters.dateRange.periodName}`);
  }
  
  // Adjust match count for aggregation queries or rating requests
  if (queryTypes.needsDataAggregation || 
      isRatingRequest ||
      query.toLowerCase().includes('all') || 
      query.toLowerCase().includes('every') ||
      query.toLowerCase().includes('overall') ||
      query.toLowerCase().includes('entire')) {
    plan.matchCount = 30; // Return more entries for comprehensive analysis
    console.log("Increasing match count to 30 for comprehensive analysis");
  }
  
  return plan;
}

/**
 * Calculates relative date ranges based on time expressions
 * @param timePeriod - The time period expression (e.g., "this month", "last week")
 * @param timezoneOffset - User's timezone offset in minutes
 * @param referenceDate - Optional reference date for relative calculations
 * @returns Date range with start and end dates
 */
export function calculateRelativeDateRange(
  timePeriod: string, 
  timezoneOffset: number = 0, 
  referenceDate?: Date
): { startDate: string, endDate: string, periodName: string } {
  // Convert timezone offset to milliseconds
  const offsetMs = timezoneOffset * 60 * 1000;
  
  // Use provided reference date or get current date in user's timezone
  const now = referenceDate ? new Date(referenceDate) : new Date(Date.now() - offsetMs);
  let startDate: Date;
  let endDate: Date;
  let periodName = timePeriod;
  
  console.log(`Calculating date range for "${timePeriod}" with timezone offset ${timezoneOffset} minutes`);
  console.log(`User's local time: ${now.toISOString()}`);
  console.log(`Reference date provided: ${referenceDate ? 'yes' : 'no'}`);
  if (referenceDate) {
    console.log(`Reference date: ${referenceDate.toISOString()}`);
  }
  
  // Normalize time period for better matching
  const lowerTimePeriod = timePeriod.toLowerCase().trim();
  
  // Enhanced pattern matching with more variations
  if (lowerTimePeriod.includes('today') || lowerTimePeriod.includes('this day')) {
    // Today: Start at midnight, end at 23:59:59
    startDate = startOfDay(now);
    endDate = endOfDay(now);
    periodName = 'today';
  } 
  else if (lowerTimePeriod.includes('yesterday')) {
    // Yesterday: Start at previous day midnight, end at previous day 23:59:59
    startDate = startOfDay(subDays(now, 1));
    endDate = endOfDay(subDays(now, 1));
    periodName = 'yesterday';
  }
  else if (lowerTimePeriod.match(/past (\d+) days?/)) {
    // Past X days: Start X days ago at midnight, end at today 23:59:59
    const matches = lowerTimePeriod.match(/past (\d+) days?/);
    const days = parseInt(matches![1], 10) || 7; // Default to 7 if parsing fails
    startDate = startOfDay(subDays(now, days));
    endDate = endOfDay(now);
    periodName = `past ${days} days`;
  }
  else if (lowerTimePeriod.match(/last (\d+) days?/)) {
    // Last X days: Start X days ago at midnight, end at today 23:59:59
    const matches = lowerTimePeriod.match(/last (\d+) days?/);
    const days = parseInt(matches![1], 10) || 7; // Default to 7 if parsing fails
    startDate = startOfDay(subDays(now, days));
    endDate = endOfDay(now);
    periodName = `last ${days} days`;
  }
  else if (lowerTimePeriod.match(/recent (\d+) days?/)) {
    // Recent X days: Start X days ago at midnight, end at today 23:59:59
    const matches = lowerTimePeriod.match(/recent (\d+) days?/);
    const days = parseInt(matches![1], 10) || 7; // Default to 7 if parsing fails
    startDate = startOfDay(subDays(now, days));
    endDate = endOfDay(now);
    periodName = `recent ${days} days`;
  }
  else if (lowerTimePeriod.includes('this week')) {
    // This week: Start at current week Monday, end at Sunday 23:59:59
    startDate = startOfWeek(now, { weekStartsOn: 1 }); // Start on Monday
    endDate = endOfWeek(now, { weekStartsOn: 1 }); // End on Sunday
    periodName = 'this week';
  } 
  else if (lowerTimePeriod.includes('last week')) {
    // Last week: Start at previous week Monday, end at previous week Sunday 23:59:59
    const prevWeek = subWeeks(now, 1);
    startDate = startOfWeek(prevWeek, { weekStartsOn: 1 }); // Start on Monday
    endDate = endOfWeek(prevWeek, { weekStartsOn: 1 }); // End on Sunday
    periodName = 'last week';
  }
  else if (lowerTimePeriod.includes('past week') || lowerTimePeriod.includes('previous week')) {
    // Past/previous week: Start at 7 days ago, end at today
    startDate = startOfDay(subDays(now, 7));
    endDate = endOfDay(now);
    periodName = 'past week';
  }
  else if (lowerTimePeriod.includes('this month')) {
    // This month: Start at 1st of current month, end at last day of month 23:59:59
    startDate = startOfMonth(now);
    endDate = endOfMonth(now);
    periodName = 'this month';
  } 
  else if (lowerTimePeriod.includes('last month') || lowerTimePeriod === 'previous month') {
    // Last month: Start at 1st of previous month, end at last day of previous month 23:59:59
    const prevMonth = subMonths(now, 1);
    startDate = startOfMonth(prevMonth);
    endDate = endOfMonth(prevMonth);
    periodName = 'last month';
  }
  else if (lowerTimePeriod.includes('past month')) {
    // Past month: Start at 30 days ago, end at today
    startDate = startOfDay(subDays(now, 30));
    endDate = endOfDay(now);
    periodName = 'past month';
  }
  else if (lowerTimePeriod.includes('this year')) {
    // This year: Start at January 1st, end at December 31st 23:59:59
    startDate = startOfYear(now);
    endDate = endOfYear(now);
    periodName = 'this year';
  } 
  else if (lowerTimePeriod.includes('last year')) {
    // Last year: Start at January 1st of previous year, end at December 31st of previous year 23:59:59
    const prevYear = subYears(now, 1);
    startDate = startOfYear(prevYear);
    endDate = endOfYear(prevYear);
    periodName = 'last year';
  } 
  else if (lowerTimePeriod === 'entire' || lowerTimePeriod === 'all' || 
           lowerTimePeriod === 'everything' || lowerTimePeriod === 'overall' ||
           lowerTimePeriod === 'all time' || lowerTimePeriod === 'always' ||
           lowerTimePeriod === 'all my entries' || lowerTimePeriod === 'all entries') {
    // Special case for "entire" - use a very broad date range (5 years back)
    startDate = startOfYear(subYears(now, 5));
    endDate = endOfDay(now);
    periodName = 'all time';
  }
  else if (lowerTimePeriod === 'yes' || lowerTimePeriod === 'sure' || 
           lowerTimePeriod === 'ok' || lowerTimePeriod === 'okay' ||
           lowerTimePeriod === 'yep' || lowerTimePeriod === 'yeah') {
    // Special handling for affirmative responses - use a broad date range
    startDate = startOfYear(subYears(now, 5));
    endDate = endOfDay(now);
    periodName = 'all time'; // Use "all time" for affirmative responses
  }
  else {
    // Default to last 30 days if no specific period matched
    startDate = startOfDay(subDays(now, 30));
    endDate = endOfDay(now);
    periodName = 'last 30 days';
  }

  // Add back the timezone offset to convert to UTC for storage
  // We need to explicitly create new Date objects to avoid modifying the originals
  const utcStartDate = new Date(startDate.getTime() + offsetMs);
  const utcEndDate = new Date(endDate.getTime() + offsetMs);
  
  // Validate the date range
  if (utcEndDate < utcStartDate) {
    console.error("Invalid date range calculated: end date is before start date");
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

/**
 * Detects if a user message is likely responding to a clarification request
 * This helps handle short responses like "yes", "this month", etc.
 * @param message - The user's message
 * @returns boolean indicating if this is likely a response to clarification
 */
export function isResponseToClarification(message: string): boolean {
  if (!message) return false;
  
  const normalizedMessage = message.toLowerCase().trim();
  
  // Check for very short responses
  if (normalizedMessage.length < 15) {
    // Common affirmative responses
    if (/^(yes|yeah|yep|sure|ok|okay|correct|right|exactly|confirm|confirmed|true|yup|affirmative|indeed)\.?$/.test(normalizedMessage)) {
      return true;
    }
    
    // Common negative responses
    if (/^(no|nope|nah|not|negative|don't|dont|doesn't|doesnt|nothing|false)\.?$/.test(normalizedMessage)) {
      return true;
    }
    
    // Time period responses
    if (/^(today|yesterday|this week|last week|this month|last month|this year|last year|all time|entire|everything|all)\.?$/.test(normalizedMessage)) {
      return true;
    }
    
    // Number responses
    if (/^(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\.?$/.test(normalizedMessage)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Detects relative time expressions in a query
 * @param query - The user's message
 * @returns string containing the detected time period or null if none found
 */
export function detectRelativeTimeExpression(query: string): string | null {
  if (!query) return null;
  
  const lowerQuery = query.toLowerCase().trim();
  
  // Common time period expressions
  const timePeriodPatterns = [
    /\btoday\b/,
    /\byesterday\b/,
    /\bthis\s+(day|week|month|year)\b/,
    /\blast\s+(day|week|month|year|(\d+)\s+days?|(\d+)\s+weeks?|(\d+)\s+months?|(\d+)\s+years?)\b/,
    /\b(recent|past|previous)\s+(day|week|month|year|(\d+)\s+days?|(\d+)\s+weeks?|(\d+)\s+months?|(\d+)\s+years?)\b/,
    /\ball(\s+time)?\b/,
    /\bentire\b/,
    /\beverything\b/,
    /\boverall\b/
  ];
  
  // Check for time expressions in the query
  for (const pattern of timePeriodPatterns) {
    const match = lowerQuery.match(pattern);
    if (match) {
      // Return the matched time expression
      return match[0];
    }
  }
  
  // Special case for simple query like "last month?" or "what about last year?"
  if (/^(what\s+about\s+)?(the\s+)?(last|this|previous|past|recent)\s+(day|week|month|year|(\d+)\s+days?|(\d+)\s+weeks?|(\d+)\s+months?|(\d+)\s+years?)(\?|\.|$)/i.test(lowerQuery)) {
    const match = lowerQuery.match(/(last|this|previous|past|recent)\s+(day|week|month|year|(\d+)\s+days?|(\d+)\s+weeks?|(\d+)\s+months?|(\d+)\s+years?)/i);
    if (match) return match[0];
  }
  
  return null;
}

/**
 * Extracts a reference date from a previous query plan
 * @param previousPlan - The previous query plan
 * @returns Date object or undefined if no reference date found
 */
export function extractReferenceDate(previousPlan: QueryPlan | null): Date | undefined {
  if (!previousPlan || !previousPlan.filters.dateRange) {
    return undefined;
  }
  
  // Use the end date of the previous date range as reference
  // This helps with relative calculations like "last month" relative to a specific month
  if (previousPlan.filters.dateRange.endDate) {
    return new Date(previousPlan.filters.dateRange.endDate);
  }
  
  return undefined;
}
