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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Create user-authenticated client instead of service role client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

/**
 * Generate embedding for text using OpenAI API
 */
async function generateEmbedding(text) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
      })
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
function extractAndParseJSON(content, originalMessage) {
  try {
    return JSON.parse(content);
  } catch (error) {
    console.log("Direct JSON parse failed, trying enhanced extraction methods");

    // Try to extract JSON from code blocks
    const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      try {
        const cleanedJson = jsonBlockMatch[1].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
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
function createFallbackPlan(originalMessage) {
  const lowerMessage = originalMessage.toLowerCase();
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed/.test(lowerMessage);
  const isThemeQuery = /work|relationship|family|health|goal|travel/.test(lowerMessage);
  const hasPersonalPronouns = /\b(i|me|my|mine)\b/i.test(originalMessage);

  const subQuestion = {
    question: isEmotionQuery 
      ? "What emotional patterns emerge from my journal entries?"
      : "What key themes and insights can be found in my journal entries?",
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
        description: isEmotionQuery 
          ? "Analyze emotion patterns and frequencies"
          : "Analyze theme distributions and patterns",
        queryType: "sql_analysis",
        sqlQuery: isEmotionQuery
          ? "SELECT emotion_key, AVG((emotion_value)::numeric) as avg_score FROM \"Journal Entries\", jsonb_each(emotions) WHERE user_id = $user_id GROUP BY emotion_key ORDER BY avg_score DESC LIMIT 10"
          : "SELECT theme, COUNT(*) as frequency FROM (SELECT unnest(master_themes) as theme FROM \"Journal Entries\" WHERE user_id = $user_id) t GROUP BY theme ORDER BY frequency DESC LIMIT 10"
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
async function retryOpenAICall(promptFunction, maxRetries = 2) {
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
async function analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount, isFollowUp = false, supabaseClient) {
  try {
    const last = Array.isArray(conversationContext) ? conversationContext.slice(-5) : [];
    
    // Serialize last 5 messages with length safeguards
    let serialized = last.map(msg => 
      `${msg.role}: ${(msg.content || '').toString().replace(/\s+/g, ' ').slice(0, 200)}`
    ).join('\n');
    
    if (serialized.length > 1000) {
      serialized = last.map(msg => 
        `${msg.role}: ${(msg.content || '').toString().slice(0, 120)}`
      ).join('\n');
    }

    const contextString = last.length > 0 ? `\nConversation context (last ${last.length}): ${serialized}` : '';
    
    console.log(`[Analyst Agent] Context preview: ${last.map(m => `${m.role}:${(m.content || '').slice(0, 40)}`).join(' | ')}`);

    const hasPersonalPronouns = /\b(i|me|my|mine|myself)\b/i.test(message.toLowerCase());
    const hasExplicitTimeReference = /\b(last week|yesterday|this week|last month|today|recently|lately|since|started|began)\b/i.test(message.toLowerCase());
    
    // Enhanced content-seeking query detection
    const isContentSeekingQuery = /\b(what.*talking about|what.*discussed|what.*said|tell me about|show me|examples|anecdotes|content|entries)\b/i.test(message.toLowerCase());
    
    // Extract time context from conversation if not explicit in current message
    let inferredTimeContext = null;
    if (!hasExplicitTimeReference && conversationContext.length > 0) {
      const recentMessages = conversationContext.slice(-3);
      for (const msg of recentMessages) {
        if (msg.content && /\b(last week|this week|yesterday|recently|lately)\b/i.test(msg.content)) {
          inferredTimeContext = msg.content.match(/\b(last week|this week|yesterday|recently|lately)\b/i)?.[0];
          console.log(`[Analyst Agent] Inferred time context from conversation: ${inferredTimeContext}`);
          break;
        }
      }
    }
    
    console.log(`[Analyst Agent] Query analysis - Personal pronouns: ${hasPersonalPronouns}, Time reference: ${hasExplicitTimeReference}, Content-seeking: ${isContentSeekingQuery}, Follow-up: ${isFollowUp}`);

    // Get live database schema with real themes and emotions using the authenticated client
    const databaseSchemaContext = await generateDatabaseSchemaContext(supabaseClient);

    const prompt = `You are SOULo's Analyst Agent - an intelligent query planning specialist for journal data analysis. Your role is to break down user queries into comprehensive, actionable analysis plans.

${databaseSchemaContext}

**CURRENT CONTEXT:**
- Today's date: ${new Date().toISOString()}
- Current year: ${new Date().getFullYear()}
- User query: "${message}"
- User has ${userEntryCount} journal entries${contextString}
- Content-seeking query detected: ${isContentSeekingQuery}
- Inferred time context: ${inferredTimeContext || 'none'}

**CRITICAL REQUIREMENTS FOR CONTENT-SEEKING QUERIES:**
When the user asks "what I was talking about" or similar content questions, you MUST:
1. ALWAYS include at least one vector search step using the user's actual question as the query
2. Use hybrid strategy combining both SQL statistics AND vector content retrieval
3. Apply time filtering if any time context is mentioned or inferred
4. Ensure vector searches use semantic similarity, not generic clustering queries

**YOUR RESPONSIBILITIES AS ANALYST AGENT:**
1. Smart Hypothesis Formation: infer what the user truly wants to know, then deduce focused sub-questions to answer it comprehensively
2. Sub-Question Generation: break down the query into 1-3 precise sub-questions (no hardcoded keyword lists)
3. Search Strategy: pick sql_primary, vector_primary, or hybrid based on the sub-question
4. Dynamic Query Generation: produce executable SQL for our schema and/or vector queries
5. Hybrid Analysis: combine SQL stats with semantic vector results when helpful

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
          "sqlQuery": "SELECT ... FROM \"Journal Entries\" WHERE user_id = $user_id AND ..." | null,
          "vectorSearch": {
            "query": "Use the actual user question or specific semantic search terms",
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

**VECTOR SEARCH GUIDELINES:**
- Use the user's actual question or semantically similar terms as the vector query
- For content-seeking queries, use search terms that will find relevant journal content
- Set appropriate thresholds (0.2-0.4 range typically works best)
- Include time filtering in vector searches when time context is present

**SEARCH STRATEGY SELECTION:**
- sql_primary: statistical analysis, counts, percentages
- vector_primary: semantic content analysis, similar entries, content retrieval
- hybrid: combine both when user wants both statistics AND content examples

Focus on creating comprehensive, executable analysis plans that will provide meaningful insights with actual content when requested.`;

    const promptFunction = () => fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-2025-04-14",
        messages: [
          {
            role: "system", 
            content: "You are SOULo's Analyst Agent. Respond only with valid JSON analysis plans. For content-seeking queries, ALWAYS include vector search steps."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500
      })
    });

    const content = await retryOpenAICall(promptFunction, 2);
    console.log("Analyst Agent response:", content);

    const analysisResult = extractAndParseJSON(content, message);

    if (!analysisResult || !analysisResult.subQuestions) {
      console.error("Failed to parse Analyst Agent response, using enhanced fallback for content queries");
      return createEnhancedFallbackPlan(message, isContentSeekingQuery, inferredTimeContext, supabaseClient);
    }

    // Enhance with detected characteristics
    analysisResult.hasPersonalPronouns = hasPersonalPronouns;
    analysisResult.hasExplicitTimeReference = hasExplicitTimeReference;
    analysisResult.useAllEntries = hasPersonalPronouns && !hasExplicitTimeReference;
    analysisResult.inferredTimeContext = inferredTimeContext;

    console.log("Final Analyst Plan:", JSON.stringify(analysisResult, null, 2));
    return analysisResult;

  } catch (error) {
    console.error("Error in Analyst Agent:", error);
    return createEnhancedFallbackPlan(message, isContentSeekingQuery, inferredTimeContext, supabaseClient);
  }
}

/**
 * Create enhanced fallback plan with vector search for content queries
 */
function createEnhancedFallbackPlan(originalMessage, isContentSeekingQuery, inferredTimeContext, supabaseClient) {
  const lowerMessage = originalMessage.toLowerCase();
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed/.test(lowerMessage);
  const isThemeQuery = /work|relationship|family|health|goal|travel/.test(lowerMessage);
  const hasPersonalPronouns = /\b(i|me|my|mine)\b/i.test(originalMessage);

  // Enhanced fallback for content-seeking queries
  if (isContentSeekingQuery) {
    const contentSubQuestion = {
      question: "What content and themes appear in my journal entries?",
      purpose: "Retrieve actual journal content to show what the user was discussing",
      searchStrategy: "hybrid",
      executionStage: 1,
      analysisSteps: [
        {
          step: 1,
          description: "Search for relevant journal content using semantic similarity",
          queryType: "vector_search",
          sqlQuery: null,
          vectorSearch: {
            query: originalMessage.includes("talking about") ? "journal topics content themes discussions" : originalMessage,
            threshold: 0.25,
            limit: 15
          },
          timeRange: inferredTimeContext ? {
            start: inferredTimeContext === "last week" ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() : null,
            end: null
          } : null
        },
        {
          step: 2,
          description: "Get theme frequency statistics to complement content",
          queryType: "sql_analysis",
          sqlQuery: 'SELECT unnest(master_themes) AS theme, COUNT(*) AS frequency FROM "Journal Entries" WHERE user_id = $user_id GROUP BY theme ORDER BY frequency DESC LIMIT 8',
          vectorSearch: null,
          timeRange: null
        }
      ]
    };

    return {
      queryType: "journal_specific",
      strategy: "intelligent_sub_query",
      userStatusMessage: "Finding your journal content",
      subQuestions: [contentSubQuestion],
      confidence: 0.7,
      reasoning: "Enhanced fallback with vector search for content retrieval and theme analysis",
      useAllEntries: hasPersonalPronouns,
      hasPersonalPronouns,
      hasExplicitTimeReference: false,
      inferredTimeContext
    };
  }

  // Original fallback logic for non-content queries
  const subQuestion = {
    question: isEmotionQuery 
      ? "What emotional patterns emerge from my journal entries?"
      : "What key themes and insights can be found in my journal entries?",
    purpose: "Analyze journal data to provide personalized insights",
    searchStrategy: "hybrid",
    executionStage: 1,
    analysisSteps: [
      {
        step: 1,
        description: "Retrieve relevant journal entries using semantic search",
        queryType: "vector_search",
        sqlQuery: null,
        vectorSearch: {
          query: isEmotionQuery ? "emotions, feelings, mood" : "themes, insights, patterns",
          threshold: 0.3,
          limit: 10
        }
      },
      {
        step: 2,
        description: isEmotionQuery 
          ? "Analyze emotion patterns and frequencies"
          : "Analyze theme distributions and patterns",
        queryType: "sql_analysis",
        sqlQuery: isEmotionQuery
          ? "SELECT emotion_key, AVG((emotion_value)::numeric) as avg_score FROM \"Journal Entries\", jsonb_each(emotions) WHERE user_id = $user_id GROUP BY emotion_key ORDER BY avg_score DESC LIMIT 10"
          : "SELECT theme, COUNT(*) as frequency FROM (SELECT unnest(master_themes) as theme FROM \"Journal Entries\" WHERE user_id = $user_id) t GROUP BY theme ORDER BY frequency DESC LIMIT 10"
      }
    ]
  };

  return {
    queryType: "journal_specific",
    strategy: "intelligent_sub_query",
    userStatusMessage: "Analyzing your journal patterns",
    subQuestions: [subQuestion],
    confidence: 0.6,
    reasoning: "Fallback analysis plan with hybrid search strategy",
    useAllEntries: hasPersonalPronouns,
    hasPersonalPronouns,
    hasExplicitTimeReference: false
  };
}

// Helper: derive time range hints from SQL WHERE clauses
function deriveTimeRangeFromSql(sqlQuery) {
  const res = {};
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

// Execute plan by directly running GPT-produced steps with staged parallelism
async function executePlan(plan, userId, normalizedTimeRange, supabaseClient) {
  // Clear any potential variable persistence to prevent stale data contamination
  let executionMetadata = {
    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    userId: userId,
    timeRange: normalizedTimeRange,
    planQuestion: plan?.subQuestions?.[0]?.question || 'unknown'
  };

  console.log(`[EXECUTION START] ${executionMetadata.requestId}:`, {
    userId,
    timeRange: normalizedTimeRange,
    planType: plan?.queryType,
    subQuestionCount: plan?.subQuestions?.length || 0,
    firstQuestion: executionMetadata.planQuestion
  });

  // Helper: run raw SQL via RPC after injecting user id
  const executeRawSql = async (sqlQuery, timeRange) => {
    if (!sqlQuery || !sqlQuery.trim()) return { ok: true, rows: [] };

    // Replace placeholders
    let finalSql = sqlQuery.replace(/\$user_id\b/g, `'${userId}'::uuid`);
    
    const startVal = timeRange?.start || null;
    const endVal = timeRange?.end || null;
    
    if (/\$start_date\b/.test(finalSql)) {
      finalSql = finalSql.replace(/\$start_date\b/g, startVal ? `'${startVal}'::timestamptz` : 'NULL');
    }
    if (/\$end_date\b/.test(finalSql)) {
      finalSql = finalSql.replace(/\$end_date\b/g, endVal ? `'${endVal}'::timestamptz` : 'NULL');
    }

    console.log(`[SQL EXECUTION] ${executionMetadata.requestId}:`, {
      originalQuery: sqlQuery,
      finalSql: finalSql,
      timeRange: timeRange,
      userId: userId
    });

    const { data, error } = await supabaseClient.rpc('execute_dynamic_query', {
      query_text: finalSql
    });

    if (error) {
      console.error(`[SQL ERROR] ${executionMetadata.requestId}:`, error);
      return { ok: false, error: error.message };
    }

    if (!data || data.success === false) {
      console.error(`[SQL FAILED] ${executionMetadata.requestId}:`, data);
      return { ok: false, error: (data && data.error) || 'Unknown SQL execution error' };
    }

    const rows = Array.isArray(data.data) ? data.data : [];
    console.log(`[SQL SUCCESS] ${executionMetadata.requestId}:`, {
      rowCount: rows.length,
      sampleData: rows.slice(0, 2)
    });

    return { ok: true, rows };
  };

  const getTotalCount = async () => {
    const { data: total } = await supabaseClient.rpc('get_journal_entry_count', {
      user_id_filter: userId,
      start_date: normalizedTimeRange?.start || null,
      end_date: normalizedTimeRange?.end || null
    });
    return total || 0;
  };

  const subQuestions = plan.subQuestions || [];
  
  // Default executionStage = 1 when missing
  subQuestions.forEach(sq => {
    if (sq.executionStage == null) sq.executionStage = 1;
  });

  const stages = [...new Set(subQuestions.map(sq => sq.executionStage))].sort((a, b) => a - b);
  console.log(`[executePlan] Processing ${subQuestions.length} sub-questions across stages: ${stages.join(', ')}`);

  const processSubQuestion = async (subQuestion) => {
    console.log(`[executePlan] Processing sub-question: ${subQuestion.question}`);

    const stepPromises = (subQuestion.analysisSteps || []).map(async (step) => {
      try {
        console.log(`[executePlan] Executing step ${step.step}: ${step.description}`);

        // Determine per-step time range
        let stepTimeRange = normalizedTimeRange || null;
        const derived = deriveTimeRangeFromSql(step.sqlQuery || '');

        if (step?.timeRange && (step.timeRange.start || step.timeRange.end)) {
          stepTimeRange = {
            start: step.timeRange.start || null,
            end: step.timeRange.end || null
          };
        } else if (derived.start || derived.end) {
          stepTimeRange = {
            start: derived.start || null,
            end: derived.end || null
          };
        }

        if (step.queryType === 'vector_search' && step.vectorSearch) {
          try {
            console.log(`[executePlan] Generating embedding for vector search: "${step.vectorSearch.query}"`);
            const queryEmbedding = await generateEmbedding(step.vectorSearch.query);
            console.log(`[executePlan] Embedding generated successfully with ${queryEmbedding.length} dimensions`);
            
            const useDated = !!(stepTimeRange && (stepTimeRange.start || stepTimeRange.end));
            const rpcName = useDated ? 'match_journal_entries_with_date' : 'match_journal_entries';

            const rpcArgs = {
              query_embedding: queryEmbedding,
              match_threshold: step.vectorSearch.threshold || 0.3,
              match_count: step.vectorSearch.limit || 10,
              user_id_filter: userId
            };

            if (useDated) {
              rpcArgs.start_date = stepTimeRange?.start || null;
              rpcArgs.end_date = stepTimeRange?.end || null;
              console.log(`[executePlan] Using time-filtered vector search: ${stepTimeRange?.start} to ${stepTimeRange?.end}`);
            }

            console.log(`[executePlan] Calling ${rpcName} with threshold ${rpcArgs.match_threshold}, limit ${rpcArgs.match_count}`);

            // Use the user-authenticated client for vector search
            const { data: vectorData, error: vectorError } = await supabaseClient.rpc(rpcName, rpcArgs);

            if (vectorError) {
              console.error(`[executePlan] Vector search error:`, vectorError);
              return { kind: 'vector', ok: false, error: vectorError.message };
            }

            console.log(`[executePlan] Vector search returned ${vectorData?.length || 0} results`);
            if (vectorData && vectorData.length > 0) {
              console.log(`[executePlan] Sample vector result:`, {
                id: vectorData[0].id,
                similarity: vectorData[0].similarity,
                content_preview: vectorData[0].content?.slice(0, 100)
              });
            }

            return {
              kind: 'vector',
              ok: true,
              entries: vectorData || [],
              timeRange: stepTimeRange
            };
          } catch (e) {
            console.error(`[executePlan] Vector search execution error:`, e);
            return { kind: 'vector', ok: false, error: e.message };
          }
        }

        if (step.queryType === 'sql_analysis' || step.queryType === 'sql_calculation' || step.queryType === 'sql_count') {
          const exec = await executeRawSql(step.sqlQuery || '', stepTimeRange);
          if (exec.ok) return {
            kind: 'sql',
            ok: true,
            rows: exec.rows || [],
            timeRange: stepTimeRange
          };
          return { kind: 'sql', ok: false, error: exec.error || 'SQL execution failed' };
        }

        return { kind: 'unknown', ok: false, error: 'Unknown or missing step configuration' };
      } catch (err) {
        console.error(`[executePlan] Step execution error:`, err);
        return { kind: 'unknown', ok: false, error: err.message };
      }
    });

    const resolved = await Promise.all(stepPromises);
    const sqlRows = resolved.filter(r => r.kind === 'sql' && r.ok && Array.isArray(r.rows));
    const vectorOk = resolved.filter(r => r.kind === 'vector' && r.ok && Array.isArray(r.entries));

    const sqlResults = sqlRows.flatMap(r => r.rows);
    const vectorResults = vectorOk.flatMap(r => r.entries);
    const stepTimeRanges = resolved.map(r => ({
      kind: r.kind,
      timeRange: r.timeRange || null
    }));

    // Prefer SQL-derived metrics when available
    let sqlPercentage = null;
    let sqlCountValue = null;

    for (const row of sqlResults) {
      if (sqlPercentage === null && typeof row?.percentage === 'number') sqlPercentage = Number(row.percentage);
      if (sqlCountValue === null && typeof row?.count === 'number') sqlCountValue = Number(row.count);
    }

    const vectorIds = new Set(vectorResults.map(e => e.id));
    let totalCount = 0;
    try { totalCount = await getTotalCount(); } catch {}

    const vectorBasedPercentage = totalCount > 0 ? Math.round((vectorIds.size / totalCount) * 1000) / 10 : 0;
    const finalPercentage = sqlPercentage ?? vectorBasedPercentage;
    const finalCount = sqlCountValue ?? vectorIds.size;

    console.log(`[executePlan] Sub-question results: ${sqlResults.length} SQL rows, ${vectorResults.length} vector entries`);

    return {
      subQuestion: {
        question: subQuestion.question,
        purpose: subQuestion.purpose,
        executionStage: subQuestion.executionStage
      },
      researcherOutput: {
        plan: { searchStrategy: subQuestion.searchStrategy },
        validatedPlan: { searchStrategy: subQuestion.searchStrategy },
        confidence: plan.confidence ?? null,
        validationIssues: [],
        enhancements: []
      },
      executionResults: {
        sqlResults,
        vectorResults,
        stepTimeRanges,
        combinedMetrics: {
          sqlCount: sqlResults.length,
          vectorCount: vectorResults.length,
          combinedCount: finalCount,
          totalCount,
          combinedPercentage: finalPercentage
        }
      }
    };
  };

  const allResults = [];
  for (const stage of stages) {
    const inStage = subQuestions.filter(sq => sq.executionStage === stage);
    console.log(`[executePlan] Executing stage ${stage} with ${inStage.length} sub-questions in parallel`);
    const stageResults = await Promise.all(inStage.map(processSubQuestion));
    allResults.push(...stageResults);
  }

  console.log(`[EXECUTION COMPLETE] ${executionMetadata.requestId}:`, {
    totalSubQuestions: allResults.length,
    stages: stages.length,
    successfulQuestions: allResults.filter(r => r.executionResults?.sqlResults || r.executionResults?.vectorResults).length,
    timeRange: normalizedTimeRange,
    resultsSummary: allResults.map((r, idx) => ({
      index: idx,
      question: r.subQuestion?.question?.substring(0, 50),
      sqlRowCount: r.executionResults?.sqlResults?.length || 0,
      vectorResultCount: r.executionResults?.vectorResults?.length || 0,
      hasError: !!r.executionResults?.error
    }))
  });

  // Final data integrity check
  allResults.forEach((result, idx) => {
    const sqlCount = result.executionResults?.sqlResults?.length || 0;
    const vectorCount = result.executionResults?.vectorResults?.length || 0;
    console.log(`[RESULT SUMMARY] ${executionMetadata.requestId} #${idx + 1}: ${sqlCount} SQL rows, ${vectorCount} vector results`);

    if (vectorCount > 0) {
      console.log(`[VECTOR SAMPLE] ${executionMetadata.requestId} #${idx + 1}:`, JSON.stringify(result.executionResults.vectorResults.slice(0, 2), null, 2));
    }
    if (sqlCount > 0) {
      console.log(`[SQL SAMPLE] ${executionMetadata.requestId} #${idx + 1}:`, JSON.stringify(result.executionResults.sqlResults.slice(0, 2), null, 2));
    }
  });

  return { researchResults: allResults };
}

function getLastWeekRangeUTC() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 Sun .. 6 Sat
  const daysSinceMonday = (day + 6) % 7; // Monday = 0

  const startOfThisWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  startOfThisWeek.setUTCDate(startOfThisWeek.getUTCDate() - daysSinceMonday);

  const start = new Date(startOfThisWeek);
  start.setUTCDate(startOfThisWeek.getUTCDate() - 7);
  
  const end = startOfThisWeek; // exclusive

  return { start, end };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate unique request ID for tracking data flow
    const requestId = `planner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { message, conversationContext = [], userId, execute = false, timeRange = null, threadId = null, messageId = null, isFollowUp = false } = await req.json();

    console.log(`[REQUEST START] ${requestId}:`, {
      message: message?.substring(0, 100),
      userId: userId?.substring(0, 8),
      execute,
      timestamp: new Date().toISOString(),
      contextLength: conversationContext?.length || 0,
      timeRange,
      threadId: threadId?.substring(0, 8),
      messageId: messageId?.substring(0, 8),
      isFollowUp
    });

    if (!message || !userId) {
      console.error(`[REQUEST ERROR] ${requestId}: Missing required fields`);
      return new Response(JSON.stringify({
        error: 'Message and userId are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create user-authenticated Supabase client using the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`[REQUEST ERROR] ${requestId}: No authorization header found`);
      return new Response(JSON.stringify({
        error: 'Authorization required'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get user's journal entry count for context
    const { data: countData } = await supabaseClient.rpc('get_journal_entry_count', {
      user_id_filter: userId
    });
    const userEntryCount = countData || 0;

    // Generate comprehensive analysis plan - now passing supabaseClient
    const analysisResult = await analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount, isFollowUp, supabaseClient);

    if (!execute) {
      // Return just the plan without execution
      return new Response(JSON.stringify({
        success: true,
        queryPlan: analysisResult,
        userEntryCount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Execute the analysis plan with user-authenticated client
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

    const executionResult = await executePlan(analysisResult, userId, normalizedTimeRange, supabaseClient);

    return new Response(JSON.stringify({
      success: true,
      queryPlan: analysisResult,
      researchResults: executionResult.researchResults,
      userEntryCount,
      timeRange: normalizedTimeRange
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Smart Query Planner error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      fallback: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
