
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * GPT-powered message classifier with enhanced contextual understanding
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
      console.error('[Query Classifier] OpenAI API key not found, falling back to rule-based classification');
      const fallbackResult = ruleBased_classifyMessage(message);
      return new Response(
        JSON.stringify(fallbackResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use GPT for classification
    const classification = await gptClassifyMessage(message, conversationContext, openAiApiKey);

    console.log(`[Query Classifier] Result: ${classification.category} (confidence: ${classification.confidence})`);

    return new Response(
      JSON.stringify(classification),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Query Classifier] Error:', error);
    
    // Fallback to rule-based classification on error
    try {
      const { message } = await req.json();
      const fallbackResult = ruleBased_classifyMessage(message);
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
 * GPT-powered classification with detailed prompt
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
    ? `\nConversation context: ${conversationContext.slice(-2).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
    : '';

  const classificationPrompt = `You are a query classifier for SOULo, a voice journaling app that helps users analyze their personal journal entries for emotional insights and patterns.

Your task is to classify user messages into one of three categories:

**JOURNAL_SPECIFIC**: Questions that require analysis of the user's personal journal entries
- Examples: "How was I doing last week?", "What are my top emotions?", "Am I an introvert?", "Do I like people?", "How should I improve my sleep?", "What makes me happy?", "How can I deal with my anxiety?", "What are my patterns?", "How have I been feeling recently?", "What did I write about yesterday?"
- Key indicators: Personal pronouns (I, me, my), temporal references (last week, yesterday, recently), personality questions, personal advice requests, emotion analysis requests

**GENERAL_MENTAL_HEALTH**: General mental health information requests without personal context
- Examples: "What is anxiety?", "How to meditate?", "What are signs of depression?", "Best practices for mental health", "What is mindfulness?"
- Key indicators: General educational questions, no personal pronouns, requesting general information

**CONVERSATIONAL**: Greetings, thanks, clarifications, or general chat
- Examples: "Hello", "Thank you", "How are you?", "Who are you?", "Can you help me?", "What can you do?"
- Key indicators: Greetings, gratitude expressions, assistant capability questions

CRITICAL RULES:
1. ANY question with temporal references (last week, yesterday, today, recently, etc.) should be JOURNAL_SPECIFIC
2. Questions starting with "How was I...", "Am I...", "Do I...", "What makes me..." are JOURNAL_SPECIFIC
3. Personal advice requests ("How should I...", "What should I do...") are JOURNAL_SPECIFIC
4. Personality or trait questions are JOURNAL_SPECIFIC
5. When in doubt between JOURNAL_SPECIFIC and GENERAL_MENTAL_HEALTH, choose JOURNAL_SPECIFIC

User message: "${message}"${contextString}

Respond with ONLY a JSON object in this exact format:
{
  "category": "JOURNAL_SPECIFIC" | "GENERAL_MENTAL_HEALTH" | "CONVERSATIONAL",
  "confidence": 0.0-1.0,
  "shouldUseJournal": boolean,
  "reasoning": "Brief explanation of why this category was chosen"
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
        max_tokens: 200,
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
      reasoning: result.reasoning || 'GPT classification'
    };

  } catch (error) {
    console.error('[Query Classifier] GPT classification failed:', error);
    throw error;
  }
}

/**
 * Fallback rule-based classification (simplified version of the original)
 */
function ruleBased_classifyMessage(message: string): {
  category: string;
  confidence: number;
  shouldUseJournal: boolean;
  reasoning: string;
} {
  const lowerMessage = message.toLowerCase().trim();
  
  // Conversational patterns
  const conversationalPatterns = [
    /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i,
    /^(thank you|thanks|thank u)\b/i,
    /^(how are you|how do you)\b/i,
    /^(what (are|is) you|who are you|tell me about yourself)\b/i,
    /^(can you|could you|would you).{0,20}(help|assist|explain|clarify)\b/i,
    /^(yes|no|okay|ok|sure|alright)\s*\.?\s*$/i
  ];
  
  for (const pattern of conversationalPatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        category: "CONVERSATIONAL",
        confidence: 0.9,
        shouldUseJournal: false,
        reasoning: "Conversational greeting or response"
      };
    }
  }
  
  // Journal-specific indicators
  const journalSpecificIndicators = [
    /\bam i\b|\bdo i\b/i,
    /\bmy (mental health|wellbeing|anxiety|depression|stress)\b/i,
    /\bhow (can|could|should) i\b|\bwhat should i do\b/i,
    /\bhow (do|did) i feel\b|\bmy emotions\b|\bi feel\b/i,
    /\b(last week|yesterday|recently|lately|this week|last month)\b/i,
    /\b(intro|extro)vert\b/i,
    /\bwhat (type|kind) of person\b/i,
    /\bmy (personality|character|nature)\b/i
  ];
  
  for (const pattern of journalSpecificIndicators) {
    if (pattern.test(lowerMessage)) {
      return {
        category: "JOURNAL_SPECIFIC",
        confidence: 0.8,
        shouldUseJournal: true,
        reasoning: "Contains personal context or temporal references"
      };
    }
  }
  
  // General mental health patterns
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
  
  return {
    category: "GENERAL_NO_RELATION",
    confidence: 0.6,
    shouldUseJournal: false,
    reasoning: "No clear indicators for other categories"
  };
}
