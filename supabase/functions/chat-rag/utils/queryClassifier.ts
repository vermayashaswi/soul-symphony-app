
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

// Detect time frame in the query
export function detectTimeframeInQuery(message: string): any {
  const lowerQuery = message.toLowerCase();
  
  // Simple timeframe detection - this could be enhanced with NLP
  if (lowerQuery.includes('last week') || lowerQuery.includes('previous week')) {
    const today = new Date();
    const lastWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
    const lastWeekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    
    return {
      startDate: lastWeekStart.toISOString(),
      endDate: lastWeekEnd.toISOString(),
      description: 'last week'
    };
  }
  
  if (lowerQuery.includes('this month') || lowerQuery.includes('current month')) {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    return {
      startDate: monthStart.toISOString(),
      endDate: today.toISOString(),
      description: 'this month'
    };
  }
  
  return null;
}
