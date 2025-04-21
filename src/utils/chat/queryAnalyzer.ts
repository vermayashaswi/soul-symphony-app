
// This file contains functions to analyze the type of query a user is asking

type QueryTypes = {
  isEmotionFocused: boolean;
  isQuantitative: boolean;
  isWhyQuestion: boolean;
  isTemporalQuery: boolean;
  isTimePatternQuery: boolean;
  isWhenQuestion: boolean;
  needsVectorSearch: boolean;
  needsMoreContext: boolean;
  needsDataAggregation: boolean;
  isSpecificQuery: boolean;
  isThemeFocused: boolean;
  requiresTimeAnalysis: boolean;
  isFactualQuery: boolean; // New property to identify factual queries
  emotion?: string;
  theme?: string;
  timeRange: {
    startDate: string | null;
    endDate: string | null;
    periodName: string;
  };
  startDate?: string;
  endDate?: string;
};

/**
 * Analyzes the user's query to determine what type of processing it needs
 */
export function analyzeQueryTypes(query: string): QueryTypes {
  const lowerQuery = query.toLowerCase();
  
  // Initialize result with default values
  const result: QueryTypes = {
    isEmotionFocused: false,
    isQuantitative: false,
    isWhyQuestion: false,
    isTemporalQuery: false,
    isTimePatternQuery: false,
    isWhenQuestion: false,
    needsVectorSearch: true, // Most queries will need vector search
    needsMoreContext: false,
    needsDataAggregation: false,
    isSpecificQuery: false,
    isThemeFocused: false,
    requiresTimeAnalysis: false,
    isFactualQuery: false, // Initialize new property
    timeRange: {
      startDate: null,
      endDate: null,
      periodName: "recently"
    }
  };
  
  // Detect factual queries about general knowledge
  result.isFactualQuery = lowerQuery.startsWith('who is') || 
                          lowerQuery.startsWith('what is') || 
                          lowerQuery.startsWith('when was') ||
                          lowerQuery.startsWith('where is') ||
                          lowerQuery.includes('president of') ||
                          lowerQuery.includes('capital of') ||
                          lowerQuery.includes('prime minister of');
  
  // Detect emotion-focused queries
  const emotionWords = ['feel', 'feeling', 'felt', 'emotion', 'emotions', 'mood', 'moods', 'happy', 'sad', 'angry', 'anxious', 'joy', 'fear', 'happiness'];
  result.isEmotionFocused = emotionWords.some(word => lowerQuery.includes(word));
  
  // Detect if this is a why-question
  result.isWhyQuestion = lowerQuery.includes('why') || 
                         lowerQuery.includes('reason') || 
                         lowerQuery.includes('reasons') ||
                         lowerQuery.includes('explain') ||
                         lowerQuery.includes('what caused') ||
                         lowerQuery.includes('what makes');
  
  // Detect if this needs more context (why questions or complex questions)
  result.needsMoreContext = result.isWhyQuestion || 
                           lowerQuery.includes('explain') ||
                           lowerQuery.includes('elaborate') ||
                           lowerQuery.includes('details');
  
  // Detect if this is a quantitative query
  result.isQuantitative = lowerQuery.includes('how much') ||
                         lowerQuery.includes('how many') ||
                         lowerQuery.includes('count') ||
                         lowerQuery.includes('percentage') ||
                         lowerQuery.includes('rate') ||
                         lowerQuery.includes('average') ||
                         lowerQuery.includes('top') ||
                         /\d+/.test(lowerQuery); // Contains numbers
  
  // Detect theme-focused queries
  const themeWords = ['theme', 'themes', 'topic', 'topics', 'about', 'regarding', 'related to', 'concerning'];
  result.isThemeFocused = themeWords.some(word => lowerQuery.includes(word));
  
  // Identify specific emotions being asked about
  const specificEmotions = ['happy', 'sad', 'angry', 'anxious', 'joy', 'fear', 'happiness', 'excitement', 'boredom', 'frustration', 'hope'];
  for (const emotion of specificEmotions) {
    if (lowerQuery.includes(emotion)) {
      result.emotion = emotion;
      break;
    }
  }
  
  // Identify specific themes being asked about
  if (result.isThemeFocused) {
    const themeMatches = lowerQuery.match(/about\s+(\w+)/i) || 
                         lowerQuery.match(/regarding\s+(\w+)/i) ||
                         lowerQuery.match(/related to\s+(\w+)/i);
    if (themeMatches && themeMatches[1]) {
      result.theme = themeMatches[1];
    }
  }
  
  // Detect time-pattern queries
  result.isTimePatternQuery = lowerQuery.includes('what time') ||
                            lowerQuery.includes('when do i usually') ||
                            lowerQuery.includes('time of day') ||
                            (lowerQuery.includes('morning') && lowerQuery.includes('night')) ||
                            (lowerQuery.includes('time') && lowerQuery.includes('most'));
  
  result.requiresTimeAnalysis = result.isTimePatternQuery || 
                                lowerQuery.includes('pattern') || 
                                lowerQuery.includes('routine');
  
  // Detect temporal queries (asking about a specific time period)
  result.isTemporalQuery = lowerQuery.includes('yesterday') ||
                          lowerQuery.includes('last week') ||
                          lowerQuery.includes('last month') ||
                          lowerQuery.includes('past week') ||
                          lowerQuery.includes('past month') ||
                          lowerQuery.includes('this week') ||
                          lowerQuery.includes('this month') ||
                          lowerQuery.includes('today');
  
  // Detect "when" questions
  result.isWhenQuestion = lowerQuery.startsWith('when') || 
                         lowerQuery.includes('what day') ||
                         lowerQuery.includes('what date') ||
                         lowerQuery.includes('which day') ||
                         lowerQuery.includes('which date');
  
  // If this is a temporal query, determine the time range
  const timeRange = extractTimeRange(lowerQuery);
  if (timeRange) {
    result.timeRange = timeRange;
    if (timeRange.startDate) {
      result.startDate = timeRange.startDate;
    }
    if (timeRange.endDate) {
      result.endDate = timeRange.endDate;
    }
  }
  
  // Detect if this is a specific query that should return fewer, more precise results
  result.isSpecificQuery = result.isTemporalQuery || result.isWhenQuestion || result.theme !== undefined;
  
  // Detect if we need to aggregate data from multiple entries
  result.needsDataAggregation = result.isQuantitative || 
                               lowerQuery.includes('pattern') ||
                               lowerQuery.includes('usually') ||
                               lowerQuery.includes('typically') ||
                               lowerQuery.includes('often') ||
                               lowerQuery.includes('most of the time');
  
  return result;
}

/**
 * Extracts time range from query text
 */
function extractTimeRange(query: string): { startDate: string | null, endDate: string | null, periodName: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();
  
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let periodName = "recently";
  
  // Match common time expressions
  if (query.includes('yesterday')) {
    startDate = new Date(year, month, date - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(year, month, date - 1);
    endDate.setHours(23, 59, 59, 999);
    periodName = "yesterday";
  } else if (query.includes('last week')) {
    // Last week: Monday-Sunday of previous week
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToLastMonday = dayOfWeek === 0 ? 7 : dayOfWeek;
    startDate = new Date(year, month, date - daysToLastMonday - 6);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(year, month, date - daysToLastMonday);
    endDate.setHours(23, 59, 59, 999);
    periodName = "last week";
  } else if (query.includes('this week')) {
    // This week: Monday-Today of current week
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate = new Date(year, month, date - daysToMonday);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(year, month, date);
    endDate.setHours(23, 59, 59, 999);
    periodName = "this week";
  } else if (query.includes('last month')) {
    startDate = new Date(year, month - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);
    periodName = "last month";
  } else if (query.includes('this month')) {
    startDate = new Date(year, month, 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = now;
    periodName = "this month";
  } else if (query.includes('today')) {
    startDate = new Date(year, month, date);
    startDate.setHours(0, 0, 0, 0);
    endDate = now;
    periodName = "today";
  } else {
    // Default to last 30 days
    startDate = new Date(year, month, date - 30);
    startDate.setHours(0, 0, 0, 0);
    endDate = now;
    periodName = "the last 30 days";
  }
  
  return {
    startDate: startDate ? startDate.toISOString() : null,
    endDate: endDate ? endDate.toISOString() : null,
    periodName
  };
}
