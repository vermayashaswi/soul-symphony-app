import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StreamingMessageRequest {
  userMessage: string;
  category: string;
  conversationContext?: any[];
  userProfile?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[generate-streaming-messages] Function started');
    
    // Parse request body
    const body: StreamingMessageRequest = await req.json();
    const { userMessage, category, conversationContext = [], userProfile = {} } = body;
    
    console.log(`[generate-streaming-messages] Processing message for category: ${category}`);
    
    // Only generate dynamic messages for JOURNAL_SPECIFIC category
    if (category !== 'JOURNAL_SPECIFIC') {
      console.log(`[generate-streaming-messages] Category ${category} does not require dynamic messages`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          messages: [], 
          shouldUseFallback: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not found');
    }

    // Generate 5-word streaming messages using GPT
    const prompt = `
You are helping generate short, 5-word status messages for a voice journaling app's chat interface.

User's message: "${userMessage}"
User profile: ${JSON.stringify(userProfile)}
Recent conversation: ${JSON.stringify(conversationContext.slice(-3))}

Generate exactly 3 different 5-word status messages that would be appropriate to show while processing this journal-specific query. These should be encouraging, relevant to journaling/mental health, and help the user understand what's happening.

Examples of good 5-word messages:
- "Analyzing your journal patterns..."
- "Finding relevant emotional insights..."
- "Processing your mental wellness..."
- "Reviewing your thought patterns..."
- "Searching through journal entries..."

Respond with ONLY a JSON array of 3 strings, nothing else:
["message1", "message2", "message3"]
`;

    console.log('[generate-streaming-messages] Calling OpenAI API');
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates concise 5-word status messages for a mental health journaling app.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const gptResponse = openaiData.choices[0]?.message?.content?.trim();
    
    console.log(`[generate-streaming-messages] GPT response: ${gptResponse}`);

    // Parse GPT response
    let messages: string[] = [];
    try {
      messages = JSON.parse(gptResponse);
      if (!Array.isArray(messages) || messages.length !== 3) {
        throw new Error('Invalid response format');
      }
    } catch (parseError) {
      console.error('[generate-streaming-messages] Failed to parse GPT response:', parseError);
      // Fallback messages
      messages = [
        "Analyzing your journal patterns...",
        "Finding relevant emotional insights...",
        "Processing your mental wellness..."
      ];
    }

    console.log(`[generate-streaming-messages] Generated messages:`, messages);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messages,
        shouldUseFallback: false 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-streaming-messages] Error:', error);
    const messages = [
      "Analyzing your journal patterns...",
      "Finding relevant emotional insights...",
      "Processing your mental wellness..."
    ];
    return new Response(
      JSON.stringify({ 
        success: true, 
        messages,
        shouldUseFallback: true,
        error: (error as any)?.message || String(error)
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});