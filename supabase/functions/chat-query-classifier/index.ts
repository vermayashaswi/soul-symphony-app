import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function gptClassifyMessage(message: string, conversationContext: any[], apiKey: string) {
  console.log('[chat-query-classifier] Classifying message:', message.substring(0, 100));

  // Quick classification for simple acknowledgments
  const simpleResponses = ['thanks', 'thank you', 'ok', 'okay', 'yes', 'no', 'got it', 'understood'];
  if (simpleResponses.some(phrase => message.toLowerCase().trim() === phrase)) {
    return { category: 'GENERAL_MENTAL_HEALTH' };
  }

  const systemPrompt = `You are a message classifier for a mental health journaling app. Classify user messages into these categories:

JOURNAL_SPECIFIC: Questions about user's journal entries, patterns, emotions, themes, specific timeframes, or analysis requests
JOURNAL_SPECIFIC_NEEDS_CLARIFICATION: Vague journal questions that need more details (e.g., "tell me about my entries", "analyze my data")  
GENERAL_MENTAL_HEALTH: General wellbeing, mental health support, coping strategies, not requiring journal analysis
UNRELATED: Off-topic questions not related to mental health or journaling

Examples:
- "How was my mood last week?" → JOURNAL_SPECIFIC
- "What themes appear in my entries?" → JOURNAL_SPECIFIC  
- "Tell me about my journal" → JOURNAL_SPECIFIC_NEEDS_CLARIFICATION
- "I'm feeling anxious today" → GENERAL_MENTAL_HEALTH
- "What's the weather?" → UNRELATED

Context: ${conversationContext.length > 0 ? conversationContext.slice(-3).map(m => `${m.sender}: ${m.content}`).join('\n') : 'No previous context'}

Message: "${message}"

Respond with JSON: {"category": "CATEGORY_NAME"}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 50,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error('No classification content received from OpenAI');
    }

    const parsed = JSON.parse(content);
    const category = parsed.category;

    const validCategories = ['JOURNAL_SPECIFIC', 'JOURNAL_SPECIFIC_NEEDS_CLARIFICATION', 'GENERAL_MENTAL_HEALTH', 'UNRELATED'];
    if (!validCategories.includes(category)) {
      console.warn('[chat-query-classifier] Invalid category returned:', category);
      return { category: 'GENERAL_MENTAL_HEALTH' };
    }

    console.log('[chat-query-classifier] Classification result:', category);
    return { category };

  } catch (error) {
    console.error('[chat-query-classifier] Classification error:', error);
    return { category: 'GENERAL_MENTAL_HEALTH' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationContext = [] } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('[chat-query-classifier] OpenAI API key not found');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await gptClassifyMessage(message, conversationContext, openAIApiKey);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[chat-query-classifier] Server error:', error);
    return new Response(JSON.stringify({ 
      error: 'Classification failed',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});