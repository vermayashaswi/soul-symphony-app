
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get OpenAI API key from environment variable
const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  // We'll continue and just log queries without embeddings if the key is missing
}

// Define CORS headers
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
    const { userId, messageId, threadId, queryText } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!queryText) {
      throw new Error('Query text is required');
    }

    console.log(`Ensuring chat persistence for user ${userId}`);
    
    // Generate embedding for the message if OpenAI API key is available
    let queryEmbedding = null;
    
    if (apiKey) {
      try {
        console.log("Generating embedding for query:", queryText.substring(0, 50) + "...");
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-ada-002',
            input: queryText,
          }),
        });

        if (!embeddingResponse.ok) {
          const error = await embeddingResponse.text();
          console.error('Failed to generate embedding:', error);
        } else {
          const embeddingData = await embeddingResponse.json();
          if (embeddingData.data && embeddingData.data.length > 0) {
            queryEmbedding = embeddingData.data[0].embedding;
            console.log("Embedding generated successfully");
          }
        }
      } catch (error) {
        console.error("Error generating embedding:", error);
        // Continue without embedding
      }
    } else {
      console.log("Skipping embedding generation - OPENAI_API_KEY not set");
    }
    
    // Insert the query into the user_queries table
    const { data, error } = await supabase
      .from('user_queries')
      .insert({
        user_id: userId,
        query_text: queryText,
        thread_id: threadId,
        message_id: messageId,
        embedding: queryEmbedding
      })
      .select()
      .single();
      
    if (error) {
      console.error("Error logging user query:", error);
      throw error;
    }
    
    console.log("User query logged successfully with ID:", data.id);

    return new Response(
      JSON.stringify({ success: true, queryId: data.id }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
