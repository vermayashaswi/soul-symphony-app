
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
    
    console.log(`[Test] Starting comprehensive vector search test for user: ${userId}`);
    console.log(`[Test] Test query: "${testQuery}"`);

    // Step 1: Check user's journal entries with detailed analysis
    const { data: entries, error: entriesError } = await supabaseClient
      .from('Journal Entries')
      .select('id, created_at, "refined text", "transcription text", user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (entriesError) {
      throw entriesError;
    }

    console.log(`[Test] Found ${entries?.length || 0} journal entries`);
    if (entries && entries.length > 0) {
      console.log(`[Test] Sample entries:`, entries.slice(0, 3).map(e => ({
        id: e.id,
        created_at: e.created_at,
        content_length: (e['refined text'] || e['transcription text'] || '').length
      })));
    }

    // Step 2: Check embeddings for these entries with detailed analysis
    const entryIds = entries?.map(e => e.id) || [];
    
    const { data: embeddings, error: embeddingsError } = await supabaseClient
      .from('journal_embeddings')
      .select('id, journal_entry_id, created_at, embedding')
      .in('journal_entry_id', entryIds);

    if (embeddingsError) {
      throw embeddingsError;
    }

    console.log(`[Test] Found ${embeddings?.length || 0} embeddings`);
    
    // Analyze embedding quality
    if (embeddings && embeddings.length > 0) {
      const firstEmbedding = embeddings[0].embedding;
      console.log(`[Test] First embedding analysis:`);
      console.log(`[Test] - Type: ${typeof firstEmbedding}`);
      console.log(`[Test] - Is array: ${Array.isArray(firstEmbedding)}`);
      
      if (Array.isArray(firstEmbedding)) {
        console.log(`[Test] - Dimensions: ${firstEmbedding.length}`);
        console.log(`[Test] - Sample values: [${firstEmbedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`);
        console.log(`[Test] - All numbers: ${firstEmbedding.every(n => typeof n === 'number' && !isNaN(n))}`);
      }
    }

    // Step 3: Generate embedding for test query with validation
    const queryEmbedding = await generateEmbedding(testQuery);
    console.log(`[Test] Query embedding validation:`);
    console.log(`[Test] - Dimensions: ${queryEmbedding.length}`);
    console.log(`[Test] - Expected: 1536`);
    console.log(`[Test] - Match: ${queryEmbedding.length === 1536}`);
    console.log(`[Test] - Sample: [${queryEmbedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`);

    // Step 4: Test vector search with multiple thresholds
    const testResults = [];
    const thresholds = [0.01, 0.1, 0.3, 0.5];
    
    for (const threshold of thresholds) {
      console.log(`[Test] Testing threshold: ${threshold}`);
      
      const { data: vectorResults, error: vectorError } = await supabaseClient
        .rpc('match_journal_entries', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: 20,
          user_id_filter: userId
        });

      if (vectorError) {
        console.error(`[Test] Vector search error at threshold ${threshold}:`, vectorError);
        testResults.push({
          threshold,
          error: vectorError.message,
          results_count: 0
        });
      } else {
        console.log(`[Test] Threshold ${threshold}: ${vectorResults?.length || 0} results`);
        testResults.push({
          threshold,
          results_count: vectorResults?.length || 0,
          top_similarities: vectorResults?.slice(0, 3).map(r => ({
            id: r.id,
            similarity: r.similarity,
            content_preview: (r.content || '').substring(0, 100)
          })) || []
        });
      }
    }

    // Step 5: Test direct embedding lookup
    let directLookup = null;
    if (embeddings && embeddings.length > 0) {
      const sampleEntryId = embeddings[0].journal_entry_id;
      console.log(`[Test] Testing direct lookup for entry ID: ${sampleEntryId}`);
      
      const { data: directResults, error: directError } = await supabaseClient
        .from('journal_embeddings')
        .select('*, "Journal Entries"!inner(id, created_at, "refined text", "transcription text")')
        .eq('journal_entry_id', sampleEntryId)
        .eq('Journal Entries.user_id', userId)
        .limit(1);

      if (!directError && directResults) {
        directLookup = {
          success: true,
          entry_id: sampleEntryId,
          has_embedding: !!directResults[0]?.embedding,
          embedding_dimensions: Array.isArray(directResults[0]?.embedding) ? directResults[0].embedding.length : 0
        };
      } else {
        directLookup = {
          success: false,
          error: directError?.message || 'Unknown error'
        };
      }
    }

    // Step 6: Test database extensions
    const { data: extensionTest, error: extensionError } = await supabaseClient
      .rpc('version');

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      test_query: testQuery,
      user_id: userId,
      results: {
        journal_entries: {
          count: entries?.length || 0,
          sample_ids: entries?.slice(0, 3).map(e => e.id) || []
        },
        embeddings: {
          count: embeddings?.length || 0,
          sample_analysis: embeddings && embeddings.length > 0 ? {
            dimensions: Array.isArray(embeddings[0].embedding) ? embeddings[0].embedding.length : 0,
            type: typeof embeddings[0].embedding,
            is_valid: Array.isArray(embeddings[0].embedding) && embeddings[0].embedding.length === 1536
          } : null
        },
        query_embedding: {
          dimensions: queryEmbedding.length,
          is_valid: queryEmbedding.length === 1536,
          sample: queryEmbedding.slice(0, 5)
        },
        vector_search_tests: testResults,
        direct_lookup: directLookup,
        database_extensions: {
          test: extensionTest || null,
          error: extensionError?.message || null
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
      stack: error.stack,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
