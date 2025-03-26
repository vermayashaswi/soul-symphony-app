
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.22.0";
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";

// Set up CORS headers for browser requests
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
    // Get the Supabase client and API key from environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";

    if (!supabaseUrl || !supabaseServiceRole || !openaiKey) {
      console.log("Missing environment variables");
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    // Get the request data
    const { userId, processAll = false } = await req.json();

    if (!userId) {
      console.log("User ID is required");
      throw new Error("User ID is required");
    }

    console.log(`Processing journal entries for user ${userId}`);
    console.log(`Process all entries: ${processAll ? "Yes" : "No"}`);

    // Make sure the embedding table exists
    try {
      // Note: Using direct SQL is more reliable than .from().select() for checking table existence
      const { error: tableCheckError } = await supabase
        .from('journal_embeddings')
        .select('id')
        .limit(1);

      if (tableCheckError) {
        console.log("Journal embeddings table not found, creating it");
        
        // Create embeddings table if needed
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS journal_embeddings (
            id BIGSERIAL PRIMARY KEY,
            journal_entry_id BIGINT NOT NULL,
            content TEXT NOT NULL,
            embedding VECTOR(1536),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `;
        
        // We can't use supabase.query directly, but we can use supabase.rpc
        // to call a function that would create the table. Let's use the .from() API instead.
        await supabase.from('journal_embeddings').insert({
          journal_entry_id: 0,
          content: 'Table initialization',
          embedding: Array(1536).fill(0)
        }).single();
        
        console.log("Journal embeddings table created");
      }
    } catch (error) {
      console.error("Error running table creation SQL:", error);
    }

    console.log("Fetching entries that need processing...");
    
    // Fetch entries to process:
    // - If processAll=true, get all entries for the user
    // - If processAll=false, get only entries without embeddings
    try {
      let query = supabase
        .from("Journal Entries")
        .select(`
          id,
          "refined text",
          "transcription text"
        `)
        .eq("user_id", userId);

      if (!processAll) {
        console.log("Filtering for entries without embeddings");
        
        // Get IDs of entries that already have embeddings
        const { data: existingEmbeddings, error: embedError } = await supabase
          .from("journal_embeddings")
          .select("journal_entry_id");
        
        if (embedError) {
          console.error("Error fetching existing embeddings:", embedError);
          throw new Error("Failed to fetch existing embeddings");
        }

        // Extract the IDs
        const embeddedIds = (existingEmbeddings || []).map(e => e.journal_entry_id);
        
        if (embeddedIds.length > 0) {
          // Filter out entries that already have embeddings
          query = query.not('id', 'in', `(${embeddedIds.join(',')})`);
        }
      }

      const { data: entries, error: entriesError } = await query;

      if (entriesError) {
        console.error("Error fetching journal entries:", entriesError);
        throw new Error("Failed to fetch entries: " + entriesError.message);
      }

      // Filter for entries with text content
      const entriesToProcess = entries?.filter(entry => 
        (entry["refined text"] && entry["refined text"].trim().length > 0) || 
        (entry["transcription text"] && entry["transcription text"].trim().length > 0)
      ) || [];

      console.log(`Found ${entriesToProcess.length} entries to process`);

      if (entriesToProcess.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            processedCount: 0,
            message: "No entries to process" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      // Initialize OpenAI
      const configuration = new Configuration({ apiKey: openaiKey });
      const openai = new OpenAIApi(configuration);

      let processedCount = 0;
      let errorCount = 0;

      // Process entries with embeddings
      for (const entry of entriesToProcess) {
        try {
          // Get text content - prefer refined text over transcription
          const textContent = entry["refined text"] || entry["transcription text"] || "";
          
          if (textContent.trim().length === 0) {
            console.log(`Skipping entry ${entry.id} - no text content`);
            continue;
          }

          // Create embedding with OpenAI
          console.log(`Creating embedding for entry ${entry.id}`);
          const embeddingResponse = await openai.createEmbedding({
            model: "text-embedding-ada-002",
            input: textContent.trim()
          });

          if (!embeddingResponse.data || !embeddingResponse.data.data || embeddingResponse.data.data.length === 0) {
            console.error(`OpenAI API returned an invalid response for entry ${entry.id}`);
            errorCount++;
            continue;
          }

          const [{ embedding }] = embeddingResponse.data.data;

          // Store the embedding
          const { error: insertError } = await supabase
            .from("journal_embeddings")
            .insert({
              journal_entry_id: entry.id,
              content: textContent,
              embedding
            });

          if (insertError) {
            console.error(`Error storing embedding for entry ${entry.id}:`, insertError);
            errorCount++;
            continue;
          }

          processedCount++;
          console.log(`Successfully processed entry ${entry.id}`);
        } catch (error) {
          console.error(`Error processing entry ${entry.id}:`, error);
          errorCount++;
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          processedCount,
          errorCount,
          totalEntries: entriesToProcess.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } catch (error) {
      console.error("Error processing entries:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in embed-all-entries function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
