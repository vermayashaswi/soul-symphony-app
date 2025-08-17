
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
  const message = body?.message;
  const conversationContext = Array.isArray(body?.conversationContext) ? body.conversationContext : [];

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

    console.log(`[Query Classifier] Result: ${classification.category}`);

    return new Response(
      JSON.stringify(classification),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Query Classifier] Error:', error);

    return new Response(
      JSON.stringify({ error: 'Classification failed', details: String((error).message || error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

/**
 * GPT-powered classification with conversational flow prioritization
 */
async function gptClassifyMessage(
  message, 
  conversationContext, 
  apiKey
) {
  
  // Let GPT decide everything - no hardcoded patterns

  const contextString = conversationContext.length > 0 
    ? `\nConversation context: ${conversationContext.slice(-6).map(msg => `${(msg.role || msg.sender || 'user')}: ${msg.content}`).join('\n')}`
    : '';

  const classificationPrompt = `You are a natural conversation classifier for a voice journaling app's chatbot called "Ruh". 

Your job is to classify user messages into the right category based on what they're actually asking for. Think naturally - not every message needs complex analysis.

Categories:
- JOURNAL_SPECIFIC: When users explicitly want analysis of their personal journal data. Examples: "analyze my mood this week", "what patterns do you see in my entries?", "how have I been feeling lately?"
- JOURNAL_SPECIFIC_NEEDS_CLARIFICATION: Personal but vague requests that need one clarifying question. Examples: "I'm sad", "help me", "how am I?"  
- GENERAL_MENTAL_HEALTH: Conversational messages, greetings, general advice requests, acknowledgments. Examples: "hey there", "thanks", "how to manage anxiety?", "what is meditation?"
- UNRELATED: Topics completely unrelated to mental health or wellbeing. Examples: "who is the president?", "quantum physics", "sports scores"

For the user message "${message}", consider the context naturally and classify appropriately.${contextString}

Output strictly a single JSON object:
{
  "category": "JOURNAL_SPECIFIC" | "JOURNAL_SPECIFIC_NEEDS_CLARIFICATION" | "GENERAL_MENTAL_HEALTH" | "UNRELATED"
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
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: 'You are a strict JSON classifier. Respond with a single JSON object only that matches the provided schema. No code fences, no commentary.' },
          { role: 'user', content: classificationPrompt }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 600
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
    const extractJsonObject = (text) => {
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
      category: result.category
    };

  } catch (error) {
    console.error('[Query Classifier] GPT classification failed:', error);
    throw error;
  }
}
