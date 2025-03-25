
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.22.0";
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";
import { createJournalEmbeddingsTable } from "../_shared/sql-helpers.ts";

// Setup CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";

    if (!supabaseUrl || !supabaseServiceRole || !openaiKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    // Get the request body
    const { text, journalEntryId } = await req.json();

    if (!text || !journalEntryId) {
      throw new Error("Missing required fields: text and journalEntryId");
    }

    console.log(`Creating embedding for journal entry ${journalEntryId}`);
    console.log(`Text length: ${text.length} characters`);

    // Initialize OpenAI
    const configuration = new Configuration({ apiKey: openaiKey });
    const openai = new OpenAIApi(configuration);

    // First, make sure the journal_embeddings table exists
    try {
      const { error: tableError } = await supabase.query(createJournalEmbeddingsTable);
      
      if (tableError) {
        console.error("Error creating table:", tableError);
        // Continue anyway as the table might already exist
      } else {
        console.log("Journal embeddings table created or already exists");
      }
    } catch (tableErr) {
      console.error("Error running table creation SQL:", tableErr);
      // Continue anyway as the table might already exist
    }

    // Check if an embedding already exists for this journal entry
    const { data: existingEmbeddings, error: checkError } = await supabase
      .from('journal_embeddings')
      .select('id')
      .eq('journal_entry_id', journalEntryId)
      .limit(1);

    if (checkError) {
      console.error("Error checking for existing embeddings:", checkError);
    } else if (existingEmbeddings && existingEmbeddings.length > 0) {
      console.log(`Embedding already exists for journal entry ${journalEntryId}. Deleting it first.`);
      
      // Delete existing embedding
      const { error: deleteError } = await supabase
        .from('journal_embeddings')
        .delete()
        .eq('journal_entry_id', journalEntryId);
        
      if (deleteError) {
        console.error("Error deleting existing embedding:", deleteError);
      }
    }

    // Generate embedding with OpenAI
    const embeddingResponse = await openai.createEmbedding({
      model: "text-embedding-ada-002",
      input: text.trim(),
    });

    const [{ embedding }] = embeddingResponse.data.data;

    // Store the embedding in the database
    const { data, error } = await supabase
      .from('journal_embeddings')
      .insert({
        journal_entry_id: journalEntryId,
        embedding,
        content: text
      })
      .select();

    if (error) {
      console.error("Error storing embedding:", error);
      throw new Error(`Failed to store embedding: ${error.message}`);
    }

    console.log(`Successfully stored embedding for journal entry ${journalEntryId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Embedding created successfully", 
        embeddingId: data?.[0]?.id
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error in create-embedding function:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
