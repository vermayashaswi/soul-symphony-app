import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateClarificationPrompt(message: string, conversationContext: any[], userProfile: any, apiKey: string) {
  console.log('[gpt-clarification-generator] Generating clarification for:', message.substring(0, 100));

  const systemPrompt = `You are a helpful assistant for a mental health journaling app. When users ask vague questions about their journal entries that need clarification, generate a friendly and specific clarifying question.

Common vague requests that need clarification:
- "Tell me about my journal entries"
- "Analyze my data" 
- "What can you tell me about my writing?"
- "Give me insights"
- "Tell me about my mood"

Your clarifying questions should:
1. Be warm and supportive
2. Offer specific options or timeframes
3. Help guide the user to ask more specific questions
4. Show understanding of what they might want to know

Context: ${conversationContext.length > 0 ? conversationContext.slice(-2).map(m => `${m.sender}: ${m.content}`).join('\n') : 'No previous context'}

User message: "${message}"

Generate a helpful clarifying question that guides them to be more specific about what they want to explore in their journal entries.`;

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
        max_tokens: 150,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const clarificationPrompt = data.choices?.[0]?.message?.content?.trim();
    
    if (!clarificationPrompt) {
      throw new Error('No clarification content received from OpenAI');
    }

    console.log('[gpt-clarification-generator] Generated clarification');
    return { clarificationPrompt };

  } catch (error) {
    console.error('[gpt-clarification-generator] Error generating clarification:', error);
    
    // Fallback clarification prompts
    const fallbacks = [
      "I'd love to help you explore your journal entries! Could you tell me more about what specific aspect you'd like to analyze? For example, are you interested in your mood patterns, recurring themes, or entries from a particular time period?",
      "That's a great question! To give you the most helpful insights, could you be more specific? Are you looking for patterns in your emotions, analysis of recent entries, or something else particular about your journaling?",
      "I'm here to help analyze your journal entries! What specifically would you like to explore? Your emotional patterns over time, themes in recent entries, or insights about a particular topic you've been writing about?"
    ];
    
    return { 
      clarificationPrompt: fallbacks[Math.floor(Math.random() * fallbacks.length)]
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationContext = [], userProfile = {} } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('[gpt-clarification-generator] OpenAI API key not found');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await generateClarificationPrompt(message, conversationContext, userProfile, openAIApiKey);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[gpt-clarification-generator] Server error:', error);
    return new Response(JSON.stringify({ 
      error: 'Clarification generation failed',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});