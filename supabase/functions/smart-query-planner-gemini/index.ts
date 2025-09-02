import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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
  subQuestions?: SubQuestion[];
  expectedResponseType: string;
  confidence: number;
  reasoning: string;
  databaseContext: string;
}

interface SubQuestion {
  id?: string;
  question: string;
  purpose: string;
  searchStrategy: string;
  executionStage: number;
  dependencies?: string[];
  resultForwarding?: string;
  executionMode?: 'parallel' | 'sequential' | 'conditional';
  analysisSteps: AnalysisStep[];
}

interface AnalysisStep {
  step: number;
  description: string;
  queryType: string;
  sqlQueryType?: 'filtering' | 'analysis';
  sqlQuery?: string;
  vectorSearch?: {
    query: string;
    threshold: number;
    limit: number;
  };
  timeRange?: any;
  resultContext?: string;
  dependencies?: string[];
}

interface ExecutionContext {
  stageResults: Map<string, any>;
  subQuestionResults: Map<string, any>;
  currentStage: number;
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

async function testVectorOperations(supabaseClient: any, requestId: string): Promise<boolean> {
  try {
    console.log(`[${requestId}] Testing vector operations...`);
    
    const { data, error } = await supabaseClient.rpc('test_vector_operations');
    
    if (error) {
      console.error(`[${requestId}] Vector test error:`, error);
      return false;
    }
    
    if (data && data.success) {
      console.log(`[${requestId}] Vector operations test passed:`, data.message);
      return true;
    } else {
      console.error(`[${requestId}] Vector operations test failed:`, data?.error || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error(`[${requestId}] Error testing vector operations:`, error);
    return false;
  }
}

async function executePlan(plan: any, userId: string, supabaseClient: any, requestId: string, userTimezone: string = 'UTC') {
  console.log(`[${requestId}] Executing orchestrated plan:`, JSON.stringify(plan, null, 2));

  // Initialize execution context
  const executionContext: ExecutionContext = {
    stageResults: new Map(),
    subQuestionResults: new Map(),
    currentStage: 1
  };

  // Assign IDs to sub-questions if not present
  plan.subQuestions.forEach((subQ: any, index: number) => {
    if (!subQ.id) {
      subQ.id = `sq${index + 1}`;
    }
  });

  // Get total entries count for percentage calculations
  const { count: totalEntries } = await supabaseClient
    .from('Journal Entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  // Group sub-questions by execution stage
  const stageGroups = groupByExecutionStage(plan.subQuestions);
  console.log(`[${requestId}] Execution stages:`, Object.keys(stageGroups).map(k => `Stage ${k}: ${stageGroups[k].length} sub-questions`));

  const allResults = [];

  // Execute stages sequentially
  for (const stage of Object.keys(stageGroups).sort((a, b) => parseInt(a) - parseInt(b))) {
    console.log(`[${requestId}] Executing stage ${stage} with ${stageGroups[stage].length} sub-questions`);
    executionContext.currentStage = parseInt(stage);

    // Execute sub-questions in parallel within the stage (if they're independent)
    const stageResults = await executeStageInParallel(stageGroups[stage], userId, supabaseClient, requestId, executionContext, userTimezone);
    
    // Store stage results for dependency resolution
    executionContext.stageResults.set(stage, stageResults);
    
    // Store individual sub-question results
    stageResults.forEach((result: any) => {
      if (result.subQuestion?.id) {
        executionContext.subQuestionResults.set(result.subQuestion.id, result);
      }
    });

    allResults.push(...stageResults);
  }

  console.log(`[${requestId}] Orchestrated execution complete. Total results: ${allResults.length}`);
  
  // ENHANCED RESULT PROCESSING: Transform raw data into processed summaries
  const processedResults = await processExecutionResults(allResults, userId, totalEntries || 0, requestId);
  
  return processedResults;
}

function groupByExecutionStage(subQuestions: any[]) {
  const stageGroups: { [key: string]: any[] } = {};
  
  subQuestions.forEach(subQ => {
    const stage = subQ.executionStage || 1;
    if (!stageGroups[stage]) {
      stageGroups[stage] = [];
    }
    stageGroups[stage].push(subQ);
  });
  
  return stageGroups;
}

async function executeStageInParallel(
  subQuestions: any[], 
  userId: string, 
  supabaseClient: any, 
  requestId: string, 
  executionContext: ExecutionContext,
  userTimezone: string
) {
  const stagePromises = subQuestions.map(async (subQuestion) => {
    try {
      const result = await executeSubQuestion(subQuestion, userId, supabaseClient, requestId, executionContext, userTimezone);
      return result;
    } catch (error) {
      console.error(`[${requestId}] Error executing sub-question ${subQuestion.id}:`, error);
      return {
        subQuestion,
        executionResults: { error: error.message }
      };
    }
  });

  return Promise.all(stagePromises);
}

async function executeSubQuestion(
  subQuestion: any,
  userId: string,
  supabaseClient: any,
  requestId: string,
  executionContext: ExecutionContext,
  userTimezone: string
) {
  console.log(`[${requestId}] Executing sub-question: ${subQuestion.question}`);
  
  const sqlResults = [];
  const vectorResults = [];
  const errors = [];

  for (const step of subQuestion.analysisSteps) {
    try {
      if (step.queryType === 'sql_analysis' || step.queryType === 'hybrid_search') {
        if (step.sqlQuery) {
          const sqlResult = await executeSQLAnalysis(step, userId, supabaseClient, requestId, {}, userTimezone);
          sqlResults.push(...(sqlResult.data || []));
        }
        
        if (step.vectorSearch && (step.queryType === 'hybrid_search' || step.queryType === 'vector_search')) {
          const vectorResult = await executeVectorSearch(step, userId, supabaseClient, requestId);
          vectorResults.push(...(vectorResult.data || []));
        }
      } else if (step.queryType === 'vector_search') {
        const vectorResult = await executeVectorSearch(step, userId, supabaseClient, requestId);
        vectorResults.push(...(vectorResult.data || []));
      }
    } catch (error) {
      console.error(`[${requestId}] Error executing step ${step.step}:`, error);
      errors.push(error.message);
    }
  }

  return {
    subQuestion,
    executionResults: {
      sqlResults,
      vectorResults,
      errors: errors.length > 0 ? errors : undefined
    }
  };
}

async function executeVectorSearch(step: any, userId: string, supabaseClient: any, requestId: string) {
  try {
    console.log(`[${requestId}] Executing vector search: ${step.vectorSearch.query}`);
    
    const embedding = await generateEmbedding(step.vectorSearch.query);
    const threshold = step.vectorSearch.threshold || 0.15;
    const limit = step.vectorSearch.limit || 25;

    let vectorResults;
    if (step.timeRange && step.timeRange.start && step.timeRange.end) {
      vectorResults = await supabaseClient.rpc('match_journal_entries_with_date', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
        user_id_filter: userId,
        start_date: step.timeRange.start,
        end_date: step.timeRange.end
      });
    } else {
      vectorResults = await supabaseClient.rpc('match_journal_entries', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
        user_id_filter: userId
      });
    }

    if (vectorResults.error) {
      throw new Error(`Vector search error: ${vectorResults.error.message}`);
    }

    return { data: vectorResults.data || [] };
  } catch (error) {
    console.error(`[${requestId}] Vector search failed:`, error);
    return { data: [], error: error.message };
  }
}

async function processExecutionResults(allResults: any[], userId: string, totalEntries: number, requestId: string) {
  console.log(`[${requestId}] Processing ${allResults.length} sub-question results with total entries context: ${totalEntries}`);
  
  const processedResults = [];
  
  for (const result of allResults) {
    const processedResult = {
      subQuestion: result.subQuestion,
      executionSummary: {
        resultType: 'unknown',
        dataType: 'none',
        summary: '',
        count: 0,
        analysis: {},
        sampleEntries: [],
        totalEntriesContext: totalEntries
      },
      executionDetails: result.executionResults
    };

    // Extract step type from the first analysis step
    const firstStep = result.subQuestion?.analysisSteps?.[0];
    const sqlQueryType = firstStep?.sqlQueryType;
    
    if (result.executionResults?.sqlResults?.length > 0) {
      const sqlResults = result.executionResults.sqlResults;
      
      if (sqlQueryType === 'analysis') {
        // ANALYSIS QUERIES: Process computed statistics
        processedResult.executionSummary = await processAnalysisResults(sqlResults, totalEntries, requestId);
      } else if (sqlQueryType === 'filtering') {
        // FILTERING QUERIES: Count and sample entries
        processedResult.executionSummary = await processFilteringResults(sqlResults, totalEntries, requestId);
      } else {
        // UNKNOWN SQL TYPE: Determine based on content
        processedResult.executionSummary = await autoDetectSQLResultType(sqlResults, totalEntries, requestId);
      }
    } else if (result.executionResults?.vectorResults?.length > 0) {
      // VECTOR SEARCH: Sample entries with semantic relevance
      if (result.subQuestion?.id === 'final_content_retrieval') {
        // This is the mandatory final vector search - mark it specially
        const vectorSummary = await processVectorResults(result.executionResults.vectorResults, totalEntries, requestId);
        processedResult.executionSummary = {
          ...vectorSummary,
          resultType: 'journal_content_retrieval',
          dataType: 'journal_entries',
          isMandatoryFinalStep: true
        };
      } else {
        processedResult.executionSummary = await processVectorResults(result.executionResults.vectorResults, totalEntries, requestId);
      }
    } else {
      // NO RESULTS
      processedResult.executionSummary = {
        resultType: 'no_results',
        dataType: 'none',
        summary: 'No matching entries found',
        count: 0,
        analysis: {},
        sampleEntries: [],
        totalEntriesContext: totalEntries
      };
    }

    processedResults.push(processedResult);
  }
  
  console.log(`[${requestId}] Result processing complete. Processed ${processedResults.length} sub-questions`);
  return processedResults;
}

async function processAnalysisResults(sqlResults: any[], totalEntries: number, requestId: string) {
  // Implementation from smart-query-planner
  console.log(`[${requestId}] Processing analysis results: ${sqlResults.length} rows`);
  
  // Check for count queries - multiple variations
  if (sqlResults.length === 1 && (
    sqlResults[0].total_entries !== undefined || 
    sqlResults[0].count !== undefined ||
    sqlResults[0].entry_count !== undefined
  )) {
    const totalCount = sqlResults[0].total_entries || sqlResults[0].count || sqlResults[0].entry_count;
    return {
      resultType: 'count_analysis',
      dataType: 'count',
      summary: `Found ${totalCount} matching journal entries`,
      count: totalCount,
      analysis: { totalEntries: totalCount },
      sampleEntries: [],
      totalEntriesContext: totalEntries
    };
  }

  // Enhanced emotion analysis detection
  if (sqlResults.some(row => 
    row.emotion !== undefined || 
    row.avg_sentiment !== undefined || 
    row.score !== undefined ||
    row.avg_score !== undefined ||
    Object.keys(row).some(key => key.toLowerCase().includes('emotion'))
  )) {
    const emotionAnalysis = {};
    let emotionCount = 0;
    
    sqlResults.forEach(row => {
      if (row.emotion && (row.score !== undefined || row.avg_score !== undefined)) {
        const score = row.score || row.avg_score;
        emotionAnalysis[row.emotion] = {
          score: parseFloat(score).toFixed(2),
          occurrences: row.entry_count || row.count || 1
        };
        emotionCount++;
      }
    });
    
    const summary = Object.keys(emotionAnalysis).length > 0 
      ? `Emotion analysis: ${Object.entries(emotionAnalysis).slice(0, 3).map(([emotion, data]: [string, any]) => 
          `${emotion}${data.score ? ` (${data.score})` : ''}`).join(', ')}`
      : `Emotion analysis completed with ${sqlResults.length} data points`;
    
    return {
      resultType: 'emotion_analysis',
      dataType: 'emotions',
      summary,
      count: sqlResults.length,
      analysis: emotionAnalysis,
      sampleEntries: [],
      totalEntriesContext: totalEntries
    };
  }

  return {
    resultType: 'statistical_analysis',
    dataType: 'statistics',
    summary: `Statistical analysis computed with ${sqlResults.length} data points`,
    count: sqlResults.length,
    analysis: { rawResults: sqlResults.slice(0, 5) },
    sampleEntries: [],
    totalEntriesContext: totalEntries
  };
}

async function processFilteringResults(sqlResults: any[], totalEntries: number, requestId: string) {
  // Implementation from smart-query-planner
  console.log(`[${requestId}] Processing filtering results: ${sqlResults.length} entries found`);
  
  if (sqlResults.length === 0) {
    return {
      resultType: 'no_entries_found',
      dataType: 'entries',
      summary: `No entries found matching the specified criteria`,
      count: 0,
      analysis: { 
        matchedEntries: 0,
        totalEntries,
        percentage: 0
      },
      sampleEntries: [],
      totalEntriesContext: totalEntries
    };
  }
  
  const sampleEntries = sqlResults.slice(0, 3).map(entry => ({
    id: entry.id,
    content: entry.content || entry['refined text'] || entry['transcription text'] || 'No content available',
    created_at: entry.created_at,
    themes: entry.master_themes || entry.themes || [],
    emotions: entry.emotions || {},
    sentiment: entry.sentiment
  }));
  
  const percentage = totalEntries > 0 ? ((sqlResults.length / totalEntries) * 100).toFixed(1) : '0';
  
  return {
    resultType: 'filtered_entries',
    dataType: 'entries',
    summary: `Found ${sqlResults.length} matching entries (${percentage}% of total ${totalEntries} entries)`,
    count: sqlResults.length,
    analysis: { 
      matchedEntries: sqlResults.length,
      totalEntries,
      percentage: parseFloat(percentage)
    },
    sampleEntries,
    totalEntriesContext: totalEntries
  };
}

async function processVectorResults(vectorResults: any[], totalEntries: number, requestId: string) {
  // Implementation from smart-query-planner
  console.log(`[${requestId}] Processing vector results: ${vectorResults.length} entries found`);
  
  const sampleEntries = vectorResults.slice(0, 3).map(entry => ({
    id: entry.id,
    content: entry.content || 'No content available',
    created_at: entry.created_at,
    similarity: entry.similarity || 0,
    themes: entry.themes || [],
    emotions: entry.emotions || {}
  }));
  
  const avgSimilarity = vectorResults.length > 0 
    ? (vectorResults.reduce((sum, r) => sum + (r.similarity || 0), 0) / vectorResults.length).toFixed(3)
    : '0';
  
  return {
    resultType: 'semantic_search',
    dataType: 'entries',
    summary: `Found ${vectorResults.length} semantically relevant entries (avg similarity: ${avgSimilarity})`,
    count: vectorResults.length,
    analysis: { 
      averageSimilarity: parseFloat(avgSimilarity),
      resultCount: vectorResults.length
    },
    sampleEntries,
    totalEntriesContext: totalEntries
  };
}

async function autoDetectSQLResultType(sqlResults: any[], totalEntries: number, requestId: string) {
  // Fallback auto-detection logic
  return {
    resultType: 'unknown_analysis',
    dataType: 'mixed',
    summary: `Analysis completed with ${sqlResults.length} results`,
    count: sqlResults.length,
    analysis: { results: sqlResults.slice(0, 5) },
    sampleEntries: [],
    totalEntriesContext: totalEntries
  };
}

async function generateEmbedding(text: string): Promise<number[]> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * GEMINI-POWERED Query Planning - Uses Google Vertex AI Gemini 2.5 Flash instead of OpenAI
 */
async function analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount, isFollowUp = false, supabaseClient, userTimezone = 'UTC') {
  try {
    // Enhanced conversation context processing with proper role mapping and ordering
    const last = Array.isArray(conversationContext) ? 
      conversationContext
        .slice(-10) // Expand to last 10 messages for richer context
        .sort((a, b) => new Date(a.created_at || a.timestamp || 0) - new Date(b.created_at || b.timestamp || 0)) // Chronological order (oldest to newest)
        .map((msg, index) => ({
          role: msg.sender === 'assistant' ? 'assistant' : 'user', // Standardize role mapping using sender field
          content: msg.content || 'N/A',
          messageOrder: index + 1,
          timestamp: msg.created_at || msg.timestamp,
          id: msg.id
        })) : [];
    
    console.log(`[Gemini Query Planner] Processing query with enhanced validation and user timezone: ${userTimezone}`);
    
    const prompt = `
CRITICAL: Your response must be optimized for efficiency while maintaining accuracy. Keep your output under 3000 tokens maximum. Be concise in reasoning without compromising query plan quality or PostgreSQL query accuracy.

REASONING CONSTRAINTS:
- Minimize internal reasoning and thinking processes
- Focus ONLY on generating the required JSON output
- Avoid verbose explanations or step-by-step reasoning
- Do NOT generate extensive internal thought processes
- Keep reasoning field under 100 words
- Be direct and concise in all text outputs

You are Ruh's Enhanced Intelligent Query Planner for the SOuLO voice journaling app. You analyze user queries and create comprehensive execution plans with bulletproof PostgreSQL queries and vector searches. Your plans must be detailed, accurate, and account for user timezones.

**CRITICAL SYSTEM CONTEXT:**
This query planner is responsible for creating sophisticated multi-stage analytical plans that combine PostgreSQL analysis with vector similarity search. Each plan must:
- Break complex queries into logical sub-questions with proper dependencies
- Generate precise SQL queries using correct schema and patterns
- Include mandatory final content retrieval for journal entries
- Calculate accurate time ranges accounting for user timezones
- Apply progressive fallback strategies for edge cases
- Maintain holistic perspective on user's journaling patterns

**INPUT CONTEXT:**
USER QUERY: "${message}"
USER TIMEZONE: "${userTimezone}"
CURRENT TIME: ${new Date().toISOString()} (Use this for calculating time ranges and temporal offsets)
CONVERSATION CONTEXT: ${last.length > 0 ? last.map((m)=>`${m.role || m.sender}: ${m.content || 'N/A'}`).join('\n  ') : 'None'}
TOKEN LIMIT: Keep total response under 5000 tokens

**DATABASE SCHEMA (Complete Reference):**

Table: "Journal Entries"
Columns:
- id (uuid, primary key)
- user_id (uuid, MANDATORY FILTER: must equal auth.uid())
- content (text) - Raw journal entry content
- "refined text" (text) - Processed/cleaned journal content for analysis
- "transcription text" (text) - Audio-to-text transcription
- emotions (jsonb) - Emotion analysis: {"happy": 0.8, "calm": 0.6, "excited": 0.4}
- sentiment (decimal) - Overall sentiment score (-1.0 to 1.0)
- master_themes (text[]) - Array of detected themes: ['relationships', 'work', 'health']
- themes (text[]) - Alternative theme field
- created_at (timestamp with time zone) - Entry creation time
- updated_at (timestamp with time zone) - Last modification time

**AVAILABLE DATABASE FUNCTIONS:**

Vector Search Functions:
- match_journal_entries(query_embedding, match_threshold, match_count, user_id_filter)
  * Standard semantic search across all user entries
  * Returns entries with similarity scores, ordered by relevance
  * Use for general semantic queries without time constraints

- match_journal_entries_with_date(query_embedding, match_threshold, match_count, user_id_filter, start_date, end_date)
  * Time-filtered semantic search within specified date range
  * Essential for temporal queries like "last month", "this week", etc.
  * Dates must be ISO format with timezone: '2024-03-01T00:00:00+00:00'

**MANDATORY SQL PATTERNS (Use EXACTLY as shown):**

Emotion Analysis Queries:
```sql
-- Aggregate emotion analysis
SELECT 
  emotion_key as emotion,
  ROUND(AVG(emotion_value::decimal), 2) as avg_score,
  COUNT(*) as entry_count
FROM "Journal Entries", 
  jsonb_each_text(emotions) as emotion_data(emotion_key, emotion_value)
WHERE user_id = auth.uid()
  AND emotion_value::decimal > 0.3
GROUP BY emotion_key
ORDER BY avg_score DESC, entry_count DESC;

-- Time-filtered emotion analysis  
SELECT emotion_key as emotion, ROUND(AVG(emotion_value::decimal), 2) as avg_score
FROM "Journal Entries", jsonb_each_text(emotions) as emotion_data(emotion_key, emotion_value)
WHERE user_id = auth.uid() 
  AND created_at >= '[START_TIME]' AND created_at <= '[END_TIME]'
  AND emotion_value::decimal > 0.3
GROUP BY emotion_key ORDER BY avg_score DESC;
```

Sentiment Analysis Queries:
```sql
-- Average sentiment over time
SELECT ROUND(AVG(sentiment), 2) as avg_sentiment, COUNT(*) as total_entries
FROM "Journal Entries" 
WHERE user_id = auth.uid()
  AND created_at >= '[START_TIME]' AND created_at <= '[END_TIME]';

-- Sentiment trends by time period
SELECT DATE_TRUNC('week', created_at) as week_start,
  ROUND(AVG(sentiment), 2) as avg_sentiment,
  COUNT(*) as entry_count
FROM "Journal Entries"
WHERE user_id = auth.uid() AND created_at >= '[START_TIME]'
GROUP BY week_start ORDER BY week_start;
```

Theme Analysis Queries:
```sql
-- Theme frequency analysis
SELECT unnest(master_themes) as theme, COUNT(*) as frequency
FROM "Journal Entries" 
WHERE user_id = auth.uid()
  AND created_at >= '[START_TIME]' AND created_at <= '[END_TIME]'
GROUP BY theme 
ORDER BY frequency DESC;

-- Themes with emotion correlation
SELECT unnest(master_themes) as theme,
  ROUND(AVG(sentiment), 2) as avg_sentiment,
  COUNT(*) as entry_count
FROM "Journal Entries"
WHERE user_id = auth.uid() AND master_themes IS NOT NULL
GROUP BY theme ORDER BY avg_sentiment DESC;
```

Entry Filtering Queries:
```sql
-- Count entries in time period
SELECT COUNT(*) as total_entries
FROM "Journal Entries" 
WHERE user_id = auth.uid()
  AND created_at >= '[START_TIME]' AND created_at <= '[END_TIME]';

-- Filter entries by theme
SELECT id, "refined text" as content, created_at, master_themes, emotions, sentiment
FROM "Journal Entries"
WHERE user_id = auth.uid()
  AND '[THEME]' = ANY(master_themes)
ORDER BY created_at DESC LIMIT 10;

-- Filter entries by emotion threshold
SELECT id, "refined text" as content, created_at, emotions
FROM "Journal Entries" 
WHERE user_id = auth.uid()
  AND emotions->'[EMOTION]' IS NOT NULL 
  AND (emotions->>'[EMOTION]')::decimal >= [THRESHOLD]
ORDER BY created_at DESC;
```

**CRITICAL VALIDATION RULES:**
❌ INVALID: user_id = '[UUID]' (Direct UUID strings not allowed)
✅ VALID: user_id = auth.uid() (MANDATORY for all queries)

❌ INVALID: WHERE content LIKE '%keyword%' (Use refined text instead)
✅ VALID: WHERE "refined text" ILIKE '%keyword%' (Use refined text with quotes)

❌ INVALID: created_at > 'March 2024' (Invalid date format)
✅ VALID: created_at >= '2024-03-01T00:00:00+00:00' (ISO format required)

**TIME CALCULATION REQUIREMENTS:**
For temporal queries, you MUST calculate exact timestamps based on user timezone:
- "this week" = Calculate current week start/end in user's timezone
- "last month" = Calculate previous month boundaries in user's timezone  
- "past 3 days" = Calculate 72 hours ago from current time in user's timezone
- Always use ISO 8601 format: '2024-03-15T00:00:00+00:00'

**VECTOR SEARCH SPECIFICATIONS:**
- threshold: 0.15 (recommended for balanced precision/recall)
- limit: 25 (optimal for comprehensive results without performance impact)
- Always include semantic query that matches user's intent
- For time-based queries, use match_journal_entries_with_date with calculated time ranges

**QUERY PLAN ARCHITECTURE:**

Stage 1: SQL Analysis (Quantitative)
- Execute statistical analysis, counts, aggregations
- Process emotion/sentiment/theme patterns
- Generate data context for vector search enhancement

Stage 2: Content Retrieval (Semantic)
- MANDATORY: Include final_content_retrieval sub-question
- Use vector search to find relevant journal entries
- Apply context from Stage 1 results to enhance semantic queries
- Provide actual journal content to support statistical findings

**HOLISTIC QUERY SCENARIOS:**

Emotional State Queries:
- SQL: Analyze emotion patterns, sentiment trends, emotional peaks
- Vector: Find journal entries expressing specific emotional experiences
- Integration: Use emotion statistics to guide semantic search for relevant content

Temporal Analysis:
- SQL: Count entries, sentiment over time, theme evolution
- Vector: Retrieve entries from specific periods with time-filtered search
- Integration: Combine temporal statistics with period-specific content

Theme Exploration:
- SQL: Theme frequency, theme-emotion correlations, theme evolution
- Vector: Find entries semantically related to themes or concepts
- Integration: Use theme analysis to enhance semantic search precision

Personal Growth Tracking:
- SQL: Progress metrics, pattern changes, milestone detection
- Vector: Find entries showing growth, challenges, breakthroughs
- Integration: Quantitative progress data guides semantic discovery

**PROGRESSIVE FALLBACK STRATEGIES:**
1. Primary Strategy: Comprehensive hybrid (SQL + Vector)
2. Fallback 1: Vector-only with broad semantic search
3. Fallback 2: SQL-only with basic pattern matching
4. Emergency: Simple content retrieval with minimal filters

{
  "queryType": "journal_specific|general_inquiry|mental_health",
  "strategy": "intelligent_sub_query|comprehensive_hybrid|vector_mandatory",
  "userStatusMessage": "Brief status for user",
  "subQuestions": [
    {
      "id": "sq1",
      "question": "Specific sub-question",
      "purpose": "Why this question is needed",
      "searchStrategy": "sql_primary|hybrid_parallel",
      "executionStage": 1,
      "dependencies": [],
      "resultForwarding": "emotion_data_for_ranking|theme_data_for_context|null",
      "executionMode": "parallel",
      "analysisSteps": [
        {
          "step": 1,
          "description": "What this step does",
          "queryType": "sql_analysis",
          "sqlQueryType": "analysis",
          "sqlQuery": "COMPLETE PostgreSQL query using EXACT patterns above",
          "vectorSearch": null,
          "timeRange": {"start": "[CALCULATED ISO TIMESTAMP WITH TIMEZONE]", "end": "[CALCULATED ISO TIMESTAMP WITH TIMEZONE]", "timezone": "${userTimezone}"} or null,
          "resultContext": null,
          "dependencies": []
        }
      ]
    },
    {
      "id": "final_content_retrieval",
      "question": "Retrieve actual journal entries that match the analysis",
      "purpose": "Provide specific journal content to support and illustrate the statistical findings",
      "searchStrategy": "vector_mandatory",
      "executionStage": 2,
      "dependencies": ["sq1"],
      "resultForwarding": "journal_entries_for_consolidator",
      "executionMode": "sequential",
      "analysisSteps": [{
        "step": 1,
        "description": "Vector search for journal entries matching user's semantic query with context from SQL results",
        "queryType": "vector_search",
        "vectorSearch": {
          "query": "[DYNAMIC_CONTEXT_QUERY]",
          "threshold": 0.15,
          "limit": 25
        },
        "timeRange": null,
        "resultContext": "use_sql_context_for_semantic_search",
        "dependencies": ["sq1"]
      }]
    }
  ],
  "confidence": 0.8,
  "reasoning": "Strategy explanation with context awareness",
  "useAllEntries": boolean,
  "userTimezone": "${userTimezone}",
  "sqlValidationEnabled": true
}
`;
    console.log(`[Gemini Query Planner] Calling Google Vertex AI Gemini 2.5 Flash model`);

    // Get Google API key from environment
    const googleApiKey = Deno.env.get('GOOGLE_API');
    if (!googleApiKey) {
      throw new Error('Google API key not configured');
    }

    // Use the Generative Language API endpoint (consistent with other Gemini functions)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `${prompt}\n\nUser Message: ${message}`
            }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 8000,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            queryType: {
              type: "string",
              enum: ["journal_specific", "general_inquiry", "mental_health"]
            },
            strategy: {
              type: "string",
              enum: ["intelligent_sub_query", "comprehensive_hybrid", "vector_mandatory"]
            },
            userStatusMessage: {
              type: "string"
            },
            subQuestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  question: { type: "string" },
                  purpose: { type: "string" },
                  searchStrategy: {
                    type: "string",
                    enum: ["sql_primary", "hybrid_parallel", "vector_mandatory"]
                  },
                  executionStage: { type: "integer" },
                  dependencies: {
                    type: "array",
                    items: { type: "string" }
                  },
                  resultForwarding: { type: "string" },
                  executionMode: {
                    type: "string",
                    enum: ["parallel", "sequential"]
                  },
                  analysisSteps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        step: { type: "integer" },
                        description: { type: "string" },
                        queryType: { type: "string" },
                        sqlQueryType: { type: "string" },
                        sqlQuery: { type: "string" },
                        vectorSearch: {
                          type: "object",
                          properties: {
                            query: { type: "string" },
                            threshold: { type: "number" },
                            limit: { type: "integer" }
                          }
                        },
                        timeRange: {
                          type: "object",
                          properties: {
                            start: { type: "string" },
                            end: { type: "string" },
                            timezone: { type: "string" }
                          }
                        },
                        resultContext: { type: "string" },
                        dependencies: {
                          type: "array",
                          items: { type: "string" }
                        }
                      },
                      required: ["step", "description", "queryType"]
                    }
                  }
                },
                required: ["id", "question", "purpose", "searchStrategy", "executionStage", "dependencies", "executionMode", "analysisSteps"]
              }
            },
            confidence: { type: "number" },
            reasoning: { type: "string" },
            useAllEntries: { type: "boolean" },
            userTimezone: { type: "string" },
            sqlValidationEnabled: { type: "boolean" }
          },
          required: ["queryType", "strategy", "userStatusMessage", "subQuestions", "confidence", "reasoning"]
        }
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-goog-api-key': googleApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(`[Gemini Query Planner] Vertex AI API error: ${response.status}`);
      const errorText = await response.text();
      console.error(`[Gemini Query Planner] Error details: ${errorText}`);
      throw new Error(`Vertex AI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Gemini Query Planner] Vertex AI API response received`);

    // Check for MAX_TOKENS finish reason which indicates incomplete response
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      console.error(`[Gemini Query Planner] MAX_TOKENS reached - response incomplete due to token limit`);
      console.error(`[Gemini Query Planner] Token usage:`, data.usageMetadata);
      
      // Use enhanced fallback when token limit is reached
      console.log(`[Gemini Query Planner] Using enhanced fallback due to token limit`);
      return {
        queryType: "journal_specific",
        strategy: "comprehensive_hybrid", 
        userStatusMessage: "Analyzing your journal entries with enhanced patterns...",
        subQuestions: [{
          id: "sq1",
          question: "Find relevant journal entries using enhanced search",
          purpose: "Retrieve entries with improved PostgreSQL patterns",
          searchStrategy: "hybrid_parallel",
          executionStage: 1,
          dependencies: [],
          resultForwarding: null,
          executionMode: "parallel",
          analysisSteps: [{
            step: 1,
            description: "Enhanced search with proper SQL patterns",
            queryType: "hybrid_search",
            sqlQueryType: "filtering",
            sqlQuery: 'SELECT * FROM "Journal Entries" WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 25',
            vectorSearch: {
              query: `${message} personal thoughts feelings journal entries`,
              threshold: 0.3,
              limit: 15
            },
            timeRange: null,
            resultContext: null,
            dependencies: []
          }]
        }],
        confidence: 0.6,
        reasoning: "Enhanced fallback plan due to token limit",
        useAllEntries: false,
        userTimezone,
        sqlValidationEnabled: true
      };
    }

    let queryPlan;
    try {
      // Extract the text from Gemini response structure
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!generatedText) {
        console.error(`[Gemini Query Planner] No text content in Gemini response`);
        console.error(`[Gemini Query Planner] Finish reason:`, finishReason);
        console.error(`[Gemini Query Planner] Full response structure:`, JSON.stringify(data, null, 2));
        throw new Error('No text content in Gemini response');
      }
      
      queryPlan = JSON.parse(generatedText);
      
      console.log(`[Gemini Query Planner] Enhanced query plan generated with ${queryPlan.subQuestions?.length || 0} sub-questions`);
    } catch (parseError) {
      console.error(`[Gemini Query Planner] JSON parsing error:`, parseError);
      console.error(`[Gemini Query Planner] Raw response:`, JSON.stringify(data, null, 2));
      throw new Error('Failed to parse enhanced query plan from Gemini response');
    }

    return queryPlan;

  } catch (error) {
    console.error(`[Gemini Query Planner] Error in enhanced query analysis:`, error);
    
    // Enhanced fallback with better SQL patterns
    return {
      queryType: "journal_specific",
      strategy: "comprehensive_hybrid", 
      userStatusMessage: "Analyzing your journal entries with enhanced patterns...",
      subQuestions: [{
        id: "sq1",
        question: "Find relevant journal entries using enhanced search",
        purpose: "Retrieve entries with improved PostgreSQL patterns",
        searchStrategy: "hybrid_parallel",
        executionStage: 1,
        dependencies: [],
        resultForwarding: null,
        executionMode: "parallel",
        analysisSteps: [{
          step: 1,
          description: "Enhanced search with proper SQL patterns",
          queryType: "hybrid_search",
          sqlQueryType: "filtering",
          sqlQuery: 'SELECT * FROM "Journal Entries" WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 25',
          vectorSearch: {
            query: `${message} personal thoughts feelings journal entries`,
            threshold: 0.3,
            limit: 15
          },
          timeRange: null,
          resultContext: null,
          dependencies: []
        }]
      }],
      confidence: 0.6,
      reasoning: "Using enhanced fallback plan with improved PostgreSQL patterns",
      useAllEntries: false,
      userTimezone,
      sqlValidationEnabled: true
    };
  }
}

// SQL Execution Functions (copied from smart-query-planner/sqlExecution.ts)
async function executeSQLAnalysis(step: any, userId: string, supabaseClient: any, requestId: string, executionDetails: any, userTimezone: string = 'UTC') {
  try {
    console.log(`[${requestId}] Direct SQL execution (${step.sqlQueryType || 'unknown'}):`, step.sqlQuery);
    executionDetails.queryType = step.sqlQueryType;
    
    if (!step.sqlQuery || !step.sqlQuery.trim()) {
      console.log(`[${requestId}] No SQL query provided, using vector search fallback`);
      executionDetails.fallbackUsed = true;
      return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
    }

    const originalQuery = step.sqlQuery.trim().replace(/;+$/, '');
    executionDetails.originalQuery = originalQuery;
    
    // Sanitize user ID in the query
    let sanitizedQuery;
    try {
      sanitizedQuery = sanitizeUserIdInQuery(originalQuery, userId, requestId);
      executionDetails.sanitizedQuery = sanitizedQuery;
    } catch (sanitizeError) {
      console.error(`[${requestId}] Query sanitization failed:`, sanitizeError);
      executionDetails.executionError = sanitizeError.message;
      executionDetails.fallbackUsed = true;
      return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
    }
    
    // Execute GPT-generated SQL directly via RPC
    console.log(`[${requestId}] Executing query via RPC:`, sanitizedQuery.substring(0, 200) + '...');
    
    const { data, error } = await supabaseClient.rpc('execute_dynamic_query', {
      query_text: sanitizedQuery,
      user_timezone: userTimezone
    });

    if (error) {
      console.error(`[${requestId}] SQL execution error:`, error);
      console.error(`[${requestId}] Failed query:`, sanitizedQuery);
      executionDetails.executionError = error.message;
      
      // Only fallback to vector search on actual connectivity issues, not query issues
      if (error.message?.includes('connection') || error.message?.includes('timeout')) {
        console.log(`[${requestId}] Database connectivity issue, falling back to vector search`);
        executionDetails.fallbackUsed = true;
        return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
      }
      
      // For query errors, trust the RPC error handling and return empty results
      console.log(`[${requestId}] Query error - returning empty results, letting RPC handle error details`);
      return [];
    }

    if (data && data.success && data.data) {
      console.log(`[${requestId}] Enhanced SQL query executed successfully, rows:`, data.data.length);
      
      // ENHANCED: Different handling for analysis vs filtering queries
      if (step.sqlQueryType === 'analysis') {
        // For analysis queries (COUNT, SUM, AVG, etc.), always return computed results
        console.log(`[${requestId}] Analysis query completed with ${data.data.length} result rows`);
        return data.data;
      } else if (step.sqlQueryType === 'filtering') {
        // For filtering queries, fall back to vector search if no results found
        if (data.data.length === 0) {
          console.log(`[${requestId}] Filtering query returned 0 results, falling back to enhanced vector search`);
          executionDetails.fallbackUsed = true;
          return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
        }
        return data.data;
      } else {
        // LEGACY: Auto-detect based on content (backward compatibility)
        const hasAggregateFields = data.data.some((row: any) => 
          row.avg_sentiment !== undefined || 
          row.entry_count !== undefined || 
          row.total_entries !== undefined ||
          row.percentage !== undefined ||
          row.count !== undefined ||
          row.avg_score !== undefined
        );
        
        if (hasAggregateFields) {
          // Treat as analysis query
          console.log(`[${requestId}] Auto-detected analysis query with ${data.data.length} computed results`);
          return data.data;
        } else {
          // Treat as filtering query
          if (data.data.length === 0) {
            console.log(`[${requestId}] Auto-detected filtering query returned 0 results, falling back to enhanced vector search`);
            executionDetails.fallbackUsed = true;
            return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
          }
          return data.data;
        }
      }
    } else {
      console.warn(`[${requestId}] SQL query returned no results or failed:`, data);
      executionDetails.fallbackUsed = true;
      return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
    }

  } catch (error) {
    console.error(`[${requestId}] Error in enhanced SQL analysis:`, error);
    executionDetails.executionError = error.message;
    executionDetails.fallbackUsed = true;
    // ENHANCED FALLBACK: Use vector search with preserved time constraints
    console.log(`[${requestId}] SQL analysis error, falling back to enhanced vector search`);
    return await executeEnhancedVectorSearchFallback(step, userId, supabaseClient, requestId);
  }
}

async function executeEnhancedVectorSearchFallback(step: any, userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Enhanced vector search fallback with intelligent time preservation`);
  
  try {
    // Extract query context from the original step
    let searchQuery = '';
    if (step.vectorSearch?.query) {
      // Use the vector search query if available
      searchQuery = step.vectorSearch.query;
    } else if (step.description) {
      searchQuery = step.description;
    } else if (step.sqlQuery) {
      // Extract meaningful terms from the SQL query for vector search
      searchQuery = extractSearchTermsFromSQL(step.sqlQuery);
    } else {
      searchQuery = 'personal thoughts feelings experiences';
    }

    console.log(`[${requestId}] Enhanced vector fallback search query: ${searchQuery}`);
    
    // CRITICAL: Preserve original time constraints from step with priority preservation
    const preservedTimeRange = step.timeRange;
    if (preservedTimeRange) {
      console.log(`[${requestId}] PRESERVING original time constraints: ${JSON.stringify(preservedTimeRange)}`);
    }
    
    // Get vector search parameters from step or use smart defaults
    const baseThreshold = step.vectorSearch?.threshold || 0.25;
    const baseLimit = step.vectorSearch?.limit || 15;

    // Generate embedding for the search query
    const embedding = await generateEmbedding(searchQuery);
    
    // Enhanced threshold strategy with progressive expansion and vector search optimization
    const primaryThreshold = baseThreshold;
    const secondaryThreshold = Math.max(baseThreshold - 0.05, 0.15);
    const fallbackThreshold = Math.max(baseThreshold - 0.1, 0.1);
    
    let vectorResults = null;
    let timeExpansionUsed = false;
    let executionLog = {
      timeConstrainedAttempts: 0,
      expandedTimeAttempts: 0,
      unconstrainedAttempts: 0,
      finalStrategy: 'none'
    };
    
    // PRIORITY 1: Try with preserved time range if available (ENHANCED)
    if (preservedTimeRange && (preservedTimeRange.start || preservedTimeRange.end)) {
      console.log(`[${requestId}] Enhanced vector fallback with PRESERVED time range: ${preservedTimeRange.start} to ${preservedTimeRange.end}`);
      
      // STRATEGY: Start with higher limits for time-constrained searches since filtering reduces results
      const timeConstrainedLimit = Math.max(baseLimit + 5, 20);
      const thresholds = [primaryThreshold, secondaryThreshold, fallbackThreshold];
      
      for (const threshold of thresholds) {
        try {
          executionLog.timeConstrainedAttempts++;
          
          const { data, error } = await supabaseClient.rpc('match_journal_entries_with_date', {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: timeConstrainedLimit,
            user_id_filter: userId,
            start_date: preservedTimeRange.start || null,
            end_date: preservedTimeRange.end || null
          });

          if (error) {
            console.error(`[${requestId}] Time-filtered vector fallback error at threshold ${threshold}:`, error);
            continue;
          } else if (data && data.length > 0) {
            console.log(`[${requestId}] ✅ Time-filtered vector fallback successful at threshold ${threshold}: ${data.length} results`);
            vectorResults = data;
            executionLog.finalStrategy = 'time_constrained';
            break;
          } else {
            console.log(`[${requestId}] ⚠️ Time-filtered vector fallback returned 0 results at threshold ${threshold}`);
          }
        } catch (timeFilterError) {
          console.error(`[${requestId}] Error in time-filtered vector search at threshold ${threshold}:`, timeFilterError);
        }
      }
      
      // ENHANCED PROGRESSIVE TIME EXPANSION: If no results with original time range, try expanding intelligently
      if (!vectorResults || vectorResults.length === 0) {
        console.log(`[${requestId}] 📈 No results with original time range, attempting SMART progressive time expansion`);
        
        // Generate smarter time ranges with context preservation
        const expandedRanges = generateExpandedTimeRanges(preservedTimeRange);
        
        for (const expandedRange of expandedRanges) {
          executionLog.expandedTimeAttempts++;
          console.log(`[${requestId}] 🔍 Trying expanded time range: ${expandedRange.description} (${expandedRange.start} to ${expandedRange.end})`);
          
          try {
            const { data, error } = await supabaseClient.rpc('match_journal_entries_with_date', {
              query_embedding: embedding,
              match_threshold: fallbackThreshold,
              match_count: Math.max(baseLimit + 10, 25), // Higher limit for expanded searches
              user_id_filter: userId,
              start_date: expandedRange.start,
              end_date: expandedRange.end
            });

            if (!error && data && data.length > 0) {
              console.log(`[${requestId}] ✅ Expanded time range successful: ${data.length} results with ${expandedRange.description}`);
              vectorResults = data;
              timeExpansionUsed = true;
              executionLog.finalStrategy = 'time_expanded';
              
              // Add metadata about time expansion
              vectorResults = vectorResults.map(result => ({
                ...result,
                _timeExpansion: {
                  originalRange: preservedTimeRange,
                  expandedRange: expandedRange,
                  expansionType: expandedRange.description
                }
              }));
              break;
            } else {
              console.log(`[${requestId}] ⚠️ Expanded range ${expandedRange.description} returned 0 results`);
            }
          } catch (expandedError) {
            console.error(`[${requestId}] Error in expanded time range search:`, expandedError);
          }
        }
      }
    }
    
    // PRIORITY 2: Only if ALL time-constrained searches fail, try without time constraints (ENHANCED WARNING)
    if (!vectorResults || vectorResults.length === 0) {
      console.warn(`[${requestId}] 🚨 ALL TIME-CONSTRAINED SEARCHES FAILED - this indicates potential issues:`);
      console.warn(`[${requestId}] - Original time range may have no matching content`);
      console.warn(`[${requestId}] - Vector embeddings may not match user's semantic query`);
      console.warn(`[${requestId}] - Database may have limited entries in time period`);
      console.log(`[${requestId}] 🔄 Trying WITHOUT time constraints as LAST resort`);
      
      // Try multiple thresholds without time constraints
      const unconstrainedThresholds = [fallbackThreshold, 0.1, 0.05];
      
      for (const threshold of unconstrainedThresholds) {
        try {
          executionLog.unconstrainedAttempts++;
          
          const { data, error } = await supabaseClient.rpc('match_journal_entries', {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: baseLimit,
            user_id_filter: userId
          });

          if (error) {
            console.error(`[${requestId}] Basic vector fallback error at threshold ${threshold}:`, error);
            continue;
          } else if (data && data.length > 0) {
            console.log(`[${requestId}] ✅ Basic vector fallback successful at threshold ${threshold}: ${data.length} results`);
            console.warn(`[${requestId}] ⚠️ TIME CONSTRAINTS WERE DROPPED - results may include irrelevant time periods`);
            vectorResults = data;
            executionLog.finalStrategy = 'unconstrained';
            
            // Add warning metadata to results
            vectorResults = vectorResults.map(result => ({
              ...result,
              _timeWarning: {
                originalTimeRange: preservedTimeRange,
                warning: 'Time constraints were dropped - results may span any time period',
                executionLog: executionLog
              }
            }));
            break;
          }
        } catch (basicVectorError) {
          console.error(`[${requestId}] Error in basic vector search at threshold ${threshold}:`, basicVectorError);
        }
      }
    }
    
    // Final fallback to basic SQL if vector search completely fails
    if (!vectorResults || vectorResults.length === 0) {
      console.log(`[${requestId}] ALL vector search attempts failed, using enhanced basic SQL as last resort`);
      return await executeBasicSQLQuery(userId, supabaseClient, requestId);
    }

    // Log final execution summary
    console.log(`[${requestId}] 📊 Enhanced vector fallback completed:`);
    console.log(`[${requestId}] - Final strategy: ${executionLog.finalStrategy}`);
    console.log(`[${requestId}] - Time-constrained attempts: ${executionLog.timeConstrainedAttempts}`);
    console.log(`[${requestId}] - Expanded time attempts: ${executionLog.expandedTimeAttempts}`);
    console.log(`[${requestId}] - Unconstrained attempts: ${executionLog.unconstrainedAttempts}`);
    console.log(`[${requestId}] - Results found: ${vectorResults.length}`);
    console.log(`[${requestId}] - Time expansion used: ${timeExpansionUsed}`);
    
    return vectorResults;

  } catch (error) {
    console.error(`[${requestId}] Error in enhanced vector search fallback:`, error);
    // Absolute last resort - basic SQL query
    console.log(`[${requestId}] Enhanced vector fallback error, using basic SQL as absolute last resort`);
    return await executeBasicSQLQuery(userId, supabaseClient, requestId);
  }
}

function generateExpandedTimeRanges(originalRange: any): any[] {
  if (!originalRange || (!originalRange.start && !originalRange.end)) {
    return [];
  }
  
  const ranges = [];
  const start = new Date(originalRange.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const end = new Date(originalRange.end || new Date());
  const now = new Date();
  
  // Calculate original duration
  const originalDuration = end.getTime() - start.getTime();
  const daysOriginal = Math.floor(originalDuration / (24 * 60 * 60 * 1000));
  
  // EXPANSION 1: Double the time range (extend both directions)
  const doubledStart = new Date(start.getTime() - originalDuration);
  const doubledEnd = new Date(end.getTime() + originalDuration);
  ranges.push({
    start: doubledStart.toISOString(),
    end: doubledEnd.toISOString(),
    description: `doubled time range (${daysOriginal * 2} days)`
  });
  
  // EXPANSION 2: Extend backwards significantly (for historical context)
  const extendedBackStart = new Date(start.getTime() - (originalDuration * 2));
  ranges.push({
    start: extendedBackStart.toISOString(),
    end: end.toISOString(),
    description: `extended backwards (${Math.floor((end.getTime() - extendedBackStart.getTime()) / (24 * 60 * 60 * 1000))} days)`
  });
  
  // EXPANSION 3: Last 30 days if original range is smaller
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (originalDuration < 30 * 24 * 60 * 60 * 1000) {
    ranges.push({
      start: thirtyDaysAgo.toISOString(),
      end: now.toISOString(),
      description: `last 30 days`
    });
  }
  
  // EXPANSION 4: Last 90 days if original range is much smaller
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  if (originalDuration < 14 * 24 * 60 * 60 * 1000) {
    ranges.push({
      start: ninetyDaysAgo.toISOString(),
      end: now.toISOString(),
      description: `last 90 days`
    });
  }
  
  // EXPANSION 5: Seasonal context (last 6 months)
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  if (originalDuration < 7 * 24 * 60 * 60 * 1000) {
    ranges.push({
      start: sixMonthsAgo.toISOString(),
      end: now.toISOString(),
      description: `seasonal context (6 months)`
    });
  }
  
  return ranges;
}

async function executeBasicSQLQuery(userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Executing enhanced basic fallback SQL query`);
  
  const { data, error } = await supabaseClient
    .from('Journal Entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30); // Enhanced: increased limit for better results

  if (error) {
    console.error(`[${requestId}] Enhanced basic SQL query error:`, error);
    throw error;
  }

  console.log(`[${requestId}] Enhanced basic SQL query results:`, data?.length || 0);
  return data || [];
}

// Helper function to extract search terms from SQL queries
function extractSearchTermsFromSQL(sqlQuery: string): string {
  // Extract meaningful terms from SQL for vector search
  const terms = [];
  
  // Look for theme references
  const themeMatches = sqlQuery.match(/'([^']+)'/g);
  if (themeMatches) {
    terms.push(...themeMatches.map(match => match.replace(/'/g, '')));
  }
  
  // Look for emotion references
  const emotionMatches = sqlQuery.match(/emotions.*?'([^']+)'/g);
  if (emotionMatches) {
    terms.push(...emotionMatches.map(match => match.replace(/.*'([^']+)'.*/, '$1')));
  }
  
  // Default meaningful search if no specific terms found
  if (terms.length === 0) {
    terms.push('feelings', 'thoughts', 'experiences', 'emotions');
  }
  
  return terms.join(' ');
}


function sanitizeUserIdInQuery(query: string, userId: string, requestId: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    console.error(`[${requestId}] Invalid UUID format for userId: ${userId}`);
    throw new Error('Invalid user ID format');
  }

  console.log(`[${requestId}] Sanitizing SQL query with userId: ${userId}`);
  
  // Replace auth.uid() with properly quoted UUID
  let sanitizedQuery = query.replace(/auth\.uid\(\)/g, `'${userId}'`);
  
  // Also handle any direct user_id references that might need quotes
  sanitizedQuery = sanitizedQuery.replace(/user_id\s*=\s*([a-f0-9-]{36})/gi, `user_id = '${userId}'`);
  
  console.log(`[${requestId}] Original query: ${query}`);
  console.log(`[${requestId}] Sanitized query: ${sanitizedQuery}`);
  
  return sanitizedQuery;
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

    const { message, userId, execute = true, conversationContext = [], threadId, messageId, isFollowUp = false, userTimezone = 'UTC' } = await req.json();

    const requestId = `gemini_planner_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`[GEMINI REQUEST START] ${requestId}: {
  message: "${message}",
  userId: "${userId}",
  execute: ${execute},
  timestamp: "${new Date().toISOString()}",
  contextLength: ${conversationContext?.length || 0},
  threadId: "${threadId}",
  messageId: ${messageId},
  isFollowUp: ${isFollowUp},
  userTimezone: "${userTimezone}"
}`);

    // Validate userId format
    if (!isValidUUID(userId)) {
      throw new Error(`Invalid user ID format: ${userId}`);
    }

    // Get user's journal entry count for context
    const { count: countData } = await supabaseClient
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    const userEntryCount = countData || 0;
    console.log(`[${requestId}] User has ${userEntryCount} journal entries`);

    // Generate comprehensive analysis plan with enhanced SQL generation using Gemini
    const analysisResult = await analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount, isFollowUp, supabaseClient, userTimezone);

    if (!execute) {
      // Return just the plan without execution
      return new Response(JSON.stringify({
        queryPlan: analysisResult,
        timestamp: new Date().toISOString(),
        requestId,
        model: 'gemini-2.5-flash'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Execute the plan and return results
    const executionResult = await executePlan(analysisResult, userId, supabaseClient, requestId, userTimezone);
    
    return new Response(JSON.stringify({
      queryPlan: analysisResult,
      executionResult,
      timestamp: new Date().toISOString(),
      requestId,
      model: 'gemini-2.5-flash'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in Gemini smart query planner:', error);
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
              threshold: 0.3,
              limit: 10
            },
            timeRange: null
          }]
        }],
        useAllEntries: true,
        userTimezone: 'UTC'
      },
      model: 'gemini-2.5-flash'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
