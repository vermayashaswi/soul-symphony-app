
export function detectMentalHealthQuery(message: string): boolean {
  const mentalHealthKeywords = [
    'mental health', 'depression', 'anxiety', 'stress', 'mood', 'emotional', 
    'therapy', 'counseling', 'wellbeing', 'wellness', 'mindfulness', 'meditation'
  ];
  
  const lowerMessage = message.toLowerCase();
  return mentalHealthKeywords.some(keyword => lowerMessage.includes(keyword));
}

export function detectMonthInQuery(message: string): { month: number; year: number } | null {
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  
  const lowerMessage = message.toLowerCase();
  const currentYear = new Date().getFullYear();
  
  for (let i = 0; i < monthNames.length; i++) {
    if (lowerMessage.includes(monthNames[i])) {
      // Extract year if mentioned, otherwise use current year
      const yearMatch = message.match(/\b(20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;
      
      return { month: i + 1, year };
    }
  }
  
  return null;
}

export function isDirectDateQuery(message: string): boolean {
  const datePatterns = [
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,  // MM/DD/YYYY
    /\b\d{4}-\d{2}-\d{2}\b/,        // YYYY-MM-DD
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i
  ];
  
  return datePatterns.some(pattern => pattern.test(message));
}

export function isJournalAnalysisQuery(message: string): boolean {
  const analysisKeywords = [
    'analyze', 'pattern', 'trend', 'summary', 'insight', 'overview',
    'what', 'how', 'why', 'when', 'frequency'
  ];
  
  const journalKeywords = ['journal', 'entry', 'entries', 'wrote', 'writing'];
  
  const lowerMessage = message.toLowerCase();
  const hasAnalysisKeyword = analysisKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasJournalKeyword = journalKeywords.some(keyword => lowerMessage.includes(keyword));
  
  return hasAnalysisKeyword && hasJournalKeyword;
}

export function isMonthSpecificQuery(message: string): boolean {
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  
  const lowerMessage = message.toLowerCase();
  return monthNames.some(month => lowerMessage.includes(month));
}

export function detectTimeframeInQuery(message: string): any {
  const lowerMessage = message.toLowerCase();
  
  // Check for "last week"
  if (lowerMessage.includes('last week')) {
    console.log(`[chat-with-rag] Detected "last week" timeframe`);
    return { type: 'lastWeek', periodName: 'last week', timezone: 'UTC' };
  }
  
  // Check for "this week"
  if (lowerMessage.includes('this week')) {
    return { type: 'week', periodName: 'this week', timezone: 'UTC' };
  }
  
  // Check for "last month"
  if (lowerMessage.includes('last month')) {
    return { type: 'lastMonth', periodName: 'last month', timezone: 'UTC' };
  }
  
  // Check for "this month"
  if (lowerMessage.includes('this month')) {
    return { type: 'month', periodName: 'this month', timezone: 'UTC' };
  }
  
  // Check for specific months
  const monthMatch = detectMonthInQuery(message);
  if (monthMatch) {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return {
      type: 'specificMonth',
      monthName: monthNames[monthMatch.month - 1],
      year: monthMatch.year,
      periodName: `${monthNames[monthMatch.month - 1]} ${monthMatch.year}`,
      timezone: 'UTC'
    };
  }
  
  return null;
}
