
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Generate Missing Embeddings] Starting process...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Get user ID from request
    const { userId } = await req.json();
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`[Generate Missing Embeddings] Processing for user: ${userId}`);

    // Find journal entries without embeddings
    const { data: entriesWithoutEmbeddings, error: fetchError } = await supabaseClient
      .from('Journal Entries')
      .select('id, "refined text", "transcription text"')
      .eq('user_id', userId)
      .not('id', 'in', `(SELECT journal_entry_id FROM journal_embeddings)`);

    if (fetchError) {
      console.error('[Generate Missing Embeddings] Error fetching entries:', fetchError);
      throw fetchError;
    }

    console.log(`[Generate Missing Embeddings] Found ${entriesWithoutEmbeddings?.length || 0} entries without embeddings`);

    if (!entriesWithoutEmbeddings || entriesWithoutEmbeddings.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'All entries already have embeddings',
        processedCount: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    let errorCount = 0;

    // Process each entry
    for (const entry of entriesWithoutEmbeddings) {
      try {
        // Get content for embedding
        const content = entry['refined text'] || entry['transcription text'] || '';
        
        if (!content || content.trim().length === 0) {
          console.log(`[Generate Missing Embeddings] Skipping entry ${entry.id} - no content`);
          continue;
        }

        console.log(`[Generate Missing Embeddings] Generating embedding for entry ${entry.id}`);

        // Generate embedding
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: content.substring(0, 8000), // Limit content length
            encoding_format: 'float'
          }),
        });

        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text();
          console.error(`[Generate Missing Embeddings] OpenAI API error for entry ${entry.id}:`, errorText);
          errorCount++;
          continue;
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        // Insert embedding into database
        const { error: insertError } = await supabaseClient
          .from('journal_embeddings')
          .insert({
            journal_entry_id: entry.id,
            content: content,
            embedding: embedding
          });

        if (insertError) {
          console.error(`[Generate Missing Embeddings] Database insert error for entry ${entry.id}:`, insertError);
          errorCount++;
          continue;
        }

        processedCount++;
        console.log(`[Generate Missing Embeddings] Successfully processed entry ${entry.id}`);

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[Generate Missing Embeddings] Error processing entry ${entry.id}:`, error);
        errorCount++;
      }
    }

    console.log(`[Generate Missing Embeddings] Completed - Processed: ${processedCount}, Errors: ${errorCount}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Generated embeddings for ${processedCount} entries`,
      processedCount,
      errorCount,
      totalFound: entriesWithoutEmbeddings.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Generate Missing Embeddings] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
