
// Import necessary Deno modules
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Get environment variables
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client with admin privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Set up CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate embeddings using OpenAI API
async function generateEmbedding(text: string) {
  try {
    console.log("Generating embedding for text:", text.substring(0, 100) + "...");
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text.trim(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`Failed to generate embedding: ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.data || !result.data[0] || !result.data[0].embedding) {
      throw new Error("Invalid response from OpenAI embeddings API");
    }
    
    console.log(`Successfully generated ${result.data[0].embedding.length}-dimension embedding vector`);
    return result.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

// Main handler function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the request body
    let requestData;
    try {
      requestData = await req.json();
      console.log("Request data received:", JSON.stringify(requestData).substring(0, 500) + "...");
    } catch (parseError) {
      console.error("Error parsing request JSON:", parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Invalid JSON in request body" 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const { entryId, text, forceRegenerate, isTestQuery } = requestData;
    
    // If this is just a test query to generate an embedding without storing it
    if (isTestQuery && text) {
      console.log("Processing test query embedding");
      const embedding = await generateEmbedding(text);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Test embedding generated successfully",
          embedding
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate required parameters
    if (!text || text.trim().length === 0) {
      throw new Error("Text is required and must not be empty");
    }
    
    if (!entryId && !isTestQuery) {
      throw new Error("Entry ID is required");
    }
    
    // Parse entry ID to ensure it's a number
    const numericEntryId = typeof entryId === 'number' ? entryId : 
                          typeof entryId === 'string' ? parseInt(entryId, 10) : null;
                          
    if (!numericEntryId && !isTestQuery) {
      throw new Error(`Invalid entry ID: ${entryId}. Must be a valid number.`);
    }
    
    // If force regenerate is requested, delete existing embedding first
    if (forceRegenerate && numericEntryId) {
      console.log(`Force regenerate requested for entry ${numericEntryId}, deleting existing embedding`);
      const { error: deleteError } = await supabase
        .from('journal_embeddings')
        .delete()
        .eq('journal_entry_id', numericEntryId);
        
      if (deleteError) {
        console.log(`No existing embedding found to delete for entry ${numericEntryId}`);
      } else {
        console.log(`Successfully deleted existing embedding for entry ${numericEntryId}`);
      }
    } else if (!isTestQuery) {
      // Check if embedding already exists for this entry
      const { data: existingEmbedding, error: checkError } = await supabase
        .from('journal_embeddings')
        .select('id')
        .eq('journal_entry_id', numericEntryId)
        .maybeSingle();
        
      if (!checkError && existingEmbedding) {
        console.log(`Embedding already exists for entry ${numericEntryId}, skipping generation`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Embedding already exists for this entry", 
            embedding_id: existingEmbedding.id 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Generate the embedding
    console.log(`Generating embedding for entry ${numericEntryId || 'test query'}`);
    const embedding = await generateEmbedding(text);
    
    // For test queries, we're done here
    if (isTestQuery) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Test embedding generated successfully",
          embedding
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Store the embedding in the database
    const { data: insertedEmbedding, error: insertError } = await supabase
      .from('journal_embeddings')
      .insert({
        journal_entry_id: numericEntryId,
        embedding: embedding,
        content: text.trim()
      })
      .select('id')
      .single();
      
    if (insertError) {
      console.error(`Error storing embedding for entry ${numericEntryId}:`, insertError);
      throw new Error(`Failed to store embedding: ${insertError.message}`);
    }
    
    console.log(`Successfully stored embedding for entry ${numericEntryId} with ID ${insertedEmbedding.id}`);
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Embedding generated and stored successfully", 
        embedding_id: insertedEmbedding.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Log and return error response
    console.error("Error in generate-embeddings function:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || "An unknown error occurred" 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
