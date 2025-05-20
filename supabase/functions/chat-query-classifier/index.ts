
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Message classifier for determining if a query should be processed using journal entries
 * or as a general question.
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Analyze message to detect if it's personal or general
    const classification = classifyMessage(message);

    return new Response(
      JSON.stringify(classification),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing message classification:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

/**
 * Classify a message as needing journal analysis or being a general question
 */
function classifyMessage(message: string): {
  category: string;
  confidence: number;
  shouldUseJournal: boolean;
  reasoning: string;
} {
  const lowerMessage = message.toLowerCase();
  
  // Initialize with default values
  let category = "GENERAL";
  let confidence = 0.5;
  let reasoning = "No specific indicators found";
  
  // Collection of indicators that suggest we should use journal entries
  const personalIndicators = [
    // Personal trait/personality questions
    { pattern: /\bam i\b|\bdo i\b/i, 
      weight: 0.4, 
      reason: "Question about personal traits or preferences" },
      
    // Mental health related queries
    { pattern: /\bmy (mental health|wellbeing|wellness|anxiety|depression|stress)\b/i, 
      weight: 0.5, 
      reason: "Personal mental health question" },
    
    // Self-improvement questions
    { pattern: /\bhow (can|could|should) i\b|\bwhat should i do\b/i, 
      weight: 0.35, 
      reason: "Seeking personal advice or self-improvement" },
      
    // Emotion-related personal questions
    { pattern: /\bhow (do|did) i feel\b|\bmy emotions\b|\bi feel\b/i, 
      weight: 0.4, 
      reason: "Question about personal emotions" },
      
    // Pattern recognition in behavior
    { pattern: /\b(pattern|habit|routine|tendency|typically|usually|often)\b/i, 
      weight: 0.3, 
      reason: "Question about personal patterns or habits" },
      
    // First-person indicators with health/wellbeing terms
    { pattern: /\bi\b.{1,30}\b(anxiety|stress|depression|mood|emotion|mental)\b/i, 
      weight: 0.4, 
      reason: "Personal context with mental health terms" },
      
    // Explicit references to journal entries
    { pattern: /\b(journal|entry|entries|wrote|written|recorded)\b/i, 
      weight: 0.45, 
      reason: "Explicit reference to journal entries" },
      
    // Temporal questions about self
    { pattern: /\bhow (have|did) i\b.{1,20}\b(recently|lately|past|week|month|year)\b/i, 
      weight: 0.35, 
      reason: "Question about personal changes over time" },
      
    // Personality trait specific questions
    { pattern: /\b(intro|extro)vert\b/i,
      weight: 0.5,
      reason: "Question about introversion/extroversion personality traits" },
      
    // Social preference questions
    { pattern: /\bdo i (like|enjoy|prefer)\b.{0,15}\bpeople\b/i,
      weight: 0.5,
      reason: "Question about social preferences" },
      
    // Personality type questions
    { pattern: /\bwhat (type|kind) of person\b/i,
      weight: 0.45,
      reason: "Question about personality type" },
      
    // Character trait questions
    { pattern: /\bmy (personality|character|nature|temperament)\b/i,
      weight: 0.5,
      reason: "Question about personal character traits" },
      
    // Social comfort questions
    { pattern: /\b(how|do) i\b.{0,20}\b(handle|manage|deal with|approach) social\b/i,
      weight: 0.45,
      reason: "Question about handling social situations" },
      
    // Social energy questions
    { pattern: /\b(energized|drained|tired)\b.{0,20}\b(after|by|from|when)\b.{0,20}\b(social|people|interaction|talking|conversation)\b/i,
      weight: 0.5,
      reason: "Question about social energy levels" }
  ];
  
  // Indicators that suggest this is a general question
  const generalIndicators = [
    // Definitional questions without personal context
    { pattern: /\bwhat (is|are)\b(?!.{0,15}\b(i|me|my|myself)\b)/i, 
      weight: -0.3, 
      reason: "General definitional question" },
      
    // How-to questions without personal context
    { pattern: /\bhow (to|do you|does one|can one|can people)\b/i, 
      weight: -0.25, 
      reason: "General how-to question" },
      
    // Questions about other people, not self
    { pattern: /\b(people|humans|individuals|everyone|most people)\b/i, 
      weight: -0.2, 
      reason: "Question about people in general, not self" },
      
    // Very short questions that lack context
    { pattern: /^.{1,15}$/i, 
      weight: -0.15, 
      reason: "Very short query lacking personal context" }
  ];
  
  // Start with base confidence
  confidence = 0.4; // Slight bias toward general questions
  
  // Track reasons for classification
  const journalReasons = [];
  const generalReasons = [];
  
  // Check for personal indicators
  for (const indicator of personalIndicators) {
    if (indicator.pattern.test(lowerMessage)) {
      confidence += indicator.weight;
      journalReasons.push(indicator.reason);
    }
  }
  
  // Check for general indicators
  for (const indicator of generalIndicators) {
    if (indicator.pattern.test(lowerMessage)) {
      confidence += indicator.weight; // This will subtract since weights are negative
      generalReasons.push(indicator.reason);
    }
  }
  
  // Special case: Mental health advice without personal context
  if ((/\b(mental health|anxiety|depression|stress)\b/i.test(lowerMessage)) && 
      !(/\b(i|me|my|myself)\b/i.test(lowerMessage))) {
    confidence -= 0.1;
    generalReasons.push("Mental health topic without personal context");
  }
  
  // Special case: Strong personal indicators override everything else
  const strongPersonalPatterns = [
    /\bam i\b/i,
    /\bdo i\b.{1,20}\b(like|enjoy|prefer|tend to|usually)\b/i,
    /\bhow (can|could|should) i\b/i,
    /\bwhat should i do\b/i,
    /\bhelp (me|my)\b/i,
    /\b(intro|extro)vert\b/i,
    /\bdo i like people\b/i,
    /\bwhat (kind|type) of person am i\b/i
  ];
  
  const hasStrongPersonalIndicator = strongPersonalPatterns.some(pattern => pattern.test(lowerMessage));
  if (hasStrongPersonalIndicator) {
    confidence = Math.max(confidence, 0.8);
    journalReasons.push("Strong personal context indicator");
  }
  
  // Make the final classification based on confidence
  if (confidence > 0.5) {
    category = "JOURNAL_SPECIFIC";
    reasoning = journalReasons.length > 0 ? 
      journalReasons.slice(0, 3).join("; ") : 
      "Overall analysis suggests personal nature";
  } else {
    category = "GENERAL";
    reasoning = generalReasons.length > 0 ? 
      generalReasons.slice(0, 3).join("; ") : 
      "Query appears to be seeking general information";
  }
  
  // Ensure confidence is within bounds
  confidence = Math.max(0, Math.min(1, confidence));
  
  return {
    category,
    confidence,
    shouldUseJournal: category === "JOURNAL_SPECIFIC" || confidence > 0.5,
    reasoning
  };
}
