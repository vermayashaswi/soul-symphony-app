import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { executeSQLAnalysis, executeBasicSQLQuery } from '../smart-query-planner/sqlExecution.ts';

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
    
    const prompt = `You are Ruh's Enhanced Intelligent Query Planner - a precise execution engine for a voice journaling app called SOuLO. Your job is to analyze user queries and return structured JSON plans with BULLETPROOF PostgreSQL queries.

===== COMPLETE JOURNAL ENTRIES TABLE COLUMN SPECIFICATION =====
In this databse we have a table: "Journal Entries" (ALWAYS use quotes); this contains all user's journal entries on the app SOuLO
MANDATORY COLUMNS & DATA TYPES listed below(PostgreSQL):

1. **id** (bigint, Primary Key): Entry identifier
   ✅ VALID: entries.id = 123
   ❌ INVALID: entries.id::text = '123'
   Example data in column on table: "605" 

2. **user_id** (uuid, NOT NULL): User identifier ("ID of the user who created this entry - MUST be included in all queries for user isolation)
   ✅ VALID: entries.user_id = auth.uid()
   ✅ VALID: entries.user_id = '1e7caad7-180d-439c-abd4-2f0d45256f68'
   ❌ INVALID: entries.user_id::text = 'uuid-string'
   Example data in column on table: "1e7caad7-180d-439c-abd4-2f0d45256f68"

3. **"refined text"** (text, Nullable): Main content - ALWAYS use quotes
   ✅ VALID: entries."refined text"
   ✅ VALID: COALESCE(entries."refined text", entries."transcription text") as content
   ❌ INVALID: entries.refined_text, entries.refinedtext
   Example data in column on table: "Today was very productive. I finished all my pending work and also started working on a new project. I feel quite satisfied on days when everything seems to be on track. Even meditation helped improve my focus today."

5. **sentiment** (real, Nullable): Sentiment score (-1 to 1)
   Example data in column on table: "0.4"
   ✅ VALID: ROUND(AVG(entries.sentiment::numeric), 3) as avg_sentiment
   ✅ VALID: entries.sentiment::numeric > 0.5
   ❌ BROKEN: ROUND(AVG(entries.sentiment), 3) -- WILL FAIL: real type incompatible
   ❌ BROKEN: SELECT sentiment FROM... -- Direct real math operations fail

6. **emotions** (jsonb, Nullable): Emotion scores as {"emotion": 0.85}
   Example data in column on table: {"joy": 0.4, "pride": 0.3, "relief": 0.5, "sadness": 0.5, "contentment": 0.6}
   ✅ VALID: SELECT e.key as emotion, ROUND(AVG((e.value::text)::numeric), 3) as avg_score FROM "Journal Entries" entries, jsonb_each(entries.emotions) e WHERE entries.user_id = auth.uid() GROUP BY e.key
   ✅ VALID: entries.emotions ? 'happiness' AND (entries.emotions->>'happiness')::numeric > 0.5
   ❌ BROKEN: jsonb_object_keys(emotions) -- Function doesn't exist
   ❌ BROKEN: json_object_keys(emotions) -- Wrong function for jsonb
   - This column only contain fixed values from this list (nothing else): "amusement","anger", "anticipation",
          "anxiety", "awe", "boredom", "compassion", "concern", "confidence", "confusion", "contentment", "curiosity", "depression",
          "disappointment","disgust","embarrassment","empathy","Enthusiasm","envy","excitement","fear","frustration","gratitude","guilt",
          "hate","hope","hurt","interest","jealousy","joy","loneliness","love","nostalgia","optimism","overwhelm","pessimism","pride",
          "relief","remorse","sadness","satisfaction","serenity","shame","surprise","trust",
   

7. **master_themes** (text[], Nullable): Theme categories
   Example data in column on table: ["Mental Health","Creativity & Hobbies","Self & Identity"]
   ✅ VALID: SELECT theme, COUNT(*) FROM "Journal Entries" entries, unnest(entries.master_themes) as theme WHERE entries.user_id = auth.uid() GROUP BY theme
   ✅ VALID: entries.master_themes @> ARRAY['work']
   ✅ VALID: 'work' = ANY(entries.master_themes)
   ❌ INVALID: entries.master_themes[0] -- Direct array indexing risky
   - This column only contain fixed values from this list (nothing else): 
           "Self & Identity" (description: "Personal growth, self-reflection, and identity exploration")
           "Body & Health" (description: "Physical health, fitness, body image, and medical concerns")
           "Mental Health" (description: "Emotional wellbeing, mental health challenges, and therapy")
           "Romantic Relationships" (description: "Dating, marriage, partnerships, and romantic connections")
           "Family" (description: "Family relationships, parenting, and family dynamics")
           "Friendships & Social Circle" (description: "Friendships, social connections, and community")
           "Career & Workplace" (description: "Work, career development, and professional relationships")
           "Money & Finances" (description: "Financial planning, money management, and economic concerns")
           "Education & Learning" (description: "Formal education, skill development, and learning experiences")
           "Habits & Routines" (description: "Daily habits, routines, and lifestyle patterns")
           "Sleep & Rest" (description: "Sleep quality, rest, and recovery")
           "Creativity & Hobbies" (description: "Creative pursuits, hobbies, and artistic expression")
           "Spirituality & Beliefs" (description: "Spiritual practices, religious beliefs, and philosophy")
           "Technology & Social Media" (description: "Digital life, social media, and technology use")
           "Environment & Living Space" (description: "Home, living environment, and physical spaces")
           "Time & Productivity" (description: "Time management, productivity, and organization")
           "Travel & Movement" (description: "Travel experiences, moving, and location changes")
           "Loss & Grief" (description: "Dealing with loss, grief, and major life transitions")
           "Purpose & Fulfillment" (description: "Life purpose, meaning, and personal fulfillment")
           "Conflict & Trauma" (description: "Conflict resolution, trauma processing, and difficult experiences")
           "Celebration & Achievement" (description: "Achievements, celebrations, and positive milestones")
        

8. **entities** (jsonb, Nullable): Named entities as {"person": ["John", "Mary"]}
   Example data in column on table: ["life of surprises","walk in nature","AI project"]
   ✅ VALID: SELECT entity_name, COUNT(*) FROM "Journal Entries" entries, jsonb_each(entries.entities) as ent(ent_key, ent_value), jsonb_array_elements_text(ent_value) as entity_name WHERE entries.user_id = auth.uid() GROUP BY entity_name
   ❌ INVALID: Mixing jsonb functions incorrectly
   
9. **created_at** (timestamp with time zone, NOT NULL): Entry creation time (description: "When the journal entry was created - use for temporal analysis and date filtering")
   Example data in column on table: "2025-06-02 00:23:49.641397+00"
   ✅ VALID: entries.created_at >= (NOW() AT TIME ZONE '${userTimezone}' - INTERVAL '7 days')
   ✅ VALID: entries.created_at >= '2025-08-21T00:00:00+05:30'::timestamptz
   ✅ VALID: DATE_TRUNC('day', entries.created_at AT TIME ZONE '${userTimezone}')
   ❌ INVALID: created_at > 'today' -- Use proper timestamp

10. **duration** (numeric, Nullable): Journal Entry length in seconds
    Example data in column on table: "19"
    ✅ VALID: entries.duration > 60.0
    ✅ VALID: AVG(entries.duration)

11. **themeemotion** (jsonb, Nullable): Mater_Theme-emotions relationships
Example data in column on table:{"Mental Health": {"relief": 0.5, "sadness": 0.5, "contentment": 0.6}, "Self & Identity": {"pride": 0.3, "relief": 0.5, "contentment": 0.6}, "Creativity & Hobbies": {"joy": 0.4, "pride": 0.3, "contentment": 0.6}}
    ✅ VALID: jsonb_each(entries.themeemotion)
    NOTE: This only contains combinations of "master_themes" and "emotions" column values , noting else! 
    
12. **themes** (text[], Nullable): general conversational topical themes
    Example data in column on table: ["life of surprises","walk in nature","AI project"]      
    NOTE: This column doesn't have any constrained master list 

===== JOURNAL EMBEDDINGS TABLE SPECIFICATION =====
We also have a related table "journal_embeddings" for vector search operations:

Table: "journal_embeddings"
COLUMNS:
1. **id** (bigint, Primary Key): Embedding identifier
2. **journal_entry_id** (bigint, NOT NULL): Foreign key to "Journal Entries".id
3. **embedding** (vector, NOT NULL): Vector embedding for semantic search
4. **content** (text, NOT NULL): Text content used to generate the embedding
5. **created_at** (timestamp with time zone, NOT NULL): When embedding was created

VECTOR SEARCH FUNCTIONS:
1. **match_journal_entries(query_embedding, match_threshold, match_count, user_id_filter)**
   - Basic vector search without time constraints
   - Returns: id, content, similarity, embedding, created_at, themes, emotions
   
2. **match_journal_entries_with_date(query_embedding, match_threshold, match_count, user_id_filter, start_date, end_date)**
   - Vector search with time range filtering (REQUIRED for time-based queries)
   - Returns: id, content, created_at, similarity, themes, emotions
   
3. **match_journal_entries_by_emotion(emotion_name, user_id_filter, min_score, start_date, end_date, limit_count)**
   - Search entries by specific emotion with optional time filtering
   - Returns: id, content, created_at, emotion_score, embedding
   
4. **match_journal_entries_by_entity_emotion(entity_queries, emotion_queries, user_id_filter, match_threshold, match_count, start_date, end_date)**
   - Search entries matching both entities and emotions with relationship analysis
   - Returns: id, content, created_at, entities, emotions, entityemotion, similarity, entity_emotion_matches, relationship_strength

VECTOR SEARCH USAGE RULES:
- For time-constrained queries: ALWAYS use match_journal_entries_with_date
- For basic semantic search: Use match_journal_entries  
- For emotion-specific search: Use match_journal_entries_by_emotion
- For entity-emotion relationships: Use match_journal_entries_by_entity_emotion
- Threshold: 0.12-0.18 for time-constrained searches (lower to compensate for filtering)
- Limit: 20-30 for time-constrained searches (higher to ensure good results)

12. **entityemotion** (jsonb, Nullable): Entity-emotion relationships  
     ✅ VALID: jsonb_each(entries.entityemotion)

===== CRITICAL DATA TYPE CASTING RULES =====

**REAL TO NUMERIC CASTING (MANDATORY for sentiment):**
✅ CORRECT: entries.sentiment::numeric
✅ CORRECT: ROUND(AVG(entries.sentiment::numeric), 3)
✅ CORRECT: CAST(entries.sentiment AS numeric)
❌ BROKEN: ROUND(AVG(entries.sentiment), 3) -- WILL FAIL
❌ BROKEN: entries.sentiment + 1 -- WILL FAIL

**JSONB VALUE EXTRACTION:**
✅ CORRECT: (entries.emotions->>'happiness')::numeric
✅ CORRECT: (e.value::text)::numeric from jsonb_each
❌ BROKEN: entries.emotions->'happiness'::numeric -- Wrong cast order

**TEXT ARRAY OPERATIONS:**
✅ CORRECT: unnest(entries.master_themes) as theme
✅ CORRECT: array_length(entries.master_themes, 1)
❌ BROKEN: entries.master_themes[*] -- Postgres doesn't support

===== MANDATORY SQL PATTERNS =====

EMOTION ANALYSIS (COPY EXACTLY):
SELECT e.key as emotion, ROUND(AVG((e.value::text)::numeric), 3) as avg_score 
FROM "Journal Entries" entries, jsonb_each(entries.emotions) e 
WHERE entries.user_id = auth.uid() 
GROUP BY e.key 
ORDER BY avg_score DESC LIMIT 5

SENTIMENT ANALYSIS (COPY EXACTLY):
SELECT ROUND(AVG(entries.sentiment::numeric), 3) as avg_sentiment 
FROM "Journal Entries" entries 
WHERE entries.user_id = auth.uid()

THEME ANALYSIS (COPY EXACTLY):
SELECT theme, COUNT(*) as count 
FROM "Journal Entries" entries, unnest(entries.master_themes) as theme 
WHERE entries.user_id = auth.uid() 
GROUP BY theme 
ORDER BY count DESC LIMIT 5

TIME-FILTERED CONTENT (COPY EXACTLY):
SELECT entries.id, entries."refined text", entries.created_at
FROM "Journal Entries" entries
WHERE entries.user_id = auth.uid() 
AND entries.created_at >= (NOW() AT TIME ZONE '${userTimezone}' - INTERVAL '7 days')
ORDER BY entries.created_at DESC

===== CRITICAL: VECTOR SEARCH FUNCTION SPECIFICATION =====

ONLY FUNCTION FOR TIME-CONSTRAINED VECTOR SEARCH:
Function: match_journal_entries_with_date
Parameters: (query_embedding, match_threshold, match_count, user_id_filter, start_date, end_date)

WHEN TO USE VECTOR SEARCH WITH TIME:
- User mentions specific time periods (this week, last month, recently, etc.)
- Emotional/semantic queries with time context
- Theme analysis over time periods
- Any question combining content search + time filter

VECTOR SEARCH PARAMETERS:
- threshold: 0.12-0.18 for time-constrained (LOWERED to compensate for filtering)
- limit: 20-30 for time-constrained (INCREASED to compensate for filtering)  
- query: Use user's semantic terms + EMOTION FAMILIES + context (emotions, themes, time words)

**CRITICAL: EMOTION-ENHANCED VECTOR QUERIES:**
- If user mentions sadness → "sadness depression hurt disappointment loneliness feelings emotions mood recent"
- If user mentions happiness → "happiness joy contentment gratitude celebration feelings emotions mood recent"  
- If user mentions anxiety → "anxiety worry stress overwhelm concern fear feelings emotions mood recent"
- If user mentions any emotion → ALWAYS include related emotions from the same family

ANALYSIS STATUS:
- User timezone: ${userTimezone}

SUB-QUESTION/QUERIES GENERATION GUIDELINE (MANDATORY): 
- Break down user query (MANDATORY: remember that current user message might not be a direct query, so you'll have to look in to the conversation context provided to you and look at last user messages to guess the "ASK" and accordingly frame the sub-questions) into ATLEAST 2 sub-questions or more such that all sub-questions can be consolidated to answer the user's ASK 
- **MANDATORY: Understand user queries in context of PREVIOUS AI RESPONSES with HIGH CONFIDENCE** - If chatbot said "You've been dealing with hope and anxiety emotions" and user asks "What's been their scores", focus ONLY on hope and anxiety scores. If AI mentioned "work stress themes" and user asks "how often", focus specifically on work stress frequency.
- CRITICAL: When analyzing vague queries like "I'm confused between these two options" or "help me decide", look at the FULL conversation history to understand what the two options are (e.g., "jobs vs startup", "career choices", etc.) and generate specific sub-questions about those topics
- If user's query is vague, examine the complete conversation history to derive what the user wants to know and frame sub-questions that address their specific decision or dilemma
- For career/life decisions: Generate sub-questions about patterns, emotions, and insights related to the specific options being considered

===== MANDATORY FINAL VECTOR SEARCH REQUIREMENT =====

**CRITICAL: ALL QUERY PLANS MUST END WITH A JOURNAL CONTENT RETRIEVAL STEP**

Every query plan MUST include a final vector search step that:
1. Retrieves actual journal entry content to support SQL analysis results
2. Uses semantic terms from the user's original query + analysis context
3. Applies time range and filters established by previous SQL steps
4. Provides specific journal excerpts for the consolidator to quote and reference
5. Ensures responses are both quantified (SQL data) AND evidence-backed (journal content)

**MANDATORY FINAL STEP TEMPLATE (COPY EXACTLY):**
{
  "id": "final_content_retrieval",
  "question": "Retrieve actual journal entries that match the analysis",
  "purpose": "Provide specific journal content to support and illustrate the statistical findings from previous SQL analysis",
  "searchStrategy": "vector_mandatory",
  "executionStage": 2,
  "dependencies": ["sq1", "sq2", "sq3"],
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
    "timeRange": "[Inherit from previous SQL analysis timeRange if any]",
    "resultContext": "unrestricted_with_time_filter",
    "dependencies": ["sq1", "sq2"]
  }]
}

**RESPONSE FORMAT (MUST be valid JSON):**
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
    }
  ],
  "confidence": 0.8,
  "reasoning": "Strategy explanation with context awareness",
  "useAllEntries": boolean,
  "userTimezone": "${userTimezone}",
  "sqlValidationEnabled": true
}

**MANDATORY QUALITY CHECKS:**
✓ All SQL queries use exact patterns from examples above
✓ timeRange preserved across ALL analysisSteps when applicable
✓ JSONB queries use jsonb_each() not json_object_keys()
✓ Proper column/table quoting with spaces
✓ Timezone-aware date operations
✓ EVERY time reference in user query MUST have calculated timeRange with actual ISO timestamps
✓ NO null timeRange when user mentions any temporal phrases
✓ ALL timestamps MUST include proper timezone offset for "${userTimezone}"

**FINAL VALIDATION - TIME RANGE REQUIREMENTS:**
- If user mentions "today", "yesterday", "this week", "last week", "recently", "lately", "past few days", "last N days/weeks/months" → timeRange is MANDATORY
- Calculate actual start/end timestamps, don't use placeholders
- Use proper timezone offset for "${userTimezone}"
- Both SQL and vector search steps MUST include the same timeRange when time is mentioned`;

    console.log(`[Gemini Query Planner] Calling Google Vertex AI Gemini 2.5 Flash model`);

    // Get Google API key from environment
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      throw new Error('Google API key not configured');
    }

    // Construct the Vertex AI endpoint URL for Gemini 2.5 Flash
    const projectId = 'your-project-id'; // This should be configured as an environment variable
    const region = 'us-central1';
    const model = 'gemini-2.5-flash-002';
    const endpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${prompt}\n\nUser Message: ${message}`
            }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 2500,
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${googleApiKey}`,
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

    let queryPlan;
    try {
      // Extract the text from Gemini response structure
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!generatedText) {
        throw new Error('No text content in Gemini response');
      }
      
      queryPlan = JSON.parse(generatedText);
      
      console.log(`[Gemini Query Planner] Enhanced query plan generated with ${queryPlan.subQuestions?.length || 0} sub-questions`);
    } catch (parseError) {
      console.error(`[Gemini Query Planner] JSON parsing error:`, parseError);
      console.error(`[Gemini Query Planner] Raw response:`, data);
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
