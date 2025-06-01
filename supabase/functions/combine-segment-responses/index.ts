
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
    const { originalQuery, segmentResults, userId } = await req.json();
    
    if (!originalQuery || !segmentResults || !Array.isArray(segmentResults)) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Format segment results for GPT prompt
    const formattedSegments = segmentResults.map((result, index) => {
      return `Segment ${index + 1}: "${result.segment}"\nAnswer: ${result.response}`;
    }).join("\n\n");
    
    // Use GPT to create a final comprehensive answer
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
            content: `You are an AI assistant that combines answers to segmented parts of a complex query into a comprehensive final response.
                      Based on the answers to individual segments, create a unified response that addresses the original question fully.
                      Please be concise in your answers. Prefer bulleted points where needed.` 
          },
          {
            role: 'user',
            content: `Original query: "${originalQuery}"

Answers to segmented parts:
${formattedSegments}

Please combine these answers into a comprehensive response that addresses the original query. 
Be concise and use bullet points where appropriate. Focus on providing clear, actionable information.`
          }
        ],
        temperature: 0.3
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const result = await response.json();
    const combinedResponse = result.choices[0].message.content;
    
    return new Response(
      JSON.stringify({ response: combinedResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in combine-segment-responses function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
