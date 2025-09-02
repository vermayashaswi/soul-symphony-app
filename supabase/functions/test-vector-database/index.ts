import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const testId = `test_${Date.now()}`;
    console.log(`[${testId}] Starting comprehensive vector database test`);

    // Test 1: Test vector operations function
    console.log(`[${testId}] Testing vector operations function...`);
    const { data: vectorTestData, error: vectorTestError } = await supabaseClient.rpc('test_vector_operations');
    
    if (vectorTestError) {
      console.error(`[${testId}] Vector operations test failed:`, vectorTestError);
    } else {
      console.log(`[${testId}] Vector operations test result:`, vectorTestData);
    }

    // Test 2: Generate a test embedding
    console.log(`[${testId}] Testing embedding generation...`);
    let testEmbedding = null;
    try {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: 'test emotions feelings mood',
        }),
      });

      if (!embeddingResponse.ok) {
        throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
      }

      const embeddingData = await embeddingResponse.json();
      testEmbedding = embeddingData.data[0].embedding;
      console.log(`[${testId}] Embedding generation successful: ${testEmbedding.length} dimensions`);
    } catch (embeddingError) {
      console.error(`[${testId}] Embedding generation failed:`, embeddingError);
    }

    // Test 3: Test vector search functions if embedding succeeded
    let vectorSearchResults = null;
    if (testEmbedding) {
      console.log(`[${testId}] Testing basic vector search function...`);
      try {
        const { data: basicSearchData, error: basicSearchError } = await supabaseClient.rpc('match_journal_entries', {
          query_embedding: testEmbedding,
          match_threshold: 0.1,
          match_count: 5,
          user_id_filter: 'test-user-id'
        });

        if (basicSearchError) {
          console.error(`[${testId}] Basic vector search failed:`, basicSearchError);
        } else {
          console.log(`[${testId}] Basic vector search succeeded: ${basicSearchData?.length || 0} results`);
          vectorSearchResults = { basic: basicSearchData };
        }
      } catch (searchError) {
        console.error(`[${testId}] Basic vector search exception:`, searchError);
      }

      // Test 4: Test time-filtered vector search
      console.log(`[${testId}] Testing time-filtered vector search function...`);
      try {
        const { data: timeSearchData, error: timeSearchError } = await supabaseClient.rpc('match_journal_entries_with_date', {
          query_embedding: testEmbedding,
          match_threshold: 0.1,
          match_count: 5,
          user_id_filter: 'test-user-id',
          start_date: '2024-01-01T00:00:00Z',
          end_date: '2024-12-31T23:59:59Z'
        });

        if (timeSearchError) {
          console.error(`[${testId}] Time-filtered vector search failed:`, timeSearchError);
        } else {
          console.log(`[${testId}] Time-filtered vector search succeeded: ${timeSearchData?.length || 0} results`);
          if (!vectorSearchResults) vectorSearchResults = {};
          vectorSearchResults.timeFiltered = timeSearchData;
        }
      } catch (timeSearchError) {
        console.error(`[${testId}] Time-filtered vector search exception:`, timeSearchError);
      }
    }

    // Test 5: Check journal_embeddings table structure
    console.log(`[${testId}] Testing journal_embeddings table access...`);
    let embeddingsTableTest = null;
    try {
      const { data: embeddingsData, error: embeddingsError } = await supabaseClient
        .from('journal_embeddings')
        .select('id, journal_entry_id, created_at')
        .limit(1);

      if (embeddingsError) {
        console.error(`[${testId}] Journal embeddings table access failed:`, embeddingsError);
      } else {
        console.log(`[${testId}] Journal embeddings table access succeeded: ${embeddingsData?.length || 0} sample records`);
        embeddingsTableTest = { success: true, sampleCount: embeddingsData?.length || 0 };
      }
    } catch (embeddingsTableError) {
      console.error(`[${testId}] Journal embeddings table access exception:`, embeddingsTableError);
      embeddingsTableTest = { success: false, error: embeddingsTableError.message };
    }

    const testResults = {
      success: true,
      testId,
      timestamp: new Date().toISOString(),
      results: {
        vectorOperationsTest: {
          success: !vectorTestError,
          data: vectorTestData,
          error: vectorTestError
        },
        embeddingGeneration: {
          success: !!testEmbedding,
          embeddingLength: testEmbedding?.length || 0,
          hasOpenAIKey: !!Deno.env.get('OPENAI_API_KEY')
        },
        vectorSearchFunctions: {
          success: !!vectorSearchResults,
          results: vectorSearchResults
        },
        embeddingsTableAccess: embeddingsTableTest
      },
      summary: {
        allTestsPassed: !vectorTestError && !!testEmbedding && !!vectorSearchResults && embeddingsTableTest?.success,
        criticalIssues: []
      }
    };

    // Add critical issues to summary
    if (vectorTestError) {
      testResults.summary.criticalIssues.push('Vector operations function failed');
    }
    if (!testEmbedding) {
      testResults.summary.criticalIssues.push('Embedding generation failed');
    }
    if (!vectorSearchResults) {
      testResults.summary.criticalIssues.push('Vector search functions failed');
    }
    if (!embeddingsTableTest?.success) {
      testResults.summary.criticalIssues.push('Journal embeddings table access failed');
    }

    console.log(`[${testId}] Vector database test completed:`, testResults.summary);

    return new Response(JSON.stringify(testResults), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Vector database test error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});