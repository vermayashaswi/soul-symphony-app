
// Add the missing type definitions for this file's exports and functions
import { supabase } from "@/integrations/supabase/client";

type QueryTypes = {
  isTemporalQuery: boolean;
  isTimePatternQuery: boolean;
  isWhyQuestion: boolean;
  isEmotionFocused: boolean;
  isFrequencyQuery: boolean;
  isQuantitative: boolean;
  isComplexQuery: boolean;
  isComparisonQuery: boolean;
  needsContext: boolean;
  needsDataAggregation: boolean;
  needsVectorSearch: boolean;
  searchStrategy: string;
  querySegments?: string[];
  isThemeFocused?: boolean;
  emotion?: string;
  theme?: string;
  isWhenQuestion?: boolean;
  startDate?: string;
  endDate?: string;
  timeRange?: {
    type: 'day' | 'week' | 'month' | 'year' | 'custom';
    startDate?: string;
    endDate?: string;
  };
};

export function analyzeQueryTypes(queryText: string): QueryTypes {
  const lowerQuery = queryText.toLowerCase();
  
  // Analyze for temporal queries (when questions)
  const isTemporalQuery = /\bwhen\b/i.test(lowerQuery) && 
    !/what time|time of day|morning|afternoon|evening|night/i.test(lowerQuery);
  
  // NEW: Analyze for time-of-day pattern queries
  const isTimePatternQuery = /what time|time of day|morning|afternoon|evening|night|o'clock|am\b|pm\b|hour|daytime/i.test(lowerQuery);
  
  // Analyze for why questions
  const isWhyQuestion = /\bwhy\b|\bwhat caused\b|\breason for\b|\bexplain why\b/i.test(lowerQuery);
  
  // Analyze for emotion-focused questions
  const isEmotionFocused = /\bfeel\b|\bfeeling\b|\bfelt\b|\bemotions?\b|\bhappy\b|\bsad\b|\bangry\b|\bworried\b|\banxious\b|\bcontent\b|\bjoyful\b|\bstressed\b|\bupset\b|\bfrustrated\b|\boptimistic\b|\bdepressed\b|\blonely\b/i.test(lowerQuery);
  
  // Analyze for frequency queries (how often questions)
  const isFrequencyQuery = /how (often|frequently|many times|regularly)|frequency|per (day|week|month)|daily|weekly|monthly/i.test(lowerQuery);
  
  // Analyze for quantitative questions (numbers, rankings, etc.)
  const isQuantitative = /\bmost\b|\bleast\b|\btop\b|\bbottom\b|\branking\b|\baverage\b|\bmean\b|\bmedian\b|\bcount\b|\bnumber of\b|\bpercentage\b|\bhow many\b|highest|lowest/i.test(lowerQuery);
  
  // Improved: Analyze for complex queries (multiple questions or conditions)
  const isComplexQuery = /\band\b|\bor\b|\bbut\b|;|,\s*\b(what|how|when|why|who)\b|\?.*\?/i.test(lowerQuery) || 
    lowerQuery.split(' ').length > 20 || // Lengthy questions are typically complex
    (isWhyQuestion && lowerQuery.length > 60) || // Why questions with detailed context
    // New: Detect ranking or prioritization requests
    /\border\b|\brank\b|\bprioritize\b|\bpriority\b|\bmost important\b|\bleast important\b/i.test(lowerQuery);
  
  // Analyze for comparison queries
  const isComparisonQuery = /\bcompared to\b|\bvs\.?\b|\bversus\b|\bagainst\b|\bdifference between\b|\bhow does.*compare\b|\bmore than\b|\bless than\b|\bsimilar to\b|\bdifferent from\b/i.test(lowerQuery);
  
  // Determine if we need additional context for this query
  const needsContext = isWhyQuestion || isComplexQuery || 
    /explain|elaborate|tell me more|context|understand|meaning|interpret/i.test(lowerQuery);
  
  // Determine if the query requires data aggregation (typically for quantitative analysis)
  const needsDataAggregation = isQuantitative || 
    /pattern|trend|correlation|relationship between|associated with|connected to|link between|summary|summarize|average|mean|total/i.test(lowerQuery);
  
  // Determine if the query requires vector search (semantic retrieval)
  const needsVectorSearch = !needsDataAggregation || isEmotionFocused || isTemporalQuery;
  
  // Try to determine time range from query
  const timeRange = extractTimeRange(lowerQuery);
  
  // Determine search strategy
  let searchStrategy = determineSearchStrategy(lowerQuery, {
    isTemporalQuery,
    isTimePatternQuery, 
    isFrequencyQuery, 
    isEmotionFocused, 
    isQuantitative,
    needsDataAggregation
  });
  
  return {
    isTemporalQuery,
    isTimePatternQuery,
    isWhyQuestion,
    isEmotionFocused,
    isFrequencyQuery,
    isQuantitative,
    isComplexQuery,
    isComparisonQuery,
    needsContext,
    needsDataAggregation,
    needsVectorSearch,
    searchStrategy,
    timeRange
  };
}

// New function to segment complex queries
export async function segmentQuery(queryText: string, userId: string): Promise<string[]> {
  try {
    // For non-complex queries, return the original query as a single segment
    const queryTypes = analyzeQueryTypes(queryText);
    if (!queryTypes.isComplexQuery) {
      return [queryText];
    }
    
    // For complex queries, use supabase function to segment the query
    const { data, error } = await supabase.functions.invoke('segment-complex-query', {
      body: { 
        query: queryText,
        userId: userId
      }
    });
    
    if (error) {
      console.error("Error segmenting query:", error);
      return [queryText]; // Fallback to original query
    }
    
    if (data && data.segments && Array.isArray(data.segments) && data.segments.length > 0) {
      console.log("Query segmented into:", data.segments);
      return data.segments;
    }
    
    return [queryText]; // Fallback to original query
  } catch (error) {
    console.error("Exception in query segmentation:", error);
    return [queryText]; // Fallback to original query
  }
}

function determineSearchStrategy(
  query: string, 
  flags: { 
    isTemporalQuery: boolean; 
    isTimePatternQuery: boolean;
    isFrequencyQuery: boolean; 
    isEmotionFocused: boolean; 
    isQuantitative: boolean;
    needsDataAggregation: boolean;
  }
): string {
  // Check for time-of-day pattern questions first (new strategy)
  if (flags.isTimePatternQuery) {
    return 'time_pattern_analysis';
  }
  
  // Check for temporal queries (when did something happen)
  if (flags.isTemporalQuery) {
    return 'temporal_vector_search';
  }
  
  // Check for frequency queries (how often)
  if (flags.isFrequencyQuery) {
    return 'frequency_analysis';
  }
  
  // Check for emotion-focused queries
  if (flags.isEmotionFocused) {
    if (/\bwhy\b/i.test(query)) {
      return 'emotion_causal_analysis';
    }
    
    if (/\btop\b|\bmost\b|\bcommon\b/i.test(query)) {
      return 'emotion_aggregation';
    }
  }
  
  // Check for relationship-themed queries
  if (/\bpartner\b|\bspouse\b|\bhusband\b|\bwife\b|\brelationship\b|\bmarriage\b|\bboyfriend\b|\bgirlfriend\b/i.test(query)) {
    return 'relationship_analysis';
  }
  
  // Check for advice/improvement queries
  if (/\bhow\s+can\s+i\b|\bhow\s+do\s+i\b|\bhow\s+to\b|\badvice\b|\bsuggest\b|\bimprove\b|\bbetter\b|\bhelp\s+me\b/i.test(query)) {
    return 'contextual_advice';
  }
  
  // Check for data aggregation needs (correlation, patterns, numbers)
  if (flags.needsDataAggregation || 
      /\bpattern\b|\btrend\b|\bcorrelation\b|\baverage\b|\bmean\b|\btotal\b|\bsum\b|\bcount\b/i.test(query)) {
    return 'data_aggregation';
  }
  
  // Default strategy
  return 'vector_search';
}

function extractTimeRange(query: string): { type: 'day' | 'week' | 'month' | 'year' | 'custom', startDate?: string, endDate?: string } | undefined {
  const now = new Date();
  
  // Check for today
  if (/\btoday\b/i.test(query)) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      type: 'day',
      startDate: today.toISOString(),
      endDate: now.toISOString()
    };
  }
  
  // Check for yesterday
  if (/\byesterday\b/i.test(query)) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    return {
      type: 'day',
      startDate: yesterday.toISOString(),
      endDate: yesterdayEnd.toISOString()
    };
  }
  
  // Check for this week
  if (/\bthis\s+week\b/i.test(query)) {
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day + (day === 0 ? -6 : 1)); // Adjust to Monday
    startOfWeek.setHours(0, 0, 0, 0);
    
    return {
      type: 'week',
      startDate: startOfWeek.toISOString(),
      endDate: now.toISOString()
    };
  }
  
  // Check for last week
  if (/\blast\s+week\b|\bprevious\s+week\b/i.test(query)) {
    const endOfLastWeek = new Date(now);
    const day = endOfLastWeek.getDay();
    endOfLastWeek.setDate(endOfLastWeek.getDate() - day + (day === 0 ? -6 : 1) - 1); // Last Sunday
    endOfLastWeek.setHours(23, 59, 59, 999);
    
    const startOfLastWeek = new Date(endOfLastWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 6); // Last Monday
    startOfLastWeek.setHours(0, 0, 0, 0);
    
    return {
      type: 'week',
      startDate: startOfLastWeek.toISOString(),
      endDate: endOfLastWeek.toISOString()
    };
  }
  
  // Check for this month
  if (/\bthis\s+month\b/i.test(query)) {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return {
      type: 'month',
      startDate: startOfMonth.toISOString(),
      endDate: now.toISOString()
    };
  }
  
  // Check for last month
  if (/\blast\s+month\b|\bprevious\s+month\b/i.test(query)) {
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    endOfLastMonth.setHours(23, 59, 59, 999);
    
    return {
      type: 'month',
      startDate: startOfLastMonth.toISOString(),
      endDate: endOfLastMonth.toISOString()
    };
  }
  
  // Check for this year
  if (/\bthis\s+year\b/i.test(query)) {
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    return {
      type: 'year',
      startDate: startOfYear.toISOString(),
      endDate: now.toISOString()
    };
  }
  
  // Check for last year
  if (/\blast\s+year\b|\bprevious\s+year\b/i.test(query)) {
    const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
    const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
    endOfLastYear.setHours(23, 59, 59, 999);
    
    return {
      type: 'year',
      startDate: startOfLastYear.toISOString(),
      endDate: endOfLastYear.toISOString()
    };
  }
  
  // Default to past 30 days
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return {
    type: 'custom',
    startDate: thirtyDaysAgo.toISOString(),
    endDate: now.toISOString()
  };
}

// Helper function to extract emotion keywords from a query
export function extractEmotionKeywords(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  
  // Common emotion words to look for
  const emotionWords = [
    'happy', 'sad', 'angry', 'frustrated', 'excited', 'anxious', 'calm', 
    'stressed', 'relaxed', 'motivated', 'tired', 'energetic', 'joyful', 
    'depressed', 'content', 'optimistic', 'pessimistic', 'hopeful',
    'negative', 'positive', 'irritable', 'annoyed', 'worried', 'scared',
    'fearful', 'proud', 'ashamed', 'guilty', 'jealous', 'envious',
    'lonely', 'loved', 'appreciated', 'rejected', 'abandoned'
  ];
  
  // Find any emotion words in the message
  const foundEmotions = emotionWords.filter(emotion => lowerMessage.includes(emotion));
  
  // If no specific emotions found, include general emotional state keywords
  if (foundEmotions.length === 0) {
    // Check for general emotional state references
    if (lowerMessage.includes('feel good') || lowerMessage.includes('positive')) {
      foundEmotions.push('positive');
    }
    if (lowerMessage.includes('feel bad') || lowerMessage.includes('negative')) {
      foundEmotions.push('negative');
    }
    if (foundEmotions.length === 0) {
      // Default to searching for all emotions if none specified
      foundEmotions.push('emotion');
    }
  }
  
  return foundEmotions;
}
