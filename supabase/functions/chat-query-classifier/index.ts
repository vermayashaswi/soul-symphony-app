
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Enhanced message classifier with 3-tier categorization system
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

    // Classify message using enhanced 3-tier system
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
 * Enhanced 3-tier classification system
 */
function classifyMessage(message: string): {
  category: string;
  confidence: number;
  shouldUseJournal: boolean;
  reasoning: string;
} {
  const lowerMessage = message.toLowerCase().trim();
  
  // Initialize with default values
  let category = "GENERAL_NO_RELATION";
  let confidence = 0.5;
  let reasoning = "No specific indicators found";
  
  // Step 1: Check for conversational patterns first
  const conversationalPatterns = [
    { pattern: /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i, 
      weight: 0.95, 
      reason: "Greeting or salutation" },
      
    { pattern: /^(thank you|thanks|thank u)\b/i, 
      weight: 0.9, 
      reason: "Expression of gratitude" },
      
    { pattern: /^(how are you|how do you)\b/i, 
      weight: 0.85, 
      reason: "Conversational inquiry" },
      
    { pattern: /^(what (are|is) you|who are you|tell me about yourself)\b/i, 
      weight: 0.9, 
      reason: "Getting to know the assistant" },
      
    { pattern: /^(can you|could you|would you).{0,20}(help|assist|explain|clarify)\b/i, 
      weight: 0.8, 
      reason: "Request for help or clarification" },
      
    { pattern: /^(i don't understand|can you clarify|what do you mean)\b/i, 
      weight: 0.85, 
      reason: "Clarification request" },
      
    { pattern: /^(sorry|excuse me|pardon)\b/i, 
      weight: 0.8, 
      reason: "Polite conversational marker" },
      
    { pattern: /^(yes|no|okay|ok|sure|alright)\s*\.?\s*$/i, 
      weight: 0.75, 
      reason: "Simple affirmation or response" },
      
    { pattern: /\b(please|can you).{0,30}(explain|clarify|help me understand)\b/i, 
      weight: 0.8, 
      reason: "Request for explanation" }
  ];
  
  // Check for conversational patterns
  for (const indicator of conversationalPatterns) {
    if (indicator.pattern.test(lowerMessage)) {
      return {
        category: "CONVERSATIONAL",
        confidence: indicator.weight,
        shouldUseJournal: false,
        reasoning: indicator.reason
      };
    }
  }
  
  // Step 2: Check for journal-specific indicators
  const journalSpecificIndicators = [
    // Personal trait/personality questions
    { pattern: /\bam i\b|\bdo i\b/i, 
      weight: 0.5, 
      reason: "Question about personal traits or preferences" },
      
    // Mental health related queries with personal context
    { pattern: /\bmy (mental health|wellbeing|wellness|anxiety|depression|stress)\b/i, 
      weight: 0.6, 
      reason: "Personal mental health question" },
    
    // Self-improvement questions
    { pattern: /\bhow (can|could|should) i\b|\bwhat should i do\b/i, 
      weight: 0.45, 
      reason: "Seeking personal advice or self-improvement" },
      
    // Emotion-related personal questions
    { pattern: /\bhow (do|did) i feel\b|\bmy emotions\b|\bi feel\b/i, 
      weight: 0.5, 
      reason: "Question about personal emotions" },
      
    // Pattern recognition in behavior
    { pattern: /\b(pattern|habit|routine|tendency|typically|usually|often)\b/i, 
      weight: 0.4, 
      reason: "Question about personal patterns or habits" },
      
    // First-person indicators with health/wellbeing terms
    { pattern: /\bi\b.{1,30}\b(anxiety|stress|depression|mood|emotion|mental)\b/i, 
      weight: 0.5, 
      reason: "Personal context with mental health terms" },
      
    // Explicit references to journal entries
    { pattern: /\b(journal|entry|entries|wrote|written|recorded)\b/i, 
      weight: 0.6, 
      reason: "Explicit reference to journal entries" },
      
    // Temporal questions about self
    { pattern: /\bhow (have|did) i\b.{1,20}\b(recently|lately|past|week|month|year)\b/i, 
      weight: 0.45, 
      reason: "Question about personal changes over time" },
      
    // Personality trait specific questions
    { pattern: /\b(intro|extro)vert\b/i,
      weight: 0.6,
      reason: "Question about introversion/extroversion personality traits" },
      
    // Social preference questions
    { pattern: /\bdo i (like|enjoy|prefer)\b.{0,15}\bpeople\b/i,
      weight: 0.6,
      reason: "Question about social preferences" },
      
    // Personality type questions
    { pattern: /\bwhat (type|kind) of person\b/i,
      weight: 0.55,
      reason: "Question about personality type" },
      
    // Character trait questions
    { pattern: /\bmy (personality|character|nature|temperament)\b/i,
      weight: 0.6,
      reason: "Question about personal character traits" }
  ];
  
  // Step 3: Check for general mental health indicators (without personal context)
  const mentalHealthIndicators = [
    { pattern: /\b(anxiety|depression|stress|mental health|wellbeing|wellness)\b/i,
      weight: 0.4,
      reason: "General mental health terminology" },
      
    { pattern: /\b(meditation|mindfulness|self[\s-]care|therapy|counseling)\b/i,
      weight: 0.4,
      reason: "Mental health practices and treatment" },
      
    { pattern: /\b(happiness|sadness|anger|emotion|mood|feeling)\b/i,
      weight: 0.3,
      reason: "Emotional terminology" },
      
    { pattern: /\b(coping|resilience|recovery|healing|growth)\b/i,
      weight: 0.4,
      reason: "Mental health recovery and growth terms" },
      
    { pattern: /\b(sleep|insomnia|burnout|overwhelm|worry)\b/i,
      weight: 0.35,
      reason: "Mental health symptoms and concerns" },
      
    { pattern: /\bwhat (are|is) (the )?(best|good|effective) (ways?|methods?|techniques?)\b/i,
      weight: 0.4,
      reason: "Request for mental health strategies" },
      
    { pattern: /\bhow (to|can|do).{0,30}(improve|increase|reduce|manage|cope with|deal with)\b/i,
      weight: 0.4,
      reason: "General improvement or management question" },
      
    { pattern: /\b(tips|advice|strategies|techniques) (for|to)\b/i,
      weight: 0.35,
      reason: "Request for general advice" }
  ];
  
  // Step 4: Check for non-mental health factual questions
  const factualIndicators = [
    { pattern: /\b(who is|what is|where is|when (was|is)|how many)\b/i,
      weight: 0.4,
      reason: "Factual question format" },
      
    { pattern: /\b(president|capital|population|history|geography|science|math|technology)\b/i,
      weight: 0.5,
      reason: "Academic or factual subject matter" },
      
    { pattern: /\b(weather|news|sports|politics|economics|business)\b/i,
      weight: 0.5,
      reason: "Current events or general knowledge" },
      
    { pattern: /\b(recipe|cooking|food|restaurant|movie|music|book)\b/i,
      weight: 0.4,
      reason: "Entertainment or lifestyle topics" },
      
    { pattern: /\b(define|definition|meaning|translate|convert)\b/i,
      weight: 0.5,
      reason: "Definition or translation request" }
  ];
  
  // Calculate scores for each category
  let journalScore = 0;
  let mentalHealthScore = 0;
  let factualScore = 0;
  
  const journalReasons = [];
  const mentalHealthReasons = [];
  const factualReasons = [];
  
  // Check journal-specific indicators
  for (const indicator of journalSpecificIndicators) {
    if (indicator.pattern.test(lowerMessage)) {
      journalScore += indicator.weight;
      journalReasons.push(indicator.reason);
    }
  }
  
  // Check general mental health indicators
  for (const indicator of mentalHealthIndicators) {
    if (indicator.pattern.test(lowerMessage)) {
      mentalHealthScore += indicator.weight;
      mentalHealthReasons.push(indicator.reason);
    }
  }
  
  // Check factual indicators
  for (const indicator of factualIndicators) {
    if (indicator.pattern.test(lowerMessage)) {
      factualScore += indicator.weight;
      factualReasons.push(indicator.reason);
    }
  }
  
  // Make final classification based on highest score
  if (journalScore > 0.4) {
    category = "JOURNAL_SPECIFIC";
    confidence = Math.min(0.95, 0.5 + journalScore);
    reasoning = journalReasons.slice(0, 3).join("; ");
  } else if (mentalHealthScore > 0.3 && factualScore < 0.3) {
    category = "GENERAL_MENTAL_HEALTH";
    confidence = Math.min(0.9, 0.6 + mentalHealthScore);
    reasoning = mentalHealthReasons.slice(0, 3).join("; ") || "General mental health topic without personal context";
  } else if (factualScore > 0.3) {
    category = "GENERAL_NO_RELATION";
    confidence = Math.min(0.9, 0.6 + factualScore);
    reasoning = factualReasons.slice(0, 3).join("; ") || "Factual question unrelated to mental health";
  } else {
    // Default case
    category = "GENERAL_NO_RELATION";
    confidence = 0.6;
    reasoning = "Query doesn't clearly fit mental health or personal insight categories";
  }
  
  // Ensure confidence is within bounds
  confidence = Math.max(0, Math.min(1, confidence));
  
  return {
    category,
    confidence,
    shouldUseJournal: category === "JOURNAL_SPECIFIC",
    reasoning
  };
}
