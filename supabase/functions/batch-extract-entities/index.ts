
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Use proper API key from Supabase secrets
const googleApiKey = Deno.env.get('GOOGLE_API') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to extract entities from text using Google NL API
async function extractEntities(text) {
  if (!googleApiKey) {
    console.error("Google API key not configured");
    return { error: "Google API key not configured" };
  }

  try {
    console.log("Extracting entities from text:", text.substring(0, 50) + "...");
    
    const response = await fetch(`https://language.googleapis.com/v1/documents:analyzeEntities?key=${googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          type: 'PLAIN_TEXT',
          content: text
        },
        encodingType: 'UTF8'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google NL API error:", errorData);
      return { error: errorData };
    }

    const result = await response.json();
    console.log("Entity extraction successful, found", result.entities?.length || 0, "entities");
    return { entities: result.entities || [] };
  } catch (error) {
    console.error("Error in entity extraction:", error);
    return { error: error.message };
  }
}

// Function to process a batch of journal entries
async function processJournalEntries(entries, diagnosticMode = false) {
  const results = [];

  for (const entry of entries) {
    try {
      console.log(`Processing entry ID: ${entry.id}`);
      
      // Fix: Use "refined text" or "transcription text" field instead of "text"
      const textToProcess = entry["refined text"] || entry["transcription text"] || "";
      
      if (!textToProcess) {
        console.error(`No text content found for entry ID ${entry.id}`);
        results.push({ id: entry.id, success: false, error: "No text content found" });
        continue;
      }
      
      const { entities, error } = await extractEntities(textToProcess);

      if (error) {
        console.error(`Error extracting entities for entry ID ${entry.id}:`, error);
        results.push({ id: entry.id, success: false, error: error });
        continue;
      }

      // Update the journal entry with extracted entities
      const { error: updateError } = await supabase
        .from('Journal Entries')
        .update({ entities: entities })
        .eq('id', entry.id);

      if (updateError) {
        console.error(`Error updating entry ID ${entry.id}:`, updateError);
        results.push({ id: entry.id, success: false, error: updateError.message });
        continue;
      }

      console.log(`Successfully processed entry ID: ${entry.id}`);
      results.push({ id: entry.id, success: true, entityCount: entities?.length || 0 });

    } catch (error) {
      console.error(`Unexpected error processing entry ID ${entry.id}:`, error);
      results.push({ id: entry.id, success: false, error: error.message });
    }
  }

  return results;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { diagnosticMode = false, checkApiKeyOnly = false, processAll = false } = await req.json();

    if (checkApiKeyOnly) {
      if (!googleApiKey) {
        return new Response(
          JSON.stringify({
            message: "GOOGLE_API key is not configured.",
            configured: false
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      } else {
        return new Response(
          JSON.stringify({
            message: "GOOGLE_API key is configured.",
            configured: true
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    console.log("Starting batch entity extraction...");

    // Use the correct field names in the query
    const query = supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text"')
      .is('entities', null)
      .limit(50);
      
    const { data: entries, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching journal entries:", fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch journal entries', details: fetchError }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!entries || entries.length === 0) {
      console.log("No entries found to process.");
      return new Response(JSON.stringify({ message: 'No entries found to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Fetched ${entries.length} entries for processing.`);

    // Process the entries
    const results = await processJournalEntries(entries, diagnosticMode);

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(`Batch processing completed. Success: ${successCount}, Errors: ${errorCount}`);

    // Diagnostic mode response
    if (diagnosticMode) {
      return new Response(
        JSON.stringify({
          message: `Batch processing completed. Success: ${successCount}, Errors: ${errorCount}`,
          results: results
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      // Standard response
      return new Response(
        JSON.stringify({ message: `Batch processing completed. Success: ${successCount}, Errors: ${errorCount}` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

  } catch (error) {
    console.error("Unexpected error in batch entity extraction:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
