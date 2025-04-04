
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, userId } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'No query provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use GPT to break down the complex query into logical segments
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `You are an AI assistant that breaks down complex user queries into logical segments 
                      that can be processed separately and then combined for a final answer. 
                      Focus on segmenting queries that contain multiple questions, prioritization requests, 
                      or complex analysis needs. For each segment, maintain the original intent and ensure
                      it can stand alone as a coherent question. Return only the segments, no other text.` 
          },
          {
            role: 'user',
            content: `Break down this query into logical segments that can be processed separately: "${query}"
                      Return ONLY the segments as a JSON array of strings, no explanation, just the segments.
                      For example: ["What are my negative traits?", "What should I work on in order of intensity?"]`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const result = await response.json();
    let segments = [];
    
    try {
      const content = JSON.parse(result.choices[0].message.content);
      if (content && Array.isArray(content.segments)) {
        segments = content.segments;
      } else {
        // Fallback if the format isn't as expected
        segments = [query];
      }
    } catch (parseError) {
      console.error("Error parsing GPT response:", parseError);
      segments = [query];
    }
    
    return new Response(
      JSON.stringify({ segments }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in segment-complex-query function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
