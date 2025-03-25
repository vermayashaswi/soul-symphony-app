
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.22.0";
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";
import { createJournalEmbeddingsTable } from "../_shared/sql-helpers.ts";

// Set up CORS headers
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
    const { userId, processAll = false } = await req.json();

    if (!userId) {
      throw new Error("Missing required field: userId");
    }

    console.log(`Processing journal entries for user ${userId}`);
    console.log(`Process all entries: ${processAll ? "Yes" : "No"}`);

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

    // Fetch journal entries that need embeddings
    console.log("Fetching entries that need processing...");
    let query = supabase
      .from("Journal Entries")
      .select("id, refined text, transcription text")
      .eq("user_id", userId);

    // If not processing all entries, only get ones without embeddings
    if (!processAll) {
      console.log("Filtering for entries without embeddings");
      query = query.not('id', 'in', 
        supabase.from('journal_embeddings').select('journal_entry_id')
      );
    }

    const { data: entries, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching journal entries:", fetchError);
      throw new Error(`Failed to fetch entries: ${fetchError.message}`);
    }

    if (!entries || entries.length === 0) {
      console.log("No entries to process");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No entries to process",
          processedCount: 0
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      );
    }

    console.log(`Found ${entries.length} entries to process`);

    // Initialize OpenAI
    const configuration = new Configuration({ apiKey: openaiKey });
    const openai = new OpenAIApi(configuration);

    // Process each entry
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const entry of entries) {
      try {
        const text = entry["refined text"] || entry["transcription text"];
        
        if (!text || text.trim() === "") {
          console.log(`Skipping entry ${entry.id} - no valid text content`);
          results.push({
            id: entry.id,
            status: "skipped",
            reason: "No valid text content"
          });
          continue;
        }

        // Generate embedding
        console.log(`Generating embedding for entry ${entry.id}...`);
        const embeddingResponse = await openai.createEmbedding({
          model: "text-embedding-ada-002",
          input: text.trim(),
        });

        const [{ embedding }] = embeddingResponse.data.data;

        // Delete any existing embedding for this entry
        const { error: deleteError } = await supabase
          .from('journal_embeddings')
          .delete()
          .eq('journal_entry_id', entry.id);

        if (deleteError) {
          console.error(`Error deleting existing embedding for entry ${entry.id}:`, deleteError);
        }

        // Store the embedding
        const { data, error } = await supabase
          .from('journal_embeddings')
          .insert({
            journal_entry_id: entry.id,
            embedding,
            content: text
          });

        if (error) {
          console.error(`Error storing embedding for entry ${entry.id}:`, error);
          results.push({
            id: entry.id,
            status: "failed",
            error: error.message
          });
          failureCount++;
        } else {
          console.log(`Successfully stored embedding for entry ${entry.id}`);
          results.push({
            id: entry.id,
            status: "success"
          });
          successCount++;
        }
      } catch (error) {
        console.error(`Error processing entry ${entry.id}:`, error);
        results.push({
          id: entry.id,
          status: "failed",
          error: error.message
        });
        failureCount++;
      }
    }

    console.log(`Processing complete: ${successCount} successful, ${failureCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processing complete: ${successCount} successful, ${failureCount} failed`,
        results,
        processedCount: successCount,
        failedCount: failureCount
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error in embed-all-entries function:", error);
    
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
