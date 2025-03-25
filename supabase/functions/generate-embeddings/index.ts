
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate embeddings using OpenAI
async function generateEmbedding(text: string) {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input for embedding generation');
    }
    
    console.log("Generating embedding for text:", text.substring(0, 100) + "...");
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding: ' + error);
    }

    const result = await response.json();
    if (!result.data || !result.data[0] || !result.data[0].embedding) {
      throw new Error('Invalid embedding result from OpenAI');
    }
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error in generateEmbedding:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    console.log("Request data:", JSON.stringify(requestData).substring(0, 200) + "...");
    
    const { entryId, text, isTestQuery, forceRegenerate } = requestData;
    
    // Special case for test queries - just return the embedding without storing
    if (isTestQuery === true && text) {
      console.log("Generating test embedding without storing");
      try {
        const embedding = await generateEmbedding(text);
        return new Response(
          JSON.stringify({ success: true, embedding: embedding }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error("Error generating test embedding:", error);
        throw new Error(`Test embedding generation failed: ${error.message}`);
      }
    }
    
    if (!entryId || !text) {
      throw new Error('Entry ID and text are required');
    }

    console.log(`Processing embedding generation for entry ID: ${entryId}`);
    
    // Check if embedding already exists for this entry
    if (forceRegenerate !== true) {
      const { count, error: checkError } = await supabase
        .from('journal_embeddings')
        .select('*', { count: 'exact', head: true })
        .eq('journal_entry_id', entryId);
        
      if (checkError) {
        console.error('Error checking existing embedding:', checkError);
        throw checkError;
      }
      
      if (count && count > 0) {
        console.log(`Embedding already exists for entry ${entryId}, skipping generation`);
        return new Response(
          JSON.stringify({ success: true, message: 'Embedding already exists' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (forceRegenerate === true) {
      // Delete any existing embedding if force regenerate is true
      console.log(`Force regenerating embedding for entry ${entryId}`);
      const { error: deleteError } = await supabase
        .from('journal_embeddings')
        .delete()
        .eq('journal_entry_id', entryId);
        
      if (deleteError) {
        console.error('Error deleting existing embedding:', deleteError);
        // Continue anyway to try generating a new one
      } else {
        console.log(`Deleted existing embedding for entry ${entryId} to regenerate`);
      }
    }
    
    // Generate embedding
    const embedding = await generateEmbedding(text);
    
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Failed to generate valid embedding');
    }
    
    // Store embedding in database
    const { error: insertError } = await supabase
      .from('journal_embeddings')
      .insert({
        journal_entry_id: entryId,
        embedding: embedding,
        content: text
      });
      
    if (insertError) {
      console.error('Error storing embedding:', insertError);
      throw insertError;
    }
    
    console.log(`Successfully generated and stored embedding for entry ${entryId}`);
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-embeddings function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
