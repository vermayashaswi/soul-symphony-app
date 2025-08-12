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
      console.error('[Query Classifier] OPENAI_API_KEY missing - cannot classify via GPT');
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured for chat-query-classifier' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
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

    return new Response(
      JSON.stringify({ error: 'Classification failed', details: String((error as any)?.message || error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
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
  
  // Short-circuit acknowledgements to avoid unnecessary analysis
  const trimmed = (message || '').trim();
  const ackRegex = /^(ok(?:ay)?|k|kk|thanks|thank you|thx|cool|got it|sounds good|roger|understood|yep|yup|sure|👌|👍)[.!]?$/i;
  if (ackRegex.test(trimmed)) {
    return {
      category: 'GENERAL_MENTAL_HEALTH',
      confidence: 0.99,
      reasoning: 'Acknowledgment/closure detected; no analysis requested.',
      useAllEntries: false,
      recommendedPipeline: 'general',
      clarifyingQuestion: null,
      journalHintStrength: 'low',
      timeScopeHint: null
    };
  }

  const contextString = conversationContext.length > 0 
    ? `\nConversation context: ${conversationContext.slice(-6).map(msg => `${(msg.role || msg.sender || 'user')}: ${msg.content}`).join('\n')}`
    : '';

  const classificationPrompt = `You are the intent router for "Ruh by SOuLO". Use the conversation context to classify the latest user message and return ONE JSON object that exactly matches the schema. Be decisive and consistent.

Categories (choose exactly one):
- JOURNAL_SPECIFIC: First-person, analyzable questions about the user's own patterns/feelings/behaviors. Examples: "How have I felt this month?", "Did meditation help me?", "What are my stress patterns lately?".
- JOURNAL_SPECIFIC_NEEDS_CLARIFICATION: Personal but too vague to analyze. Examples: "I'm sad", "Help", "How am I?". A single short follow-up question would unlock analysis.
- GENERAL_MENTAL_HEALTH: General advice/skills/resources not about their own data. Examples: "How to manage anxiety?", "Tips for sleep".
- UNRELATED: Small talk or off-topic. Examples: "Thanks", "Tell me more", "How are you?".

Decisions:
- useAllEntries: true if holistic with no explicit timeframe words ("overall", "in general", "what do my entries say about me?"); otherwise false when any timeframe appears or is implied ("today", "yesterday", "last week", "this month", "last month", "recently", "lately").
- timeScopeHint: one of "all" | "recent" | "last_week" | "this_month" | "last_month" | null.
  - "recent" for vague near-term ("recently", "lately", "these days").
  - pick the exact window when stated; null for GENERAL_MENTAL_HEALTH or UNRELATED.
- recommendedPipeline: "rag_full" for JOURNAL_SPECIFIC; "clarification" for JOURNAL_SPECIFIC_NEEDS_CLARIFICATION; "general" for GENERAL_MENTAL_HEALTH or UNRELATED.
- clarifyingQuestion: Only for JOURNAL_SPECIFIC_NEEDS_CLARIFICATION; else null. Keep it one short, specific question.
- journalHintStrength: "high" for clear first-person self-reflection; "medium" for personal but lighter focus; "low" otherwise.

Output strictly a single JSON object (no code fences, no extra text) with this schema:
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

Latest user message: "${message}"${contextString}`;

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
        model: 'gpt-4.1-mini-2025-04-14',
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
    const content = data?.choices?.[0]?.message?.content?.trim() || '';

    if (!content) {
      throw new Error('Empty OpenAI response');
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

// Rule-based classification removed — GPT-only per requirements.