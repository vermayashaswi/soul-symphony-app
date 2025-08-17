
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
  subQuestions: Array<{
    question: string;
    purpose: string;
    searchStrategy: string;
    executionStage: number;
    analysisSteps: Array<{
      step: number;
      description: string;
      queryType: string;
      sqlQuery?: string;
      vectorSearch?: {
        query: string;
        threshold: number;
        limit: number;
      };
      timeRange?: {
        start: string | null;
        end: string | null;
      };
    }>;
  }>;
  confidence: number;
  reasoning: string;
  databaseContext: string;
}

async function generateIntelligentQueryPlan(
  message: string,
  conversationContext: any[],
  userPatterns: any,
  userProfile: any,
  databaseContext: string,
  emotionGuidelines: string,
  themeGuidelines: string,
  openaiApiKey: string,
  userEntryCount: number
): Promise<QueryPlan> {
  const systemPrompt = `You are SOULo's Analyst Agent - an intelligent query planning specialist for journal data analysis. Your role is to break down user queries into comprehensive, actionable analysis plans.

${databaseContext}

${emotionGuidelines}

${themeGuidelines}

**CURRENT CONTEXT:**
- Today's date: ${new Date().toISOString()}
- Current year: ${new Date().getFullYear()}
- User query: "${message}"
- User has ${userEntryCount} journal entries
- Recent conversation context: ${conversationContext.slice(-5).map(c => `${c.sender}: ${c.content?.slice(0, 50) || 'N/A'}`).join(' | ')}

**YOUR RESPONSIBILITIES AS ANALYST AGENT:**
1. Smart Hypothesis Formation: infer what the user truly wants to know, then deduce focused sub-questions to answer it comprehensively
2. Sub-Question Generation: break down the query into 1-3 precise sub-questions. For complex queries generate sub-questions in such a way that all sub-question's query when analyzed together give the answer to the core user's query
3. Search Strategy: pick sql_primary, vector_primary, or hybrid based on the sub-question
4. Dynamic Query Generation: produce executable SQL for our schema and/or vector queries
5. Hybrid Analysis: combine SQL stats with semantic vector results when helpful

**ANALYSIS APPROACH:**
- Simple greetings or acknowledgments: Create conversational plans without complex analysis
- Journal-specific queries: Determine if SQL, vector search, or hybrid approach is needed based on the actual query
- Let the content and intent of the query guide the analysis strategy
- Only create complex analysis plans when the user explicitly asks for journal analysis
- **MANDATORY**: If no specific time range is mentioned in the query, ALWAYS consider ALL time range - this means include ALL journal entries across ALL time periods to provide comprehensive analysis

**SQL QUERY GUIDELINES:**
- ALWAYS include WHERE user_id = '{user_id}' (this will be replaced with actual user_id)
- Use proper column names with quotes for spaced names like "refined text"
- For emotion analysis: use emotions JSONB column
- For theme analysis: use master_themes array and/or entities/text where appropriate
- For percentages: alias as percentage
- For counts: alias as count (or frequency for grouped counts)
- For averages/scores: alias as avg_score (or score)
- For date filtering: apply created_at comparisons when time is implied or stated
- Do NOT call RPCs; generate plain SQL only

**SEARCH STRATEGY SELECTION:**
- sql_primary: statistical analysis, counts, percentages, aggregations
- vector_primary: semantic content analysis, similar entries, meaning-based searches
- hybrid: combine both when you need both statistics and semantic understanding

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
          "queryType": "sql_analysis" | "vector_search" | "hybrid_search",
          "sqlQuery": "SELECT ... FROM \\"Journal Entries\\" WHERE user_id = '{user_id}' AND ..." | null,
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

Focus on creating comprehensive, executable analysis plans that will provide meaningful insights.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const planText = data.choices[0].message.content;

  try {
    const plan = JSON.parse(planText);
    plan.databaseContext = plan.databaseContext || "Query plan generated with advanced analysis capabilities";
    return plan;
  } catch (parseError) {
    console.error('Failed to parse GPT response:', parseError);
    throw new Error('Failed to generate valid query plan');
  }
}

async function executeDynamicQuery(sqlQuery: string, userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Executing dynamic SQL query:`, sqlQuery);
  
  // Replace user_id placeholder with actual user ID
  const finalQuery = sqlQuery.replace(/\{user_id\}/g, `'${userId}'`);
  
  try {
    const { data, error } = await supabaseClient.rpc('execute_dynamic_query', {
      query_text: finalQuery
    });

    if (error) {
      console.error(`[${requestId}] SQL execution error:`, error);
      throw error;
    }

    console.log(`[${requestId}] SQL execution successful:`, data?.data?.length || 0, 'results');
    return data?.data || [];
  } catch (error) {
    console.error(`[${requestId}] Error in dynamic query execution:`, error);
    throw error;
  }
}

async function executeVectorSearch(vectorConfig: any, userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Executing vector search:`, vectorConfig.query);
  
  try {
    // Generate embedding
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: vectorConfig.query.substring(0, 8000),
        encoding_format: 'float'
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Embedding API error: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    // Execute vector search using RPC
    const { data, error } = await supabaseClient.rpc('match_journal_entries', {
      query_embedding: embedding,
      match_threshold: vectorConfig.threshold || 0.3,
      match_count: vectorConfig.limit || 10,
      user_id_filter: userId
    });

    if (error) {
      console.error(`[${requestId}] Vector search error:`, error);
      throw error;
    }

    console.log(`[${requestId}] Vector search successful:`, data?.length || 0, 'results');
    return data || [];
  } catch (error) {
    console.error(`[${requestId}] Error in vector search:`, error);
    throw error;
  }
}

async function executePlan(plan: QueryPlan, userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Executing analysis plan with ${plan.subQuestions.length} sub-questions`);

  const researchResults = [];

  for (const subQuestion of plan.subQuestions) {
    console.log(`[${requestId}] Processing sub-question:`, subQuestion.question);

    const subQuestionResults = {
      subQuestion: subQuestion.question,
      purpose: subQuestion.purpose,
      searchStrategy: subQuestion.searchStrategy,
      executionResults: {
        sqlResults: [],
        vectorResults: [],
        hybridResults: []
      }
    };

    for (const step of subQuestion.analysisSteps) {
      console.log(`[${requestId}] Executing step ${step.step}:`, step.description);

      try {
        if (step.queryType === 'sql_analysis' && step.sqlQuery) {
          const sqlResults = await executeDynamicQuery(step.sqlQuery, userId, supabaseClient, requestId);
          subQuestionResults.executionResults.sqlResults.push({
            step: step.step,
            description: step.description,
            results: sqlResults
          });
        }
        
        if (step.queryType === 'vector_search' && step.vectorSearch) {
          const vectorResults = await executeVectorSearch(step.vectorSearch, userId, supabaseClient, requestId);
          subQuestionResults.executionResults.vectorResults.push({
            step: step.step,
            description: step.description,
            results: vectorResults
          });
        }
        
        if (step.queryType === 'hybrid_search') {
          // Execute both SQL and vector search for hybrid
          const hybridResults = { sqlData: [], vectorData: [] };
          
          if (step.sqlQuery) {
            hybridResults.sqlData = await executeDynamicQuery(step.sqlQuery, userId, supabaseClient, requestId);
          }
          
          if (step.vectorSearch) {
            hybridResults.vectorData = await executeVectorSearch(step.vectorSearch, userId, supabaseClient, requestId);
          }
          
          subQuestionResults.executionResults.hybridResults.push({
            step: step.step,
            description: step.description,
            results: hybridResults
          });
        }
      } catch (stepError) {
        console.error(`[${requestId}] Error executing step ${step.step}:`, stepError);
        // Add error information but continue with other steps
        subQuestionResults.executionResults[`step_${step.step}_error`] = stepError.message;
      }
    }

    researchResults.push(subQuestionResults);
  }

  return {
    queryPlan: plan,
    researchResults,
    executionSummary: {
      totalSubQuestions: plan.subQuestions.length,
      totalSteps: plan.subQuestions.reduce((sum, sq) => sum + sq.analysisSteps.length, 0),
      strategy: plan.strategy,
      confidence: plan.confidence
    }
  };
}

async function analyzeUserPatterns(entries: any[], supabaseClient: any, userId: string) {
  const patterns = {
    avgEntriesPerWeek: 0,
    commonEmotions: [] as string[],
    commonThemes: [] as string[],
    commonEntities:[] as string[],
    lastEntryDate: null as string | null,
    dominantSentiment: null as string | null
  };

  if (entries.length === 0) return patterns;

  // Calculate basic patterns from recent entries
  const dateRange = new Date(entries[0].created_at).getTime() - new Date(entries[entries.length - 1].created_at).getTime();
  const weeks = dateRange / (1000 * 60 * 60 * 24 * 7);
  patterns.avgEntriesPerWeek = Math.round(entries.length / Math.max(weeks, 1));
  patterns.lastEntryDate = entries[0]?.created_at || null;

  return patterns;
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

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { 
      message, 
      userId, 
      execute = true, 
      conversationContext = [], 
      threadId, 
      messageId, 
      isFollowUp = false, 
      userTimezone = 'UTC' 
    } = await req.json();

    const requestId = `planner_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`[${requestId}] Smart Query Planner Request:`, {
      message: message.substring(0, 100),
      userId,
      execute,
      contextLength: conversationContext?.length || 0
    });

    // Get user's journal entry count for context
    const { count: countData } = await supabaseClient
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    const userEntryCount = countData || 0;
    console.log(`[${requestId}] User has ${userEntryCount} journal entries`);

    // Get recent entries for pattern analysis
    const { data: recentEntries } = await supabaseClient
      .from('Journal Entries')
      .select('created_at, emotions, master_themes, entities, sentiment')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    const userPatterns = await analyzeUserPatterns(recentEntries || [], supabaseClient, userId);

    // Generate database schema context
    const databaseContext = generateDatabaseSchemaContext();
    const emotionGuidelines = getEmotionAnalysisGuidelines();
    const themeGuidelines = getThemeAnalysisGuidelines();

    // Generate intelligent query plan using GPT
    const queryPlan = await generateIntelligentQueryPlan(
      message,
      conversationContext,
      userPatterns,
      {},
      databaseContext,
      emotionGuidelines,
      themeGuidelines,
      openaiApiKey,
      userEntryCount
    );

    if (!execute) {
      // Return just the plan without execution
      return new Response(JSON.stringify({
        queryPlan,
        userPatterns,
        databaseContext,
        timestamp: new Date().toISOString(),
        requestId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Execute the plan and return structured results
    const executionResult = await executePlan(queryPlan, userId, supabaseClient, requestId);
    
    console.log(`[${requestId}] Plan execution completed successfully`);
    
    return new Response(JSON.stringify({
      ...executionResult,
      userPatterns,
      databaseContext,
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
        strategy: "simple_vector_search",
        subQuestions: [{
          question: "General journal search",
          searchStrategy: "vector_primary",
          analysisSteps: [{
            step: 1,
            queryType: "vector_search",
            vectorSearch: {
              query: "personal journal experiences thoughts feelings",
              threshold: 0.3,
              limit: 10
            }
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
