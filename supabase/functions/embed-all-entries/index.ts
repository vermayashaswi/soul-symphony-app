
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const { userId, entryId, processAll = false } = await req.json();
    
    console.log('Received request to embed entries:', { userId, entryId, processAll });
    
    if (!userId && !entryId) {
      throw new Error('Either userId or entryId must be provided');
    }

    // Get entries to process
    let entries = [];
    if (entryId) {
      // Process a single entry
      const { data, error } = await supabase
        .from('Journal Entries')
        .select('id, "refined text", "transcription text"')
        .eq('id', entryId)
        .single();
        
      if (error) {
        throw new Error(`Error fetching entry ${entryId}: ${error.message}`);
      }
      
      if (data) entries = [data];
    } else {
      // Process entries for a user
      const query = supabase
        .from('Journal Entries')
        .select('id, "refined text", "transcription text"')
        .eq('user_id', userId);
      
      // If not processing all, only get entries without embeddings
      if (!processAll) {
        console.log('Querying only entries without embeddings');
        // First, get the entries that already have embeddings
        const { data: embeddingsData } = await supabase
          .from('journal_embeddings')
          .select('journal_entry_id')
          .is('embedding', 'not null');
          
        if (embeddingsData && embeddingsData.length > 0) {
          // Get list of entry IDs that already have non-null embeddings
          const entriesWithEmbeddingsIds = embeddingsData.map(e => e.journal_entry_id);
          
          if (entriesWithEmbeddingsIds.length > 0) {
            console.log(`Found ${entriesWithEmbeddingsIds.length} entries with existing embeddings`);
            query.not('id', 'in', `(${entriesWithEmbeddingsIds.join(',')})`);
          }
        } else {
          console.log('No entries found with existing embeddings, processing all entries for user');
        }
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw new Error(`Error fetching entries for user ${userId}: ${error.message}`);
      }
      
      entries = data || [];
    }
    
    console.log(`Found ${entries.length} entries to process`);
    
    // Process each entry
    const results = {
      success: true,
      totalProcessed: entries.length,
      successCount: 0,
      errorCount: 0,
      errors: [] as Array<{ id: number; error: string }>,
    };
    
    for (const entry of entries) {
      try {
        const text = entry["refined text"] || entry["transcription text"] || '';
        
        if (!text || text.trim() === '') {
          console.log(`Skipping entry ${entry.id} - no text content`);
          continue;
        }
        
        console.log(`Processing entry ${entry.id}, text length: ${text.length}`);
        
        // Generate embedding using OpenAI API
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: text,
            model: 'text-embedding-ada-002',
          }),
        });

        if (!embeddingResponse.ok) {
          const errorData = await embeddingResponse.json();
          throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;
        
        // Check if entry already has an embedding record
        const { data: existingEmbedding } = await supabase
          .from('journal_embeddings')
          .select('id')
          .eq('journal_entry_id', entry.id)
          .maybeSingle();
          
        // Insert or update embedding
        let upsertResult;
        if (existingEmbedding) {
          // Update existing embedding
          console.log(`Updating existing embedding for entry ${entry.id}`);
          upsertResult = await supabase
            .from('journal_embeddings')
            .update({ 
              content: text,
              embedding: embedding
            })
            .eq('journal_entry_id', entry.id);
        } else {
          // Insert new embedding
          console.log(`Creating new embedding for entry ${entry.id}`);
          upsertResult = await supabase
            .from('journal_embeddings')
            .insert({ 
              journal_entry_id: entry.id,
              content: text,
              embedding: embedding
            });
        }
        
        if (upsertResult.error) {
          throw new Error(`Error storing embedding: ${upsertResult.error.message}`);
        }
        
        console.log(`Successfully processed entry ${entry.id}`);
        results.successCount++;
      } catch (error) {
        console.error(`Error processing entry ${entry.id}:`, error);
        results.errorCount++;
        results.errors.push({ 
          id: entry.id, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    
    console.log('Embedding processing complete:', results);

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
    
  } catch (error) {
    console.error("Error in embed-all-entries function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error), 
        success: false,
        message: "Failed to process embeddings"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
