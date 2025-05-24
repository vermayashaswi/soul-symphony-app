
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * GPT-powered message classifier with enhanced personal pronoun detection and intent understanding
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

    // Use GPT for classification with enhanced personal pronoun handling
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
 * Enhanced GPT-powered classification with personal pronoun priority and intent understanding
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

  const classificationPrompt = `You are an advanced query classifier for SOULo, a voice journaling app that helps users analyze their personal journal entries for emotional insights and patterns.

Your task is to classify user messages into one of three categories, with CRITICAL PRIORITY for personal pronoun detection:

**CRITICAL RULE - PERSONAL PRONOUN OVERRIDE:**
If the message contains ANY personal pronouns (I, me, my, mine, myself, we, us, our, ours), it MUST be classified as JOURNAL_SPECIFIC and should analyze ALL ENTRIES unless there's an explicit time constraint (like "yesterday", "last week").

**JOURNAL_SPECIFIC**: Questions that require analysis of the user's personal journal entries
- AUTOMATIC TRIGGERS: Any use of "I", "me", "my", "mine", "myself", "we", "us", "our", "ours"
- Examples: "How was I doing last week?", "What are my top emotions?", "Am I an introvert?", "Do I like people?", "How should I improve my sleep?", "What makes me happy?", "How can I deal with my anxiety?", "What are my patterns?", "How have I been feeling recently?", "What did I write about yesterday?"
- Key indicators: Personal pronouns (HIGHEST PRIORITY), temporal references, personality questions, personal advice requests, emotion analysis requests
- TIME RANGE RULE: Use ALL ENTRIES unless explicit temporal words like "yesterday", "last week", "this month" are present

**GENERAL_MENTAL_HEALTH**: General mental health information requests without personal context
- Examples: "What is anxiety?", "How to meditate?", "What are signs of depression?", "Best practices for mental health", "What is mindfulness?"
- Key indicators: General educational questions, NO personal pronouns, requesting general information, hypothetical scenarios
- Must NOT contain personal pronouns

**CONVERSATIONAL**: Greetings, thanks, clarifications, or general chat
- Examples: "Hello", "Thank you", "How are you?", "Who are you?", "Can you help me?", "What can you do?"
- Key indicators: Greetings, gratitude expressions, assistant capability questions, social pleasantries
- Must NOT contain personal pronouns or specific requests

**ENHANCED CLASSIFICATION LOGIC:**
1. FIRST: Check for personal pronouns - if found, classify as JOURNAL_SPECIFIC
2. SECOND: Check for temporal constraints - if personal pronouns + temporal words, use specified time range
3. THIRD: If no personal pronouns, check for general mental health vs conversational patterns
4. FOURTH: When in doubt between categories, lean toward JOURNAL_SPECIFIC if there's ANY personal context

**TYPO AND INTENT UNDERSTANDING:**
- ASSUME MISSING WORDS: "How was I last week?" = "How was I [doing] last week?" → JOURNAL_SPECIFIC
- IGNORE TYPOS: "wat makes me sad", "how r u", "wat did i write" → focus on intent
- INCOMPLETE PERSONAL QUESTIONS: "Am I...", "Do I...", "How was I..." → JOURNAL_SPECIFIC
- TEMPORAL + PERSONAL = JOURNAL_SPECIFIC with time constraint
- PERSONAL ONLY = JOURNAL_SPECIFIC with ALL ENTRIES

**EXAMPLES WITH REASONING:**
- "How am I doing?" → JOURNAL_SPECIFIC (personal pronoun "I"), ALL ENTRIES, confidence: 0.95
- "What makes me happy?" → JOURNAL_SPECIFIC (personal pronoun "me"), ALL ENTRIES, confidence: 0.95  
- "How was I last week?" → JOURNAL_SPECIFIC (personal pronoun "I" + temporal "last week"), time-constrained, confidence: 0.95
- "What is depression?" → GENERAL_MENTAL_HEALTH (no personal pronouns), confidence: 0.9
- "Hello" → CONVERSATIONAL (greeting), confidence: 0.95

User message: "${message}"${contextString}

Respond with ONLY a JSON object in this exact format:
{
  "category": "JOURNAL_SPECIFIC" | "GENERAL_MENTAL_HEALTH" | "CONVERSATIONAL",
  "confidence": 0.0-1.0,
  "shouldUseJournal": boolean,
  "useAllEntries": boolean,
  "reasoning": "Brief explanation focusing on personal pronoun detection, temporal constraints, and classification rationale"
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
      reasoning: result.reasoning || 'GPT classification with enhanced personal pronoun detection',
      useAllEntries: result.useAllEntries || false
    };

  } catch (error) {
    console.error('[Query Classifier] GPT classification failed:', error);
    throw error;
  }
}

/**
 * Enhanced rule-based classification with personal pronoun priority
 */
function enhancedRuleBased_classifyMessage(message: string): {
  category: string;
  confidence: number;
  shouldUseJournal: boolean;
  reasoning: string;
  useAllEntries?: boolean;
} {
  const lowerMessage = message.toLowerCase().trim();
  
  // PRIORITY CHECK: Personal pronouns - highest priority classification
  const personalPronouns = /\b(i|me|my|mine|myself|we|us|our|ours)\b/i;
  const hasPersonalPronouns = personalPronouns.test(lowerMessage);
  
  // Check for temporal constraints when personal pronouns are present
  const temporalWords = /\b(yesterday|today|last week|this week|last month|this month|recently|lately)\b/i;
  const hasTemporalConstraints = temporalWords.test(lowerMessage);
  
  if (hasPersonalPronouns) {
    return {
      category: "JOURNAL_SPECIFIC",
      confidence: 0.95,
      shouldUseJournal: true,
      useAllEntries: !hasTemporalConstraints, // Use ALL entries unless temporal constraints present
      reasoning: `Contains personal pronouns (${hasPersonalPronouns ? 'detected' : 'not detected'}), temporal constraints: ${hasTemporalConstraints ? 'yes' : 'no'} - classified as JOURNAL_SPECIFIC with ${hasTemporalConstraints ? 'time-based' : 'ALL entries'} scope`
    };
  }
  
  // Enhanced conversational patterns (no personal pronouns)
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
        useAllEntries: false,
        reasoning: "Conversational greeting or response (no personal pronouns detected)"
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
        useAllEntries: false,
        reasoning: "General mental health question without personal pronouns"
      };
    }
  }
  
  return {
    category: "CONVERSATIONAL",
    confidence: 0.6,
    shouldUseJournal: false,
    useAllEntries: false,
    reasoning: "No clear indicators for journal-specific or mental health categories, no personal pronouns detected"
  };
}
