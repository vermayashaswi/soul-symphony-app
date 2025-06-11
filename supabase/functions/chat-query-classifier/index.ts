
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * ENHANCED GPT-powered message classifier with PRIORITY personal pronoun detection
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationContext = [] } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[Query Classifier] ENHANCED classification with PRIORITY personal pronoun detection: "${message}"`);

    // Get OpenAI API key
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      console.error('[Query Classifier] OpenAI API key not found, falling back to enhanced rule-based classification');
      const fallbackResult = enhancedRuleBased_classifyMessage(message);
      return new Response(
        JSON.stringify(fallbackResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use GPT for classification with ENHANCED personal pronoun handling
    const classification = await gptClassifyMessage(message, conversationContext, openAiApiKey);

    console.log(`[Query Classifier] Result: ${classification.category} (confidence: ${classification.confidence}) - UseAllEntries: ${classification.useAllEntries}`);

    return new Response(
      JSON.stringify(classification),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Query Classifier] Error:', error);
    
    // Fallback to enhanced rule-based classification on error
    try {
      const { message } = await req.json();
      const fallbackResult = enhancedRuleBased_classifyMessage(message);
      return new Response(
        JSON.stringify({ ...fallbackResult, fallbackUsed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fallbackError) {
      return new Response(
        JSON.stringify({ error: 'Classification failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  }
});

/**
 * ENHANCED GPT-powered classification with HIGHEST PRIORITY personal pronoun detection
 */
async function gptClassifyMessage(
  message: string, 
  conversationContext: any[], 
  apiKey: string
): Promise<{
  category: string;
  confidence: number;
  shouldUseJournal: boolean;
  reasoning: string;
  useAllEntries?: boolean;
}> {
  
  const contextString = conversationContext.length > 0 
    ? `\nConversation context: ${conversationContext.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
    : '';

  const classificationPrompt = `You are a friendly query classifier for SOULo, a personal voice journaling app that helps users understand their emotional patterns through conversational AI.

**CLASSIFICATION RULES:**

1. **JOURNAL_SPECIFIC** - Questions about the user's personal patterns, emotions, or experiences
   - PRIORITY TRIGGERS: Personal pronouns ("I", "me", "my", "how am I", "what makes me", etc.)
   - Time-based personal questions: "How was I last week?", "What made me happy recently?"
   - Pattern questions: "When do I feel...", "What triggers my..."
   - useAllEntries = true UNLESS explicit time mentioned ("last week", "yesterday", etc.)

2. **GENERAL_MENTAL_HEALTH** - Educational questions about mental health topics
   - "What is anxiety?", "How to manage stress?", "Signs of depression"
   - General advice without personal context

3. **CONVERSATIONAL** - Greetings, thanks, clarifications
   - "Hello", "Thank you", "How are you?", "What can you do?"

**CRITICAL LOGIC:**
- Personal pronouns = JOURNAL_SPECIFIC with confidence 0.9+
- "How am I?" without time = useAllEntries: true (analyze everything)
- "How was I yesterday?" = useAllEntries: false (respect time constraint)

User message: "${message}"${contextString}

Respond with ONLY this JSON:
{
  "category": "JOURNAL_SPECIFIC" | "GENERAL_MENTAL_HEALTH" | "CONVERSATIONAL",
  "confidence": 0.0-1.0,
  "shouldUseJournal": boolean,
  "useAllEntries": boolean,
  "reasoning": "Brief explanation"
}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: classificationPrompt }],
        temperature: 0.1,
        max_tokens: 300,
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    console.log(`[Query Classifier] GPT Response: ${content}`);

    // Parse the JSON response
    const result = JSON.parse(content);
    
    // Validate the response
    if (!result.category || !['JOURNAL_SPECIFIC', 'GENERAL_MENTAL_HEALTH', 'CONVERSATIONAL'].includes(result.category)) {
      throw new Error('Invalid category in GPT response');
    }

    return {
      category: result.category,
      confidence: Math.max(0, Math.min(1, result.confidence || 0.8)),
      shouldUseJournal: result.category === 'JOURNAL_SPECIFIC',
      useAllEntries: result.useAllEntries || false,
      reasoning: result.reasoning || 'GPT classification with enhanced personal pronoun prioritization'
    };

  } catch (error) {
    console.error('[Query Classifier] GPT classification failed:', error);
    throw error;
  }
}

/**
 * ENHANCED rule-based classification with PRIORITIZED personal pronoun detection
 */
function enhancedRuleBased_classifyMessage(message: string): {
  category: string;
  confidence: number;
  shouldUseJournal: boolean;
  reasoning: string;
  useAllEntries?: boolean;
} {
  const lowerMessage = message.toLowerCase().trim();
  
  console.log(`[Rule-Based] Analyzing message: "${message}"`);
  
  // PRIORITY 1: Check for personal pronouns - ABSOLUTE HIGHEST PRIORITY
  const personalPronounPatterns = [
    /\b(i|me|my|mine|myself)\b/i,
    /\bam i\b/i,
    /\bdo i\b/i,
    /\bhow am i\b/i,
    /\bhow do i\b/i,
    /\bwhat makes me\b/i,
    /\bhow was i\b/i,
    /\bwhat do i\b/i,
    /\bwhere do i\b/i,
    /\bwhen do i\b/i,
    /\bwhy do i\b/i,
    /\bwhat about me\b/i,
    /\bam i getting\b/i,
    /\bwhat can i\b/i,
    /\bwhat should i\b/i
  ];
  
  for (const pattern of personalPronounPatterns) {
    if (pattern.test(lowerMessage)) {
      // Check if there's an explicit temporal reference
      const hasTemporalReference = /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night)\b/i.test(lowerMessage);
      
      const useAllEntries = !hasTemporalReference;
      
      console.log(`[Rule-Based] PERSONAL PRONOUNS DETECTED - Pattern: ${pattern}, Time ref: ${hasTemporalReference}, UseAllEntries: ${useAllEntries}`);
      
      return {
        category: "JOURNAL_SPECIFIC",
        confidence: 0.95,
        shouldUseJournal: true,
        useAllEntries: useAllEntries,
        reasoning: `PERSONAL PRONOUNS DETECTED - automatically classified as journal-specific. ${hasTemporalReference ? 'Time constraint detected - will respect date range.' : 'No time constraint - will analyze ALL entries for comprehensive personal insights.'}`
      };
    }
  }
  
  // Enhanced conversational patterns (including typos/abbreviations)
  const conversationalPatterns = [
    /^(hi|hello|hey|good morning|good afternoon|good evening|hii|helo)\b/i,
    /^(thank you|thanks|thank u|thx|ty)\b/i,
    /^(how are you|how do you|how r u|how r you)\b/i,
    /^(what (are|is) you|who are you|tell me about yourself|wat r u)\b/i,
    /^(can you|could you|would you|can u).{0,20}(help|assist|explain|clarify)\b/i,
    /^(yes|no|okay|ok|sure|alright|ya|nah)\s*\.?\s*$/i
  ];
  
  for (const pattern of conversationalPatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        category: "CONVERSATIONAL",
        confidence: 0.9,
        shouldUseJournal: false,
        reasoning: "Conversational greeting or response (including common abbreviations/typos)"
      };
    }
  }
  
  // Enhanced journal-specific indicators (with typo tolerance)
  const journalSpecificIndicators = [
    // Temporal patterns with personal context
    /\bhow (was|am|did) i\b.{0,15}\b(last week|yesterday|today|this week|recently|lately)\b/i,
    /\b(last week|yesterday|recently|lately|this week|last month)\b.{0,20}\bhow (was|am|did) i\b/i,
    
    // Personal trait/identity questions without pronouns
    /\bmy (mental health|wellbeing|anxiety|depression|stress|personality|emotions)\b/i,
    /\b(intro|extro)vert\b/i,
    /\bwhat (type|kind) of person\b/i,
    /\bmy (personality|character|nature|patterns|habits)\b/i,
    
    // Temporal references (even without complete sentences)
    /\b(last week|yesterday|recently|lately|this week|last month)\b/i,
    
    // Questions with typos/missing words (but no personal pronouns)
    /\bwat (makes|helps)\b/i, // "wat makes" without "me"
    /\bhow r\b/i, // "how r" abbreviations
  ];
  
  for (const pattern of journalSpecificIndicators) {
    if (pattern.test(lowerMessage)) {
      const hasTemporal = /\b(last week|yesterday|recently|lately|this week|last month)\b/i.test(lowerMessage);
      
      return {
        category: "JOURNAL_SPECIFIC",
        confidence: 0.8,
        shouldUseJournal: true,
        useAllEntries: !hasTemporal,
        reasoning: "Contains journal-related context or temporal references (with typo tolerance)"
      };
    }
  }
  
  // General mental health patterns (without personal context)
  const mentalHealthPatterns = [
    /\b(anxiety|depression|stress|mental health|wellbeing|wellness)\b/i,
    /\b(meditation|mindfulness|self[\s-]care|therapy|counseling)\b/i,
    /\bwhat (are|is) (the )?(best|good|effective) (ways?|methods?|techniques?)\b/i,
    /\bhow (to|can|do).{0,30}(improve|increase|reduce|manage|cope with|deal with)\b/i
  ];
  
  for (const pattern of mentalHealthPatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        category: "GENERAL_MENTAL_HEALTH",
        confidence: 0.7,
        shouldUseJournal: false,
        reasoning: "General mental health question without personal context"
      };
    }
  }
  
  console.log(`[Rule-Based] No clear patterns found, defaulting to CONVERSATIONAL`);
  
  return {
    category: "CONVERSATIONAL",
    confidence: 0.6,
    shouldUseJournal: false,
    reasoning: "No clear indicators for journal-specific or mental health categories"
  };
}
