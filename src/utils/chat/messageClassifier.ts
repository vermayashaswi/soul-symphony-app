
/**
 * This utility helps classify messages to determine if they should be 
 * processed using journal entries or as general questions
 */

import { analyzeQueryTypes } from './queryAnalyzer';
import { analyzeMentalHealthContent } from './messageProcessor';

export enum QueryCategory {
  JOURNAL_SPECIFIC = 'JOURNAL_SPECIFIC',
  GENERAL_MENTAL_HEALTH = 'GENERAL_MENTAL_HEALTH', 
  GENERAL_NO_RELATION = 'GENERAL_NO_RELATION',
  CONVERSATIONAL = 'CONVERSATIONAL'
}

/**
 * Analyzes a user message to determine its category and processing approach
 */
export function classifyUserQuery(message: string): {
  category: QueryCategory;
  confidence: number;
  reasoning: string;
} {
  // Default values
  let category = QueryCategory.GENERAL_NO_RELATION;
  let confidence = 0.5;
  let reasoning = "No specific indicators found";

  const lowerMessage = message.toLowerCase().trim();
  
  // Get detailed query analysis
  const queryTypes = analyzeQueryTypes(message);
  const mentalHealthScore = analyzeMentalHealthContent(message);
  
  // Track specific reasons for classification
  const journalSpecificReasons: string[] = [];
  const mentalHealthReasons: string[] = [];
  const conversationalReasons: string[] = [];
  const noRelationReasons: string[] = [];
  
  // Check for conversational patterns first
  const conversationalPatterns = [
    /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i,
    /^(thank you|thanks|thank u)\b/i,
    /^(how are you|how do you)\b/i,
    /^(what (are|is) you|who are you|tell me about yourself)\b/i,
    /^(can you|could you|would you).{0,20}(help|assist|explain|clarify)\b/i,
    /^(i don't understand|can you clarify|what do you mean)\b/i,
    /^(sorry|excuse me|pardon)\b/i,
    /^(yes|no|okay|ok|sure|alright)\s*\.?\s*$/i,
    /\b(please|can you).{0,30}(explain|clarify|help me understand)\b/i
  ];
  
  for (const pattern of conversationalPatterns) {
    if (pattern.test(lowerMessage)) {
      conversationalReasons.push("Conversational greeting or clarification request");
      category = QueryCategory.CONVERSATIONAL;
      confidence = 0.9;
      break;
    }
  }
  
  // If not conversational, check for journal specific indicators
  if (category !== QueryCategory.CONVERSATIONAL) {
    confidence = mentalHealthScore;
    
    // Strong indicators of journal specific queries
    if (queryTypes.isPersonalInsightQuery) {
      journalSpecificReasons.push("Query asks for personal insights or self-reflection");
      confidence += 0.3;
    }
    
    if (queryTypes.isMentalHealthQuery) {
      journalSpecificReasons.push("Query relates to personal mental health or wellbeing");
      confidence += 0.2;
    }

    // Personal trait/personality questions should always be journal specific
    if (/\bam i\b|\bmy personality\b|\bmy traits?\b|\bi tend to\b/i.test(lowerMessage)) {
      journalSpecificReasons.push("Query about personal traits or personality");
      confidence += 0.35;
    }
    
    // Self-improvement or advice questions with personal context
    if (/\b(what|how) should i\b|\bhow (can|do) i\b/i.test(lowerMessage) && 
        (queryTypes.isMentalHealthQuery || mentalHealthScore > 0.3)) {
      journalSpecificReasons.push("Personal advice or self-improvement question");
      confidence += 0.25;
    }
    
    // Pattern or habit questions should be journal specific
    if (queryTypes.isTimePatternQuery || /\b(pattern|habit|routine)\b/i.test(lowerMessage)) {
      journalSpecificReasons.push("Query about personal patterns, habits or routines");
      confidence += 0.25;
    }
    
    // Explicit references to journal entries
    if (/\b(journal|entry|entries|wrote|written|recorded)\b/i.test(lowerMessage)) {
      journalSpecificReasons.push("Explicit reference to journal entries");
      confidence += 0.4;
    }
    
    // Emotion queries with personal context
    if (queryTypes.isEmotionFocused && /\b(i|me|my|myself)\b/i.test(lowerMessage)) {
      journalSpecificReasons.push("Question about personal emotions");
      confidence += 0.3;
    }
    
    // Personality trait questions - enhanced detection
    const personalityTraits = [
      'introvert', 'extrovert', 'ambivert', 'shy', 'outgoing', 'reserved',
      'social', 'antisocial', 'talkative', 'quiet', 'people person', 'loner',
    ];
    
    for (const trait of personalityTraits) {
      if (lowerMessage.includes(trait)) {
        journalSpecificReasons.push(`Query mentions personality trait: ${trait}`);
        confidence += 0.4;
        break;
      }
    }
    
    // Enhanced pattern detection for personality questions
    if (/\bdo i like\b|\bam i\b.{0,25}\b(person|individual|introvert|extrovert)\b/i.test(lowerMessage)) {
      journalSpecificReasons.push("Question about personal identity or preference");
      confidence += 0.45;
    }
    
    // Check for general mental health topics (without personal context)
    const mentalHealthTopics = [
      /\b(anxiety|depression|stress|mental health|wellbeing|wellness)\b/i,
      /\b(meditation|mindfulness|self[\s-]care|therapy|counseling)\b/i,
      /\b(happiness|sadness|anger|emotion|mood|feeling)\b/i,
      /\b(coping|resilience|recovery|healing|growth)\b/i,
      /\b(sleep|insomnia|burnout|overwhelm|worry)\b/i,
      /\bwhat (are|is) (the )?(best|good|effective) (ways?|methods?|techniques?)\b/i,
      /\bhow (to|can|do).{0,30}(improve|increase|reduce|manage|cope with|deal with)\b/i,
      /\b(tips|advice|strategies|techniques) (for|to)\b/i
    ];
    
    let hasMentalHealthContent = false;
    for (const pattern of mentalHealthTopics) {
      if (pattern.test(lowerMessage)) {
        hasMentalHealthContent = true;
        mentalHealthReasons.push("Contains general mental health terminology");
        break;
      }
    }
    
    // Check for non-mental health factual questions
    const factualPatterns = [
      /\b(who is|what is|where is|when (was|is)|how many)\b/i,
      /\b(president|capital|population|history|geography|science|math|technology)\b/i,
      /\b(weather|news|sports|politics|economics|business)\b/i,
      /\b(recipe|cooking|food|restaurant|movie|music|book)\b/i,
      /\b(define|definition|meaning|translate|convert)\b/i
    ];
    
    let hasFactualContent = false;
    for (const pattern of factualPatterns) {
      if (pattern.test(lowerMessage)) {
        hasFactualContent = true;
        noRelationReasons.push("Contains factual or non-mental health query patterns");
        break;
      }
    }
    
    // Make the final classification
    if (confidence > 0.5 && journalSpecificReasons.length > 0) {
      category = QueryCategory.JOURNAL_SPECIFIC;
      reasoning = journalSpecificReasons.join("; ");
    } else if (hasMentalHealthContent && !hasFactualContent) {
      category = QueryCategory.GENERAL_MENTAL_HEALTH;
      confidence = 0.8;
      reasoning = mentalHealthReasons.join("; ") || "General mental health topic without personal context";
    } else if (hasFactualContent && !hasMentalHealthContent) {
      category = QueryCategory.GENERAL_NO_RELATION;
      confidence = 0.8;
      reasoning = noRelationReasons.join("; ") || "Factual question unrelated to mental health";
    } else {
      // Default case - lean towards no relation unless there's clear mental health context
      category = QueryCategory.GENERAL_NO_RELATION;
      confidence = 0.6;
      reasoning = "Query doesn't clearly fit mental health or personal insight categories";
    }
  }
  
  // Set reasoning for conversational
  if (category === QueryCategory.CONVERSATIONAL) {
    reasoning = conversationalReasons.join("; ");
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
    /\bmy (mental health|wellbeing)\b/i, // "Help my mental health"
    /\b(intro|extro)vert\b/i,           // "Am I an introvert/extrovert?"
    /\b(like|enjoy).{0,10}\bpeople\b/i,  // "Do I like people?"
    /\b(am|are|is)\b.{0,10}\b(social|shy|outgoing|reserved)\b/i, // "Am I social/shy/outgoing/reserved?"
    /\b(personality|character|nature|temperament)\b/i, // "What's my personality like?"
    /\bdo i prefer\b/i,                 // "Do I prefer being alone or in groups?"
    /\bsocial (life|interaction|situation)/i, // "How do I handle social situations?"
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
