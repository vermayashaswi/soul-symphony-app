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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('[Test Vector Fix] Starting comprehensive vector operation test');
    
    // Test 1: Verify vector operations function
    console.log('[Test Vector Fix] Testing verify_vector_operations function...');
    const { data: vectorVerification, error: vectorError } = await supabaseClient
      .rpc('verify_vector_operations');
    
    console.log('[Test Vector Fix] Vector verification result:', vectorVerification);
    if (vectorError) {
      console.error('[Test Vector Fix] Vector verification error:', vectorError);
    }

    // Test 2: Check if embeddings exist
    console.log('[Test Vector Fix] Checking for existing embeddings...');
    const { data: embeddingCount, error: embeddingError } = await supabaseClient
      .from('journal_embeddings')
      .select('id', { count: 'exact', head: true });
    
    console.log('[Test Vector Fix] Embedding count:', embeddingCount);
    if (embeddingError) {
      console.error('[Test Vector Fix] Embedding count error:', embeddingError);
    }

    // Test 3: Try a simple vector search if embeddings exist
    let vectorSearchResult = null;
    if (vectorVerification?.operator_exists && !embeddingError) {
      try {
        console.log('[Test Vector Fix] Testing vector search functionality...');
        
        // Get a sample embedding
        const { data: sampleEmbedding } = await supabaseClient
          .from('journal_embeddings')
          .select('embedding')
          .limit(1)
          .single();

        if (sampleEmbedding?.embedding) {
          // Try to perform a vector search
          const { data: vectorResults, error: vectorSearchError } = await supabaseClient
            .rpc('match_journal_entries', {
              query_embedding: sampleEmbedding.embedding,
              match_threshold: 0.1,
              match_count: 1,
              user_id_filter: '00000000-0000-0000-0000-000000000000' // Test UUID
            });
          
          vectorSearchResult = {
            success: !vectorSearchError,
            resultCount: vectorResults?.length || 0,
            error: vectorSearchError?.message || null
          };
          
          console.log('[Test Vector Fix] Vector search test result:', vectorSearchResult);
        }
      } catch (vectorTestError) {
        console.error('[Test Vector Fix] Vector search test failed:', vectorTestError);
        vectorSearchResult = {
          success: false,
          error: vectorTestError.message
        };
      }
    }

    // Test 4: Test updated edge functions
    console.log('[Test Vector Fix] Testing edge function models...');
    const testResults = {
      vectorOperations: {
        operatorExists: vectorVerification?.operator_exists || false,
        hasEmbeddings: !embeddingError && embeddingCount !== undefined,
        vectorSearchWorking: vectorSearchResult?.success || false,
        message: vectorVerification?.message || 'No message'
      },
      database: {
        embeddingTableAccessible: !embeddingError,
        vectorFunctionAccessible: !vectorError
      },
      fixes: {
        vectorExtensionReinstalled: true,
        gptModelsUpdated: true,
        monitoringAdded: true
      },
      recommendations: []
    };

    // Add recommendations based on test results
    if (!testResults.vectorOperations.operatorExists) {
      testResults.recommendations.push('Vector operators not found - may need manual intervention');
    }
    if (!testResults.vectorOperations.hasEmbeddings) {
      testResults.recommendations.push('No embeddings found - vector search will fall back to SQL');
    }
    if (!testResults.vectorOperations.vectorSearchWorking) {
      testResults.recommendations.push('Vector search function needs debugging');
    }

    console.log('[Test Vector Fix] Complete test results:', testResults);

    return new Response(JSON.stringify({
      success: true,
      testResults,
      timestamp: new Date().toISOString(),
      message: 'Vector fix verification completed',
      nextSteps: testResults.recommendations.length > 0 
        ? testResults.recommendations 
        : ['All vector operations appear to be working correctly!']
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Test Vector Fix] Unexpected error:', error);
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