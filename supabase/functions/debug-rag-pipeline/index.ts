
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
    const { testQuery = "Rate my top 3 negative traits out of 100? What do i do to improve them?", userId } = await req.json();
    
    const debugId = `debug_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    console.log(`[DEBUG START] ${debugId}: Testing RAG pipeline with query: "${testQuery}"`);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const debugResults = {
      timestamp: new Date().toISOString(),
      testQuery,
      userId,
      tests: {}
    };

    // Test 1: Database Connection and Journal Entries
    console.log(`[${debugId}] Test 1: Database Connection`);
    try {
      const { data: journalEntries, error: journalError } = await supabaseClient
        .from('Journal Entries')
        .select('id, "refined text", created_at, emotions, master_themes')
        .eq('user_id', userId)
        .limit(5);
      
      if (journalError) throw journalError;
      
      debugResults.tests.database = {
        success: true,
        journalEntriesFound: journalEntries?.length || 0,
        sampleEntry: journalEntries?.[0] ? {
          id: journalEntries[0].id,
          hasRefinedText: !!journalEntries[0]['refined text'],
          hasEmotions: !!journalEntries[0].emotions,
          hasThemes: !!journalEntries[0].master_themes,
          createdAt: journalEntries[0].created_at
        } : null
      };
      console.log(`[${debugId}] ✅ Database test passed: ${journalEntries?.length || 0} entries found`);
    } catch (error) {
      debugResults.tests.database = {
        success: false,
        error: error.message
      };
      console.log(`[${debugId}] ❌ Database test failed:`, error.message);
    }

    // Test 2: Embedding Generation
    console.log(`[${debugId}] Test 2: Embedding Generation`);
    try {
      const testText = "test embedding generation";
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: testText,
        }),
      });

      if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
      
      const embeddingData = await response.json();
      const embedding = embeddingData.data[0].embedding;
      
      debugResults.tests.embedding = {
        success: true,
        embeddingLength: embedding.length,
        firstFewValues: embedding.slice(0, 3)
      };
      console.log(`[${debugId}] ✅ Embedding test passed: ${embedding.length} dimensions`);
    } catch (error) {
      debugResults.tests.embedding = {
        success: false,
        error: error.message
      };
      console.log(`[${debugId}] ❌ Embedding test failed:`, error.message);
    }

    // Test 3: Vector Search
    console.log(`[${debugId}] Test 3: Vector Search`);
    try {
      const testEmbedding = Array(1536).fill(0.1); // Mock embedding for testing
      const { data: vectorResults, error: vectorError } = await supabaseClient.rpc('match_journal_entries', {
        query_embedding: testEmbedding,
        match_threshold: 0.1,
        match_count: 5,
        user_id_filter: userId
      });
      
      if (vectorError) throw vectorError;
      
      debugResults.tests.vectorSearch = {
        success: true,
        resultsFound: vectorResults?.length || 0,
        sampleResult: vectorResults?.[0] ? {
          id: vectorResults[0].id,
          similarity: vectorResults[0].similarity,
          hasContent: !!vectorResults[0].content
        } : null
      };
      console.log(`[${debugId}] ✅ Vector search test passed: ${vectorResults?.length || 0} results`);
    } catch (error) {
      debugResults.tests.vectorSearch = {
        success: false,
        error: error.message
      };
      console.log(`[${debugId}] ❌ Vector search test failed:`, error.message);
    }

    // Test 4: SQL Execution via execute_dynamic_query
    console.log(`[${debugId}] Test 4: SQL Execution`);
    try {
      const testSQL = `SELECT id, "refined text", created_at FROM "Journal Entries" WHERE user_id = '${userId}' ORDER BY created_at DESC LIMIT 3`;
      const { data: sqlResult, error: sqlError } = await supabaseClient.rpc('execute_dynamic_query', {
        query_text: testSQL
      });
      
      if (sqlError) throw sqlError;
      
      debugResults.tests.sqlExecution = {
        success: sqlResult?.success || false,
        queryExecuted: testSQL,
        resultsFound: sqlResult?.data?.length || 0,
        sqlResponse: sqlResult
      };
      console.log(`[${debugId}] ✅ SQL execution test passed:`, sqlResult?.success);
    } catch (error) {
      debugResults.tests.sqlExecution = {
        success: false,
        error: error.message
      };
      console.log(`[${debugId}] ❌ SQL execution test failed:`, error.message);
    }

    // Test 5: Smart Query Planner
    console.log(`[${debugId}] Test 5: Smart Query Planner`);
    try {
      const plannerResponse = await supabaseClient.functions.invoke('smart-query-planner', {
        body: {
          message: testQuery,
          userId: userId,
          execute: false, // Just plan, don't execute
          userTimezone: 'UTC'
        }
      });
      
      if (plannerResponse.error) throw plannerResponse.error;
      
      debugResults.tests.smartQueryPlanner = {
        success: true,
        planGenerated: !!plannerResponse.data?.queryPlan,
        subQuestionsCount: plannerResponse.data?.queryPlan?.subQuestions?.length || 0,
        strategy: plannerResponse.data?.queryPlan?.strategy,
        confidence: plannerResponse.data?.queryPlan?.confidence
      };
      console.log(`[${debugId}] ✅ Smart query planner test passed`);
    } catch (error) {
      debugResults.tests.smartQueryPlanner = {
        success: false,
        error: error.message
      };
      console.log(`[${debugId}] ❌ Smart query planner test failed:`, error.message);
    }

    // Test 6: GPT Model (gpt-4.1-nano)
    console.log(`[${debugId}] Test 6: GPT Model Test`);
    try {
      const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini-2025-08-07',
          messages: [
            { role: 'system', content: 'You are a helpful assistant. Respond with a simple JSON object containing a "message" field.' },
            { role: 'user', content: 'Say hello in JSON format' }
          ],
          max_completion_tokens: 100
        }),
      });

      if (!gptResponse.ok) throw new Error(`GPT API error: ${gptResponse.status}`);
      
      const gptData = await gptResponse.json();
      const gptContent = gptData.choices[0].message.content;
      
      debugResults.tests.gptModel = {
        success: true,
        model: 'gpt-5-mini-2025-08-07',
        responseLength: gptContent?.length || 0,
        responsePreview: gptContent?.substring(0, 100)
      };
      console.log(`[${debugId}] ✅ GPT model test passed`);
    } catch (error) {
      debugResults.tests.gptModel = {
        success: false,
        error: error.message
      };
      console.log(`[${debugId}] ❌ GPT model test failed:`, error.message);
    }

    // Test 7: End-to-End RAG Pipeline Test
    console.log(`[${debugId}] Test 7: End-to-End Pipeline`);
    try {
      // First call smart-query-planner with execution
      const e2eResponse = await supabaseClient.functions.invoke('smart-query-planner', {
        body: {
          message: testQuery,
          userId: userId,
          execute: true,
          userTimezone: 'UTC'
        }
      });
      
      if (e2eResponse.error) throw e2eResponse.error;
      
      // Then call gpt-response-consolidator with the results
      const consolidatorResponse = await supabaseClient.functions.invoke('gpt-response-consolidator', {
        body: {
          userMessage: testQuery,
          researchResults: e2eResponse.data?.executionResult || [],
          conversationContext: [],
          userProfile: { timezone: 'UTC' }
        }
      });
      
      debugResults.tests.endToEndPipeline = {
        success: !consolidatorResponse.error,
        plannerSuccess: !e2eResponse.error,
        consolidatorSuccess: !consolidatorResponse.error,
        finalResponseGenerated: !!consolidatorResponse.data?.response,
        responseLength: consolidatorResponse.data?.response?.length || 0,
        plannerError: e2eResponse.error?.message,
        consolidatorError: consolidatorResponse.error?.message
      };
      console.log(`[${debugId}] ✅ End-to-end pipeline test completed`);
    } catch (error) {
      debugResults.tests.endToEndPipeline = {
        success: false,
        error: error.message
      };
      console.log(`[${debugId}] ❌ End-to-end pipeline test failed:`, error.message);
    }

    // Summary
    const passedTests = Object.values(debugResults.tests).filter((test: any) => test.success).length;
    const totalTests = Object.keys(debugResults.tests).length;
    
    console.log(`[${debugId}] SUMMARY: ${passedTests}/${totalTests} tests passed`);

    return new Response(JSON.stringify({
      debugId,
      summary: {
        testsPassedCount: passedTests,
        totalTestsCount: totalTests,
        overallSuccess: passedTests === totalTests
      },
      ...debugResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in debug RAG pipeline:', error);
    return new Response(JSON.stringify({
      error: error.message,
      debugFailed: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
