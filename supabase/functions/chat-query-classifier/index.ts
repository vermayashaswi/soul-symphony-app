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
  
  const contextString = conversationContext.length > 0 
    ? `\nConversation context: ${conversationContext.slice(-6).map(msg => `${(msg.role || msg.sender || 'user')}: ${msg.content}`).join('\n')}`
    : '';

  const classificationPrompt = `You are the conversation router and intent classifier for "Ruh by SOuLO" — a brilliantly witty, warm, non-judgmental mental health companion. Your job is to decide how the chat should proceed so the user experiences a fluid, 1-1 conversation with a wise, funny friend.\n\nUse the conversation history to understand what the user wants next and classify the latest user message. Be decisive and consistent.\n\nCategories:\n- JOURNAL_SPECIFIC: The user talks about their own feelings, patterns, triggers, behaviors, relationships, or wants insights about "me/my". Choose this when there is at least one analyzable detail (timeframe, trigger/event, behavior, symptom, metric, or explicit question).\n- JOURNAL_SPECIFIC_NEEDS_CLARIFICATION: The user is talking about themself but it's too vague to analyze (e.g., "I'm sad", "idk", "help"). Choose this when a single short clarifying question would unlock the next step.\n- GENERAL_MENTAL_HEALTH: General mental health info/skills/resources or light conversational turns not requiring personal analysis (greetings, thanks, small talk, meta questions about Ruh).\n- UNRELATED: Not about mental health/wellbeing/journaling; or purely factual/utility requests outside scope.\n\nDecisions:\n- useAllEntries:\n  - true when the personal request is holistic and no explicit timeframe is mentioned ("overall", "in general", "what do my entries say about me?").\n  - false when any timeframe is present or implied ("today", "yesterday", "last week", "this month", "last month", "recently").\n- timeScopeHint: one of "all" | "recent" | "last_week" | "this_month" | "last_month" | null.\n  - choose "recent" if the wording implies near-term without a clear window ("lately", "recently", "these days").\n  - choose "last_week" or "this_month" / "last_month" if clearly stated.\n  - null for GENERAL_MENTAL_HEALTH or UNRELATED.\n- recommendedPipeline:\n  - "rag_full" for JOURNAL_SPECIFIC with analyzable detail.\n  - "clarification" for JOURNAL_SPECIFIC_NEEDS_CLARIFICATION.\n  - "general" for GENERAL_MENTAL_HEALTH or UNRELATED.\n- clarifyingQuestion: Provide a single, friendly, specific question ONLY when category is JOURNAL_SPECIFIC_NEEDS_CLARIFICATION; otherwise null.\n- journalHintStrength: "high" for strong first-person self-reflection; "medium" when personal but less focused; "low" otherwise.\n\nOutput strictly as a single JSON object matching this schema (no code fences, no commentary):\n{\n  "category": "JOURNAL_SPECIFIC" | "JOURNAL_SPECIFIC_NEEDS_CLARIFICATION" | "GENERAL_MENTAL_HEALTH" | "UNRELATED",\n  "confidence": number,\n  "useAllEntries": boolean,\n  "reasoning": string,\n  "recommendedPipeline": "general" | "clarification" | "rag_full",\n  "clarifyingQuestion": string | null,\n  "journalHintStrength": "low" | "medium" | "high",\n  "timeScopeHint": "all" | "recent" | "last_week" | "this_month" | "last_month" | null\n}\n\nLatest user message: "${message}"${contextString}`;

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