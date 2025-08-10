
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generating inspirational quotes using OpenAI API');
    
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY environment variable is not set');
      throw new Error('OpenAI API key is not configured');
    }
    
      const model = 'gpt-5-mini-2025-08-07';
      const tokensKey = model.includes('gpt-5') ? 'max_completion_tokens' : 'max_tokens';
      const payload: any = {
        model,
        messages: [
          { 
            role: 'system', 
            content: 'You are an assistant that provides inspirational quotes with their authors. Respond with a JSON array of 15 inspirational quotes about mental health, emotional well-being, mindfulness, and personal growth. Each item should have "quote" and "author" fields. Make sure quotes are short (under 30 words) and attributed to the correct person. Return only valid JSON with no markdown formatting.' 
          },
          { 
            role: 'user', 
            content: 'Generate 15 inspirational quotes with authors.' 
          }
        ],
        temperature: 0.7
      };
      (payload as any)[tokensKey] = 1500;
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Parse the JSON response from OpenAI, handling both direct JSON and markdown-wrapped JSON
    let quotes;
    try {
      // First try to parse it directly as JSON
      quotes = JSON.parse(content);
      console.log('Parsed quotes directly:', quotes);
    } catch (error) {
      console.error('Error directly parsing quotes, trying to extract JSON from markdown:', error);
      try {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                           content.match(/(\[[\s\S]*?\])/);
        
        if (jsonMatch && jsonMatch[1]) {
          quotes = JSON.parse(jsonMatch[1].trim());
          console.log('Extracted quotes from markdown:', quotes);
        } else {
          throw new Error('Could not find valid JSON in response');
        }
      } catch (extractError) {
        console.error('Failed to extract JSON from response:', extractError);
        throw new Error('Failed to parse quotes from OpenAI response');
      }
    }

    // Validate that quotes is an array
    if (!Array.isArray(quotes)) {
      console.error('Quotes is not an array:', quotes);
      throw new Error('OpenAI did not return a valid quotes array');
    }

    return new Response(JSON.stringify({ quotes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating quotes:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to generate quotes' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
