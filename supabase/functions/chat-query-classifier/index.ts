
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * GPT-powered message classifier with enhanced typo handling and intent understanding
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

    console.log(`[Query Classifier] Classifying message: "${message}"`);

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

    // Use GPT for classification with enhanced typo handling
    const classification = await gptClassifyMessage(message, conversationContext, openAiApiKey);

    console.log(`[Query Classifier] Result: ${classification.category} (confidence: ${classification.confidence})`);

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
 * Enhanced GPT-powered classification with typo handling and intent understanding
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
}> {
  
  const contextString = conversationContext.length > 0 
    ? `\nConversation context: ${conversationContext.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
    : '';

  const classificationPrompt = `You are an advanced query classifier for SOULo, a voice journaling app that helps users analyze their personal journal entries for emotional insights and patterns.

Your task is to classify user messages into one of three categories, with special attention to typos, incomplete sentences, and user intent:

**JOURNAL_SPECIFIC**: Questions that require analysis of the user's personal journal entries
- Examples: "How was I doing last week?", "How was I last week?" (missing 'doing'), "What are my top emotions?", "Am I an introvert?", "Do I like people?", "How should I improve my sleep?", "What makes me happy?", "How can I deal with my anxiety?", "What are my patterns?", "How have I been feeling recently?", "What did I write about yesterday?", "how was i yesterday" (typo/no caps), "wat makes me sad" (typo)
- Key indicators: Personal pronouns (I, me, my), temporal references (last week, yesterday, recently), personality questions, personal advice requests, emotion analysis requests, incomplete sentences with clear personal intent

**GENERAL_MENTAL_HEALTH**: General mental health information requests without personal context
- Examples: "What is anxiety?", "How to meditate?", "What are signs of depression?", "Best practices for mental health", "What is mindfulness?", "how do you deal with stress" (general advice)
- Key indicators: General educational questions, no personal pronouns, requesting general information, hypothetical scenarios

**CONVERSATIONAL**: Greetings, thanks, clarifications, or general chat
- Examples: "Hello", "Thank you", "How are you?", "Who are you?", "Can you help me?", "What can you do?", "hi there", "thx" (abbreviated thanks), "wat r u" (typo/shorthand)
- Key indicators: Greetings, gratitude expressions, assistant capability questions, social pleasantries

CRITICAL RULES FOR TYPO AND INTENT UNDERSTANDING:
1. ASSUME MISSING WORDS: "How was I last week?" should be interpreted as "How was I [doing] last week?" - JOURNAL_SPECIFIC
2. IGNORE TYPOS AND ABBREVIATIONS: "wat makes me sad", "how r u", "wat did i write" - focus on the intent
3. TEMPORAL REFERENCES ARE STRONG SIGNALS: Any mention of time periods (last week, yesterday, today, recently, etc.) combined with personal pronouns strongly indicates JOURNAL_SPECIFIC
4. INCOMPLETE PERSONAL QUESTIONS: "Am I...", "Do I...", "How was I..." even if incomplete - JOURNAL_SPECIFIC
5. When in doubt between JOURNAL_SPECIFIC and GENERAL_MENTAL_HEALTH, choose JOURNAL_SPECIFIC if there are ANY personal indicators
6. Context matters: Use conversation history to understand abbreviated or unclear messages

INTENT INTERPRETATION EXAMPLES:
- "How was I last week?" → Intent: "How was I doing last week?" → JOURNAL_SPECIFIC
- "wat emotions do i have" → Intent: "What emotions do I have?" → JOURNAL_SPECIFIC  
- "how 2 deal with anxiety" → Intent: "How to deal with anxiety?" → Could be GENERAL_MENTAL_HEALTH (general advice) or JOURNAL_SPECIFIC (personal advice) - lean JOURNAL_SPECIFIC if personal context
- "am i happy person" → Intent: "Am I a happy person?" → JOURNAL_SPECIFIC
- "thx for help" → Intent: "Thanks for help" → CONVERSATIONAL

User message: "${message}"${contextString}

Respond with ONLY a JSON object in this exact format:
{
  "category": "JOURNAL_SPECIFIC" | "GENERAL_MENTAL_HEALTH" | "CONVERSATIONAL",
  "confidence": 0.0-1.0,
  "shouldUseJournal": boolean,
  "reasoning": "Brief explanation of interpretation and why this category was chosen, mention any typos or missing words inferred"
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
        max_tokens: 250,
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
      reasoning: result.reasoning || 'GPT classification with typo handling'
    };

  } catch (error) {
    console.error('[Query Classifier] GPT classification failed:', error);
    throw error;
  }
}

/**
 * Enhanced rule-based classification with better typo and temporal pattern handling
 */
function enhancedRuleBased_classifyMessage(message: string): {
  category: string;
  confidence: number;
  shouldUseJournal: boolean;
  reasoning: string;
} {
  const lowerMessage = message.toLowerCase().trim();
  
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
  
  // Enhanced journal-specific indicators (with typo tolerance and intent inference)
  const journalSpecificIndicators = [
    // Temporal patterns with personal context - STRONGEST indicators
    /\bhow (was|am|did) i\b.{0,15}\b(last week|yesterday|today|this week|recently|lately)\b/i,
    /\bhow (was|am) i\b.{0,5}(last|this|yesterday)/i, // "How was I last week" (missing 'doing')
    /\b(last week|yesterday|recently|lately|this week|last month)\b.{0,20}\bhow (was|am|did) i\b/i,
    
    // Personal trait/identity questions
    /\bam i\b|\bdo i\b/i,
    /\bmy (mental health|wellbeing|anxiety|depression|stress|personality|emotions)\b/i,
    /\bhow (can|could|should) i\b|\bwhat should i do\b|\bhow do i\b/i,
    /\bhow (do|did) i feel\b|\bmy emotions\b|\bi feel\b/i,
    /\b(intro|extro)vert\b/i,
    /\bwhat (type|kind) of person\b/i,
    /\bmy (personality|character|nature|patterns|habits)\b/i,
    
    // Temporal references (even without complete sentences)
    /\b(last week|yesterday|recently|lately|this week|last month)\b/i,
    
    // Personal questions with typos/missing words
    /\bwat (makes|helps) me\b/i, // "wat makes me happy" (typo)
    /\bhow r my\b/i, // "how r my emotions" (abbreviation)
    /\bdo i like\b/i, // "do i like people"
  ];
  
  for (const pattern of journalSpecificIndicators) {
    if (pattern.test(lowerMessage)) {
      // Higher confidence for temporal + personal combinations
      const hasTemporal = /\b(last week|yesterday|recently|lately|this week|last month)\b/i.test(lowerMessage);
      const hasPersonal = /\b(i|me|my|myself)\b/i.test(lowerMessage);
      const confidence = (hasTemporal && hasPersonal) ? 0.95 : 0.8;
      
      return {
        category: "JOURNAL_SPECIFIC",
        confidence,
        shouldUseJournal: true,
        reasoning: "Contains personal context, temporal references, or personal trait questions (with typo tolerance)"
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
      // Check if it has personal context - if so, it should be journal specific
      const hasPersonalContext = /\b(i|me|my|myself)\b/i.test(lowerMessage);
      if (hasPersonalContext) {
        return {
          category: "JOURNAL_SPECIFIC",
          confidence: 0.85,
          shouldUseJournal: true,
          reasoning: "Mental health topic with personal context"
        };
      }
      
      return {
        category: "GENERAL_MENTAL_HEALTH",
        confidence: 0.7,
        shouldUseJournal: false,
        reasoning: "General mental health question without personal context"
      };
    }
  }
  
  return {
    category: "GENERAL_NO_RELATION",
    confidence: 0.6,
    shouldUseJournal: false,
    reasoning: "No clear indicators for journal-specific or mental health categories"
  };
}
