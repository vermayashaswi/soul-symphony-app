
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { cors } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';

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
    const { text } = await req.json();
    
    if (!text) {
      return cors(req, new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      ));
    }

    if (!openAIApiKey) {
      return cors(req, new Response(
        JSON.stringify({ error: 'OpenAI API key is not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      ));
    }

    console.log(`Generating embedding for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      
      return cors(req, new Response(
        JSON.stringify({ error: `OpenAI API error: ${errorData}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      ));
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;

    console.log(`Successfully generated embedding with ${embedding.length} dimensions`);

    return cors(req, new Response(
      JSON.stringify({ embedding }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
  } catch (error) {
    console.error('Error in create-embedding function:', error);
    
    return cors(req, new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    ));
  }
});
