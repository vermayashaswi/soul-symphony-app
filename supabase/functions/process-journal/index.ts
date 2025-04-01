
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

// Process a journal entry for chunking and embedding
async function processJournalEntry(entryId: number) {
  try {
    // First, retrieve the entry to make sure it exists and to get any necessary data
    const { data: entry, error } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text", is_chunked')
      .eq('id', entryId)
      .single();
    
    if (error || !entry) {
      console.error(`Error retrieving journal entry ${entryId}:`, error);
      return { 
        success: false, 
        error: `Failed to retrieve journal entry: ${error?.message || 'Entry not found'}`
      };
    }
    
    // If the entry is already chunked, we can skip this step
    if (entry.is_chunked) {
      console.log(`Entry ${entryId} is already chunked, skipping chunking process.`);
      return { 
        success: true,
        already_chunked: true,
        chunks_count: entry.chunks_count || 0
      };
    }
    
    // Call the chunk-and-embed function to process this entry
    console.log(`Invoking chunk-and-embed function for entry ${entryId}...`);
    const chunkResponse = await fetch(
      `${supabaseUrl}/functions/v1/chunk-and-embed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ entryId })
      }
    );
    
    if (!chunkResponse.ok) {
      const errorText = await chunkResponse.text();
      console.error(`Error from chunk-and-embed function:`, errorText);
      return { 
        success: false, 
        error: `Chunking failed: ${errorText}`
      };
    }
    
    const chunkResult = await chunkResponse.json();
    
    console.log(`Chunk-and-embed result:`, chunkResult);
    
    // Re-fetch the entry to get the latest chunks_count
    const { data: updatedEntry, error: refetchError } = await supabase
      .from('Journal Entries')
      .select('chunks_count')
      .eq('id', entryId)
      .single();
    
    if (refetchError) {
      console.error(`Error re-fetching entry ${entryId} after chunking:`, refetchError);
    }
    
    return { 
      success: chunkResult.success, 
      message: chunkResult.message,
      chunks_count: updatedEntry?.chunks_count || 0
    };
  } catch (error) {
    console.error(`Exception in processJournalEntry:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entryId } = await req.json();
    
    if (!entryId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: entryId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process the journal entry
    const result = await processJournalEntry(entryId);
    
    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
