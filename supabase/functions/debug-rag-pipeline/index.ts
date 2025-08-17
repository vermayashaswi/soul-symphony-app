
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
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    console.log("Starting RAG pipeline debug test with query:", testQuery);
    
    const debugResults = {
      timestamp: new Date().toISOString(),
      testQuery,
      userId,
      steps: {}
    };

    // Step 1: Test database connectivity and journal entries
    try {
      const { data: entries, error: entriesError } = await supabaseClient
        .from('Journal Entries')
        .select('id, "refined text", "transcription text", created_at, emotions, master_themes')
        .eq('user_id', userId)
        .limit(5);

      debugResults.steps.database = {
        success: !entriesError,
        error: entriesError?.message,
        entryCount: entries?.length || 0,
        sampleEntries: entries?.map(e => ({
          id: e.id,
          hasContent: !!(e["refined text"] || e["transcription text"]),
          hasEmotions: !!e.emotions,
          hasThemes: !!e.master_themes,
          createdAt: e.created_at
        })) || []
      };
    } catch (dbError) {
      debugResults.steps.database = {
        success: false,
        error: dbError.message
      };
    }

    // Step 2: Test embedding generation
    try {
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: testQuery,
        }),
      });

      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json();
        debugResults.steps.embedding = {
          success: true,
          embeddingLength: embeddingData.data[0].embedding.length
        };
      } else {
        debugResults.steps.embedding = {
          success: false,
          error: `HTTP ${embeddingResponse.status}: ${await embeddingResponse.text()}`
        };
      }
    } catch (embError) {
      debugResults.steps.embedding = {
        success: false,
        error: embError.message
      };
    }

    // Step 3: Test vector search
    if (debugResults.steps.embedding?.success) {
      try {
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: testQuery,
          }),
        });
        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        const { data: vectorResults, error: vectorError } = await supabaseClient.rpc('match_journal_entries', {
          query_embedding: embedding,
          match_threshold: 0.3,
          match_count: 5,
          user_id_filter: userId
        });

        debugResults.steps.vectorSearch = {
          success: !vectorError,
          error: vectorError?.message,
          resultCount: vectorResults?.length || 0,
          sampleResults: vectorResults?.slice(0, 2).map(r => ({
            id: r.id,
            similarity: r.similarity,
            hasContent: !!r.content
          })) || []
        };
      } catch (vectorError) {
        debugResults.steps.vectorSearch = {
          success: false,
          error: vectorError.message
        };
      }
    }

    // Step 4: Test SQL execution
    try {
      const { data: sqlResult, error: sqlError } = await supabaseClient.rpc('execute_dynamic_query', {
        query_text: `SELECT id, "refined text", created_at FROM "Journal Entries" WHERE user_id = '${userId}' ORDER BY created_at DESC LIMIT 3`
      });

      debugResults.steps.sqlExecution = {
        success: !sqlError && sqlResult?.success,
        error: sqlError?.message || (!sqlResult?.success ? 'Query execution failed' : null),
        resultCount: sqlResult?.data?.length || 0
      };
    } catch (sqlError) {
      debugResults.steps.sqlExecution = {
        success: false,
        error: sqlError.message
      };
    }

    // Step 5: Test smart-query-planner
    try {
      const plannerResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/smart-query-planner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization')!,
        },
        body: JSON.stringify({
          message: testQuery,
          userId: userId,
          execute: true,
          userTimezone: 'UTC'
        }),
      });

      if (plannerResponse.ok) {
        const plannerData = await plannerResponse.json();
        debugResults.steps.smartQueryPlanner = {
          success: true,
          hasQueryPlan: !!plannerData.queryPlan,
          hasExecutionResult: !!plannerData.executionResult,
          subQuestionCount: plannerData.queryPlan?.subQuestions?.length || 0,
          totalVectorResults: plannerData.executionResult?.reduce((sum, r) => sum + (r.executionResults?.vectorResults?.length || 0), 0) || 0,
          totalSqlResults: plannerData.executionResult?.reduce((sum, r) => sum + (r.executionResults?.sqlResults?.length || 0), 0) || 0
        };
      } else {
        debugResults.steps.smartQueryPlanner = {
          success: false,
          error: `HTTP ${plannerResponse.status}: ${await plannerResponse.text()}`
        };
      }
    } catch (plannerError) {
      debugResults.steps.smartQueryPlanner = {
        success: false,
        error: plannerError.message
      };
    }

    // Step 6: Test GPT-4.1-nano response
    try {
      const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-nano',
          messages: [
            { role: 'system', content: 'You are a helpful assistant. Respond with a simple JSON object.' },
            { role: 'user', content: 'Return JSON: {"test": "success", "message": "This is a test response"}' }
          ],
          max_tokens: 100,
          temperature: 0.3
        }),
      });

      if (gptResponse.ok) {
        const gptData = await gptResponse.json();
        const responseContent = gptData.choices[0]?.message?.content || '';
        debugResults.steps.gptModel = {
          success: true,
          responseLength: responseContent.length,
          canParseJson: (() => {
            try {
              JSON.parse(responseContent);
              return true;
            } catch {
              return false;
            }
          })()
        };
      } else {
        debugResults.steps.gptModel = {
          success: false,
          error: `HTTP ${gptResponse.status}: ${await gptResponse.text()}`
        };
      }
    } catch (gptError) {
      debugResults.steps.gptModel = {
        success: false,
        error: gptError.message
      };
    }

    // Generate summary
    const successfulSteps = Object.values(debugResults.steps).filter(step => step.success).length;
    const totalSteps = Object.keys(debugResults.steps).length;
    
    debugResults.summary = {
      overallHealth: successfulSteps === totalSteps ? 'HEALTHY' : 'ISSUES_DETECTED',
      successfulSteps,
      totalSteps,
      criticalIssues: Object.entries(debugResults.steps)
        .filter(([_, step]) => !step.success)
        .map(([name, step]) => ({ step: name, error: step.error }))
    };

    return new Response(JSON.stringify(debugResults, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in debug RAG pipeline:', error);
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
