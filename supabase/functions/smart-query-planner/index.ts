import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { 
  generateDatabaseSchemaContext, 
  getEmotionAnalysisGuidelines, 
  getThemeAnalysisGuidelines 
} from '../_shared/databaseSchemaContext.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryPlan {
  strategy: string;
  searchMethods: string[];
  filters: any;
  emotionFocus?: string;
  timeRange?: any;
  subQueries?: string[];
  expectedResponseType: string;
  confidence: number;
  reasoning: string;
  databaseContext: string;
}

// Enhanced vector search debugging function
async function debugVectorSearch(supabaseClient: any, userId: string, requestId: string) {
  console.log(`[${requestId}] Starting vector search debugging for user: ${userId}`);
  
  try {
    // Check if user has any journal entries
    const { data: entries, error: entriesError } = await supabaseClient
      .from('Journal Entries')
      .select('id, created_at, user_id')
      .eq('user_id', userId)
      .limit(5);
    
    if (entriesError) {
      console.error(`[${requestId}] Error fetching entries:`, entriesError);
      return { hasEntries: false, error: entriesError.message };
    }
    
    console.log(`[${requestId}] Found ${entries?.length || 0} journal entries for user`);
    
    if (!entries || entries.length === 0) {
      return { hasEntries: false, message: 'No journal entries found' };
    }
    
    // Check if user has any embeddings
    const { data: embeddings, error: embeddingsError } = await supabaseClient
      .from('journal_embeddings')
      .select('id, journal_entry_id, created_at')
      .in('journal_entry_id', entries.map(e => e.id))
      .limit(5);
    
    if (embeddingsError) {
      console.error(`[${requestId}] Error fetching embeddings:`, embeddingsError);
      return { hasEntries: true, hasEmbeddings: false, error: embeddingsError.message };
    }
    
    console.log(`[${requestId}] Found ${embeddings?.length || 0} embeddings for user entries`);
    
    return {
      hasEntries: true,
      entriesCount: entries.length,
      hasEmbeddings: embeddings && embeddings.length > 0,
      embeddingsCount: embeddings?.length || 0,
      sampleEntryIds: entries.slice(0, 3).map(e => e.id)
    };
    
  } catch (error) {
    console.error(`[${requestId}] Debug vector search error:`, error);
    return { hasEntries: false, error: error.message };
  }
}

// Enhanced vector search execution with comprehensive debugging
async function executeVectorSearchWithDebug(step: any, userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] ================ ENHANCED VECTOR SEARCH DEBUG START ================`);
  
  try {
    const queryText = step.vectorSearch.query;
    console.log(`[${requestId}] Query text: "${queryText}"`);
    console.log(`[${requestId}] User ID: ${userId}`);
    
    // Generate embedding with detailed validation
    console.log(`[${requestId}] Generating embedding for query...`);
    const embedding = await generateEmbedding(queryText);
    
    if (!embedding || !Array.isArray(embedding)) {
      console.error(`[${requestId}] ❌ CRITICAL: Invalid embedding generated:`, typeof embedding);
      throw new Error('Failed to generate valid embedding');
    }
    
    // Comprehensive embedding validation
    console.log(`[${requestId}] ✅ Embedding generated successfully:`);
    console.log(`[${requestId}] - Dimensions: ${embedding.length}`);
    console.log(`[${requestId}] - Expected dimensions: 1536`);
    console.log(`[${requestId}] - Dimensions match: ${embedding.length === 1536 ? '✅ YES' : '❌ NO'}`);
    console.log(`[${requestId}] - Sample values: [${embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`);
    console.log(`[${requestId}] - All values are numbers: ${embedding.every(n => typeof n === 'number' && !isNaN(n)) ? '✅ YES' : '❌ NO'}`);
    console.log(`[${requestId}] - Min value: ${Math.min(...embedding).toFixed(4)}`);
    console.log(`[${requestId}] - Max value: ${Math.max(...embedding).toFixed(4)}`);
    console.log(`[${requestId}] - Has infinite values: ${embedding.some(n => !isFinite(n)) ? '❌ YES' : '✅ NO'}`);
    
    // Enhanced database call with optimized threshold
    const debugThreshold = 0.3; // Updated threshold to 0.3 as requested
    const debugLimit = 20; // More results for analysis
    
    console.log(`[${requestId}] Calling match_journal_entries with ENHANCED debugging:`);
    console.log(`[${requestId}] - Function: match_journal_entries`);
    console.log(`[${requestId}] - query_embedding: [Array of ${embedding.length} numbers]`);
    console.log(`[${requestId}] - match_threshold: ${debugThreshold}`);
    console.log(`[${requestId}] - match_count: ${debugLimit}`);
    console.log(`[${requestId}] - user_id_filter: "${userId}"`);
    console.log(`[${requestId}] - user_id_filter type: ${typeof userId}`);
    
    // Test database connectivity first
    console.log(`[${requestId}] Testing database connectivity...`);
    const { data: healthCheck, error: healthError } = await supabaseClient
      .from('Journal Entries')
      .select('count')
      .eq('user_id', userId)
      .limit(1);
    
    if (healthError) {
      console.error(`[${requestId}] ❌ Database connectivity failed:`, healthError);
    } else {
      console.log(`[${requestId}] ✅ Database connectivity confirmed`);
    }
    
    // Execute vector search with detailed error handling
    console.log(`[${requestId}] Executing vector search...`);
    const startTime = Date.now();
    
    // Choose correct RPC function based on time range
    let rpcFunctionName = 'match_journal_entries';
    let rpcParams: any = {
      query_embedding: embedding,
      match_threshold: debugThreshold,
      match_count: debugLimit,
      user_id_filter: userId
    };
    
    // Use time-based function if timeRange is provided
    if (step.timeRange && step.timeRange.start && step.timeRange.end) {
      rpcFunctionName = 'match_journal_entries_with_date';
      rpcParams.start_date = step.timeRange.start;
      rpcParams.end_date = step.timeRange.end;
      console.log(`[${requestId}] Using time-based search with range: ${step.timeRange.start} to ${step.timeRange.end}`);
    }
    
    console.log(`[${requestId}] Calling RPC function: ${rpcFunctionName}`);
    console.log(`[${requestId}] With parameters:`, Object.keys(rpcParams));
    
    const { data, error } = await supabaseClient.rpc(rpcFunctionName, rpcParams);
    
    const executionTime = Date.now() - startTime;
    console.log(`[${requestId}] Vector search execution time: ${executionTime}ms`);
    
    if (error) {
      console.error(`[${requestId}] ❌ VECTOR SEARCH RPC ERROR:`);
      console.error(`[${requestId}] - Error code: ${error.code}`);
      console.error(`[${requestId}] - Error message: ${error.message}`);
      console.error(`[${requestId}] - Error hint: ${error.hint || 'none'}`);
      console.error(`[${requestId}] - Error details:`, JSON.stringify(error.details || {}, null, 2));
      
      // Test if the RPC function exists
      console.log(`[${requestId}] Testing if match_journal_entries function exists...`);
      const { data: functions, error: funcError } = await supabaseClient
        .rpc('version'); // Test with a known function
      
      if (funcError) {
        console.error(`[${requestId}] ❌ Cannot test RPC functions:`, funcError);
      } else {
        console.log(`[${requestId}] ✅ RPC system is working`);
      }
      
      throw error;
    }
    
    console.log(`[${requestId}] ✅ Vector search completed successfully:`);
    console.log(`[${requestId}] - Results count: ${data?.length || 0}`);
    console.log(`[${requestId}] - Data type: ${typeof data}`);
    console.log(`[${requestId}] - Is array: ${Array.isArray(data)}`);
    
    if (data && data.length > 0) {
      console.log(`[${requestId}] 📊 DETAILED RESULTS ANALYSIS:`);
      
      const similarities = data.map(r => r.similarity).filter(s => s !== undefined);
      console.log(`[${requestId}] - Similarity scores: [${similarities.map(s => s.toFixed(4)).join(', ')}]`);
      console.log(`[${requestId}] - Highest similarity: ${Math.max(...similarities).toFixed(4)}`);
      console.log(`[${requestId}] - Lowest similarity: ${Math.min(...similarities).toFixed(4)}`);
      console.log(`[${requestId}] - Average similarity: ${(similarities.reduce((a, b) => a + b, 0) / similarities.length).toFixed(4)}`);
      
      data.slice(0, 5).forEach((result, idx) => {
        console.log(`[${requestId}]   📄 Result ${idx + 1}:`);
        console.log(`[${requestId}]     - Entry ID: ${result.id}`);
        console.log(`[${requestId}]     - Similarity: ${(result.similarity || 0).toFixed(4)}`);
        console.log(`[${requestId}]     - Created: ${result.created_at}`);
        console.log(`[${requestId}]     - Content length: ${(result.content || '').length}`);
        console.log(`[${requestId}]     - Content preview: "${(result.content || '').substring(0, 100)}..."`);
        console.log(`[${requestId}]     - Has embedding in result: ${!!result.embedding}`);
        console.log(`[${requestId}]     - Themes: ${(result.themes || []).join(', ')}`);
        
        if (result.emotions) {
          const emotionKeys = Object.keys(result.emotions);
          console.log(`[${requestId}]     - Emotions: ${emotionKeys.slice(0, 3).join(', ')}${emotionKeys.length > 3 ? '...' : ''}`);
        }
      });
      
    } else {
      console.warn(`[${requestId}] ⚠️ NO VECTOR SEARCH RESULTS - DIAGNOSTIC ANALYSIS:`);
      
      // Run comprehensive diagnostics
      await runVectorSearchDiagnostics(supabaseClient, userId, requestId, embedding);
    }
    
    console.log(`[${requestId}] ================ ENHANCED VECTOR SEARCH DEBUG END ================`);
    return data || [];

  } catch (error) {
    console.error(`[${requestId}] ================ VECTOR SEARCH CRITICAL ERROR ================`);
    console.error(`[${requestId}] ❌ Vector search execution failed:`, error);
    console.error(`[${requestId}] - Error type: ${error.constructor.name}`);
    console.error(`[${requestId}] - Error message: ${error.message}`);
    console.error(`[${requestId}] - Error stack:`, error.stack);
    console.error(`[${requestId}] ================ VECTOR SEARCH ERROR END ================`);
    throw error;
  }
}

// Comprehensive diagnostics function
async function runVectorSearchDiagnostics(supabaseClient: any, userId: string, requestId: string, queryEmbedding: number[]) {
  console.log(`[${requestId}] 🔍 RUNNING COMPREHENSIVE VECTOR SEARCH DIAGNOSTICS`);
  
  try {
    // 1. Check if user has journal entries
    const { data: entries, error: entriesError } = await supabaseClient
      .from('Journal Entries')
      .select('id, created_at, user_id')
      .eq('user_id', userId)
      .limit(10);
    
    if (entriesError) {
      console.error(`[${requestId}] ❌ Error fetching entries:`, entriesError);
      return;
    }
    
    console.log(`[${requestId}] 📊 Found ${entries?.length || 0} journal entries for user`);
    
    if (!entries || entries.length === 0) {
      console.warn(`[${requestId}] ⚠️ ROOT CAUSE: User has no journal entries`);
      return;
    }
    
    // 2. Check embeddings for these entries
    const entryIds = entries.map(e => e.id);
    const { data: embeddings, error: embeddingsError } = await supabaseClient
      .from('journal_embeddings')
      .select('id, journal_entry_id, created_at, embedding')
      .in('journal_entry_id', entryIds)
      .limit(10);
    
    if (embeddingsError) {
      console.error(`[${requestId}] ❌ Error fetching embeddings:`, embeddingsError);
      return;
    }
    
    console.log(`[${requestId}] 📊 Found ${embeddings?.length || 0} embeddings for user entries`);
    
    if (!embeddings || embeddings.length === 0) {
      console.warn(`[${requestId}] ⚠️ ROOT CAUSE: User entries have no embeddings`);
      return;
    }
    
    // 3. Test embedding dimensions and compatibility
    if (embeddings[0]?.embedding) {
      const storedEmbedding = embeddings[0].embedding;
      console.log(`[${requestId}] 🔍 Stored embedding analysis:`);
      console.log(`[${requestId}] - Type: ${typeof storedEmbedding}`);
      console.log(`[${requestId}] - Is array: ${Array.isArray(storedEmbedding)}`);
      
      if (Array.isArray(storedEmbedding)) {
        console.log(`[${requestId}] - Stored dimensions: ${storedEmbedding.length}`);
        console.log(`[${requestId}] - Query dimensions: ${queryEmbedding.length}`);
        console.log(`[${requestId}] - Dimensions match: ${storedEmbedding.length === queryEmbedding.length ? '✅ YES' : '❌ NO'}`);
      }
    }
    
    // 4. Test with very low threshold
    console.log(`[${requestId}] 🧪 Testing with threshold 0.01...`);
    const { data: veryLowResults, error: veryLowError } = await supabaseClient.rpc('match_journal_entries', {
      query_embedding: queryEmbedding,
      match_threshold: 0.01,
      match_count: 5,
      user_id_filter: userId
    });
    
    if (!veryLowError && veryLowResults) {
      console.log(`[${requestId}] ✅ Very low threshold returned ${veryLowResults.length} results`);
      if (veryLowResults.length > 0) {
        console.log(`[${requestId}] ⚠️ ROOT CAUSE: Similarity threshold too high (original: 0.1, working: 0.01)`);
      }
    } else {
      console.error(`[${requestId}] ❌ Very low threshold test failed:`, veryLowError);
    }
    
    // 5. Test pgvector extension
    console.log(`[${requestId}] 🔧 Testing pgvector extension...`);
    const { data: extensionData, error: extensionError } = await supabaseClient
      .rpc('version');
    
    if (extensionError) {
      console.error(`[${requestId}] ❌ Extension test failed:`, extensionError);
    } else {
      console.log(`[${requestId}] ✅ Database extensions working`);
    }
    
  } catch (diagnosticError) {
    console.error(`[${requestId}] ❌ Diagnostic error:`, diagnosticError);
  }
}

async function executePlan(plan: any, userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Executing plan:`, JSON.stringify(plan, null, 2));

  const results = [];

  for (const subQuestion of plan.subQuestions) {
    console.log(`[${requestId}] Executing sub-question:`, subQuestion.question);

    let subResults = [];
    for (const step of subQuestion.analysisSteps) {
      console.log(`[${requestId}] Executing analysis step:`, step.step, step.description);

      try {
        let stepResult;
        if (step.queryType === 'vector_search') {
          console.log(`[${requestId}] Vector search:`, step.vectorSearch.query);
          stepResult = await executeVectorSearchWithDebug(step, userId, supabaseClient, requestId);
        } else if (step.queryType === 'sql_analysis' || step.queryType === 'sql_count' || step.queryType === 'sql_calculation') {
          console.log(`[${requestId}] SQL analysis (${step.queryType}):`, step.sqlQuery);
          stepResult = await executeSQLAnalysis(step, userId, supabaseClient, requestId);
        } else if (step.queryType === 'hybrid_search') {
          console.log(`[${requestId}] Hybrid search:`, step.vectorSearch.query, step.sqlQuery);
          stepResult = await executeHybridSearch(step, userId, supabaseClient, requestId);
        } else {
          console.warn(`[${requestId}] Unknown query type:`, step.queryType);
          stepResult = { error: `Unknown query type: ${step.queryType}` };
        }

        subResults.push({ 
          step: step.step, 
          result: stepResult,
          queryType: step.queryType,
          description: step.description
        });

      } catch (stepError) {
        console.error(`[${requestId}] Error executing step:`, step.step, stepError);
        subResults.push({ 
          step: step.step, 
          error: stepError.message,
          queryType: step.queryType,
          description: step.description
        });
      }
    }

    results.push({ question: subQuestion.question, results: subResults });
  }

  console.log(`[${requestId}] Execution complete. Results:`, JSON.stringify(results, null, 2));
  return results;
}

async function executeSQLAnalysis(step: any, userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] SQL analysis (${step.queryType}):`, step.sqlQuery);
  console.log(`[${requestId}] ORIGINAL SQL:`, step.sqlQuery);

  try {
    if (!step.sqlQuery) {
      console.error(`[${requestId}] No SQL query provided`);
      return {
        success: false,
        data: [],
        error: "No SQL query provided",
        rowCount: 0
      };
    }

    // Replace $user_id placeholder with actual user ID
    let processedSQL = step.sqlQuery.replace(/\$user_id/g, `'${userId}'`);
    console.log(`[${requestId}] PROCESSED SQL:`, processedSQL);

    // Use execute_dynamic_query function for SQL execution
    const { data: result, error } = await supabaseClient.rpc('execute_dynamic_query', {
      query_text: processedSQL
    });

    if (error) {
      console.error(`[${requestId}] SQL execution error:`, error);
      return {
        success: false,
        data: [],
        error: error.message,
        rowCount: 0,
        sqlQuery: processedSQL,
        hasError: true
      };
    }

    const sqlData = result?.data || [];
    console.log(`[${requestId}] SQL analysis results: {
  success: ${result?.success || false},
  rowCount: ${sqlData.length},
  hasData: ${sqlData.length > 0},
  errorMessage: ${result?.success ? null : (result?.error || 'Unknown error')},
  sampleData: ${JSON.stringify(sqlData.slice(0, 2), null, 2)}
}`);

    return {
      success: result?.success || false,
      data: sqlData,
      error: result?.success ? null : (result?.error || 'Unknown error'),
      rowCount: sqlData.length,
      sqlQuery: processedSQL,
      vectorResultCount: 0,
      sqlResultCount: sqlData.length,
      hasError: !result?.success
    };

  } catch (error) {
    console.error(`[${requestId}] Error in SQL analysis:`, error);
    return {
      success: false,
      data: [],
      error: error.message,
      rowCount: 0,
      sqlQuery: step.sqlQuery,
      vectorResultCount: 0,
      sqlResultCount: 0,
      hasError: true
    };
  }
}

async function executeHybridSearch(step: any, userId: string, supabaseClient: any, requestId: string) {
  try {
    // Execute both vector and SQL searches in parallel
    const [vectorResults, sqlResults] = await Promise.all([
      executeVectorSearchWithDebug(step, userId, supabaseClient, requestId),
      executeSQLAnalysis(step, userId, supabaseClient, requestId)
    ]);

    // Combine and process results (example: deduplication)
    const combinedResults = [...(vectorResults || []), ...(sqlResults || [])];
    const uniqueResults = Array.from(new Set(combinedResults.map(a => a.id)))
      .map(id => {
        return combinedResults.find(a => a.id === id)
      });

    console.log(`[${requestId}] Hybrid search combined results:`, uniqueResults?.length);
    return uniqueResults;

  } catch (error) {
    console.error(`[${requestId}] Error in hybrid search:`, error);
    throw error;
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  console.log(`[Embedding] Generating embedding for text length: ${text.length}`);

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000), // Limit to prevent API errors
      encoding_format: 'float'
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Embedding] OpenAI API error:', errorText);
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.data || data.data.length === 0) {
    throw new Error('Empty embedding data received from OpenAI');
  }

  const embedding = data.data[0].embedding;
  
  if (!Array.isArray(embedding) || embedding.length !== 1536) {
    throw new Error(`Invalid embedding dimensions: expected 1536, got ${embedding?.length}`);
  }

  console.log(`[Embedding] Successfully generated embedding with ${embedding.length} dimensions`);
  return embedding;
}

/**
 * Enhanced Analyst Agent with timezone-aware date processing
 */
async function analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount, isFollowUp = false, supabaseClient, userTimezone = 'UTC') {
  try {
    const last = Array.isArray(conversationContext) ? conversationContext.slice(-5) : [];
    
    console.log(`[Analyst Agent] Processing query with user timezone: ${userTimezone}`);

    // Detect personal pronouns for personalized queries
    const hasPersonalPronouns = /\b(i|me|my|mine|myself)\b/i.test(message.toLowerCase());

    // Enhanced time reference detection
    const hasExplicitTimeReference = /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night|august|january|february|march|april|may|june|july|september|october|november|december)\b/i.test(message.toLowerCase());

    // Get live database schema with real themes and emotions using the authenticated client
    const databaseSchemaContext = await generateDatabaseSchemaContext(supabaseClient);

    const contextString = last.length > 0 ? `
- Recent conversation context: ${last.map(m => `${m.sender}: ${m.content?.slice(0, 50) || 'N/A'}`).join(' | ')}` : '';

    const prompt = `You are SOULo's Analyst Agent - an intelligent query planning specialist for journal data analysis. Your role is to break down user queries into comprehensive, actionable analysis plans.

${databaseSchemaContext}

**CURRENT CONTEXT:**
- Today's date: ${new Date().toISOString()}
- Current year: ${new Date().getFullYear()}
- User query: "${message}"
- User has ${userEntryCount} journal entries${contextString}

**YOUR RESPONSIBILITIES AS ANALYST AGENT:**
1. Smart Hypothesis Formation: infer what the user truly wants to know, then deduce focused sub-questions to answer it comprehensively
2. Sub-Question Generation: break down the query (or previous conversational context's ask) into 1-3 precise sub-questions (no hardcoded keyword lists). For complex queries generate sub-questions in such a way that all sub-question's query when anlalyzed together give the answer to the core usr's query
3. Search Strategy: pick sql_primary, vector_primary, or hybrid based on the sub-question
4. Dynamic Query Generation: produce executable SQL for our schema and/or vector queries
5. Hybrid Analysis: combine SQL stats with semantic vector results when helpful

**ANALYSIS APPROACH:**
   - Simple greetings or acknowledgments: Create conversational plans without complex analysis
   - Journal-specific queries: Determine if SQL, vector search, or hybrid approach is needed based on the actual query
   - Let the content and intent of the query guide the analysis strategy
   - Only create complex analysis plans when the user explicitly asks for journal analysis
   - **MANDATORY**: If no specific time range is mentioned in the query, ALWAYS consider ALL time range - this means include ALL journal entries across ALL time periods to provide comprehensive analysis



**MANDATORY OUTPUT STRUCTURE:**
Return ONLY valid JSON with this exact structure:
{
  "queryType": "journal_specific",
  "strategy": "intelligent_sub_query",
  "userStatusMessage": "exactly 5 words describing analysis approach",
  "subQuestions": [
    {
      "question": "Specific focused sub-question",
      "purpose": "How this helps answer the main query",
      "searchStrategy": "sql_primary" | "vector_primary" | "hybrid",
      "executionStage": 1,
      "analysisSteps": [
        {
          "step": 1,
          "description": "Clear description of what this step accomplishes",
          "queryType": "sql_analysis" | "vector_search" | "sql_count" | "sql_calculation",
          "sqlQuery": "SELECT ... FROM \\"Journal Entries\\" WHERE user_id = $user_id AND ..." | null,
           "vectorSearch": {
             "query": "optimized search query",
             "threshold": 0.3,
             "limit": 10
           } | null,
          "timeRange": { "start": "ISO string or null", "end": "ISO string or null" } | null
        }
      ]
    }
  ],
  "confidence": 0.8,
  "reasoning": "Brief explanation of the analysis strategy",
  "useAllEntries": boolean,
  "hasPersonalPronouns": boolean,
  "hasExplicitTimeReference": boolean
}

**EXECUTION ORDERING RULES:**
- Assign an integer executionStage to EACH sub-question starting at 1
- Sub-questions with the SAME executionStage run in parallel
- Stages execute in ascending order: stage 1 first, then 2, then 3, etc.
- Keep stages contiguous (1..N) without gaps

**SQL QUERY GUIDELINES:**
- ALWAYS include WHERE user_id = $user_id
- Use proper column names with quotes for spaced names like "refined text"
- For emotion analysis: use emotions JSONB
- For theme analysis: use master_themes array and/or entities/text where appropriate (no hardcoded expansions)
- For percentages: alias as percentage
- For counts: alias as count (or frequency for grouped counts)
- For averages/scores: alias as avg_score (or score)
- For date filtering: apply created_at comparisons when time is implied or stated
- Do NOT call RPCs; generate plain SQL only

**SEARCH STRATEGY SELECTION:**
- sql_primary: statistical analysis, counts, percentages
- vector_primary: semantic content analysis, similar entries
- hybrid: combine both when needed

Focus on creating comprehensive, executable analysis plans that will provide meaningful insights.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content;
    console.log(`[Analyst Agent] Raw GPT response:`, responseText);

    // Try to parse JSON directly first
    let analysisResult;
    try {
      analysisResult = JSON.parse(responseText);
      console.log(`[Analyst Agent] Successfully parsed JSON:`, analysisResult);
    } catch (parseError) {
      console.warn(`[Analyst Agent] Direct JSON parse failed, trying to extract:`, parseError);
      
      // Try to extract JSON from code blocks or other formatting
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                       responseText.match(/(\{[\s\S]*\})/);
      
      if (jsonMatch) {
        try {
          analysisResult = JSON.parse(jsonMatch[1]);
          console.log(`[Analyst Agent] Extracted and parsed JSON:`, analysisResult);
        } catch (extractError) {
          console.error(`[Analyst Agent] Failed to parse extracted JSON:`, extractError);
          // Return fallback plan
          return createEnhancedFallbackPlan(message, false, null, supabaseClient, userTimezone);
        }
      } else {
        console.error(`[Analyst Agent] No JSON found in response:`, responseText);
        // Return fallback plan
        return createEnhancedFallbackPlan(message, false, null, supabaseClient, userTimezone);
      }
    }

    // Validate the parsed result has required structure
    if (!analysisResult || !analysisResult.subQuestions || !Array.isArray(analysisResult.subQuestions)) {
      console.error(`[Analyst Agent] Invalid analysis result structure:`, analysisResult);
      return createEnhancedFallbackPlan(message, false, null, supabaseClient, userTimezone);
    }

    // Enhance with detected characteristics and timezone
    const finalResult = {
      ...analysisResult,
      useAllEntries: analysisResult.useAllEntries !== false,
      hasPersonalPronouns,
      hasExplicitTimeReference,
      inferredTimeContext: null,
      userTimezone
    };

    console.log("Final Analyst Plan:", JSON.stringify(finalResult, null, 2));
    return finalResult;

  } catch (error) {
    console.error("Error in Analyst Agent:", error);
    return createEnhancedFallbackPlan(message, false, null, supabaseClient, userTimezone);
  }
}

/**
 * Create enhanced fallback plan respecting GPT's intended strategy flexibility
 */
function createEnhancedFallbackPlan(originalMessage, unused, inferredTimeContext, supabaseClient, userTimezone = 'UTC') {
  const lowerMessage = originalMessage.toLowerCase();
  const hasPersonalPronouns = /\b(i|me|my|mine|myself)\b/i.test(lowerMessage);
  const hasExplicitTimeReference = /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night|august|january|february|march|april|may|june|july|september|october|november|december)\b/i.test(lowerMessage);

  return {
    queryType: "journal_specific",
    strategy: "intelligent_sub_query",
    userStatusMessage: "Analyzing query using fallback strategy",
    subQuestions: [
      {
        question: `Analysis for: ${originalMessage}`,
        purpose: "Comprehensive analysis using flexible search strategy",
        searchStrategy: "hybrid",
        executionStage: 1,
        analysisSteps: [
          {
            step: 1,
            description: "Hybrid search to handle the query appropriately",
            queryType: "hybrid_search",
            sqlQuery: `SELECT * FROM "Journal Entries" WHERE user_id = $user_id ORDER BY created_at DESC LIMIT 10`,
            vectorSearch: {
              query: originalMessage,
              threshold: 0.3,
              limit: 10
            },
            timeRange: inferredTimeContext
          }
        ]
      }
    ],
    confidence: 0.7,
    reasoning: `Fallback plan for: "${originalMessage}". Using hybrid approach to ensure comprehensive coverage.`,
    useAllEntries: true,
    hasPersonalPronouns,
    hasExplicitTimeReference,
    inferredTimeContext: inferredTimeContext,
    userTimezone
  };
}

async function generateDatabaseSchemaContext(supabaseClient: any): Promise<string> {
  try {
    const { generateDatabaseSchemaContext: generateContext } = await import('../_shared/databaseSchemaContext.ts');
    return await generateContext(supabaseClient);
  } catch (error) {
    console.error('Error generating database schema context:', error);
    
    // Fallback comprehensive schema context
    return `
**DATABASE SCHEMA - "Journal Entries" Table:**

**CRITICAL COLUMNS FOR QUERIES:**
- id (bigint): Unique entry identifier  
- user_id (uuid): User ID - MANDATORY in all WHERE clauses
- created_at (timestamp): Entry creation date - use for time filtering
- "refined text" (text): Primary content source (cleaned transcription)
- "transcription text" (text): Raw voice-to-text content
- emotions (jsonb): AI emotion scores {emotion_name: score} where scores 0.0-1.0
- master_themes (text[]): Array of theme categories from master themes table
- sentiment (real): Overall sentiment score (-1.0 to 1.0)
- entities (jsonb): Named entities {"PERSON": ["names"], "ORG": ["orgs"], "GPE": ["places"]}
- themeemotion (jsonb): Theme-emotion correlations {theme: {emotion: score}}

**SQL QUERY RULES:**
- ALWAYS include: WHERE user_id = $user_id  
- Use quotes for spaced column names: "refined text", "transcription text"
- For emotion analysis: use emotions JSONB column
- For theme analysis: use master_themes array column  
- For sentiment: use sentiment real column
- For date filtering: use created_at timestamp column
- Generate standard SQL only, no RPC calls

**AVAILABLE THEMES:**
Self & Identity, Body & Health, Mental Health, Romantic Relationships, Family, Friendships & Social Circle, Career & Workplace, Money & Finances, Education & Learning, Habits & Routines, Sleep & Rest, Creativity & Hobbies, Spirituality & Beliefs, Technology & Social Media, Environment & Living Space, Time & Productivity, Travel & Movement, Loss & Grief, Purpose & Fulfillment, Conflict & Trauma, Celebration & Achievement

**AVAILABLE EMOTIONS:**
amusement, anger, anticipation, anxiety, awe, boredom, compassion, concern, confidence, confusion, contentment, curiosity, depression, disappointment, disgust, embarrassment, empathy, enthusiasm, envy, excitement, fear, frustration, gratitude, guilt, hate, hope, hurt, interest, jealousy, joy, loneliness, love, nostalgia, optimism, overwhelm, pessimism, pride, regret, relief, remorse, sadness, satisfaction, serenity, shame, surprise, trust`;
  }
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

    const { message, userId, execute = true, conversationContext = [], timeRange = null, threadId, messageId, isFollowUp = false, userTimezone = 'UTC' } = await req.json();

    const requestId = `planner_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`[REQUEST START] ${requestId}: {
  message: "${message}",
  userId: "${userId}",
  execute: ${execute},
  timestamp: "${new Date().toISOString()}",
  contextLength: ${conversationContext?.length || 0},
  timeRange: ${JSON.stringify(timeRange)},
  threadId: "${threadId}",
  messageId: ${messageId},
  isFollowUp: ${isFollowUp},
  userTimezone: "${userTimezone}"
}`);

    // Get user's journal entry count for context
    const { count: countData } = await supabaseClient
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    const userEntryCount = countData || 0;
    console.log(`[${requestId}] User has ${userEntryCount} journal entries`);

    // Run vector search debugging first
    const debugInfo = await debugVectorSearch(supabaseClient, userId, requestId);
    console.log(`[${requestId}] Debug info:`, JSON.stringify(debugInfo, null, 2));

    // Generate comprehensive analysis plan with timezone support
    const analysisResult = await analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount, isFollowUp, supabaseClient, userTimezone);

    if (!execute) {
      // Return just the plan without execution
      return new Response(JSON.stringify({
        queryPlan: analysisResult,
        debugInfo,
        timestamp: new Date().toISOString(),
        requestId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Execute the plan and return results
    const executionResult = await executePlan(analysisResult, userId, supabaseClient, requestId);
    
    return new Response(JSON.stringify({
      queryPlan: analysisResult,
      executionResult,
      debugInfo,
      timestamp: new Date().toISOString(),
      requestId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in smart query planner:', error);
    return new Response(JSON.stringify({
      error: error.message,
      fallbackPlan: {
        queryType: "error_fallback",
        strategy: "vector_mandatory",
        subQuestions: [{
          question: "Enhanced vector search fallback",
          searchStrategy: "vector_mandatory",
          analysisSteps: [{
            step: 1,
            queryType: "vector_search",
            vectorSearch: {
              query: "personal journal experiences thoughts feelings",
              threshold: 0.6,
              limit: 10
            },
            timeRange: null
          }]
        }],
        useAllEntries: true,
        userTimezone: 'UTC'
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
