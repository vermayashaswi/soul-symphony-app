// Mental health and wellbeing term dictionary for domain recognition
const MENTAL_HEALTH_TERMS = [
  // Emotional states
  'anxiety', 'anxious', 'depression', 'depressed', 'stress', 'stressed',
  'mood', 'emotion', 'feeling', 'mental health', 'wellbeing', 'well-being',
  'therapy', 'therapist', 'counseling', 'psychiatrist', 'psychologist',
  // Common concerns
  'sleep', 'insomnia', 'tired', 'exhaustion', 'burnout', 'overwhelm', 
  'overthinking', 'ruminating', 'worry', 'worrying', 'trauma',
  // Self-improvement
  'self-care', 'self care', 'mindfulness', 'meditation', 'breathing',
  'coping', 'cope', 'healing', 'recovery', 'growth', 'improve',
  // Relationships
  'relationship', 'friendship', 'family', 'partner', 'work-life',
  'balance', 'boundaries', 'communication',
  // Actions and requests
  'help me', 'advice', 'suggestion', 'recommend', 'strategy', 'technique',
  'improve', 'better', 'healthier', 'calm', 'relax', 'peace'
];

// Month name recognition for time-based queries
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june', 
  'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec'
];

/**
 * Detect if a message is likely a mental health query requiring journal data
 */
export function detectMentalHealthQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Check for personal indicators combined with mental health terms
  const hasPersonalIndicators = /\b(i|me|my|mine|myself|we|our|us)\b/i.test(lowerMessage);
  
  // Check if any mental health term appears in the query
  const hasMentalHealthTerms = MENTAL_HEALTH_TERMS.some(term => 
    lowerMessage.includes(term.toLowerCase())
  );
  
  // Check for direct requests for help or advice
  const isHelpRequest = /\b(help|advice|suggest|recommend|improve|better)\b/i.test(lowerMessage);
  
  // Check for questions about feelings or emotional states
  const isEmotionalQuery = /\b(feel|feeling|felt|emotion|mood|happy|sad|angry|anxious)\b/i.test(lowerMessage);
  
  // If it contains personal indicators AND mental health terms OR emotional content, classify as mental_health
  if ((hasPersonalIndicators && (hasMentalHealthTerms || isEmotionalQuery)) || 
      (isHelpRequest && (hasMentalHealthTerms || isEmotionalQuery))) {
    return true;
  }
  
  return false;
}

/**
 * Detect month mentions in a query text
 * Returns the month name if found, or null if not found
 */
export function detectMonthInQuery(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced special handling for the word "may" since it's both a month and a modal verb
  // Check for patterns that indicate "may" is being used as a month
  const mayMonthPatterns = [
    /(^|\s)(in\s+may\b|during\s+may\b|\bfor\s+may\b|may\s+\d{4}|may\s+\d{1,2}|may\s+month|month\s+of\s+may|\bfirst\s+week\s+in\s+may\b)/i,
    /(^|\s)(early\s+may\b|late\s+may\b|mid\s+may\b|may\s+entries|\babout\s+may\b)/i,
    /(^|\s)(show\s+me\s+may\b|what\s+(about|happened\s+in)\s+may)/i,
    /(^|\s)(last\s+may\b|this\s+may\b|may\s+journal)/i
  ];
  
  // Check for "may" month patterns
  for (const pattern of mayMonthPatterns) {
    if (pattern.test(lowerMessage)) {
      console.log(`Detected 'May' as a month in query with pattern ${pattern}: "${message}"`);
      return 'may';
    }
  }
  
  // Iterate through all month names to find matches
  for (const month of MONTH_NAMES) {
    // Skip "may" as it's handled specially above
    if (month === 'may') continue;
    
    // Check if the month name appears surrounded by word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${month}\\b`, 'i');
    if (regex.test(lowerMessage)) {
      console.log(`Detected month in query: ${month} in "${message}"`);
      return month;
    }
  }
  
  // Special case: if query is JUST about may (like "may?" or "May.")
  if (/^may\??\.?$/i.test(lowerMessage.trim())) {
    console.log(`Detected 'may' as single-word month query: "${message}"`);
    return 'may';
  }
  
  return null;
}

// Detect if query appears to be a direct date query
export function isDirectDateQuery(message: string): boolean {
  const lowerQuery = message.toLowerCase();
  
  // Check for direct date-related queries
  return (
    lowerQuery.includes('what is the current week') ||
    lowerQuery.includes('what are the dates for this week') ||
    lowerQuery.includes('current week dates') ||
    lowerQuery.includes('this week dates') ||
    lowerQuery.includes('last week dates') ||
    lowerQuery.includes('previous week dates') ||
    lowerQuery.includes('what are the dates for last week')
  );
}

// Detect if query appears to be a journal analysis query
export function isJournalAnalysisQuery(message: string): boolean {
  const lowerQuery = message.toLowerCase();
  
  // Check for journal analysis related queries
  return (
    lowerQuery.includes('analyze my journal') ||
    lowerQuery.includes('journal analysis') ||
    lowerQuery.includes('journal entries') ||
    lowerQuery.includes('my entries') ||
    lowerQuery.includes('what have i written about') ||
    lowerQuery.includes('what did i write about')
  );
}

/**
 * Check if the query is likely about a specific month
 */
export function isMonthSpecificQuery(message: string): boolean {
  const monthName = detectMonthInQuery(message);
  if (!monthName) return false;
  
  const lowerQuery = message.toLowerCase();
  
  // Enhanced patterns for month-specific queries
  const monthPatterns = [
    new RegExp(`\\b${monthName}\\s+month\\b`, 'i'),
    new RegExp(`month\\s+of\\s+${monthName}\\b`, 'i'),
    new RegExp(`\\bin\\s+${monthName}\\b`, 'i'),
    new RegExp(`\\bduring\\s+${monthName}\\b`, 'i'),
    new RegExp(`\\bfor\\s+${monthName}\\b`, 'i'),
    new RegExp(`\\bweek\\s+in\\s+${monthName}\\b`, 'i'),
    new RegExp(`\\bweek\\s+of\\s+${monthName}\\b`, 'i'),
    new RegExp(`\\b${monthName}\\s+\\d{1,2}`, 'i'),     // "May 15" format
    new RegExp(`\\b${monthName}\\s+\\d{4}\\b`, 'i'),   // "May 2023" format
    // Single month name queries
    new RegExp(`^${monthName}\\??$`, 'i')               // Just the month name with optional question mark
  ];
  
  // Check each pattern
  for (const pattern of monthPatterns) {
    if (pattern.test(lowerQuery)) {
      console.log(`Detected month-specific query with pattern ${pattern}: "${message}"`);
      return true;
    }
  }
  
  // If the month is mentioned prominently and query is short, consider it month-specific
  if (lowerQuery.length < 30 && lowerQuery.includes(monthName.toLowerCase())) {
    console.log(`Short query with month mention detected as month-specific: "${message}"`);
    return true;
  }
  
  return false;
}

// Detect time frame in the query
export function detectTimeframeInQuery(message: string): any {
  const lowerQuery = message.toLowerCase();
  
  // Enhanced detection for month-specific queries
  const monthName = detectMonthInQuery(message);
  if (monthName) {
    console.log(`Detected month in query: ${monthName}`);
    
    // Get current year for default
    const currentYear = new Date().getFullYear();
    
    // Extract year if specified
    let year = currentYear;
    const yearMatch = lowerQuery.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      year = parseInt(yearMatch[1]);
      console.log(`Detected year in query: ${year}`);
    }
    
    // Determine month index (0-based)
    const monthMap: Record<string, number> = {
      'january': 0, 'jan': 0,
      'february': 1, 'feb': 1,
      'march': 2, 'mar': 2,
      'april': 3, 'apr': 3,
      'may': 4,
      'june': 5, 'jun': 5,
      'july': 6, 'jul': 6,
      'august': 7, 'aug': 7,
      'september': 8, 'sep': 8, 'sept': 8,
      'october': 9, 'oct': 9,
      'november': 10, 'nov': 10,
      'december': 11, 'dec': 11
    };
    
    // Find correct month index
    let monthIndex = -1;
    for (const [key, index] of Object.entries(monthMap)) {
      if (monthName.toLowerCase() === key.toLowerCase()) {
        monthIndex = index;
        break;
      }
    }
    
    if (monthIndex >= 0) {
      // Generate the timeframe object with the calculated dates
      const timeframe = {
        type: 'specificMonth',
        monthName: monthName,
        year: year,
        timezone: 'UTC', // Assuming UTC; this should be overridden with user timezone
        description: `${monthName} ${year}`
      };
      
      console.log("Generated month-specific timeframe:", JSON.stringify(timeframe, null, 2));
      return timeframe;
    }
  }
  
  // Enhanced timeframe detection for more common patterns
  if (lowerQuery.includes('last week') || lowerQuery.includes('previous week')) {
    console.log(`Detected "last week" timeframe in query: "${message}"`);
    return {
      type: 'lastWeek',
      description: 'last week',
      timezone: 'UTC' // Will be overridden with user timezone
    };
  }
  
  if (lowerQuery.includes('this week') || lowerQuery.includes('current week')) {
    console.log(`Detected "this week" timeframe in query: "${message}"`);
    return {
      type: 'week',
      description: 'this week',
      timezone: 'UTC'
    };
  }
  
  if (lowerQuery.includes('this month') || lowerQuery.includes('current month')) {
    console.log(`Detected "this month" timeframe in query: "${message}"`);
    return {
      type: 'month',
      description: 'this month',
      timezone: 'UTC'
    };
  }
  
  if (lowerQuery.includes('last month') || lowerQuery.includes('previous month')) {
    console.log(`Detected "last month" timeframe in query: "${message}"`);
    return {
      type: 'lastMonth',
      description: 'last month',
      timezone: 'UTC'
    };
  }
  
  console.log(`No timeframe detected in query: "${message}"`);
  return null;
}
