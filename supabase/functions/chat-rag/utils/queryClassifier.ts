
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
  
  // Special handling for the word "may" since it's both a month and a modal verb
  if (/(^|\s)(may\s+month|month\s+of\s+may|\bin\s+may\b|during\s+may)/.test(lowerMessage)) {
    console.log("Detected 'may' as a month in query:", message);
    return 'may';
  }
  
  for (const month of MONTH_NAMES) {
    if (lowerMessage.includes(month)) {
      console.log(`Detected month in query: ${month} in "${message}"`);
      return month;
    }
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
  
  // Check for patterns that suggest querying about a specific month
  return (
    lowerQuery.includes(`${monthName} month`) ||
    lowerQuery.includes(`month of ${monthName}`) ||
    lowerQuery.includes(`in ${monthName}`) ||
    lowerQuery.includes(`during ${monthName}`) ||
    lowerQuery.includes(`${monthName}`)
  );
}

// Detect time frame in the query
export function detectTimeframeInQuery(message: string): any {
  const lowerQuery = message.toLowerCase();
  
  // Check for specific month mentions first
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
      // Create start and end dates for the specified month
      const startDate = new Date(year, monthIndex, 1);
      const endDate = new Date(year, monthIndex + 1, 0); // Last day of month
      
      return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        description: `${monthName} ${year}`,
        periodName: monthName,
        type: 'specificMonth',
        monthName: monthName,
        year: year
      };
    }
  }
  
  // Simple timeframe detection - this could be enhanced with NLP
  if (lowerQuery.includes('last week') || lowerQuery.includes('previous week')) {
    const today = new Date();
    const lastWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
    const lastWeekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    
    return {
      startDate: lastWeekStart.toISOString(),
      endDate: lastWeekEnd.toISOString(),
      description: 'last week',
      type: 'lastWeek'
    };
  }
  
  if (lowerQuery.includes('this month') || lowerQuery.includes('current month')) {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    return {
      startDate: monthStart.toISOString(),
      endDate: today.toISOString(),
      description: 'this month',
      type: 'month'
    };
  }
  
  return null;
}
