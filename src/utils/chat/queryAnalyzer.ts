
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
    timeRange: {
      startDate: null,
      endDate: null,
      periodName: "recently"
    }
  };
  
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
  
  // Enhanced theme detection
  // First check for explicit theme words
  const themeWords = [
    'theme', 'themes', 'topic', 'topics', 'about', 'regarding', 'related to', 'concerning',
    'fitness', 'health', 'exercise', 'workout', 'physical', 'training', 'active', 'fit'
  ];
  result.isThemeFocused = themeWords.some(word => lowerQuery.includes(word));
  
  // Then check for patterns that imply theme focus
  if (!result.isThemeFocused) {
    // "Have I been X lately/recently" pattern strongly indicates theme focus
    const themePatterns = [
      /have i been (\w+) (lately|recently)/i,
      /am i (\w+)/i, 
      /do i (\w+)/i,
      /how (\w+) (am|are) (i|we|my)/i,
      /how (is|was) my (\w+)/i,
      /my (\w+) (is|are|has been)/i
    ];
    
    for (const pattern of themePatterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        result.isThemeFocused = true;
        // In some patterns, the theme is captured in the second group
        if (pattern.toString().includes('how (is|was) my')) {
          result.theme = match[2];
        } else {
          // For other patterns, theme is in the first group
          result.theme = match[1];
        }
        break;
      }
    }
  }
  
  // Identify specific emotions being asked about
  const specificEmotions = ['happy', 'sad', 'angry', 'anxious', 'joy', 'fear', 'happiness', 'excitement', 'boredom', 'frustration', 'hope'];
  for (const emotion of specificEmotions) {
    if (lowerQuery.includes(emotion)) {
      result.emotion = emotion;
      break;
    }
  }
  
  // Identify specific themes being asked about if not already found
  if (!result.theme && result.isThemeFocused) {
    const themeMatches = lowerQuery.match(/about\s+(\w+)/i) || 
                         lowerQuery.match(/regarding\s+(\w+)/i) ||
                         lowerQuery.match(/related to\s+(\w+)/i) ||
                         lowerQuery.match(/my\s+(\w+)/i);
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
  
  // Enhanced temporal queries detection to include month names
  result.isTemporalQuery = lowerQuery.includes('yesterday') ||
                          lowerQuery.includes('last week') ||
                          lowerQuery.includes('last month') ||
                          lowerQuery.includes('past week') ||
                          lowerQuery.includes('past month') ||
                          lowerQuery.includes('this week') ||
                          lowerQuery.includes('this month') ||
                          lowerQuery.includes('today') ||
                          lowerQuery.includes('lately') ||
                          lowerQuery.includes('recently') ||
                          lowerQuery.includes('of late') ||
                          /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(lowerQuery) ||
                          /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/.test(lowerQuery);
  
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
                               lowerQuery.includes('most of the time') ||
                               lowerQuery.includes('lately') ||
                               lowerQuery.includes('of late') ||
                               lowerQuery.includes('recently');
  
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
  
  const lowerQuery = query.toLowerCase();
  
  // Check for month name mentions first (new)
  const fullMonthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  
  const shortMonthNames = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];
  
  // First check for a year+month specification like "May 2023" or "2023 May"
  const yearMonthRegex = /\b(\d{4})\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i;
  const monthYearRegex = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{4})\b/i;
  
  let yearMatch = yearMonthRegex.exec(lowerQuery);
  let specifiedYear: number | null = null;
  let specifiedMonth: number | null = null;
  
  if (yearMatch) {
    specifiedYear = parseInt(yearMatch[1]);
    const monthName = yearMatch[2].toLowerCase();
    specifiedMonth = getMonthIndex(monthName);
  } else {
    yearMatch = monthYearRegex.exec(lowerQuery);
    if (yearMatch) {
      const monthName = yearMatch[1].toLowerCase();
      specifiedYear = parseInt(yearMatch[2]);
      specifiedMonth = getMonthIndex(monthName);
    }
  }
  
  // If we found a year+month specification
  if (specifiedYear !== null && specifiedMonth !== null) {
    startDate = new Date(specifiedYear, specifiedMonth, 1);
    startDate.setHours(0, 0, 0, 0);
    
    endDate = new Date(specifiedYear, specifiedMonth + 1, 0); // Last day of the month
    endDate.setHours(23, 59, 59, 999);
    
    const monthName = fullMonthNames[specifiedMonth];
    periodName = `${monthName} ${specifiedYear}`;
  } 
  // Check for just month name without year
  else {
    let foundMonthName = '';
    let monthIndex = -1;
    
    for (let i = 0; i < fullMonthNames.length; i++) {
      if (lowerQuery.includes(fullMonthNames[i])) {
        foundMonthName = fullMonthNames[i];
        monthIndex = i;
        break;
      }
    }
    
    if (monthIndex === -1) {
      for (let i = 0; i < shortMonthNames.length; i++) {
        // Make sure "may" is treated as a month and not just the modal verb
        if (shortMonthNames[i] === 'may') {
          // Check for surrounding context that suggests it's used as a month name
          const mayAsMonthRegex = /\b(in|during|for|about|of|this|last)\s+may\b|\bmay\s+(of|\d{4}|\d{1,2}(st|nd|rd|th))\b/i;
          if (mayAsMonthRegex.test(lowerQuery)) {
            foundMonthName = 'may';
            monthIndex = 4; // May is the 5th month (0-indexed)
            break;
          }
        } else if (lowerQuery.includes(shortMonthNames[i])) {
          foundMonthName = shortMonthNames[i];
          monthIndex = i;
          break;
        }
      }
    }
    
    if (monthIndex !== -1) {
      // Determine which year to use for the month
      // If the month is in the future, use last year
      // If the month is in the past or current, use this year
      let yearToUse = year;
      if (monthIndex > month) {
        yearToUse = year - 1; // Use last year
      }
      
      startDate = new Date(yearToUse, monthIndex, 1);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(yearToUse, monthIndex + 1, 0); // Last day of the month
      endDate.setHours(23, 59, 59, 999);
      
      periodName = foundMonthName;
    }
  }
  
  // If no month was found, match common time expressions
  if (startDate === null) {
    if (lowerQuery.includes('yesterday')) {
      startDate = new Date(year, month, date - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(year, month, date - 1);
      endDate.setHours(23, 59, 59, 999);
      periodName = "yesterday";
    } else if (lowerQuery.includes('last week')) {
      // Last week: Monday-Sunday of previous week
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysToLastMonday = dayOfWeek === 0 ? 7 : dayOfWeek;
      startDate = new Date(year, month, date - daysToLastMonday - 6);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(year, month, date - daysToLastMonday);
      endDate.setHours(23, 59, 59, 999);
      periodName = "last week";
    } else if (lowerQuery.includes('this week')) {
      // This week: Monday-Today of current week
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(year, month, date - daysToMonday);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(year, month, date);
      endDate.setHours(23, 59, 59, 999);
      periodName = "this week";
    } else if (lowerQuery.includes('last month')) {
      startDate = new Date(year, month - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(year, month, 0);
      endDate.setHours(23, 59, 59, 999);
      periodName = "last month";
    } else if (lowerQuery.includes('this month')) {
      startDate = new Date(year, month, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = now;
      periodName = "this month";
    } else if (lowerQuery.includes('today')) {
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
  }
  
  // Helper function to get month index from month name
  function getMonthIndex(monthName: string): number {
    const fullNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    
    const shortNames = [
      'jan', 'feb', 'mar', 'apr', 'may', 'jun',
      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ];
    
    let index = fullNames.indexOf(monthName);
    if (index === -1) {
      index = shortNames.indexOf(monthName);
    }
    
    return index;
  }
  
  console.log(`Time range extracted: ${startDate?.toISOString()} to ${endDate?.toISOString()} (${periodName})`);
  
  return {
    startDate: startDate ? startDate.toISOString() : null,
    endDate: endDate ? endDate.toISOString() : null,
    periodName
  };
}

