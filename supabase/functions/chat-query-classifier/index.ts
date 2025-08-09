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

  // Parse body once to avoid re-reading on fallback
  const body = await req.json().catch(() => null);
  const message: string | undefined = body?.message;
  const conversationContext: any[] = Array.isArray(body?.conversationContext) ? body.conversationContext : [];

  if (!message) {
    return new Response(
      JSON.stringify({ error: 'Message is required' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  try {
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

    // Fallback to rule-based classification WITHOUT re-reading the body
    const fallbackResult = enhancedRuleBasedClassification(message);
    return new Response(
      JSON.stringify({ ...fallbackResult, fallbackUsed: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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
  reasoning: string;
  useAllEntries?: boolean;
  recommendedPipeline?: 'general' | 'clarification' | 'rag_full';
  clarifyingQuestion?: string | null;
  journalHintStrength?: 'low' | 'medium' | 'high';
  timeScopeHint?: 'all' | 'recent' | 'last_week' | 'this_month' | 'last_month' | null;
}> {
  
  const contextString = conversationContext.length > 0 
    ? `\nConversation context: ${conversationContext.slice(-6).map(msg => `${(msg.role || msg.sender || 'user')}: ${msg.content}`).join('\n')}`
    : '';

  const classificationPrompt = `You are SOULo's chat query classifier. Classify the user's latest message while maintaining smooth 1-1 conversational flow.

Categories:
- JOURNAL_SPECIFIC: Personal, analyzable questions about the user's feelings/behaviors/patterns. Be generous—any concrete personal detail counts.
- JOURNAL_SPECIFIC_NEEDS_CLARIFICATION: Personal but too vague to analyze; ask one targeted follow-up.
- GENERAL_MENTAL_HEALTH: General education/tips/resources, greetings/acknowledgements, small talk.
- UNRELATED: Outside mental health/wellbeing/journaling.

Core rules:
1) Prefer JOURNAL_SPECIFIC for first-person queries about the user's own state/patterns, even if slightly vague but with any specific detail.
2) Use JOURNAL_SPECIFIC_NEEDS_CLARIFICATION only for extremely vague personal prompts with zero analyzable detail.
3) useAllEntries = true if personal question has no explicit timeframe; if timeframe is mentioned/implied (last week, this month, last month, recent), set useAllEntries=false and set timeScopeHint accordingly.
4) journalHintStrength: "high" for strong first-person self-reflection; "medium" for somewhat personal; "low" otherwise.

Return ONLY valid JSON matching this schema (no code fences):
{
  "category": "JOURNAL_SPECIFIC" | "JOURNAL_SPECIFIC_NEEDS_CLARIFICATION" | "GENERAL_MENTAL_HEALTH" | "UNRELATED",
  "confidence": number,
  "useAllEntries": boolean,
  "reasoning": string,
  "recommendedPipeline": "general" | "clarification" | "rag_full",
  "clarifyingQuestion": string | null,
  "journalHintStrength": "low" | "medium" | "high",
  "timeScopeHint": "all" | "recent" | "last_week" | "this_month" | "last_month" | null
}

User message: "${message}"${contextString}`;

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
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: 'You are a strict JSON classifier. Respond with a single JSON object only that matches the provided schema. No code fences, no commentary.' },
          { role: 'user', content: classificationPrompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 600
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? '';


    if (!content || !content.trim()) {
      throw new Error('No content in OpenAI response');
    }

    console.log(`[Query Classifier] GPT Response: ${content}`);

    // Helper to extract JSON from possible fenced or prefixed content
    const extractJsonObject = (text: string): string => {
      // ```json ... ```
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) return fenceMatch[1].trim();
      // First { ... last }
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1).trim();
      return text.trim();
    };

    // Parse the JSON response safely
    const jsonString = extractJsonObject(content);
    const result = JSON.parse(jsonString);
    
    // Validate the response
    if (!result.category || !['JOURNAL_SPECIFIC', 'JOURNAL_SPECIFIC_NEEDS_CLARIFICATION', 'GENERAL_MENTAL_HEALTH', 'UNRELATED'].includes(result.category)) {
      throw new Error('Invalid category in GPT response');
    }

    console.log(`[Query Classifier] Meta: pipeline=${result.recommendedPipeline || 'n/a'}, timeScope=${result.timeScopeHint || 'n/a'}`);

    return {
      category: result.category,
      confidence: Math.max(0, Math.min(1, result.confidence ?? 0.85)),
      useAllEntries: !!result.useAllEntries,
      reasoning: result.reasoning || 'GPT classification for conversational flow',
      recommendedPipeline: result.recommendedPipeline,
      clarifyingQuestion: result.clarifyingQuestion ?? null,
      journalHintStrength: result.journalHintStrength,
      timeScopeHint: result.timeScopeHint ?? null
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
        reasoning: "Vague personal question requiring clarification"
      };
    }
  }
  
  // Strong personal + timeframe detection
  const hasMy = /\bmy\b/i.test(lowerMessage);
  const hasTemporalReference = /\b(last week|last month|this week|this month|today|yesterday|recently|lately)\b/i.test(lowerMessage);
  if (hasMy && hasTemporalReference) {
    console.log(`[Rule-Based] PERSONAL + TIMEFRAME detected`);
      return {
        category: "JOURNAL_SPECIFIC",
        confidence: 0.9,
        useAllEntries: false,
        reasoning: "Personal pronoun with explicit timeframe"
      };
  }
  
  // Specific personal pronouns = JOURNAL_SPECIFIC
  const personalPatterns = [
    /\b(i|me|my|mine|myself)\b.*\b(work|stress|feel|feeling|feelings|emotion|emotions|mood|moods|relationship|journal|entries|pattern|patterns?|theme|themes?)\b/i,
    /\bam i\b.*\b(good|bad|better|worse|okay)\b/i,
    /\bhow (am i|was i).*\b(lately|recently|today|this week|this month)\b/i,
    /\bwhat makes me\b/i,
    /\bwhen do i\b/i,
    /\bwhy do i\b/i,
    /\bmy\s+(top|common|most|biggest)\s+(emotions?|moods?|themes?)\b/i
  ];
  
  for (const pattern of personalPatterns) {
    if (pattern.test(lowerMessage)) {
      const useAllEntries = !hasTemporalReference;
      
      console.log(`[Rule-Based] SPECIFIC PERSONAL - UseAllEntries: ${useAllEntries}`);
      
      return {
        category: "JOURNAL_SPECIFIC",
        confidence: 0.85,
        useAllEntries: useAllEntries,
        reasoning: `Specific personal question - analyzing ${hasTemporalReference ? 'specific timeframe' : 'all entries'}`
      };
    }
  }
  
  // Conversational patterns - now classified as GENERAL_MENTAL_HEALTH
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
        category: "GENERAL_MENTAL_HEALTH",
        confidence: 0.9,
        reasoning: "Conversational response - handled as general mental health interaction"
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
        reasoning: "Query unrelated to mental health, wellness, or journaling"
      };
    }
  }
  
  console.log(`[Rule-Based] No clear patterns found, defaulting to GENERAL_MENTAL_HEALTH`);
  
  return {
    category: "GENERAL_MENTAL_HEALTH",
    confidence: 0.6,
    reasoning: "Unclear intent - treating as general mental health interaction"
  };
}