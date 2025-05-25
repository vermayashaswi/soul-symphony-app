import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`[General Mental Health] Processing: "${message}" with ${conversationContext.length} context messages`);

    // Build messages array with conversation context
    const messages = [
      {
        role: 'system',
        content: `You are a mental health assistant for SOULo, a voice journaling app. Provide helpful, supportive general mental health guidance.

Guidelines:
- Be empathetic and supportive
- Provide evidence-based mental health information
- Suggest practical coping strategies
- Encourage professional help when appropriate
- Keep responses concise and actionable
- For personalized insights, suggest the user ask about their journal entries specifically

If the question is about the user's personal patterns or experiences, gently suggest they ask something like "How am I doing?" to get personalized insights from their journal entries.`
      }
    ];

    // Add conversation context (last 5 messages to keep context manageable)
    if (conversationContext.length > 0) {
      messages.push(...conversationContext.slice(-5));
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[General Mental Health] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const responseContent = data.choices[0]?.message?.content || 'I apologize, but I was unable to generate a helpful response. Please try rephrasing your question.';

    console.log(`[General Mental Health] Generated response with conversation context`);

    return new Response(
      JSON.stringify({ response: responseContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[General Mental Health] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate response' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
