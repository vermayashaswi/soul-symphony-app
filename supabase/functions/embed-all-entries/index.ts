
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { calculateEmbedding } from "../_shared/openai-helpers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const createTableSchema = `
CREATE TABLE IF NOT EXISTS journal_embeddings (
  id BIGSERIAL PRIMARY KEY,
  journal_entry_id BIGINT REFERENCES "Journal Entries" (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', now())
);
`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, processAll = false } = await req.json();
    
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    console.log(`Processing journal entries for user ${userId}`);
    console.log(`Process all entries: ${processAll ? 'Yes' : 'No'}`);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Ensure the embedding table exists
    try {
      const { error } = await supabase.rpc('execute_sql', { sql: createTableSchema });
      
      if (error) {
        console.error('Error running table creation SQL:', error);
      }
    } catch (error) {
      console.error('Error running table creation SQL:', error);
    }
    
    // Fetch journal entries that need processing
    console.log('Fetching entries that need processing...');
    
    let query = supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text"')
      .eq('user_id', userId);
    
    if (!processAll) {
      console.log('Filtering for entries without embeddings');
      
      const { data: existingEmbeddings, error: embeddingsError } = await supabase
        .from('journal_embeddings')
        .select('journal_entry_id');
      
      if (embeddingsError) {
        console.error('Error fetching existing embeddings:', embeddingsError);
        throw new Error('Failed to fetch existing embeddings');
      }
      
      const processedIds = (existingEmbeddings || []).map(e => e.journal_entry_id);
      
      if (processedIds.length > 0) {
        query = query.not('id', 'in', processedIds);
      }
    }
    
    const { data: entries, error: entriesError } = await query;
    
    if (entriesError) {
      console.error('Error fetching journal entries:', entriesError);
      throw new Error('Failed to fetch entries: ' + entriesError.message);
    }
    
    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No entries to process',
          processedCount: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${entries.length} entries to process`);
    
    let processedCount = 0;
    
    for (const entry of entries) {
      const textToEmbed = entry["refined text"] || entry["transcription text"];
      
      if (!textToEmbed || textToEmbed.trim() === '') {
        console.log(`Skipping entry ${entry.id} - no text to embed`);
        continue;
      }
      
      try {
        // Generate embedding for the journal entry text
        const embedding = await calculateEmbedding(textToEmbed);
        
        if (!embedding) {
          console.error(`Failed to generate embedding for entry ${entry.id}`);
          continue;
        }
        
        // Store the embedding in the database
        const { error: insertError } = await supabase
          .from('journal_embeddings')
          .insert({
            journal_entry_id: entry.id,
            content: textToEmbed,
            embedding: embedding,
          });
          
        if (insertError) {
          console.error(`Error storing embedding for entry ${entry.id}:`, insertError);
          continue;
        }
        
        processedCount++;
        console.log(`Processed entry ${entry.id}`);
        
      } catch (error) {
        console.error(`Error processing entry ${entry.id}:`, error);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully processed ${processedCount} of ${entries.length} entries`,
        processedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in embed-all-entries function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'An unknown error occurred',
        processedCount: 0
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
