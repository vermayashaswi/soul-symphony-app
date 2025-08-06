
// Enhanced query classification utilities
export function detectMentalHealthQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  const mentalHealthPatterns = [
    /mental\s+health/i,
    /\b(anxiety|anxious|depress(ed|ion)|stress(ed)?|mood|emotion|therapy)\b/i,
    /\b(self[\s-]care|well[\s-]being|wellbeing|coping)\b/i,
    /\bhow\s+(to|can|do)\s+I\s+(feel|get|cope|manage|improve|handle)\b/i,
    /what\s+(is|should)\s+(best|good|helpful|recommended)\s+for\s+my\s+(mental|emotional)/i,
    /what\s+(should|can|must)\s+i\s+do/i
  ];
  
  return mentalHealthPatterns.some(pattern => pattern.test(lowerMessage));
}

export function detectMonthInQuery(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  const monthPatterns = [
    /\b(january|jan)\b/i,
    /\b(february|feb)\b/i,
    /\b(march|mar)\b/i,
    /\b(april|apr)\b/i,
    /\b(may)\b/i,
    /\b(june|jun)\b/i,
    /\b(july|jul)\b/i,
    /\b(august|aug)\b/i,
    /\b(september|sep|sept)\b/i,
    /\b(october|oct)\b/i,
    /\b(november|nov)\b/i,
    /\b(december|dec)\b/i
  ];
  
  for (const pattern of monthPatterns) {
    const match = lowerMessage.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

export function isDirectDateQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  const directDatePatterns = [
    /^what\s+(are\s+)?the\s+dates?\s+(for\s+)?(this\s+week|current\s+week|last\s+week)(\?|\.)?$/i,
    /^when\s+(is|was)\s+(this\s+week|current\s+week|last\s+week)(\?|\.)?$/i,
    /^(this\s+week|current\s+week|last\s+week)\s+dates?(\?|\.)?$/i
  ];
  
  return directDatePatterns.some(pattern => pattern.test(lowerMessage));
}

export function isJournalAnalysisQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  const analysisPatterns = [
    /\b(analyze|analysis|insight|pattern|trend)\b/i,
    /\bhow\s+(am\s+i|do\s+i)\b/i,
    /\bwhat\s+(emotions?|feelings?|moods?)\b/i,
    /\btop\s+\d+\b/i,
    /\bmost\s+(common|frequent)\b/i
  ];
  
  return analysisPatterns.some(pattern => pattern.test(lowerMessage));
}

export function isMonthSpecificQuery(message: string): boolean {
  return detectMonthInQuery(message) !== null;
}

export function detectTimeframeInQuery(message: string): any {
  const lowerMessage = message.toLowerCase();
  
  // Detect specific time periods
  if (lowerMessage.includes('last week')) {
    return {
      type: 'lastWeek',
      timezone: 'UTC'
    };
  }
  
  if (lowerMessage.includes('this week') || lowerMessage.includes('current week')) {
    return {
      type: 'week',
      timezone: 'UTC'
    };
  }
  
  if (lowerMessage.includes('last month')) {
    return {
      type: 'lastMonth',
      timezone: 'UTC'
    };
  }
  
  if (lowerMessage.includes('this month') || lowerMessage.includes('current month')) {
    return {
      type: 'month',
      timezone: 'UTC'
    };
  }
  
  // Check for specific months
  const monthName = detectMonthInQuery(message);
  if (monthName) {
    return {
      type: 'specificMonth',
      monthName: monthName,
      timezone: 'UTC'
    };
  }
  
  return null;
}

export function classifyQueryComplexity(message: string): 'simple' | 'complex' | 'multi_part' {
  const lowerMessage = message.toLowerCase();
  
  // Check for multiple questions
  const questionMarkers = (lowerMessage.match(/\?/g) || []).length;
  const andMarkers = (lowerMessage.match(/\band\b/g) || []).length;
  const alsoMarkers = (lowerMessage.match(/\balso\b/g) || []).length;
  
  if (questionMarkers > 1 || (andMarkers > 0 && (questionMarkers > 0 || alsoMarkers > 0))) {
    return 'multi_part';
  }
  
  // Check for complex analysis requests
  const complexPatterns = [
    /\b(pattern|trend|analysis|compare|correlation)\b/i,
    /\btop\s+\d+\b/i,
    /\bover\s+(time|period|months?|years?)\b/i,
    /\bhow\s+(often|much|many)\b/i
  ];
  
  if (complexPatterns.some(pattern => pattern.test(lowerMessage))) {
    return 'complex';
  }
  
  return 'simple';
}

export function detectUnrelatedQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  const unrelatedPatterns = [
    /\b(weather|temperature|forecast|climate)\b/i,
    /\b(recipe|cook|cooking|food preparation|ingredient)\b/i,
    /\b(history|geography|science|mathematics|physics|chemistry|biology)\b/i,
    /\b(sports|games|entertainment|movies|music|tv|television)\b/i,
    /\b(technology|programming|computer|software|app|coding)\b/i,
    /\b(news|politics|current events|election|government)\b/i,
    /\b(travel|vacation|tourist|destination)\b/i,
    /\b(fashion|style|clothing|makeup)\b/i,
    /\b(business|finance|stocks|investment|money|salary)\b/i,
    /\b(car|automobile|vehicle|transportation)\b/i
  ];
  
  return unrelatedPatterns.some(pattern => pattern.test(lowerMessage));
}

export function generateSubQueries(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  
  // Split on common separators
  const parts = message.split(/(?:\sand\s|\salso\s|\?(?!\s*$))/i)
    .map(part => part.trim())
    .filter(part => part.length > 5);
  
  if (parts.length > 1) {
    return parts.map(part => {
      // Add question mark if missing
      if (!part.endsWith('?') && !part.endsWith('.')) {
        return part + '?';
      }
      return part;
    });
  }
  
  return [message];
}
