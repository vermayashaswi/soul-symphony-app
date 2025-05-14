
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { OpenAIEmbeddings } from 'https://esm.sh/langchain/embeddings/openai';
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9.0.0';

// Get environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || '';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize OpenAI embeddings
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: openaiApiKey,
  modelName: "text-embedding-3-small"
});

// Set up CORS headers
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
    const { userId, queryText, threadId, messageId, timezoneOffset } = await req.json();
    
    if (!userId || !queryText) {
      throw new Error('userId and queryText are required');
    }

    console.log(`Ensuring persistence for query: "${queryText.substring(0, 30)}..." by user: ${userId}`);
    
    // Generate an embedding for the query
    let queryEmbedding;
    try {
      const embeddingArray = await embeddings.embedQuery(queryText);
      queryEmbedding = embeddingArray;
      console.log('Generated embedding for query');
    } catch (embeddingError) {
      console.error('Error generating embedding:', embeddingError);
      // Continue without embedding if it fails
    }
    
    // Store the query in the database
    const queryId = uuidv4();
    const now = new Date();
    const { error: insertError } = await supabase
      .from('user_queries')
      .insert({
        id: queryId,
        user_id: userId,
        query_text: queryText,
        embedding: queryEmbedding,
        thread_id: threadId || null,
        message_id: messageId || null,
        created_at: now.toISOString(),
        user_timezone_offset: timezoneOffset || null
      });
      
    if (insertError) {
      console.error('Error storing query:', insertError);
      throw new Error(`Failed to store query: ${insertError.message}`);
    }
    
    // Check thread_id and update thread's updated_at timestamp
    if (threadId) {
      const { error: updateError } = await supabase
        .from('chat_threads')
        .update({ updated_at: now.toISOString() })
        .eq('id', threadId);
        
      if (updateError) {
        console.error('Error updating thread timestamp:', updateError);
        // Non-critical error, continue execution
      }
    }
    
    return new Response(
      JSON.stringify({ success: true, id: queryId }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error in ensure-chat-persistence function:', error);
    
    // Use toast for UI error display if imported
    try {
      if (typeof toast !== 'undefined') {
        toast({ 
          title: "Error", 
          description: "Failed to save query data. Some features may be limited." 
        });
      }
    } catch (e) {
      // Ignore toast errors
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
});
