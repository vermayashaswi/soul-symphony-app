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

1. **JOURNAL_SPECIFIC** - Specific, analyzable personal questions about their emotional patterns
   - "How am I feeling about work lately?", "What are my stress patterns this month?"
   - "Do you think meditation helped me?", "How have I been feeling the last few months?"
   - "No, since last 2 months I've been fighting a lot. I'm not sure if meditating helped me overcome this anger I get"
   - Clear, specific personal questions that can be effectively analyzed with journal data

2. **JOURNAL_SPECIFIC_NEEDS_CLARIFICATION** - Only truly vague personal questions needing follow-up
   - "How am I?", "I need help", "I feel lost", "What's wrong with me?"
   - Personal but extremely vague with no context to analyze
   - **IMPORTANT**: Be selective - if there's ANY specific context or detail, use JOURNAL_SPECIFIC instead

3. **GENERAL_MENTAL_HEALTH** - General wellness questions  
   - "How to manage anxiety?", "What are coping strategies?", "Tips for better sleep?"
   - Educational content, not personal analysis

4. **CONVERSATIONAL** - Natural chat flow
   - "Thanks!", "That's helpful", "Tell me more", "How are you?"
   - Keep the conversation flowing naturally

5. **UNRELATED** - Queries completely unrelated to journaling, mental health, or wellness
   - Technical questions, random topics, unrelated requests
   - When the query has nothing to do with the user's well-being or journal analysis
   - "What's the weather?", "How to cook pasta?", "Tell me about history"

**UPDATED CLASSIFICATION RULES - FAVOR JOURNAL_SPECIFIC:**
- Any personal question with specific context or details = JOURNAL_SPECIFIC (be generous here)
- Questions about personal feelings, behaviors, patterns = JOURNAL_SPECIFIC
- Only use JOURNAL_SPECIFIC_NEEDS_CLARIFICATION for extremely vague questions with zero context
- Educational/general questions = GENERAL_MENTAL_HEALTH
- Greetings/thanks/follow-ups = CONVERSATIONAL
- Completely unrelated topics = UNRELATED

**UPDATED EXAMPLES:**
- "How am I feeling about work?" → JOURNAL_SPECIFIC
- "How have I been feeling the last few months?" → JOURNAL_SPECIFIC
- "Do you think meditation helped me?" → JOURNAL_SPECIFIC
- "I fight with my partner" → JOURNAL_SPECIFIC
- "I've been fighting a lot lately" → JOURNAL_SPECIFIC
- "How am I?" (with no context) → JOURNAL_SPECIFIC_NEEDS_CLARIFICATION
- "I need help" (with no specifics) → JOURNAL_SPECIFIC_NEEDS_CLARIFICATION
- "What is anxiety?" → GENERAL_MENTAL_HEALTH
- "Thank you" → CONVERSATIONAL
- "Okay" → CONVERSATIONAL
- "What's the weather like?" → UNRELATED
- "How do I cook pasta?" → UNRELATED

User message: "${message}"${contextString}

Respond with ONLY this JSON:
{
  "category": "JOURNAL_SPECIFIC" | "JOURNAL_SPECIFIC_NEEDS_CLARIFICATION" | "GENERAL_MENTAL_HEALTH" | "CONVERSATIONAL",
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
    if (!result.category || !['JOURNAL_SPECIFIC', 'JOURNAL_SPECIFIC_NEEDS_CLARIFICATION', 'GENERAL_MENTAL_HEALTH', 'CONVERSATIONAL', 'UNRELATED'].includes(result.category)) {
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
  
  // Vague personal questions = JOURNAL_SPECIFIC_NEEDS_CLARIFICATION
  const vaguePersonalPatterns = [
    /^how am i\??$/i,
    /^i need help$/i,
    /^help me$/i,
    /^what's (going on|wrong) with me\??$/i,
    /^i feel lost$/i,
    /^i don't know$/i
  ];
  
  for (const pattern of vaguePersonalPatterns) {
    if (pattern.test(lowerMessage)) {
      console.log(`[Rule-Based] VAGUE PERSONAL QUESTION - Needs clarification`);
      return {
        category: "JOURNAL_SPECIFIC_NEEDS_CLARIFICATION",
        confidence: 0.9,
        shouldUseJournal: false,
        reasoning: "Vague personal question requiring clarification"
      };
    }
  }
  
  // Specific personal pronouns = JOURNAL_SPECIFIC
  const personalPatterns = [
    /\b(i|me|my|mine|myself)\b.*\b(work|stress|feel|emotion|mood|relationship)\b/i,
    /\bam i\b.*\b(good|bad|better|worse|okay)\b/i,
    /\bhow (am i|was i).*\b(lately|recently|today|this week|this month)\b/i,
    /\bwhat makes me\b/i,
    /\bwhen do i\b/i,
    /\bwhy do i\b/i
  ];
  
  for (const pattern of personalPatterns) {
    if (pattern.test(lowerMessage)) {
      const hasTemporalReference = /\b(last week|yesterday|this week|last month|today|recently|lately)\b/i.test(lowerMessage);
      const useAllEntries = !hasTemporalReference;
      
      console.log(`[Rule-Based] SPECIFIC PERSONAL - UseAllEntries: ${useAllEntries}`);
      
      return {
        category: "JOURNAL_SPECIFIC",
        confidence: 0.85,
        shouldUseJournal: true,
        useAllEntries: useAllEntries,
        reasoning: `Specific personal question - analyzing ${hasTemporalReference ? 'specific timeframe' : 'all entries'}`
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
  
  // Check for unrelated queries
  const unrelatedPatterns = [
    /\b(weather|temperature|forecast)\b/i,
    /\b(recipe|cook|cooking|food preparation)\b/i,
    /\b(history|geography|science|mathematics|physics)\b/i,
    /\b(sports|games|entertainment|movies|music)\b/i,
    /\b(technology|programming|computer|software)\b/i,
    /\b(news|politics|current events)\b/i
  ];
  
  for (const pattern of unrelatedPatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        category: "UNRELATED",
        confidence: 0.8,
        shouldUseJournal: false,
        reasoning: "Query unrelated to mental health, wellness, or journaling"
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