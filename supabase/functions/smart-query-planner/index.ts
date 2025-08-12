import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateDatabaseSchemaContext } from "../_shared/databaseSchemaContext.ts";

const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  Deno.exit(1);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Generate embedding for text using OpenAI API
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to generate embedding:', error);
      throw new Error('Could not generate embedding for the text');
    }

    const embeddingData = await response.json();
    if (!embeddingData.data || embeddingData.data.length === 0) {
      throw new Error('Empty embedding data received from OpenAI');
    }

    return embeddingData.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Enhanced JSON extraction with better error handling
 */
function extractAndParseJSON(content: string, originalMessage: string): any {
  try {
    return JSON.parse(content);
  } catch (error) {
    console.log("Direct JSON parse failed, trying enhanced extraction methods");
    
    // Try to extract JSON from code blocks
    const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      try {
        const cleanedJson = jsonBlockMatch[1]
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        return JSON.parse(cleanedJson);
      } catch (e) {
        console.log("JSON block extraction failed");
      }
    }
    
    // Try to find JSON pattern
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        let jsonText = jsonMatch[0];
        jsonText = jsonText.replace(/,\s*\}/g, '}');
        jsonText = jsonText.replace(/,\s*\]/g, ']');
        return JSON.parse(jsonText);
      } catch (e) {
        console.log("JSON pattern extraction failed");
      }
    }
    
    console.error("All JSON extraction methods failed, using fallback");
    return createFallbackPlan(originalMessage);
  }
}

/**
 * Create comprehensive fallback plan with sub-questions
 */
function createFallbackPlan(originalMessage: string): any {
  const lowerMessage = originalMessage.toLowerCase();
  
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed/.test(lowerMessage);
  const isThemeQuery = /work|relationship|family|health|goal|travel/.test(lowerMessage);
  const hasPersonalPronouns = /\b(i|me|my|mine)\b/i.test(originalMessage);
  
  const subQuestion = {
    question: isEmotionQuery ? 
      "What emotional patterns emerge from my journal entries?" :
      "What key themes and insights can be found in my journal entries?",
    purpose: "Analyze journal data to provide personalized insights",
    searchStrategy: "hybrid",
    analysisSteps: [
      {
        step: 1,
        description: "Retrieve relevant journal entries using semantic search",
        queryType: "vector_search",
        vectorSearch: {
          query: isEmotionQuery ? "emotions, feelings, mood" : "themes, insights, patterns",
          threshold: 0.3,
          limit: 10
        }
      },
      {
        step: 2,
        description: isEmotionQuery ? "Analyze emotion patterns and frequencies" : "Analyze theme distributions and patterns",
        queryType: "sql_analysis",
        sqlQuery: isEmotionQuery ? 
          "SELECT emotion_key, AVG((emotion_value)::numeric) as avg_score FROM \"Journal Entries\", jsonb_each(emotions) WHERE user_id = $user_id GROUP BY emotion_key ORDER BY avg_score DESC LIMIT 10" :
          "SELECT theme, COUNT(*) as frequency FROM (SELECT unnest(master_themes) as theme FROM \"Journal Entries\" WHERE user_id = $user_id) t GROUP BY theme ORDER BY frequency DESC LIMIT 10"
      }
    ]
  };
  
  return {
    queryType: "journal_specific",
    strategy: "intelligent_sub_query",
    subQuestions: [subQuestion],
    confidence: 0.6,
    reasoning: "Fallback analysis plan with hybrid search strategy",
    useAllEntries: hasPersonalPronouns,
    hasPersonalPronouns,
    hasExplicitTimeReference: false
  };
}

/**
 * Retry wrapper for OpenAI API calls
 */
async function retryOpenAICall(promptFunction: () => Promise<Response>, maxRetries: number = 2): Promise<any> {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      
      const response = await promptFunction();
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`OpenAI API returned error ${response.status}`);
      }
      
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content ?? '';
      return content;
    } catch (error) {
      lastError = error;
      console.log(`OpenAI attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError;
}

/**
 * Enhanced Analyst Agent - generates comprehensive analysis plans
 */
async function analyzeQueryWithSubQuestions(message: string, conversationContext: any[], userEntryCount: number) {
  try {
    const contextString = conversationContext.length > 0 
      ? `\nConversation context: ${conversationContext.slice(-2).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    const hasPersonalPronouns = /\b(i|me|my|mine|myself)\b/i.test(message.toLowerCase());
    const hasExplicitTimeReference = /\b(last week|yesterday|this week|last month|today|recently|lately|since|started|began)\b/i.test(message.toLowerCase());
    
    console.log(`[Analyst Agent] Personal pronouns: ${hasPersonalPronouns}, Time reference: ${hasExplicitTimeReference}`);

    // Get live database schema with real themes and emotions
    const databaseSchemaContext = await generateDatabaseSchemaContext(supabase);

    const prompt = `You are SOULo's Analyst Agent - an intelligent query planning specialist for journal data analysis. Your role is to break down user queries into comprehensive, actionable analysis plans.

${databaseSchemaContext}

**CURRENT CONTEXT:**
- Today's date: ${new Date().toISOString()}
- Current year: ${new Date().getFullYear()}
- User query: "${message}"
- User has ${userEntryCount} journal entries${contextString}

**YOUR RESPONSIBILITIES AS ANALYST AGENT:**
1. **Smart Hypothesis Formation**: Create a smart hypothesis for what the query means and what the user truly wants to know, then logically deduce sub-questions to answer it comprehensively
2. **Sub-Question Generation**: Break down the query into 1-3 focused sub-questions that capture both explicit themes AND related semantic concepts (e.g., "family" should automatically expand to include "mom", "dad", "wife", "husband", "children", "parents", "siblings", "mother", "father", "son", "daughter")
3. **Intelligent Search Strategy**: For theme-based queries, ALWAYS create both SQL queries that search for expanded terms AND vector searches for semantic similarity
4. **Dynamic Query Generation**: Generate SQL queries and vector searches dynamically based on the user's specific query - NO hardcoded functions
5. **Hybrid Analysis**: Combine SQL statistical analysis with vector semantic search for comprehensive insights

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
          } | null
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

**SQL QUERY GENERATION RULES:**
- ALWAYS include WHERE user_id = $user_id for security
- Use proper column names with quotes for spaced names like "refined text"
- For emotion analysis: Use emotions column with jsonb operators
- For theme analysis: Use master_themes array with unnest() or array operators AND consider entity mentions and text content search for semantic expansion
- For percentages: Always alias the result as percentage (e.g., SELECT ... AS percentage)
- For counts: Alias as count (e.g., SELECT COUNT(*) AS count) or frequency for grouped counts
- For averages/scores: Alias as avg_score (or score when singular)
- For date filtering: Use created_at with timestamp comparisons
- For theme-based queries like "family": AUTOMATICALLY expand to related terms (mom, dad, wife, husband, children, parents, siblings, mother, father, son, daughter, family) and search in master_themes, entities, AND text content
- Use ONLY the $user_id placeholder for binding the user. Do not use {{user_id}} or :user_id.
- Generate dynamic SQL - NO hardcoded RPC function calls
- Always include semantic expansion for theme queries

**SEARCH STRATEGY SELECTION:**
- sql_primary: For statistical analysis, counts, percentages, structured data
- vector_primary: For semantic content analysis, finding similar entries
- hybrid: For comprehensive analysis requiring both approaches (PREFERRED for theme queries)

**CRITICAL FOR THEME QUERIES:** Always include both SQL analysis AND vector search steps for theme-based queries like "family", "work", "relationships" to ensure comprehensive coverage.

**ANALYSIS STEP TYPES:**
- sql_count: Simple counting queries
- sql_calculation: Complex calculations, percentages, aggregations
- sql_analysis: General SQL-based analysis
- vector_search: Semantic similarity search

Focus on creating comprehensive, executable analysis plans that will provide meaningful insights.`;

    const promptFunction = () => fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-2025-04-14",
        messages: [
          { role: "system", content: "You are SOULo's Analyst Agent. Respond only with valid JSON analysis plans." },
          { role: "user", content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500
      })
    });

    const content = await retryOpenAICall(promptFunction, 2);
    console.log("Analyst Agent response:", content);
    
    const analysisResult = extractAndParseJSON(content, message);
    
    if (!analysisResult || !analysisResult.subQuestions) {
      console.error("Failed to parse Analyst Agent response, using fallback");
      return createFallbackPlan(message);
    }
    
    // Enhance with detected characteristics
    analysisResult.hasPersonalPronouns = hasPersonalPronouns;
    analysisResult.hasExplicitTimeReference = hasExplicitTimeReference;
    analysisResult.useAllEntries = hasPersonalPronouns && !hasExplicitTimeReference;
    
    console.log("Final Analyst Plan:", JSON.stringify(analysisResult, null, 2));
    return analysisResult;

  } catch (error) {
    console.error("Error in Analyst Agent:", error);
    return createFallbackPlan(message);
  }
}

// Helper: derive time range hints from SQL WHERE clauses
function deriveTimeRangeFromSql(sqlQuery: string): { start?: string | null; end?: string | null } {
  const res: { start?: string | null; end?: string | null } = {};
  if (!sqlQuery) return res;
  const q = sqlQuery.replace(/\s+/g, ' ');
  const between = q.match(/created_at\s+BETWEEN\s*(?:TIMESTAMP\s*)?'([^']+)'\s+AND\s*(?:TIMESTAMP\s*)?'([^']+)'/i);
  if (between) {
    const start = new Date(between[1]);
    const end = new Date(between[2]);
    if (!isNaN(start.getTime())) res.start = start.toISOString();
    if (!isNaN(end.getTime())) res.end = end.toISOString();
  }
  const gte = q.match(/created_at\s*>=\s*(?:TIMESTAMP\s*)?'([^']+)'/i);
  if (gte) {
    const d = new Date(gte[1]);
    if (!isNaN(d.getTime())) res.start = d.toISOString();
  }
  const lte = q.match(/created_at\s*<=\s*(?:TIMESTAMP\s*)?'([^']+)'/i);
  if (lte) {
    const d = new Date(lte[1]);
    if (!isNaN(d.getTime())) res.end = d.toISOString();
  }
  return res;
}

// Helper: extract LIMIT from SQL
function deriveLimitFromSql(sqlQuery: string, fallback: number = 10): number {
  const m = (sqlQuery || '').match(/LIMIT\s+(\d+)/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return fallback;
}

// Execute SQL intent by mapping to safe RPCs/query builder
async function executeSqlIntent(sqlQuery: string, userId: string, timeRange: { start?: string | null; end?: string | null } | null, supabaseClient: any) {
  const limit = deriveLimitFromSql(sqlQuery, 5);
  const start_date = timeRange?.start || null;
  const end_date = timeRange?.end || null;

  // Emotions analysis
  if (/jsonb_each\(emotions\)|\bemotions\b/i.test(sqlQuery)) {
    const { data, error } = await supabaseClient.rpc('get_top_emotions_with_entries', {
      user_id_param: userId,
      start_date,
      end_date,
      limit_count: limit
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data || [] };
  }

  // Theme statistics
  if (/unnest\(master_themes\)|\bmaster_themes\b/i.test(sqlQuery)) {
    const { data, error } = await supabaseClient.rpc('get_theme_statistics', {
      user_id_filter: userId,
      start_date,
      end_date,
      limit_count: Math.max(limit, 10)
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data || [] };
  }

  // Entity statistics
  if (/jsonb_each\(entities\)|\bentities\b/i.test(sqlQuery)) {
    const { data, error } = await supabaseClient.rpc('get_entity_statistics', {
      user_id_filter: userId,
      start_date,
      end_date,
      limit_count: Math.max(limit, 10)
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data || [] };
  }

  // Entity-Emotion relationships
  if (/entityemotion/i.test(sqlQuery)) {
    const { data, error } = await supabaseClient.rpc('get_entity_emotion_statistics', {
      user_id_filter: userId,
      start_date,
      end_date,
      limit_count: Math.max(limit, 10)
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data || [] };
  }

  return { ok: false, error: 'Unsupported SQL intent' };
}
// Execute a validated plan with proper SQL and vector search execution
async function executeValidatedPlan(validatedPlan: any, userId: string, normalizedTimeRange: { start?: string | null; end?: string | null } | null, supabaseClient: any) {
  // Helpers
  const extractThemeKeywords = (text: string | null | undefined): string[] => {
    const src = (text || '').toLowerCase();
    const familySet = new Set<string>(['family','mom','dad','mother','father','son','daughter','wife','husband','children','parents','siblings','sister','brother']);
    const found = Array.from(familySet).filter(k => src.includes(k));
    return found;
  };

  const getTotalCount = async (): Promise<number> => {
    const { data: total } = await supabaseClient.rpc('get_journal_entry_count', {
      user_id_filter: userId,
      start_date: normalizedTimeRange?.start || null,
      end_date: normalizedTimeRange?.end || null,
    });
    return (total as number) || 0;
  };

  const runFamilyThemeSql = async (): Promise<{ ids: number[]; count: number }> => {
    let q = supabaseClient
      .from('Journal Entries')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);

    if (normalizedTimeRange?.start) q = q.gte('created_at', normalizedTimeRange.start);
    if (normalizedTimeRange?.end) q = q.lte('created_at', normalizedTimeRange.end);

    // Master theme match on 'Family'
    q = q.contains('master_themes', ['Family'])
      .limit(1000);

    const { data, count, error } = await q;
    if (error) {
      console.warn('[executeValidatedPlan] Safe SQL family query failed:', error.message);
      return { ids: [], count: 0 };
    }
    return { ids: (data || []).map((r: any) => r.id), count: count || 0 };
  };

  // Determine steps to process
  const stepsToProcess = validatedPlan.subQuestions || (validatedPlan.executionSteps ? [{ question: 'Analysis', purpose: 'Automated analysis', searchStrategy: 'hybrid', analysisSteps: validatedPlan.executionSteps }] : []);
  console.log(`[executeValidatedPlan] Processing ${stepsToProcess.length} sub-questions/steps`);

  const subQuestionPromises = stepsToProcess.map(async (subQuestion: any) => {
    console.log(`[executeValidatedPlan] Processing sub-question: ${subQuestion.question}`);

    const stepPromises = (subQuestion.analysisSteps || []).map(async (step: any) => {
      try {
        console.log(`[executeValidatedPlan] Executing step ${step.step}: ${step.description}`);

        if (step.queryType === 'vector_search' && step.vectorSearch) {
          try {
            const queryEmbedding = await generateEmbedding(step.vectorSearch.query);
            const useDated = !!(normalizedTimeRange && (normalizedTimeRange.start || normalizedTimeRange.end));
            const rpcName = useDated ? 'match_journal_entries_with_date' : 'match_journal_entries';
            const rpcArgs: Record<string, any> = {
              query_embedding: queryEmbedding,
              match_threshold: step.vectorSearch.threshold || 0.3,
              match_count: step.vectorSearch.limit || 10,
              user_id_filter: userId,
            };
            if (useDated) {
              rpcArgs.start_date = normalizedTimeRange?.start || null;
              rpcArgs.end_date = normalizedTimeRange?.end || null;
            }

            const { data: vectorData, error: vectorError } = await supabaseClient.rpc(rpcName, rpcArgs);
            if (vectorError) {
              return { kind: 'vector', ok: false, error: vectorError.message };
            }
            return { kind: 'vector', ok: true, entries: vectorData || [] };
          } catch (e) {
            return { kind: 'vector', ok: false, error: (e as Error).message };
          }
        }

        if ((step.queryType === 'sql_analysis' || step.queryType === 'sql_calculation' || step.queryType === 'sql_count')) {
          // SAFE path: derive intent and execute known-safe SQL via query builder (no dynamic SQL)
          const textForKeywords = `${step.sqlQuery || ''} ${step.description || ''} ${(step.vectorSearch?.query) || ''}`;
          const kw = extractThemeKeywords(textForKeywords);

          // Currently support family-oriented analysis safely
          if (kw.some(k => k === 'family' || k === 'mom' || k === 'dad' || k === 'mother' || k === 'father' || k === 'wife' || k === 'husband' || k === 'children' || k === 'parents' || k === 'siblings' || k === 'sister' || k === 'brother')) {
            const [{ ids, count }, totalCount] = await Promise.all([
              runFamilyThemeSql(),
              getTotalCount(),
            ]);
            const percentage = totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0; // 1 decimal
            return { kind: 'sql', ok: true, rows: [{ count, total_count: totalCount, percentage }], meta: { ids } };
          }

          // Fallback: do not execute arbitrary SQL
          return { kind: 'sql', ok: false, error: 'Unsafe or unsupported SQL step (dynamic SQL disabled).'};
        }

        return { kind: 'unknown', ok: false, error: 'Unknown or missing step configuration' };
      } catch (err) {
        return { kind: 'unknown', ok: false, error: (err as Error).message };
      }
    });

    const resolved = await Promise.all(stepPromises);

    // Aggregate results per sub-question
    const sqlRows = resolved.filter(r => r.kind === 'sql' && r.ok && Array.isArray((r as any).rows)) as any[];
    const vectorOk = resolved.filter(r => r.kind === 'vector' && r.ok && Array.isArray((r as any).entries)) as any[];

    const sqlResults = sqlRows.flatMap(r => r.rows);
    const vectorResults = vectorOk.flatMap(r => r.entries);

    // Combined metrics (dedup by id when available)
    const sqlIds = new Set<number>();
    sqlRows.forEach(r => (r.meta?.ids || []).forEach((id: number) => sqlIds.add(id)));
    const vectorIds = new Set<number>(vectorResults.map((e: any) => e.id));
    const combinedIds = new Set<number>([...sqlIds, ...vectorIds]);

    let totalCount = 0;
    try { totalCount = await getTotalCount(); } catch {}
    const combinedPercentage = totalCount > 0 ? Math.round((combinedIds.size / totalCount) * 1000) / 10 : 0;

    return {
      subQuestion: {
        question: subQuestion.question,
        purpose: subQuestion.purpose,
      },
      researcherOutput: {
        validatedPlan: { searchStrategy: subQuestion.searchStrategy },
        confidence: validatedPlan.confidence ?? null,
        validationIssues: [],
        enhancements: []
      },
      executionResults: {
        sqlResults,
        vectorResults,
        combinedMetrics: {
          sqlCount: sqlIds.size,
          vectorCount: vectorIds.size,
          combinedCount: combinedIds.size,
          totalCount,
          combinedPercentage
        }
      }
    };
  });

  const perSubQuestionResults = await Promise.all(subQuestionPromises);
  console.log(`[executeValidatedPlan] Completed execution for ${perSubQuestionResults.length} sub-questions`);
  return { researchResults: perSubQuestionResults };
}


function getLastWeekRangeUTC() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 Sun .. 6 Sat
  const daysSinceMonday = (day + 6) % 7; // Monday = 0
  const startOfThisWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  startOfThisWeek.setUTCDate(startOfThisWeek.getUTCDate() - daysSinceMonday);
  const start = new Date(startOfThisWeek);
  start.setUTCDate(start.getUTCDate() - 7);
  const end = startOfThisWeek; // exclusive
  return { start, end };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationContext = [], userId, execute = false, timeRange = null, threadId = null, messageId = null } = await req.json();
    
    console.log('Smart Query Planner (Analyst Agent) called with:', { 
      message: message?.substring(0, 100),
      contextCount: conversationContext?.length || 0,
      userId,
      execute,
      threadId,
      messageId
    });

    // Get user's journal entry count for context
    const { data: countData } = await supabase
      .rpc('get_journal_entry_count', { user_id_filter: userId });
    
    const userEntryCount = countData || 0;

    // Generate comprehensive analysis plan
    const analysisResult = await analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount);
    
    if (!execute) {
      // Return just the plan without execution
      return new Response(JSON.stringify({
        success: true,
        queryPlan: analysisResult,
        userEntryCount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Execute the analysis plan
    let normalizedTimeRange = null;
    if (timeRange) {
      if (timeRange.type === 'last_week') {
        const range = getLastWeekRangeUTC();
        normalizedTimeRange = {
          start: range.start.toISOString(),
          end: range.end.toISOString()
        };
      } else if (timeRange.start || timeRange.end) {
        normalizedTimeRange = {
          start: timeRange.start || null,
          end: timeRange.end || null
        };
      }
    }

    const executionResult = await executeValidatedPlan(analysisResult, userId, normalizedTimeRange, supabase);

    return new Response(JSON.stringify({
      success: true,
      queryPlan: analysisResult,
      researchResults: executionResult.researchResults,
      userEntryCount,
      timeRange: normalizedTimeRange
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Smart Query Planner error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      fallback: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});