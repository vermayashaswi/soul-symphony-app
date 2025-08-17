
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
  subQuestions?: string[];
  expectedResponseType: string;
  confidence: number;
  reasoning: string;
  databaseContext: string;
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function sanitizeUserIdInQuery(query: string, userId: string, requestId: string): string {
  if (!isValidUUID(userId)) {
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

function validateSQLQuery(query: string, requestId: string): { isValid: boolean; error?: string } {
  try {
    const upperQuery = query.toUpperCase().trim();
    
    console.log(`[${requestId}] Validating SQL query: ${query.substring(0, 100)}...`);
    
    // Check for dangerous operations
    const dangerousKeywords = ['DROP', 'DELETE FROM', 'INSERT INTO', 'UPDATE SET', 'CREATE', 'ALTER', 'TRUNCATE'];
    for (const keyword of dangerousKeywords) {
      if (upperQuery.includes(keyword)) {
        const error = `Dangerous SQL keyword detected: ${keyword}`;
        console.error(`[${requestId}] ${error}`);
        return { isValid: false, error };
      }
    }
    
    // Ensure it's a SELECT query
    if (!upperQuery.startsWith('SELECT')) {
      const error = 'Only SELECT queries are allowed';
      console.error(`[${requestId}] ${error}`);
      return { isValid: false, error };
    }
    
    // More flexible table reference check - allow various forms
    const hasJournalReference = upperQuery.includes('JOURNAL ENTRIES') || 
                               upperQuery.includes('"JOURNAL ENTRIES"') ||
                               upperQuery.includes('`JOURNAL ENTRIES`') ||
                               upperQuery.includes('ENTRIES');
    
    if (!hasJournalReference) {
      const error = 'Query must reference Journal Entries table';
      console.error(`[${requestId}] ${error}`);
      return { isValid: false, error };
    }
    
    // Check for basic SQL injection patterns
    const injectionPatterns = [
      /;\s*(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER)/i,
      /UNION\s+SELECT/i,
      /--\s*$/m,
      /\/\*.*\*\//s
    ];
    
    for (const pattern of injectionPatterns) {
      if (pattern.test(query)) {
        const error = 'Potential SQL injection pattern detected';
        console.error(`[${requestId}] ${error}`);
        return { isValid: false, error };
      }
    }
    
    console.log(`[${requestId}] SQL query validation passed`);
    return { isValid: true };
  } catch (error) {
    console.error(`[${requestId}] SQL validation error:`, error);
    return { isValid: false, error: `Validation error: ${error.message}` };
  }
}

async function executePlan(plan: any, userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Executing plan:`, JSON.stringify(plan, null, 2));

  const results = [];

  for (const subQuestion of plan.subQuestions) {
    console.log(`[${requestId}] Executing sub-question:`, subQuestion.question);

    const subResults = {
      subQuestion: subQuestion,
      researcherOutput: null,
      executionResults: {
        sqlResults: [],
        vectorResults: [],
        error: null,
        sqlExecutionDetails: {
          originalQuery: null,
          sanitizedQuery: null,
          validationResult: null,
          executionError: null,
          fallbackUsed: false
        }
      }
    };

    try {
      for (const step of subQuestion.analysisSteps) {
        console.log(`[${requestId}] Executing analysis step:`, step.step, step.description);

        if (step.queryType === 'vector_search') {
          console.log(`[${requestId}] Vector search:`, step.vectorSearch.query);
          const vectorResult = await executeVectorSearch(step, userId, supabaseClient, requestId);
          subResults.executionResults.vectorResults = vectorResult || [];
        } else if (step.queryType === 'sql_analysis') {
          console.log(`[${requestId}] SQL analysis:`, step.sqlQuery);
          const sqlResult = await executeSQLAnalysis(step, userId, supabaseClient, requestId, subResults.executionResults.sqlExecutionDetails);
          subResults.executionResults.sqlResults = sqlResult || [];
        } else if (step.queryType === 'hybrid_search') {
          console.log(`[${requestId}] Hybrid search:`, step.vectorSearch.query, step.sqlQuery);
          const hybridResult = await executeHybridSearch(step, userId, supabaseClient, requestId, subResults.executionResults.sqlExecutionDetails);
          subResults.executionResults.vectorResults = hybridResult?.vectorResults || [];
          subResults.executionResults.sqlResults = hybridResult?.sqlResults || [];
        }
      }
    } catch (stepError) {
      console.error(`[${requestId}] Error executing steps:`, stepError);
      subResults.executionResults.error = stepError.message;
    }

    results.push(subResults);
  }

  console.log(`[${requestId}] Execution complete. Results count:`, results.length);
  return results;
}

async function executeVectorSearch(step: any, userId: string, supabaseClient: any, requestId: string) {
  try {
    const embedding = await generateEmbedding(step.vectorSearch.query);
    
    let vectorResults;
    if (step.timeRange) {
      // Use time-filtered vector search
      const { data, error } = await supabaseClient.rpc('match_journal_entries_with_date', {
        query_embedding: embedding,
        match_threshold: step.vectorSearch.threshold || 0.3,
        match_count: step.vectorSearch.limit || 15,
        user_id_filter: userId,
        start_date: step.timeRange.start || null,
        end_date: step.timeRange.end || null
      });

      if (error) {
        console.error(`[${requestId}] Time-filtered vector search error:`, error);
        throw error;
      }
      vectorResults = data;
    } else {
      // Use standard vector search
      const { data, error } = await supabaseClient.rpc('match_journal_entries', {
        query_embedding: embedding,
        match_threshold: step.vectorSearch.threshold || 0.3,
        match_count: step.vectorSearch.limit || 15,
        user_id_filter: userId
      });

      if (error) {
        console.error(`[${requestId}] Vector search error:`, error);
        throw error;
      }
      vectorResults = data;
    }

    console.log(`[${requestId}] Vector search results:`, vectorResults?.length || 0);
    return vectorResults || [];

  } catch (error) {
    console.error(`[${requestId}] Error in vector search:`, error);
    throw error;
  }
}

async function executeSQLAnalysis(step: any, userId: string, supabaseClient: any, requestId: string, executionDetails: any) {
  try {
    console.log(`[${requestId}] Executing SQL query:`, step.sqlQuery);
    
    if (!step.sqlQuery || !step.sqlQuery.trim()) {
      console.log(`[${requestId}] No SQL query provided, using fallback`);
      executionDetails.fallbackUsed = true;
      return await executeBasicSQLQuery(userId, supabaseClient, requestId);
    }

    const originalQuery = step.sqlQuery.trim();
    executionDetails.originalQuery = originalQuery;
    
    // Validate the SQL query
    const validationResult = validateSQLQuery(originalQuery, requestId);
    executionDetails.validationResult = validationResult;
    
    if (!validationResult.isValid) {
      console.error(`[${requestId}] SQL query validation failed: ${validationResult.error}`);
      executionDetails.fallbackUsed = true;
      return await executeBasicSQLQuery(userId, supabaseClient, requestId);
    }
    
    // Sanitize user ID in the query
    let sanitizedQuery;
    try {
      sanitizedQuery = sanitizeUserIdInQuery(originalQuery, userId, requestId);
      executionDetails.sanitizedQuery = sanitizedQuery;
    } catch (sanitizeError) {
      console.error(`[${requestId}] Query sanitization failed:`, sanitizeError);
      executionDetails.executionError = sanitizeError.message;
      executionDetails.fallbackUsed = true;
      return await executeBasicSQLQuery(userId, supabaseClient, requestId);
    }
    
    // Use the execute_dynamic_query function to safely run GPT-generated SQL
    console.log(`[${requestId}] Executing sanitized query via RPC:`, sanitizedQuery.substring(0, 200) + '...');
    
    const { data, error } = await supabaseClient.rpc('execute_dynamic_query', {
      query_text: sanitizedQuery
    });

    if (error) {
      console.error(`[${requestId}] SQL execution error:`, error);
      console.error(`[${requestId}] Failed query:`, sanitizedQuery);
      executionDetails.executionError = error.message;
      executionDetails.fallbackUsed = true;
      
      // Enhanced error logging for debugging
      if (error.code) {
        console.error(`[${requestId}] PostgreSQL error code: ${error.code}`);
      }
      if (error.details) {
        console.error(`[${requestId}] PostgreSQL error details: ${error.details}`);
      }
      if (error.hint) {
        console.error(`[${requestId}] PostgreSQL error hint: ${error.hint}`);
      }
      
      // Fallback to basic query if dynamic execution fails
      return await executeBasicSQLQuery(userId, supabaseClient, requestId);
    }

    if (data && data.success && data.data) {
      console.log(`[${requestId}] SQL query executed successfully, rows:`, data.data.length);
      return data.data;
    } else {
      console.warn(`[${requestId}] SQL query returned no results or failed:`, data);
      executionDetails.fallbackUsed = true;
      return await executeBasicSQLQuery(userId, supabaseClient, requestId);
    }

  } catch (error) {
    console.error(`[${requestId}] Error in SQL analysis:`, error);
    executionDetails.executionError = error.message;
    executionDetails.fallbackUsed = true;
    // Fallback to basic query on error
    return await executeBasicSQLQuery(userId, supabaseClient, requestId);
  }
}

async function executeBasicSQLQuery(userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Executing basic fallback SQL query`);
  
  const { data, error } = await supabaseClient
    .from('Journal Entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error(`[${requestId}] Basic SQL query error:`, error);
    throw error;
  }

  console.log(`[${requestId}] Basic SQL query results:`, data?.length || 0);
  return data || [];
}

async function executeHybridSearch(step: any, userId: string, supabaseClient: any, requestId: string, executionDetails: any) {
  try {
    // Execute both vector and SQL searches in parallel
    const [vectorResults, sqlResults] = await Promise.all([
      executeVectorSearch(step, userId, supabaseClient, requestId),
      executeSQLAnalysis(step, userId, supabaseClient, requestId, executionDetails)
    ]);

    console.log(`[${requestId}] Hybrid search results - Vector: ${vectorResults?.length || 0}, SQL: ${sqlResults?.length || 0}`);
    
    return {
      vectorResults: vectorResults || [],
      sqlResults: sqlResults || []
    };

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

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small', // Use same model as journal embeddings
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
 * Enhanced Analyst Agent with improved SQL generation and error handling
 */
async function analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount, isFollowUp = false, supabaseClient, userTimezone = 'UTC') {
  try {
    const last = Array.isArray(conversationContext) ? conversationContext.slice(-5) : [];
    
    console.log(`[Analyst Agent] Processing query with user timezone: ${userTimezone}`);
    
    // Get live database schema with real themes and emotions using the authenticated client
    const databaseSchemaContext = await generateDatabaseSchemaContext(supabaseClient);

    const contentSeekingPatterns = [
      // Direct content queries
      /\b(what did i write|what did i say|what did i journal|show me|tell me about|find|entries about)\b/i,
      /\b(content|text|wrote|said|mentioned|discussed|talked about)\b/i,
      
      // Emotional and reflective queries
      /\b(how (was|am) i feeling|what was going through my mind|emotional state|mood)\b/i,
      /\b(reflect|reflection|introspect|self-awareness|personal growth)\b/i,
      
      // Comparative and similarity queries
      /\b(similar to|like when i|reminds me of|compare|comparison|patterns like)\b/i,
      /\b(times when|occasions|moments|experiences like)\b/i,
      
      // Thematic and exploratory queries  
      /\b(themes around|insights about|patterns in|explore|analyze|analysis)\b/i,
      /\b(thoughts on|feelings about|perspective on|views on)\b/i,
      
      // Example and sample seeking
      /\b(examples|instances|cases|samples|excerpts|quotes)\b/i,
      /\b(give me|show me|find me|list)\b/i,
      
      // Achievement and progress queries
      /\b(achievement|progress|accomplishment|success|breakthrough|milestone)\b/i,
      /\b(what i achieved|how i grew|what i learned|realizations)\b/i
    ];

    const isContentSeekingQuery = contentSeekingPatterns.some(pattern => pattern.test(message.toLowerCase()));

    // Enhanced patterns for queries that MANDATE vector search regardless of time components
    const mandatoryVectorPatterns = [
      /\b(exactly|specifically|precisely|detailed|in-depth)\b/i,
      /\b(achievement|reflection|insights?|realizations?|breakthroughs?)\b/i,
      /\b(how do i feel|what emotions|emotional journey|mental state)\b/i,
      /\b(creative|inspirational|meaningful|significant|important)\b/i,
      /\b(personal growth|self-discovery|learning|wisdom|understanding)\b/i
    ];

    const requiresMandatoryVector = mandatoryVectorPatterns.some(pattern => pattern.test(message.toLowerCase()));

    // Detect personal pronouns for personalized queries
    const hasPersonalPronouns = /\b(i|me|my|mine|myself)\b/i.test(message.toLowerCase());

    // Enhanced time reference detection
    const hasExplicitTimeReference = /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night|august|january|february|march|april|may|june|july|september|october|november|december)\b/i.test(message.toLowerCase());

    // Detect follow-up context queries
    const isFollowUpContext = isFollowUp || /\b(that|those|it|this|these|above|mentioned|said|talked about)\b/i.test(message.toLowerCase());
    
    console.log(`[Analyst Agent] Enhanced analysis - Content-seeking: ${isContentSeekingQuery}, Mandatory vector: ${requiresMandatoryVector}, Personal: ${hasPersonalPronouns}, Time ref: ${hasExplicitTimeReference}, Follow-up: ${isFollowUpContext}`);

    const prompt = `You are SOULo's Enhanced Analyst Agent - an intelligent query planning specialist for journal data analysis with MANDATORY VECTOR SEARCH for content-seeking queries and TIMEZONE-AWARE date processing.

${databaseSchemaContext}

**CRITICAL DATABASE CONTEXT ADHERENCE:**
- You MUST ONLY use table names, column names, and data types that exist in the database schema above
- DO NOT hallucinate or invent table structures, column names, or data types
- STICK STRICTLY to the provided database schema context
- If uncertain about a database structure, use basic select queries instead of complex ones

**ENHANCED SQL QUERY GENERATION GUIDELINES:**

1. **UUID and User ID Requirements:**
   - ALWAYS use auth.uid() for user filtering (it will be replaced with the actual UUID)
   - NEVER hardcode user IDs or generate fake UUIDs
   - Example: WHERE user_id = auth.uid()

2. **Table and Column References:**
   - Use "Journal Entries" (with quotes) for the table name
   - Valid columns: id, user_id, created_at, "refined text", "transcription text", emotions, master_themes, entities, sentiment
   - Use COALESCE for text fields: COALESCE("refined text", "transcription text")

3. **JSON Operations on emotions/entities columns:**
   - For emotions: jsonb_each(emotions) to expand, emotions->>'emotion_name' for specific values
   - For entities: jsonb_each(entities) for types, jsonb_array_elements_text() for values
   - Example: SELECT emotion_key, AVG((emotion_value::text)::numeric) FROM "Journal Entries", jsonb_each(emotions) WHERE user_id = auth.uid() GROUP BY emotion_key

4. **Safe Query Patterns:**
   - Always include user_id = auth.uid() in WHERE clause
   - Use proper PostgreSQL syntax with double quotes for table/column names with spaces
   - Avoid complex nested queries - keep it simple and working
   - Use standard aggregation functions: COUNT, AVG, MAX, MIN, SUM

**WORKING SQL EXAMPLES FOR REFERENCE:**

1. **Basic Entry Query:**
\`\`\`sql
SELECT id, COALESCE("refined text", "transcription text") as content, created_at, emotions, master_themes 
FROM "Journal Entries" 
WHERE user_id = auth.uid() 
ORDER BY created_at DESC 
LIMIT 10;
\`\`\`

2. **Emotion Analysis:**
\`\`\`sql
SELECT 
  emotion_key,
  AVG((emotion_value::text)::numeric) as avg_score,
  COUNT(*) as frequency
FROM "Journal Entries", 
     jsonb_each(emotions) as e(emotion_key, emotion_value)
WHERE user_id = auth.uid() 
  AND emotions IS NOT NULL
GROUP BY emotion_key
ORDER BY avg_score DESC
LIMIT 5;
\`\`\`

3. **Theme-based Query:**
\`\`\`sql
SELECT id, COALESCE("refined text", "transcription text") as content, created_at, master_themes
FROM "Journal Entries" 
WHERE user_id = auth.uid() 
  AND master_themes IS NOT NULL 
  AND 'Work' = ANY(master_themes)
ORDER BY created_at DESC 
LIMIT 5;
\`\`\`

4. **Date Range Query:**
\`\`\`sql
SELECT COUNT(*) as entry_count,
       AVG(CASE WHEN sentiment = 'positive' THEN 1 WHEN sentiment = 'negative' THEN -1 ELSE 0 END) as avg_sentiment
FROM "Journal Entries" 
WHERE user_id = auth.uid() 
  AND created_at >= '2024-01-01'::timestamp 
  AND created_at <= '2024-12-31'::timestamp;
\`\`\`

**CRITICAL TIMEZONE HANDLING RULES:**

1. **USER TIMEZONE CONTEXT**: User timezone is "${userTimezone}"
2. **DATABASE STORAGE**: All journal entries are stored in UTC in the database
3. **TIMEZONE CONVERSION REQUIRED**: When generating date ranges, you MUST account for timezone conversion
   - User asks about "August 6" in India timezone
   - Database query needs UTC range that captures all entries made on August 6 India time
   - Example: August 6 India time = August 5 18:30 UTC to August 6 18:29 UTC

**CRITICAL VECTOR SEARCH RULES - MUST FOLLOW:**

1. **MANDATORY VECTOR SEARCH SCENARIOS** (Always include vector search regardless of time constraints):
   - ANY query asking for "content", "what I wrote", "what I said", "entries about", "show me", "find"
   - Questions seeking emotional context, feelings, moods, or mental states
   - Requests for examples, patterns, insights, or thematic analysis  
   - Queries about achievements, progress, breakthroughs, or personal growth
   - Comparative analysis ("similar to", "like when", "reminds me of")
   - Reflective queries ("how was I feeling", "what was going through my mind")
   - Follow-up questions referencing previous context
   - Any query with words: "exactly", "specifically", "precisely", "detailed", "in-depth"

2. **HYBRID SEARCH STRATEGY** (SQL + Vector for optimal results):
   - Time-based content queries: Use SQL for date filtering AND vector for semantic content
   - Statistical queries needing examples: SQL for stats AND vector for relevant samples
   - Thematic queries: SQL theme analysis AND vector semantic search
   - Achievement/progress tracking: SQL for metrics AND vector for meaningful content

3. **ENHANCED VECTOR QUERY GENERATION**:
   - Use the user's EXACT words and emotional context in vector searches
   - For "What did I journal in August" → Vector query: "journal entries personal thoughts feelings experiences august"
   - For achievement queries → Vector query: "achievement success accomplishment progress breakthrough proud"
   - For emotional queries → Vector query: "emotions feelings mood emotional state [specific emotions mentioned]"
   - Preserve user's original language patterns for better semantic matching

4. **TIMEZONE-AWARE TIME RANGES**:
   - All timeRange objects MUST include "timezone": "${userTimezone}"
   - Date processing will handle conversion from user's local time to UTC for database queries
   - Example timeRange: {"start": "2025-08-06T00:00:00", "end": "2025-08-06T23:59:59", "timezone": "${userTimezone}"}

USER QUERY: "${message}"
USER TIMEZONE: "${userTimezone}"
CONTEXT: ${last.length > 0 ? last.map(m => `${m.sender}: ${m.content?.slice(0, 50) || 'N/A'}`).join(' | ') : 'None'}

ANALYSIS REQUIREMENTS:
- Content-seeking detected: ${isContentSeekingQuery}
- Mandatory vector required: ${requiresMandatoryVector}  
- Has personal pronouns: ${hasPersonalPronouns}
- Has time reference: ${hasExplicitTimeReference}
- Is follow-up query: ${isFollowUpContext}
- User timezone: ${userTimezone}

Generate a comprehensive analysis plan that:
1. MANDATES vector search for any content-seeking scenario
2. Uses hybrid approach (SQL + vector) for time-based content queries
3. Creates semantically rich vector search queries using user's language
4. INCLUDES proper timezone information in all timeRange objects
5. Generates COMPLETE, SAFE, EXECUTABLE SQL queries using ONLY the provided database schema and working patterns above
6. Ensures comprehensive coverage of user's intent

Response format (MUST be valid JSON):
{
  "queryType": "journal_specific|general_inquiry|mental_health",
  "strategy": "intelligent_sub_query|comprehensive_hybrid|vector_mandatory",
  "userStatusMessage": "Brief status for user",
  "subQuestions": [
    {
      "question": "Specific sub-question",
      "purpose": "Why this question is needed",
      "searchStrategy": "vector_mandatory|sql_primary|hybrid_parallel",
      "executionStage": 1,
      "analysisSteps": [
        {
          "step": 1,
          "description": "What this step does",
          "queryType": "vector_search|sql_analysis|hybrid_search",
          "sqlQuery": "COMPLETE EXECUTABLE SQL QUERY using only existing database schema and working patterns" or null,
          "vectorSearch": {
            "query": "Semantically rich search query using user's words",
            "threshold": 0.3,
            "limit": 15
          } or null,
          "timeRange": {"start": "ISO_DATE", "end": "ISO_DATE", "timezone": "${userTimezone}"} or null
        }
      ]
    }
  ],
  "confidence": 0.8,
  "reasoning": "Explanation of strategy with emphasis on vector search usage and timezone handling",
  "useAllEntries": boolean,
  "hasPersonalPronouns": ${hasPersonalPronouns},
  "hasExplicitTimeReference": ${hasExplicitTimeReference},
  "inferredTimeContext": null or timeframe_object_with_timezone,
  "userTimezone": "${userTimezone}"
}`;

    console.log(`[Analyst Agent] Calling OpenAI API with enhanced prompt`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14', // Using gpt-4.1 for better JSON parsing reliability
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.1 // Lower temperature for more consistent JSON output and better SQL generation
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Analyst Agent] OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const rawResponse = data.choices[0].message.content;
    console.log("Analyst Agent raw response:", rawResponse?.substring(0, 500) || 'empty');

    let analysisResult;
    try {
      // Enhanced JSON parsing with better error handling
      if (!rawResponse || rawResponse.trim().length === 0) {
        console.error("[Analyst Agent] Empty response from OpenAI");
        return createEnhancedFallbackPlan(message, isContentSeekingQuery || requiresMandatoryVector, null, supabaseClient, userTimezone);
      }

      // Try to extract JSON from response if wrapped in markdown
      let jsonString = rawResponse.trim();
      if (jsonString.startsWith('```json')) {
        jsonString = jsonString.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      analysisResult = JSON.parse(jsonString);
      console.log("[Analyst Agent] Successfully parsed JSON response");
    } catch (parseError) {
      console.error("Failed to parse Analyst Agent response:", parseError);
      console.error("Raw response:", rawResponse);
      return createEnhancedFallbackPlan(message, isContentSeekingQuery || requiresMandatoryVector, null, supabaseClient, userTimezone);
    }

    if (!analysisResult || !analysisResult.subQuestions) {
      console.error("Analyst Agent response missing subQuestions, using enhanced fallback");
      return createEnhancedFallbackPlan(message, isContentSeekingQuery || requiresMandatoryVector, null, supabaseClient, userTimezone);
    }

    // Force vector search for content-seeking queries and ensure timezone info
    if (isContentSeekingQuery || requiresMandatoryVector) {
      analysisResult.subQuestions.forEach(subQ => {
        if (subQ.searchStrategy !== 'vector_mandatory' && subQ.searchStrategy !== 'hybrid_parallel') {
          subQ.searchStrategy = 'vector_mandatory';
          subQ.analysisSteps.forEach(step => {
            if (!step.vectorSearch) {
              step.vectorSearch = {
                query: `${message} personal journal content experiences thoughts feelings`,
                threshold: 0.3,
                limit: 15
              };
              step.queryType = step.queryType === 'sql_analysis' ? 'hybrid_search' : 'vector_search';
            }
            // Ensure timezone is included in timeRange
            if (step.timeRange && !step.timeRange.timezone) {
              step.timeRange.timezone = userTimezone;
            }
          });
        }
      });
    }

    // Enhance with detected characteristics and timezone
    const finalResult = {
      ...analysisResult,
      useAllEntries: analysisResult.useAllEntries !== false,
      hasPersonalPronouns,
      hasExplicitTimeReference: false, // Override to false to prevent time-only strategies
      inferredTimeContext: null,
      userTimezone
    };

    console.log("Final Analyst Plan with enhanced SQL generation:", JSON.stringify(finalResult, null, 2));
    return finalResult;

  } catch (error) {
    console.error("Error in Analyst Agent:", error);
    return createEnhancedFallbackPlan(message, true, null, supabaseClient, userTimezone); // Default to content-seeking
  }
}

/**
 * Create enhanced fallback plan with mandatory vector search and timezone handling
 */
function createEnhancedFallbackPlan(originalMessage, isContentSeekingQuery, inferredTimeContext, supabaseClient, userTimezone = 'UTC') {
  const lowerMessage = originalMessage.toLowerCase();
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed|emotional/.test(lowerMessage);
  const isThemeQuery = /work|relationship|family|health|goal|travel|career|friendship/.test(lowerMessage);
  const isAchievementQuery = /achievement|progress|accomplishment|success|breakthrough|growth|proud/.test(lowerMessage);

  // Always use vector search for content-seeking queries
  const searchStrategy = isContentSeekingQuery ? 'vector_mandatory' : 'hybrid_parallel';
  
  // Create semantically rich vector query
  let vectorQuery = originalMessage;
  if (isEmotionQuery) {
    vectorQuery += " emotions feelings emotional state mood mental health";
  }
  if (isThemeQuery) {
    vectorQuery += " themes life experiences personal growth";
  }
  if (isAchievementQuery) {
    vectorQuery += " achievements success accomplishments progress breakthroughs";
  }

  // Ensure timezone is included in timeRange if provided
  if (inferredTimeContext && !inferredTimeContext.timezone) {
    inferredTimeContext.timezone = userTimezone;
  }

  return {
    queryType: "journal_specific",
    strategy: "enhanced_fallback_with_vector",
    userStatusMessage: isContentSeekingQuery ? "Semantic content search with enhanced vector analysis" : "Intelligent hybrid search strategy",
    subQuestions: [
      {
        question: `Enhanced analysis for: ${originalMessage}`,
        purpose: "Comprehensive content retrieval using vector semantic search for accurate results",
        searchStrategy: searchStrategy,
        executionStage: 1,
        analysisSteps: [
          {
            step: 1,
            description: "Enhanced vector semantic search with user's exact query context",
            queryType: "vector_search",
            sqlQuery: null,
            vectorSearch: {
              query: vectorQuery,
              threshold: 0.3,
              limit: 15
            },
            timeRange: inferredTimeContext ? { ...inferredTimeContext, timezone: userTimezone } : null
          }
        ]
      }
    ],
    confidence: 0.7,
    reasoning: `Enhanced fallback plan using mandatory vector search for content-seeking query: "${originalMessage}". This ensures semantic understanding and comprehensive content retrieval with proper timezone handling.`,
    useAllEntries: true,
    hasPersonalPronouns: /\b(i|me|my|mine|myself)\b/i.test(lowerMessage),
    hasExplicitTimeReference: false, // Override to ensure vector search
    inferredTimeContext: inferredTimeContext,
    userTimezone
  };
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

    // Generate comprehensive analysis plan with enhanced SQL generation
    const analysisResult = await analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount, isFollowUp, supabaseClient, userTimezone);

    if (!execute) {
      // Return just the plan without execution
      return new Response(JSON.stringify({
        queryPlan: analysisResult,
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
              threshold: 0.3,
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
