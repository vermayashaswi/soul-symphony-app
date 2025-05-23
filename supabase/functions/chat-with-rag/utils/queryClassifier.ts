
/**
 * Detects if a query is related to mental health topics
 */
export function detectMentalHealthQuery(query: string): boolean {
  if (!query) return false;
  
  const mentalHealthKeywords = [
    'anxiety', 'anxious', 'depression', 'depressed', 'stress', 'stressed',
    'mental health', 'therapy', 'therapist', 'counseling', 'counselor',
    'feeling down', 'mood', 'emotions', 'emotional', 'panic', 'trauma',
    'self-care', 'coping', 'wellbeing', 'well-being', 'psychological',
    'mental illness', 'burnout', 'burn out', 'exhausted', 'overwhelmed'
  ];
  
  const lowerQuery = query.toLowerCase();
  
  // Check for direct mental health keywords
  for (const keyword of mentalHealthKeywords) {
    if (lowerQuery.includes(keyword)) {
      console.log(`[chat-with-rag] Mental health keyword detected: ${keyword}`);
      return true;
    }
  }
  
  // Check for mental health question patterns
  const mentalHealthPatterns = [
    /how (can|do) I (feel better|improve|cope|handle|manage|deal with)/i,
    /why (am I|do I) (feel|feeling) (sad|anxious|depressed|stressed|overwhelmed|scared)/i,
    /(recommend|suggest|advice) (for|about|on) (my|managing|improving|helping)/i,
    /what (should|can) I do (about|for|to improve|to help|to manage|to cope with)/i
  ];
  
  for (const pattern of mentalHealthPatterns) {
    if (pattern.test(lowerQuery)) {
      console.log(`[chat-with-rag] Mental health pattern detected: ${pattern}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Detects if a query is likely asking for a journal analysis
 */
export function isJournalAnalysisQuery(query: string): boolean {
  if (!query) return false;
  
  const lowerQuery = query.toLowerCase();
  
  // Analysis-specific keywords
  const analysisKeywords = [
    'analyze', 'analysis', 'insight', 'pattern', 'trend', 'summarize', 
    'summary', 'overview', 'review', 'reflection', 'assessment',
    'evaluate', 'examination', 'study', 'observation'
  ];
  
  // Journal-related context words
  const journalContextKeywords = [
    'journal', 'entries', 'wrote', 'written', 'recorded', 'documented',
    'my entries', 'my journals', 'my thoughts', 'my feelings', 'my emotions'
  ];
  
  // Check for direct mention of analysis keywords
  for (const keyword of analysisKeywords) {
    if (lowerQuery.includes(keyword)) {
      console.log(`[chat-with-rag] Analysis keyword detected: ${keyword}`);
      
      // If there's also a journal context keyword, high confidence
      for (const contextWord of journalContextKeywords) {
        if (lowerQuery.includes(contextWord)) {
          console.log(`[chat-with-rag] Journal context word detected: ${contextWord}`);
          return true;
        }
      }
    }
  }
  
  // Check for analysis question patterns
  const analysisPatterns = [
    /what (patterns|trends|insights|themes) (are there|can you find|do you see|appear|emerge)/i,
    /how (have I|has my|am I|are my) (changed|evolved|progressed|developed|grown)/i,
    /(show|tell|give) me (insights|analysis|summary|overview|patterns|trends|statistics)/i,
    /what do (my journals|my entries|I) (show|reveal|indicate|suggest|say) about/i
  ];
  
  for (const pattern of analysisPatterns) {
    if (pattern.test(lowerQuery)) {
      console.log(`[chat-with-rag] Analysis pattern detected: ${pattern}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Detect if a query contains a reference to a specific month
 */
export function detectMonthInQuery(query: string): string | null {
  if (!query) return null;
  
  const lowerQuery = query.toLowerCase();
  const months = [
    'january', 'jan', 'february', 'feb', 'march', 'mar',
    'april', 'apr', 'may', 'june', 'jun', 'july', 'jul',
    'august', 'aug', 'september', 'sep', 'sept', 'october', 'oct',
    'november', 'nov', 'december', 'dec'
  ];
  
  for (const month of months) {
    if (lowerQuery.includes(month)) {
      console.log(`[chat-with-rag] Month detected in query: ${month}`);
      return month;
    }
  }
  
  return null;
}

/**
 * Check if a query is specifically asking about a certain month
 */
export function isMonthSpecificQuery(query: string): boolean {
  if (!query) return false;
  
  const month = detectMonthInQuery(query);
  if (!month) return false;
  
  const lowerQuery = query.toLowerCase();
  
  // Patterns that indicate the query is specifically about that month
  const monthSpecificPatterns = [
    new RegExp(`(in|during|for|about) (${month})`, 'i'),
    new RegExp(`what (happened|did I do|did I feel|was I) (in|during) (${month})`, 'i'),
    new RegExp(`(${month}) (entries|journals|thoughts|feelings|emotions|experiences)`, 'i'),
    new RegExp(`^(${month})$`, 'i'),  // Just the month name
    new RegExp(`^(what about|how about|show me) (${month})`, 'i')
  ];
  
  for (const pattern of monthSpecificPatterns) {
    if (pattern.test(lowerQuery)) {
      console.log(`[chat-with-rag] Month-specific pattern detected: ${pattern}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a query is a direct question about dates
 */
export function isDirectDateQuery(query: string): boolean {
  if (!query) return false;
  
  const lowerQuery = query.toLowerCase().trim();
  
  // Direct date query patterns
  const dateQueryPatterns = [
    /what (day|date) is (today|tomorrow|yesterday)/i,
    /what (are|were) the dates (for|of) (last|this|next) (week|month|year)/i,
    /when (is|was|does) (last|this|next) (week|month|year) (start|end|begin)/i,
    /(tell|show) me (the dates|what days|what date) (for|of) (last|this|next) (week|month)/i,
    /^(what date|what day|what is the date|what's today|what's tomorrow)/i
  ];
  
  for (const pattern of dateQueryPatterns) {
    if (pattern.test(lowerQuery)) {
      console.log(`[chat-with-rag] Direct date query detected: ${pattern}`);
      return true;
    }
  }
  
  // Special cases - very simple date queries
  if (/^(today's date|tomorrow's date|yesterday's date)\??$/i.test(lowerQuery)) {
    console.log(`[chat-with-rag] Simple date query detected: ${lowerQuery}`);
    return true;
  }
  
  // Date range queries
  if (/(what dates are|when is) (last|this) week\??$/i.test(lowerQuery)) {
    console.log(`[chat-with-rag] Date range query detected: ${lowerQuery}`);
    return true;
  }
  
  return false;
}

/**
 * Detect timeframe information in a query
 */
export function detectTimeframeInQuery(query: string): null | {
  type: string;
  periodName?: string;
  startDate?: string;
  endDate?: string;
  monthName?: string;
  year?: number;
  timezone?: string;
} {
  if (!query) return null;
  
  const lowerQuery = query.toLowerCase().trim();
  const currentYear = new Date().getFullYear();
  
  console.log(`[chat-with-rag] Detecting timeframe in query: "${lowerQuery}"`);
  
  // Check for "last week" queries
  if (/\b(last|previous) week\b/i.test(lowerQuery)) {
    console.log('[chat-with-rag] Detected "last week" timeframe');
    return {
      type: 'lastWeek',
      periodName: 'last week',
      timezone: 'UTC'  // Will be replaced with user timezone later
    };
  }
  
  // Check for "this week" queries
  if (/\b(this|current) week\b/i.test(lowerQuery)) {
    console.log('[chat-with-rag] Detected "this week" timeframe');
    return {
      type: 'week',
      periodName: 'this week',
      timezone: 'UTC'  // Will be replaced with user timezone later
    };
  }
  
  // Check for "last month" queries
  if (/\b(last|previous) month\b/i.test(lowerQuery)) {
    console.log('[chat-with-rag] Detected "last month" timeframe');
    return {
      type: 'lastMonth',
      periodName: 'last month',
      timezone: 'UTC'
    };
  }
  
  // Check for "this month" queries
  if (/\b(this|current) month\b/i.test(lowerQuery)) {
    console.log('[chat-with-rag] Detected "this month" timeframe');
    return {
      type: 'month',
      periodName: 'this month',
      timezone: 'UTC'
    };
  }
  
  // Check for specific month queries
  const monthMatch = lowerQuery.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\b/i);
  if (monthMatch) {
    const monthName = monthMatch[0];
    console.log(`[chat-with-rag] Detected specific month: ${monthName}`);
    
    // Try to detect year
    const yearMatch = lowerQuery.match(/\b(20\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;
    
    return {
      type: 'specificMonth',
      monthName,
      year,
      periodName: `${monthName} ${year}`,
      timezone: 'UTC'
    };
  }
  
  // Check for recent time periods (last X days)
  const recentDaysMatch = lowerQuery.match(/\blast (\d+) days?\b/i);
  if (recentDaysMatch) {
    const days = parseInt(recentDaysMatch[1]);
    console.log(`[chat-with-rag] Detected "last ${days} days" timeframe`);
    if (days > 0) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      return {
        type: 'dateRange',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        periodName: `last ${days} days`,
        timezone: 'UTC'
      };
    }
  }
  
  // If no specific timeframe is detected
  return null;
}
