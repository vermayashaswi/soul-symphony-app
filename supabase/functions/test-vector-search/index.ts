
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateEmbedding(text: string): Promise<number[]> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  console.log(`[Test] Generating embedding for: "${text}"`);

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Test] OpenAI API error:', errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.data || data.data.length === 0) {
    throw new Error('Empty embedding data received from OpenAI');
  }

  const embedding = data.data[0].embedding;
  console.log(`[Test] Generated embedding with ${embedding.length} dimensions`);
  return embedding;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { userId, testQuery = "parenting thoughts feelings" } = await req.json();
    
    console.log(`[Test] Starting vector search test for user: ${userId}`);
    console.log(`[Test] Test query: "${testQuery}"`);

    // Step 1: Check user's journal entries
    const { data: entries, error: entriesError } = await supabaseClient
      .from('Journal Entries')
      .select('id, created_at, "refined text", "transcription text"')
      .eq('user_id', userId)
      .limit(10);

    if (entriesError) {
      throw entriesError;
    }

    console.log(`[Test] Found ${entries?.length || 0} journal entries`);

    // Step 2: Check embeddings for these entries
    const entryIds = entries?.map(e => e.id) || [];
    
    const { data: embeddings, error: embeddingsError } = await supabaseClient
      .from('journal_embeddings')
      .select('id, journal_entry_id, created_at')
      .in('journal_entry_id', entryIds);

    if (embeddingsError) {
      throw embeddingsError;
    }

    console.log(`[Test] Found ${embeddings?.length || 0} embeddings`);

    // Step 3: Generate embedding for test query
    const queryEmbedding = await generateEmbedding(testQuery);
    console.log(`[Test] Query embedding dimensions: ${queryEmbedding.length}`);

    // Step 4: Test vector search with very low threshold
    const { data: vectorResults, error: vectorError } = await supabaseClient
      .rpc('match_journal_entries', {
        query_embedding: queryEmbedding,
        match_threshold: 0.05, // Very low threshold
        match_count: 20,
        user_id_filter: userId
      });

    if (vectorError) {
      console.error('[Test] Vector search error:', vectorError);
      throw vectorError;
    }

    console.log(`[Test] Vector search returned ${vectorResults?.length || 0} results`);

    // Step 5: Test with known entry ID if no results
    let directTest = null;
    if ((!vectorResults || vectorResults.length === 0) && embeddings?.length > 0) {
      const sampleEntryId = embeddings[0].journal_entry_id;
      console.log(`[Test] Testing direct search with entry ID: ${sampleEntryId}`);
      
      const { data: directResults, error: directError } = await supabaseClient
        .from('journal_embeddings')
        .select('*, "Journal Entries"!inner(id, created_at, "refined text", "transcription text")')
        .eq('journal_entry_id', sampleEntryId)
        .eq('Journal Entries.user_id', userId);

      if (!directError) {
        directTest = directResults;
        console.log(`[Test] Direct query returned ${directResults?.length || 0} results`);
      }
    }

    // Step 6: Test pgvector extension
    const { data: extensionTest, error: extensionError } = await supabaseClient
      .rpc('version');

    return new Response(JSON.stringify({
      success: true,
      testResults: {
        journalEntries: {
          count: entries?.length || 0,
          sampleIds: entries?.slice(0, 3).map(e => e.id) || []
        },
        embeddings: {
          count: embeddings?.length || 0,
          sampleIds: embeddings?.slice(0, 3).map(e => e.journal_entry_id) || []
        },
        queryEmbedding: {
          dimensions: queryEmbedding.length,
          isValid: Array.isArray(queryEmbedding) && queryEmbedding.length === 1536,
          sample: queryEmbedding.slice(0, 5)
        },
        vectorSearch: {
          resultsCount: vectorResults?.length || 0,
          results: vectorResults?.slice(0, 3).map(r => ({
            id: r.id,
            similarity: r.similarity,
            created_at: r.created_at,
            content_preview: (r.content || '').substring(0, 100)
          })) || [],
          error: vectorError?.message || null
        },
        directTest,
        database: {
          extensionTest: extensionTest || null,
          extensionError: extensionError?.message || null
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Test] Error in vector search test:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
