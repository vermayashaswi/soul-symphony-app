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
    
    // Generate dynamic messages for JOURNAL_SPECIFIC category, fallback for others
    if (category !== 'JOURNAL_SPECIFIC') {
      console.log(`[generate-streaming-messages] Category ${category} -> disabling dynamic messages, using three-dot UI`);
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

Generate exactly 5 different 5-word status messages that would be appropriate to show while processing this journal-specific query. These should be encouraging, relevant to journaling/mental health, and help the user understand what's happening.

Examples of good 5-word messages:
- "Analyzing your journal patterns..."
- "Finding relevant emotional insights..."
- "Processing your mental wellness..."
- "Reviewing your thought patterns..."
- "Searching through journal entries..."

Respond with ONLY a JSON array of 5 strings, nothing else:
["message1", "message2", "message3", "message4", "message5"]
`;

    console.log('[generate-streaming-messages] Calling OpenAI API');
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
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
      const raw = gptResponse || '';
      const arrayMatch = raw.match(/\[[\s\S]*\]/);
      const jsonText = arrayMatch ? arrayMatch[0] : raw;
      messages = JSON.parse(jsonText);
      if (!Array.isArray(messages) || messages.length !== 5 || messages.some(m => typeof m !== 'string')) {
        throw new Error('Invalid response format');
      }
    } catch (parseError) {
      console.error('[generate-streaming-messages] Failed to parse GPT response:', parseError);
      // Fallback messages (5 items)
      messages = [
        "Analyzing your journal patterns...",
        "Finding relevant emotional insights...",
        "Reviewing your thought patterns...",
        "Comparing themes across entries...",
        "Summarizing key emotional signals..."
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
      "Reviewing your thought patterns...",
      "Comparing themes across entries...",
      "Summarizing key emotional signals..."
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