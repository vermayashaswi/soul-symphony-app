
/**
 * This utility helps classify messages to determine if they should be 
 * processed using journal entries or as general questions
 */

import { analyzeQueryTypes } from './queryAnalyzer';
import { analyzeMentalHealthContent } from './messageProcessor';

export enum QueryCategory {
  GENERAL = 'GENERAL',
  JOURNAL_SPECIFIC = 'JOURNAL_SPECIFIC'
}

/**
 * Analyzes a user message to determine if it should be processed
 * using journal entries or as a general question
 */
export function classifyUserQuery(message: string): {
  category: QueryCategory;
  confidence: number;
  reasoning: string;
} {
  // Default values
  let category = QueryCategory.GENERAL;
  let confidence = 0.5;
  let reasoning = "No specific indicators found";

  // Get detailed query analysis
  const queryTypes = analyzeQueryTypes(message);
  const mentalHealthScore = analyzeMentalHealthContent(message);
  
  // Start with base confidence based on personal pronouns and mental health content
  confidence = mentalHealthScore;
  
  // Track specific reasons why this might be journal specific
  const journalSpecificReasons: string[] = [];
  const generalReasons: string[] = [];
  
  // Check for strong indicators of journal specific queries
  if (queryTypes.isPersonalInsightQuery) {
    journalSpecificReasons.push("Query asks for personal insights or self-reflection");
    confidence += 0.3;
  }
  
  if (queryTypes.isMentalHealthQuery) {
    journalSpecificReasons.push("Query relates to personal mental health or wellbeing");
    confidence += 0.2;
  }

  // Personal trait/personality questions should always be journal specific
  if (/\bam i\b|\bmy personality\b|\bmy traits?\b|\bi tend to\b/i.test(message.toLowerCase())) {
    journalSpecificReasons.push("Query about personal traits or personality");
    confidence += 0.35;
  }
  
  // Self-improvement or advice questions with personal context
  if (/\b(what|how) should i\b|\bhow (can|do) i\b/i.test(message.toLowerCase()) && 
      (queryTypes.isMentalHealthQuery || mentalHealthScore > 0.3)) {
    journalSpecificReasons.push("Personal advice or self-improvement question");
    confidence += 0.25;
  }
  
  // Pattern or habit questions should be journal specific
  if (queryTypes.isTimePatternQuery || message.toLowerCase().includes("pattern") || 
      message.toLowerCase().includes("habit") || message.toLowerCase().includes("routine")) {
    journalSpecificReasons.push("Query about personal patterns, habits or routines");
    confidence += 0.25;
  }
  
  // Explicit references to journal entries
  if (/\b(journal|entry|entries|wrote|written|recorded)\b/i.test(message.toLowerCase())) {
    journalSpecificReasons.push("Explicit reference to journal entries");
    confidence += 0.4;
  }
  
  // Emotion queries with personal context
  if (queryTypes.isEmotionFocused && /\b(i|me|my|myself)\b/i.test(message.toLowerCase())) {
    journalSpecificReasons.push("Question about personal emotions");
    confidence += 0.3;
  }
  
  // Indicators of general questions
  if (/\bwhat is\b|\bhow does\b|\bexplain\b|\bdescribe\b|\bdefine\b/i.test(message.toLowerCase()) &&
      !queryTypes.isPersonalInsightQuery && !queryTypes.isMentalHealthQuery) {
    generalReasons.push("Query appears to be asking for general information");
    confidence -= 0.2;
  }
  
  if (message.length < 15) {
    generalReasons.push("Query is very short and may lack context");
    confidence -= 0.1;
  }
  
  // Make the final classification based on confidence
  if (confidence > 0.5) {
    category = QueryCategory.JOURNAL_SPECIFIC;
    reasoning = journalSpecificReasons.length > 0 ? 
      journalSpecificReasons.join("; ") : 
      "Overall query analysis suggests personal nature";
  } else {
    category = QueryCategory.GENERAL;
    reasoning = generalReasons.length > 0 ? 
      generalReasons.join("; ") : 
      "Query appears to be seeking general information";
  }
  
  // Ensure confidence is within bounds
  confidence = Math.max(0, Math.min(1, confidence));
  
  return {
    category,
    confidence,
    reasoning
  };
}

/**
 * Some query patterns should always be treated as journal-specific
 */
export function forceJournalSpecificMatching(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // These patterns should always be journal-specific
  const alwaysJournalPatterns = [
    /\bam i\b/i,                        // "Am I an introvert?"
    /\bdo i\b/i,                        // "Do I like exercise?"
    /\bhow (am|do) i\b/i,               // "How am I doing?"
    /\bwhat should i do\b/i,            // "What should I do about my anxiety?"
    /\bwhat (makes|helps) me\b/i,       // "What makes me happy?"
    /\bhow (can|could|should) i\b/i,    // "How can I improve my sleep?"
    /\bmy (mental health|wellbeing)\b/i // "Help my mental health"
  ];
  
  return alwaysJournalPatterns.some(pattern => pattern.test(lowerMessage));
}

/**
 * Enhanced query classification that combines multiple approaches
 */
export function enhancedQueryClassification(message: string): {
  category: QueryCategory;
  confidence: number;
  reasoning: string;
  forceJournalSpecific: boolean;
} {
  // First check if this matches patterns that should always be journal-specific
  const forceJournal = forceJournalSpecificMatching(message);
  
  // Then do the regular classification
  const classification = classifyUserQuery(message);
  
  // If forcing journal specific, override the classification
  if (forceJournal) {
    return {
      category: QueryCategory.JOURNAL_SPECIFIC,
      confidence: 0.95,
      reasoning: "Query matches pattern that should always use journal entries",
      forceJournalSpecific: true
    };
  }
  
  return {
    ...classification,
    forceJournalSpecific: forceJournal
  };
}
