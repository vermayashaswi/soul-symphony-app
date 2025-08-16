
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced debugging for authentication and user context
async function debugAuthenticationContext(supabase: any, requestId: string): Promise<{
  userId: string | null;
  hasValidAuth: boolean;
  userEntryCount: number;
  authDetails: any;
}> {
  console.log(`[DEBUG AUTH] ${requestId}: Starting authentication verification`);
  
  try {
    // Get current user from JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log(`[DEBUG AUTH] ${requestId}: User verification: {
      hasUser: ${!!user},
      userId: "${user?.id?.substring(0, 8) || 'none'}",
      userError: ${userError?.message || 'undefined'}
    }`);

    if (!user) {
      return {
        userId: null,
        hasValidAuth: false,
        userEntryCount: 0,
        authDetails: { error: 'No authenticated user', userError: userError?.message }
      };
    }

    // Test RLS by attempting to access user's entries
    const { data: entriesTest, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id')
      .limit(1);

    console.log(`[DEBUG AUTH] ${requestId}: RLS test: {
      canAccessEntries: ${!entriesError && entriesTest?.length >= 0},
      entriesError: ${entriesError?.message || 'undefined'},
      sampleEntryFound: ${entriesTest?.length > 0}
    }`);

    // Get entry count for this user
    const { count, error: countError } = await supabase
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true });

    console.log(`[DEBUG AUTH] ${requestId}: Entry count check: { totalEntries: ${count}, countError: ${countError?.message || 'undefined'} }`);

    return {
      userId: user.id,
      hasValidAuth: true,
      userEntryCount: count || 0,
      authDetails: {
        email: user.email,
        rlsWorking: !entriesError,
        totalEntries: count || 0,
        authMethod: 'jwt_token'
      }
    };

  } catch (error) {
    console.error(`[DEBUG AUTH] ${requestId}: Authentication context error:`, error);
    return {
      userId: null,
      hasValidAuth: false,
      userEntryCount: 0,
      authDetails: { error: error.message, stage: 'exception_thrown' }
    };
  }
}

// Enhanced embedding generation with detailed logging and fallback handling
async function generateQueryEmbedding(query: string, openaiApiKey: string, requestId: string): Promise<number[] | null> {
  console.log(`📡 [EMBEDDING] ${requestId}: Generating embedding for query: "${query.substring(0, 100)}..."`);
  
  try {
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query.substring(0, 8000), // Prevent API errors from long input
        encoding_format: 'float'
      }),
    });

    console.log(`📡 [EMBEDDING] ${requestId}: OpenAI embedding response status: ${embeddingResponse.status}`);

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error(`❌ [EMBEDDING ERROR] ${requestId}: OpenAI API error:`, errorText);
      return null;
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData?.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding) || embedding.length !== 1536) {
      console.error(`❌ [EMBEDDING ERROR] ${requestId}: Invalid embedding format - length: ${embedding?.length}`);
      return null;
    }

    console.log(`✅ [EMBEDDING SUCCESS] ${requestId}: Generated ${embedding.length}-dimensional embedding`);
    return embedding;

  } catch (error) {
    console.error(`❌ [EMBEDDING ERROR] ${requestId}: Exception during embedding generation:`, error);
    return null;
  }
}

// Enhanced vector search execution with comprehensive debugging and fallback mechanisms
async function executeVectorSearch(
  supabase: any, 
  userId: string, 
  queryEmbedding: number[], 
  subQuestion: string,
  requestId: string,
  timeRange?: { start: string; end: string }
): Promise<{
  vectorResults: any[];
  vectorDebugInfo: any;
}> {
  console.log(`🔍 [VECTOR SEARCH] ${requestId}: Starting vector search for: "${subQuestion.substring(0, 50)}..."`);
  
  const debugInfo = {
    standardSearch: { success: false, resultCount: 0, error: null },
    timeFilteredSearch: { success: false, resultCount: 0, error: null },
    embeddingTableCheck: { exists: false, totalEmbeddings: 0 },
    thresholdTesting: { results: [] },
    fallbackAttempts: [],
    errors: []
  };

  try {
    // First, check if embeddings table has data
    console.log(`📊 [VECTOR DEBUG] ${requestId}: Checking embedding table status...`);
    
    const { count: embeddingCount, error: countError } = await supabase
      .from('journal_embeddings')
      .select('*', { count: 'exact', head: true });

    debugInfo.embeddingTableCheck = {
      exists: !countError,
      totalEmbeddings: embeddingCount || 0
    };

    console.log(`📊 [VECTOR DEBUG] ${requestId}: Embedding table status: ${embeddingCount || 0} total embeddings, error: ${countError?.message || 'none'}`);

    if (countError || embeddingCount === 0) {
      debugInfo.errors.push(`No embeddings available: ${countError?.message || 'Empty table'}`);
      console.warn(`⚠️ [VECTOR WARNING] ${requestId}: No embeddings available for vector search`);
      
      // Attempt text-based fallback
      try {
        console.log(`🔄 [FALLBACK] ${requestId}: Attempting text-based search fallback`);
        const { data: textResults, error: textError } = await supabase
          .from('Journal Entries')
          .select('id, "refined text", "transcription text", created_at, master_themes, emotions')
          .textSearch('"refined text"', subQuestion.split(' ').join(' | '), { 
            type: 'websearch', 
            config: 'english' 
          })
          .limit(5);

        if (!textError && textResults?.length > 0) {
          debugInfo.fallbackAttempts.push({ method: 'text_search', count: textResults.length });
          console.log(`✅ [FALLBACK SUCCESS] ${requestId}: Text search found ${textResults.length} results`);
          return { vectorResults: textResults, vectorDebugInfo: debugInfo };
        }
      } catch (fallbackError) {
        debugInfo.fallbackAttempts.push({ method: 'text_search', error: fallbackError.message });
        console.warn(`⚠️ [FALLBACK FAILED] ${requestId}: Text search fallback failed:`, fallbackError);
      }
      
      return { vectorResults: [], vectorDebugInfo: debugInfo };
    }

    // Test different similarity thresholds with dynamic adjustment
    const thresholds = [0.7, 0.6, 0.5, 0.4, 0.3];
    let bestResults = [];
    let bestThreshold = 0.3;
    
    for (const threshold of thresholds) {
      try {
        console.log(`🎯 [VECTOR TEST] ${requestId}: Testing threshold ${threshold}...`);
        
        const { data: testResults, error: testError } = await supabase.rpc('match_journal_entries', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: 5,
          user_id_filter: userId
        });

        const resultCount = testResults?.length || 0;
        debugInfo.thresholdTesting.results.push({
          threshold,
          count: resultCount,
          success: !testError,
          error: testError?.message
        });

        console.log(`🎯 [VECTOR TEST] ${requestId}: Threshold ${threshold} returned ${resultCount} results, error: ${testError?.message || 'none'}`);
        
        if (!testError && resultCount > 0) {
          bestResults = testResults;
          bestThreshold = threshold;
          if (resultCount >= 3) break; // Good enough results found
        }
      } catch (thresholdError) {
        console.error(`❌ [VECTOR TEST ERROR] ${requestId}: Threshold ${threshold} failed:`, thresholdError);
        debugInfo.thresholdTesting.results.push({
          threshold,
          count: 0,
          success: false,
          error: thresholdError.message
        });
      }
    }

    // Use best results found
    if (bestResults.length > 0) {
      debugInfo.standardSearch = {
        success: true,
        resultCount: bestResults.length,
        error: null,
        bestThreshold
      };
      console.log(`✅ [VECTOR SUCCESS] ${requestId}: Using threshold ${bestThreshold} with ${bestResults.length} results`);
    }

    // Time-filtered search (if time range provided and we have good results)
    let timeFilteredResults = [];
    if (timeRange && bestResults.length > 0) {
      console.log(`⏰ [VECTOR TIME] ${requestId}: Executing time-filtered search for range: ${timeRange.start} to ${timeRange.end}`);
      
      try {
        const { data: timeResults, error: timeError } = await supabase.rpc('match_journal_entries_with_date', {
          query_embedding: queryEmbedding,
          match_threshold: bestThreshold,
          match_count: 10,
          user_id_filter: userId,
          start_date: timeRange.start,
          end_date: timeRange.end
        });

        debugInfo.timeFilteredSearch = {
          success: !timeError,
          resultCount: timeResults?.length || 0,
          error: timeError?.message || null
        };

        console.log(`⏰ [VECTOR TIME] ${requestId}: Time-filtered search returned ${timeResults?.length || 0} results, error: ${timeError?.message || 'none'}`);

        if (!timeError && timeResults?.length > 0) {
          timeFilteredResults = timeResults;
        }
      } catch (timeError) {
        debugInfo.timeFilteredSearch = {
          success: false,
          resultCount: 0,
          error: timeError.message
        };
        console.error(`❌ [VECTOR TIME ERROR] ${requestId}: Time-filtered search failed:`, timeError);
      }
    }

    // Combine and deduplicate results
    const allResults = [...bestResults, ...timeFilteredResults];
    const uniqueResults = allResults.filter((result, index, self) => 
      index === self.findIndex(r => r.id === result.id)
    );

    console.log(`✅ [VECTOR COMPLETE] ${requestId}: Combined ${allResults.length} total results into ${uniqueResults.length} unique results`);

    return {
      vectorResults: uniqueResults,
      vectorDebugInfo: debugInfo
    };

  } catch (error) {
    console.error(`❌ [VECTOR ERROR] ${requestId}: Exception in vector search:`, error);
    debugInfo.errors.push(`Vector search exception: ${error.message}`);
    
    return {
      vectorResults: [],
      vectorDebugInfo: debugInfo
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = `planner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // FIXED: Use ANON_KEY instead of SERVICE_ROLE_KEY for proper RLS authentication
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', // Changed from SERVICE_ROLE_KEY
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      }
    );

    const requestBody = await req.json();
    const { 
      message, 
      userId, 
      execute = false, 
      conversationContext = [], 
      timeRange = null, 
      threadId, 
      messageId,
      isFollowUp = false 
    } = requestBody;

    console.log(`\n🎬 [REQUEST START] ${requestId}: {
      message: "${message}",
      userId: "${userId?.substring(0, 8)}",
      execute: ${execute},
      timestamp: "${new Date().toISOString()}",
      contextLength: ${conversationContext?.length || 0},
      timeRange: ${timeRange ? 'provided' : 'null'},
      threadId: "${threadId?.substring(0, 8)}",
      messageId: ${messageId || 'undefined'},
      isFollowUp: ${isFollowUp}
    }`);

    // Enhanced authentication debugging with proper error handling
    const authContext = await debugAuthenticationContext(supabase, requestId);
    
    console.log(`🔐 [AUTH DEBUG] ${requestId}: {
      userId: "${authContext.userId?.substring(0, 36) || 'none'}",
      hasValidAuth: ${authContext.hasValidAuth},
      userEntryCount: ${authContext.userEntryCount},
      authDetails: ${JSON.stringify(authContext.authDetails)}
    }`);

    if (!authContext.hasValidAuth || !authContext.userId) {
      console.error(`❌ [AUTH ERROR] ${requestId}: Authentication failed`);
      return new Response(JSON.stringify({
        error: 'Authentication required',
        details: 'User must be logged in to access journal entries',
        authDebug: authContext,
        requestId
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 [USER CONTEXT] ${requestId}: User has ${authContext.userEntryCount} journal entries`);

    // Get OpenAI API key with validation
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error(`❌ [CONFIG ERROR] ${requestId}: OpenAI API key not configured`);
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured',
        details: 'Server configuration issue - missing API key',
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Enhanced analyst agent with improved error handling and fallbacks
    const analystSystemPrompt = `You are an intelligent query analyst for a personal journaling system. Analyze user queries and create optimal execution plans.

**MANDATORY VECTOR SEARCH RULE**: If the user query asks about things like common topics, areas of life, themes, events, or anything subjective, please consider generating a vector search related sub-query too mandatorily.

**AVAILABLE DATA STRUCTURES:**
- Journal Entries: content, emotions (jsonb), master_themes (text[]), entities (jsonb), created_at
- Vector embeddings: semantic similarity search for content
- SQL analytics: aggregations, statistics, time-based analysis

**ANALYSIS GUIDELINES:**
- For subjective queries (topics, themes, life areas, events): ALWAYS include vector search component
- For statistical queries: Use SQL with potential vector enhancement
- For time-based queries: Use appropriate date filtering
- For entity/emotion analysis: Use targeted searches
- If no data available: Provide helpful guidance on journaling

**RESPONSE FORMAT:** JSON with queryType, strategy, subQuestions array, and detailed execution steps.

User context: ${authContext.userEntryCount} total journal entries.
Current query: "${message}"

Provide a comprehensive analysis plan with both SQL and vector components when the query involves subjective content.`;

    // Generate query analysis with improved error handling
    console.log(`🤖 [ANALYST AGENT] ${requestId}: Generating query analysis plan...`);

    const analystMessages = [
      { role: 'system', content: analystSystemPrompt },
      { role: 'user', content: message }
    ];

    if (conversationContext.length > 0) {
      console.log(`[Analyst Agent] Context preview: ${conversationContext.slice(-2).map(m => `${m.role}: ${m.content.substring(0, 50)}`).join('; ')}`);
    }

    // Query analysis detection with enhanced pattern matching
    const hasPersonalPronouns = /\b(i|me|my|mine|myself|am i|do i|how am i|how do i|what makes me|how was i)\b/i.test(message.toLowerCase());
    const hasExplicitTimeReference = /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night|when|since|august|july|september|october)\b/i.test(message.toLowerCase());
    const isContentSeekingQuery = /\b(show me|tell me about|what did i|entries about|journal about|wrote about|mentioned|discussed|topics|themes)\b/i.test(message.toLowerCase());
    const isFollowUpQuestion = /\b(also|additionally|what about|and|furthermore|moreover)\b/i.test(message.toLowerCase()) && conversationContext.length > 0;

    console.log(`[Analyst Agent] Query analysis - Personal pronouns: ${hasPersonalPronouns}, Time reference: ${hasExplicitTimeReference}, Content-seeking: ${isContentSeekingQuery}, Follow-up: ${isFollowUpQuestion}`);

    let analystResponse;
    try {
      analystResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: analystMessages,
          max_tokens: 2000,
          temperature: 0.3
        }),
      });

      if (!analystResponse.ok) {
        const errorText = await analystResponse.text();
        console.error(`❌ [ANALYST ERROR] ${requestId}: OpenAI API error:`, errorText);
        throw new Error(`Analyst agent failed: ${analystResponse.status} - ${errorText}`);
      }
    } catch (fetchError) {
      console.error(`❌ [ANALYST FETCH ERROR] ${requestId}: Failed to call OpenAI:`, fetchError);
      throw new Error(`Network error calling analyst agent: ${fetchError.message}`);
    }

    const analystData = await analystResponse.json();
    const analystContent = analystData.choices[0]?.message?.content;

    if (!analystContent) {
      throw new Error('Empty response from analyst agent');
    }

    console.log(`Analyst Agent response: ${analystContent.substring(0, 200)}...`);

    // Parse analyst response with better error handling
    let queryPlan;
    try {
      // Extract JSON from the response
      const jsonMatch = analystContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(`❌ [PARSE ERROR] ${requestId}: No JSON found in analyst response`);
        throw new Error('No JSON found in analyst response');
      }
      queryPlan = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error(`❌ [PARSE ERROR] ${requestId}: Failed to parse analyst response:`, parseError);
      
      // Fallback query plan
      queryPlan = {
        queryType: "content_search",
        strategy: "hybrid_search",
        subQuestions: [{
          question: message,
          searchStrategy: ["vector", "sql"],
          analysisSteps: [{
            step: 1,
            description: "Fallback content search",
            queryType: "sql_analysis",
            vectorSearch: true,
            sqlQuery: `SELECT id, "refined text", "transcription text", created_at, master_themes FROM "Journal Entries" WHERE user_id = $user_id ORDER BY created_at DESC LIMIT 10`
          }],
          executionStage: 1
        }]
      };
    }

    console.log(`Final Analyst Plan: ${JSON.stringify(queryPlan, null, 2)}`);

    // If not executing, return the plan
    if (!execute) {
      return new Response(JSON.stringify({
        queryPlan,
        execute: false,
        planningComplete: true,
        authContext: {
          userId: authContext.userId,
          entryCount: authContext.userEntryCount
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Execute the query plan with enhanced error handling
    const executionRequestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`\n🚀 [EXECUTION START] ${executionRequestId}: {
      userId: "${authContext.userId.substring(0, 8)}...",
      timeRange: ${timeRange ? 'provided' : 'null'},
      planType: "${queryPlan.queryType}",
      subQuestionCount: ${queryPlan.subQuestions?.length || 0},
      firstQuestion: "${queryPlan.subQuestions?.[0]?.question?.substring(0, 50) || 'none'}..."
    }`);

    // Generate embedding for vector searches with fallback handling
    let queryEmbedding = null;
    const needsEmbedding = queryPlan.subQuestions?.some(sq => 
      sq.searchStrategy?.includes('vector') || 
      sq.analysisSteps?.some(step => step.vectorSearch)
    );

    if (needsEmbedding) {
      queryEmbedding = await generateQueryEmbedding(message, openaiApiKey, executionRequestId);
      if (!queryEmbedding) {
        console.warn(`⚠️ [EMBEDDING WARNING] ${executionRequestId}: Failed to generate embedding, vector searches will use fallback methods`);
      }
    }

    // Execute sub-questions with improved error handling
    const researchResults = [];
    
    // Group sub-questions by execution stage
    const stageGroups = {};
    for (const subQ of queryPlan.subQuestions || []) {
      const stage = subQ.executionStage || 1;
      if (!stageGroups[stage]) stageGroups[stage] = [];
      stageGroups[stage].push(subQ);
    }

    const stages = Object.keys(stageGroups).sort((a, b) => parseInt(a) - parseInt(b));
    console.log(`🔄 [EXECUTION PLAN] Processing ${queryPlan.subQuestions?.length || 0} sub-questions across stages: ${stages.join(', ')}`);

    for (const stage of stages) {
      const stageQuestions = stageGroups[stage];
      console.log(`🔄 [STAGE ${stage}] Executing ${stageQuestions.length} sub-questions in parallel`);
      
      const stagePromises = stageQuestions.map(async (subQuestion) => {
        const subRequestId = `${executionRequestId}_${Math.random().toString(36).substr(2, 6)}`;
        
        console.log(`🎯 [SUB-QUESTION] Processing: ${subQuestion.question}`);

        const executionResults = {
          vectorResults: [],
          sqlResults: [],
          vectorDebugInfo: null,
          errors: []
        };

        // Execute analysis steps with comprehensive error handling
        for (const step of subQuestion.analysisSteps || []) {
          console.log(`⚡ [STEP] Executing step ${step.step}: ${step.description}`);

          // SQL execution with better error handling
          if (step.queryType === 'sql_analysis' && step.sqlQuery) {
            try {
              let finalSql = step.sqlQuery;
              const stepTimeRange = step.timeRange || timeRange;
              
              // Replace user_id placeholder
              finalSql = finalSql.replace(/\$user_id/g, `'${authContext.userId}'::uuid`);
              
              console.log(`📊 [SQL EXECUTION] ${subRequestId}: {
                originalQuery: \`${step.sqlQuery.substring(0, 100)}...\`,
                timeRange: ${stepTimeRange ? JSON.stringify(stepTimeRange) : 'null'},
                userId: "${authContext.userId.substring(0, 8)}..."
              }`);

              const { data: sqlData, error: sqlError } = await supabase.rpc('execute_dynamic_query', {
                query_text: finalSql
              });

              if (sqlError) {
                console.error(`❌ [SQL ERROR] ${subRequestId}: SQL execution failed:`, sqlError);
                executionResults.errors.push(`SQL Error: ${sqlError.message}`);
                executionResults.sqlResults = [];
              } else {
                const results = sqlData?.data || [];
                executionResults.sqlResults = results;
                
                console.log(`✅ [SQL SUCCESS] ${subRequestId}: {
                  rowCount: ${results.length},
                  sampleData: ${JSON.stringify(results.slice(0, 1))}
                }`);
              }
            } catch (sqlException) {
              console.error(`❌ [SQL EXCEPTION] ${subRequestId}: SQL execution exception:`, sqlException);
              executionResults.errors.push(`SQL Exception: ${sqlException.message}`);
              executionResults.sqlResults = [];
            }
          }

          // Vector search execution with enhanced error handling
          if (step.vectorSearch) {
            if (queryEmbedding) {
              try {
                const vectorSearchResult = await executeVectorSearch(
                  supabase, 
                  authContext.userId, 
                  queryEmbedding, 
                  subQuestion.question,
                  subRequestId,
                  step.timeRange || timeRange
                );
                
                executionResults.vectorResults = vectorSearchResult.vectorResults;
                executionResults.vectorDebugInfo = vectorSearchResult.vectorDebugInfo;
              } catch (vectorError) {
                console.error(`❌ [VECTOR ERROR] ${subRequestId}: Vector search failed:`, vectorError);
                executionResults.errors.push(`Vector Error: ${vectorError.message}`);
                executionResults.vectorResults = [];
              }
            } else {
              console.warn(`⚠️ [VECTOR SKIP] ${subRequestId}: Skipping vector search - no embedding available`);
              executionResults.errors.push('Vector search skipped - no embedding generated');
            }
          }
        }

        console.log(`📋 [SUB-QUESTION RESULTS] SQL rows: ${executionResults.sqlResults.length}, Vector entries: ${executionResults.vectorResults.length}, Errors: ${executionResults.errors.length}`);

        return {
          subQuestion,
          executionResults
        };
      });

      const stageResults = await Promise.all(stagePromises);
      researchResults.push(...stageResults);
    }

    console.log(`🏁 [EXECUTION COMPLETE] ${executionRequestId}: {
      totalSubQuestions: ${researchResults.length},
      stages: ${stages.length},
      successfulQuestions: ${researchResults.filter(r => r.executionResults.sqlResults.length > 0 || r.executionResults.vectorResults.length > 0).length},
      timeRange: ${timeRange ? 'applied' : 'null'},
      vectorDebugAvailable: ${researchResults.some(r => r.executionResults.vectorDebugInfo) ? 'true' : 'false'}
    }`);

    console.log(`🎉 [REQUEST COMPLETE] ${requestId}: Returning results with ${researchResults.length} research results`);

    return new Response(JSON.stringify({
      queryPlan,
      researchResults,
      executionMetadata: {
        requestId,
        executionRequestId,
        totalStages: stages.length,
        totalSubQuestions: researchResults.length,
        authContext: {
          userId: authContext.userId,
          entryCount: authContext.userEntryCount,
          authMethod: 'anon_key_with_jwt'
        },
        embeddingGenerated: !!queryEmbedding,
        timestamp: new Date().toISOString(),
        successRate: researchResults.filter(r => 
          r.executionResults.sqlResults.length > 0 || r.executionResults.vectorResults.length > 0
        ).length / Math.max(researchResults.length, 1)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [REQUEST ERROR] ${requestId}: Unhandled error:`, error);
    return new Response(JSON.stringify({
      error: 'Query planning failed',
      details: error.message,
      requestId,
      timestamp: new Date().toISOString(),
      fallback: 'The system encountered an error while processing your request. Please try again or rephrase your question.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
