// This file contains functions to analyze the type of query a user is asking

export type QueryTypes = {
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
  isRatingRequest: boolean;
  isPersonalInsightQuery: boolean;  // New field for personal insight queries
  isMentalHealthQuery: boolean;     // New field for mental health queries
  isStatisticalQuery: boolean;      // Added missing property
  needsEmergencyFixes: boolean;     // Added missing property for emergency fixes
  emotion?: string;
  theme?: string;
  timeRange: {
    startDate: string | null;
    endDate: string | null;
    periodName: string;
    duration: number;
  };
  startDate?: string;
  endDate?: string;
};

/**
 * Calculate relative date range based on time expression
 * @param timeExpression Time-related phrase from user query
 * @returns Object containing start date, end date, period name, and duration in days
 */
export function calculateRelativeDateRange(timeExpression: string): { 
  startDate: string; 
  endDate: string; 
  periodName: string;
  duration: number;
} {
  const now = new Date();
  let startDate = new Date();
  let periodName = '';
  let duration = 0;

  // Default to current date
  let endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);
  
  // Convert to lowercase for easier matching
  const lowercased = timeExpression.toLowerCase();
  
  // Process time expressions
  if (lowercased.includes('today')) {
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    periodName = 'today';
    duration = 1;
  }
  else if (lowercased.includes('yesterday')) {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
    
    periodName = 'yesterday';
    duration = 1;
  }
  else if (lowercased.match(/last\s+(\d+)\s+days?/)) {
    const matches = lowercased.match(/last\s+(\d+)\s+days?/);
    const days = parseInt(matches![1], 10);
    
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    periodName = `last ${days} days`;
    duration = days;
  }
  else if (lowercased.includes('last week') || lowercased.includes('past week')) {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    
    periodName = 'last week';
    duration = 7;
  }
  else if (lowercased.includes('this week')) {
    // Start of current week (Sunday or Monday, depending on locale)
    startDate = new Date(now);
    const day = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday of current week
    
    startDate = new Date(startDate.setDate(diff));
    startDate.setHours(0, 0, 0, 0);
    
    periodName = 'this week';
    duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  else if (lowercased.includes('last month') || lowercased.includes('past month')) {
    startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setHours(0, 0, 0, 0);
    
    periodName = 'last month';
    duration = 30;
  }
  else if (lowercased.includes('this month')) {
    startDate = new Date(now);
    startDate.setDate(1); // First day of current month
    startDate.setHours(0, 0, 0, 0);
    
    periodName = 'this month';
    duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  else if (lowercased.includes('last year') || lowercased.includes('past year')) {
    startDate = new Date(now);
    startDate.setFullYear(startDate.getFullYear() - 1);
    startDate.setHours(0, 0, 0, 0);
    
    periodName = 'last year';
    duration = 365;
  }
  else if (lowercased.includes('this year')) {
    startDate = new Date(now.getFullYear(), 0, 1); // January 1st of current year
    startDate.setHours(0, 0, 0, 0);
    
    periodName = 'this year';
    duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  else if (lowercased.match(/past\s+(\d+)\s+months?/)) {
    const matches = lowercased.match(/past\s+(\d+)\s+months?/);
    const months = parseInt(matches![1], 10);
    
    startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setHours(0, 0, 0, 0);
    
    periodName = `past ${months} months`;
    duration = months * 30; // approximation
  }
  else if (lowercased.match(/past\s+(\d+)\s+weeks?/)) {
    const matches = lowercased.match(/past\s+(\d+)\s+weeks?/);
    const weeks = parseInt(matches![1], 10);
    
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - (weeks * 7));
    startDate.setHours(0, 0, 0, 0);
    
    periodName = `past ${weeks} weeks`;
    duration = weeks * 7;
  }
  else {
    // Default to last 30 days if no specific time period is detected
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    
    periodName = 'recent';
    duration = 30;
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    periodName,
    duration
  };
}

/**
 * Analyzes the user's query to determine what type of processing it needs
 */
export function analyzeQueryTypes(message: string): QueryTypes {
  const lowerQuery = message.toLowerCase();
  
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
    isRatingRequest: false,
    isPersonalInsightQuery: false,
    isMentalHealthQuery: false,
    isStatisticalQuery: false, // Initialize the new property
    needsEmergencyFixes: false, // Initialize the emergency fixes property
    timeRange: {
      startDate: null,
      endDate: null,
      periodName: "recently",
      duration: 0
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
                         
  // Detect if this is a rating request                    
  result.isRatingRequest = /\brate\b|\bscore\b|\bevaluate\b|\bassess\b|\banalyze\b|\breview\b|\brank\b/i.test(lowerQuery);
  
  // If this is a rating request, ensure we flag it as needing data aggregation
  if (result.isRatingRequest) {
    result.needsDataAggregation = true;
  }

  // NEW: Detect personal insight questions about self-identity, personality, or traits
  const personalInsightPatterns = [
    /\bam i\b|\bdo i\b|\bhow am i\b|\bwhat am i\b/i,  // "Am I an introvert?", "Do I like people?"
    /\bhave i been\b|\bhave i felt\b/i,                // "Have I been anxious lately?"
    /\bmy personality\b|\bmy traits\b|\bmy character\b/i, // "What are my personality traits?"
    /\bdoes my\b|\bhow does my\b/i,                    // "How does my anxiety affect me?"
    /\bhow (do|would|did|should) i\b/i,                // "How do I handle stress?"
    /\bwhat (do|should) i\b/i,                         // "What should I do?"
    /\bi tend to\b|\bi usually\b|\bi often\b|\bi normally\b/i // "Do I tend to overthink?"
  ];
  
  result.isPersonalInsightQuery = personalInsightPatterns.some(pattern => pattern.test(lowerQuery));

  // NEW: Detect mental health-related queries
  const mentalHealthTerms = [
    'mental health', 'wellbeing', 'well-being', 'wellness', 'self-care',
    'anxiety', 'depression', 'stress', 'burnout', 'trauma',
    'therapy', 'coping', 'healing', 'mindfulness', 'meditation',
    'overwhelm', 'sleep', 'insomnia', 'rest', 'mood',
    'overthinking', 'worry', 'rumination', 'mental state'
  ];

  result.isMentalHealthQuery = mentalHealthTerms.some(term => lowerQuery.includes(term));
  
  // If the query mentions the user specifically (I, me, my) and mental health,
  // it's very likely a personal mental health question requiring journal analysis
  if (result.isMentalHealthQuery && /\b(i|me|my|myself)\b/i.test(lowerQuery)) {
    result.isPersonalInsightQuery = true;
    result.needsMoreContext = true;
  }

  // Set emergency fixes flag for personality and emotion queries
  result.needsEmergencyFixes = result.isPersonalInsightQuery || result.isEmotionFocused;

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
  
  // Enhanced temporal queries detection to include month names AND "since" patterns
  result.isTemporalQuery = lowerQuery.includes('yesterday') ||
                          lowerQuery.includes('last week') ||
                          lowerQuery.includes('past week') ||
                          lowerQuery.includes('past month') ||
                          lowerQuery.includes('this week') ||
                          lowerQuery.includes('this month') ||
                          lowerQuery.includes('today') ||
                          lowerQuery.includes('lately') ||
                          lowerQuery.includes('recently') ||
                          lowerQuery.includes('of late') ||
                          lowerQuery.includes('since') ||  // FIXED: Include "since" patterns
                          /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(lowerQuery) ||
                          /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/.test(lowerQuery) ||
                          /\bsince\s+(late|early|mid)\s+\w+/i.test(lowerQuery);  // FIXED: "since late April" patterns
  
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
                               result.isRatingRequest ||
                               result.isPersonalInsightQuery ||  // Personal insight usually needs data aggregation
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
function extractTimeRange(query: string): { startDate: string | null, endDate: string | null, periodName: string, duration: number } {
  const now = new Date();
  const year = now.getFullYear(); // FIXED: Using current year (2025)
  const month = now.getMonth();
  const date = now.getDate();
  
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let periodName = "recently";
  let duration = 30; // Default duration in days
  
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
  
  // FIXED: Handle "since" patterns before other time expressions
  if (startDate === null) {
    // Handle "since late April", "since early May", etc.
    const sincePattern = /\bsince\s+(late|early|mid)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i;
    const sinceMatch = sincePattern.exec(lowerQuery);
    
    if (sinceMatch) {
      const modifier = sinceMatch[1].toLowerCase(); // late, early, mid
      const monthName = sinceMatch[2].toLowerCase();
      const monthIndex = getMonthIndex(monthName);
      
      if (monthIndex !== -1) {
        // Determine which year to use
        let yearToUse = year;
        if (monthIndex > month) {
          yearToUse = year - 1; // Use last year if month is in the future
        }
        
        // Set start date based on modifier
        startDate = new Date(yearToUse, monthIndex, 1);
        if (modifier === 'late') {
          startDate.setDate(20); // Late = around 20th
        } else if (modifier === 'mid') {
          startDate.setDate(15); // Mid = around 15th
        } else if (modifier === 'early') {
          startDate.setDate(1); // Early = beginning of month
        }
        startDate.setHours(0, 0, 0, 0);
        
        endDate = now;
        periodName = `since ${modifier} ${monthName}`;
        duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
    // If no "since" pattern found, check other expressions
    else if (lowerQuery.includes('yesterday')) {
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
  
  // Calculate duration between startDate and endDate
  if (startDate && endDate) {
    const timeDiff = endDate.getTime() - startDate.getTime();
    duration = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  }
  
  console.log(`Time range extracted: ${startDate?.toISOString()} to ${endDate?.toISOString()} (${periodName}), duration: ${duration} days`);
  
  return {
    startDate: startDate ? startDate.toISOString() : null,
    endDate: endDate ? endDate.toISOString() : null,
    periodName,
    duration
  };
}
