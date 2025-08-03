
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * CONVERSATIONAL GPT-powered message classifier focusing on natural flow
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

    console.log(`[Query Classifier] Analyzing message: "${message}"`);

    // Get OpenAI API key
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      console.error('[Query Classifier] OpenAI API key not found, using rule-based classification');
      const fallbackResult = enhancedRuleBasedClassification(message);
      return new Response(
        JSON.stringify(fallbackResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use GPT for natural conversation flow classification
    const classification = await gptClassifyMessage(message, conversationContext, openAiApiKey);

    console.log(`[Query Classifier] Result: ${classification.category} (confidence: ${classification.confidence})`);

    return new Response(
      JSON.stringify(classification),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Query Classifier] Error:', error);
    
    // Fallback to rule-based classification
    try {
      const { message } = await req.json();
      const fallbackResult = enhancedRuleBasedClassification(message);
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
 * GPT-powered classification with conversational flow prioritization
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

  const classificationPrompt = `You're SOULo's conversation flow analyzer. Help me understand how to respond naturally to this user message.

**RESPONSE TYPES:**

1. **JOURNAL_SPECIFIC** - Personal questions about their own emotional patterns
   - "How am I doing?", "What makes me happy?", "When do I feel stressed?"
   - Contains personal pronouns ("I", "me", "my") seeking insights from their data
   - Use ALL entries unless specific time mentioned

2. **GENERAL_MENTAL_HEALTH** - General wellness questions  
   - "How to manage anxiety?", "What are coping strategies?", "Tips for better sleep?"
   - Educational content, not personal analysis

3. **CONVERSATIONAL** - Natural chat flow
   - "Thanks!", "That's helpful", "Tell me more", "How are you?"
   - Keep the conversation flowing naturally

**CRITICAL PRIORITY RULES:**
- **HIGHEST PRIORITY**: Any message containing personal pronouns ("I", "me", "my", "myself", "mine") MUST be classified as JOURNAL_SPECIFIC with confidence 0.9+
- Personal questions about self = JOURNAL_SPECIFIC (always high confidence)
- "How am I?" without time = useAllEntries: true  
- "How was I yesterday?" = useAllEntries: false
- Follow-ups and thanks = CONVERSATIONAL
- Educational "how to" questions = GENERAL_MENTAL_HEALTH

**EXAMPLES OF MANDATORY JOURNAL_SPECIFIC:**
- "Am I an introvert?" (contains "I")
- "What if you were to show my introversion" (contains "my") 
- "Do I like people?" (contains "I")
- "How have I been feeling?" (contains "I")

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
      reasoning: result.reasoning || 'GPT classification for conversational flow'
    };

  } catch (error) {
    console.error('[Query Classifier] GPT classification failed:', error);
    throw error;
  }
}

/**
 * Enhanced rule-based classification with conversational flow support
 */
function enhancedRuleBasedClassification(message: string): {
  category: string;
  confidence: number;
  shouldUseJournal: boolean;
  reasoning: string;
  useAllEntries?: boolean;
} {
  const lowerMessage = message.toLowerCase().trim();
  
  console.log(`[Rule-Based] Analyzing: "${message}"`);
  
  // Personal pronouns = JOURNAL_SPECIFIC
  const personalPatterns = [
    /\b(i|me|my|mine|myself)\b/i,
    /\bam i\b/i,
    /\bhow am i\b/i,
    /\bwhat makes me\b/i,
    /\bhow was i\b/i,
    /\bwhen do i\b/i,
    /\bwhy do i\b/i
  ];
  
  for (const pattern of personalPatterns) {
    if (pattern.test(lowerMessage)) {
      const hasTemporalReference = /\b(last week|yesterday|this week|last month|today|recently|lately)\b/i.test(lowerMessage);
      const useAllEntries = !hasTemporalReference;
      
      console.log(`[Rule-Based] PERSONAL PRONOUNS - UseAllEntries: ${useAllEntries}`);
      
      return {
        category: "JOURNAL_SPECIFIC",
        confidence: 0.95,
        shouldUseJournal: true,
        useAllEntries: useAllEntries,
        reasoning: `Personal question - analyzing ${hasTemporalReference ? 'specific timeframe' : 'all entries'}`
      };
    }
  }
  
  // Conversational patterns
  const conversationalPatterns = [
    /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i,
    /^(thank you|thanks|thank u|thx)\b/i,
    /^(how are you|how do you)\b/i,
    /^(what (are|is) you|who are you)\b/i,
    /^(yes|no|okay|ok|sure|ya)\s*\.?\s*$/i,
    /^(that's|thats) (helpful|interesting|good|great)/i,
    /^(tell me more|more about|can you explain)/i
  ];
  
  for (const pattern of conversationalPatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        category: "CONVERSATIONAL",
        confidence: 0.9,
        shouldUseJournal: false,
        reasoning: "Conversational response for natural flow"
      };
    }
  }
  
  // General mental health patterns
  const mentalHealthPatterns = [
    /\b(anxiety|depression|stress|mental health|wellbeing)\b/i,
    /\b(meditation|mindfulness|self[\s-]care|therapy)\b/i,
    /\bwhat (are|is) (the )?(best|good|effective) (ways?|methods?|techniques?)\b/i,
    /\bhow (to|can|do).{0,30}(improve|manage|cope with|deal with)\b/i
  ];
  
  for (const pattern of mentalHealthPatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        category: "GENERAL_MENTAL_HEALTH",
        confidence: 0.7,
        shouldUseJournal: false,
        reasoning: "General mental health question"
      };
    }
  }
  
  console.log(`[Rule-Based] No clear patterns found, defaulting to CONVERSATIONAL`);
  
  return {
    category: "CONVERSATIONAL",
    confidence: 0.6,
    shouldUseJournal: false,
    reasoning: "Unclear intent - maintaining conversational flow"
  };
}
