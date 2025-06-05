
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
    console.log('[Generate-Missing-Embeddings] Starting embedding generation process');

    // Create Supabase client with user's auth token for RLS compliance
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const requestBody = await req.json();
    const { userId } = requestBody;

    if (!userId) {
      throw new Error('User ID is required');
    }

    // Find journal entries without embeddings
    console.log('[Generate-Missing-Embeddings] Finding entries without embeddings for user:', userId);
    
    const { data: entriesWithoutEmbeddings, error: fetchError } = await supabaseClient
      .from('Journal Entries')
      .select(`
        id,
        "refined text",
        "transcription text",
        created_at
      `)
      .eq('user_id', userId)
      .not('id', 'in', `(
        SELECT journal_entry_id 
        FROM journal_embeddings 
        WHERE journal_entry_id IS NOT NULL
      )`);

    if (fetchError) {
      console.error('[Generate-Missing-Embeddings] Error fetching entries:', fetchError);
      throw fetchError;
    }

    console.log(`[Generate-Missing-Embeddings] Found ${entriesWithoutEmbeddings?.length || 0} entries without embeddings`);

    if (!entriesWithoutEmbeddings || entriesWithoutEmbeddings.length === 0) {
      return new Response(JSON.stringify({
        message: 'No entries without embeddings found',
        processed: 0,
        skipped: 0,
        errors: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    const batchSize = 5; // Process in small batches to avoid timeouts

    // Process entries in batches
    for (let i = 0; i < entriesWithoutEmbeddings.length; i += batchSize) {
      const batch = entriesWithoutEmbeddings.slice(i, i + batchSize);
      console.log(`[Generate-Missing-Embeddings] Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(entriesWithoutEmbeddings.length/batchSize)}`);

      for (const entry of batch) {
        try {
          // Get the text content (prefer refined text over transcription)
          const content = entry["refined text"] || entry["transcription text"];
          
          if (!content || content.trim().length === 0) {
            console.log(`[Generate-Missing-Embeddings] Skipping entry ${entry.id} - no content`);
            skipped++;
            continue;
          }

          // Generate embedding using OpenAI
          console.log(`[Generate-Missing-Embeddings] Generating embedding for entry ${entry.id}`);
          
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: content.substring(0, 8000), // Limit to 8000 characters
              encoding_format: 'float'
            }),
          });

          if (!embeddingResponse.ok) {
            throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
          }

          const embeddingResult = await embeddingResponse.json();
          const embedding = embeddingResult.data[0].embedding;

          // Insert the embedding into the database
          const { error: insertError } = await supabaseClient
            .from('journal_embeddings')
            .insert({
              journal_entry_id: entry.id,
              content: content,
              embedding: embedding
            });

          if (insertError) {
            console.error(`[Generate-Missing-Embeddings] Error inserting embedding for entry ${entry.id}:`, insertError);
            errors++;
          } else {
            console.log(`[Generate-Missing-Embeddings] Successfully generated embedding for entry ${entry.id}`);
            processed++;
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`[Generate-Missing-Embeddings] Error processing entry ${entry.id}:`, error);
          errors++;
        }
      }

      // Longer delay between batches
      if (i + batchSize < entriesWithoutEmbeddings.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[Generate-Missing-Embeddings] Completed: ${processed} processed, ${skipped} skipped, ${errors} errors`);

    return new Response(JSON.stringify({
      message: 'Embedding generation completed',
      processed,
      skipped,
      errors,
      total: entriesWithoutEmbeddings.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Generate-Missing-Embeddings] Function error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      message: 'Failed to generate embeddings'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
