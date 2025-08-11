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

// Dynamic database context - will be populated with live data

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
        queryType: "vector_search"
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
- Current year: 2025
- User query: "${message}"
- User has ${userEntryCount} journal entries${contextString}

**YOUR RESPONSIBILITIES AS ANALYST AGENT:**
1. **Smart Hypothesis Formation**: Create a smart hypothesis for what the query means and what the user truly wants to know, then logically deduce sub-questions to answer it comprehensively
2. **Sub-Question Generation**: Break down the query into 1-3 focused sub-questions that capture both explicit themes AND related semantic concepts (e.g., "family" should include "mom", "dad", "wife", "husband", "children", "parents", "siblings")
3. **Analysis Planning**: For each sub-question, create detailed step-by-step analysis plans
4. **Query Generation**: Generate specific SQL queries and vector search specifications that include theme synonyms and entity mentions
5. **Search Strategy**: Determine optimal combination of SQL and vector search

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
- For percentages: Use COUNT(CASE WHEN condition THEN 1 END) * 100.0 / COUNT(*) 
- For date filtering: Use created_at with timestamp comparisons
- For theme-based queries like "family": Include SQL that searches master_themes, entities for related terms, AND "refined text"/"transcription text" for semantic mentions (e.g., mom, dad, wife, children, parents, siblings)

**SEARCH STRATEGY SELECTION:**
- sql_primary: For statistical analysis, counts, percentages, structured data
- vector_primary: For semantic content analysis, finding similar entries
- hybrid: For comprehensive analysis requiring both approaches (recommended)

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

// Execute a validated plan with complete SQL freedom
async function executeValidatedPlan(validatedPlan: any, userId: string, normalizedTimeRange: { start?: string | null; end?: string | null } | null, supabaseClient: any) {
  const results: any[] = [];

  // Handle both old structure (subQuestions) and new structure (executionSteps)
  const stepsToProcess = validatedPlan.subQuestions || 
    (validatedPlan.executionSteps ? [{ question: 'Analysis', analysisSteps: validatedPlan.executionSteps }] : []);

  console.log(`[executeValidatedPlan] Processing ${stepsToProcess.length} sub-questions/steps`);

  for (const subQuestion of stepsToProcess) {
    console.log(`[executeValidatedPlan] Processing sub-question: ${subQuestion.question}`);
    
    for (const step of (subQuestion.analysisSteps || [])) {
      try {
        console.log(`[executeValidatedPlan] Executing step ${step.step}: ${step.description}`);
        
        if (step.queryType === 'vector_search') {
          // Skip vector search to maintain pipeline stability
          results.push({ 
            stepId: `${subQuestion.question}_${step.step}`, 
            type: 'vector_search', 
            skipped: true, 
            reason: 'Vector search not executed in planner' 
          });
          continue;
        }

        if (step.queryType === 'sql_analysis' || step.queryType === 'sql_calculation' || step.queryType === 'sql_count') {
          const sqlQuery = step.sqlQuery;
          
          if (!sqlQuery) {
            results.push({ 
              stepId: `${subQuestion.question}_${step.step}`, 
              type: 'sql_query', 
              error: 'No SQL query provided' 
            });
            continue;
          }

          console.log(`[executeValidatedPlan] Executing SQL: ${sqlQuery.substring(0, 100)}...`);

          // Execute the SQL query using the dynamic query executor
          const { data, error } = await supabaseClient.rpc('execute_dynamic_query', {
            query_text: sqlQuery.replace('$user_id', `'${userId}'`)
          });

          if (error) {
            console.error(`[executeValidatedPlan] SQL execution error:`, error);
            results.push({ 
              stepId: `${subQuestion.question}_${step.step}`, 
              type: 'sql_query', 
              error: error.message,
              sql: sqlQuery
            });
          } else {
            console.log(`[executeValidatedPlan] SQL success, rows: ${data?.data?.length || 0}`);
            results.push({ 
              stepId: `${subQuestion.question}_${step.step}`, 
              type: 'sql_query', 
              success: true,
              rows: data?.data || [],
              sql: sqlQuery,
              subQuestion: subQuestion.question,
              description: step.description
            });
          }
          continue;
        }

        // Unknown step type
        results.push({ 
          stepId: `${subQuestion.question}_${step.step}`, 
          type: step.queryType, 
          skipped: true, 
          reason: 'Unknown step type' 
        });
        
      } catch (e) {
        console.error(`[executeValidatedPlan] Step execution error:`, e);
        results.push({ 
          stepId: `${subQuestion.question}_${step.step}`, 
          type: step.queryType, 
          error: (e as Error).message 
        });
      }
    }
  }

  console.log(`[executeValidatedPlan] Completed execution with ${results.length} results`);
  return { steps: results };
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
    const analysisPlan = await analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount);

    // Optionally execute the plan (Researcher Agent removed; direct execution)
    let researchResults = null as any;
    if (execute && analysisPlan?.subQuestions?.length) {
      // Normalize time range
      const normalizedTimeRange = (() => {
        const tr = analysisPlan?.timeRange || analysisPlan?.dateRange || timeRange || null;
        if (!tr) return null;
        const start = tr.start ?? tr.startDate ?? null;
        const end = tr.end ?? tr.endDate ?? null;
        return (start || end) ? { start, end } : null;
      })();

      // Build pseudo-validated plans from Analyst sub-questions and execute
      researchResults = await Promise.all(
        analysisPlan.subQuestions.map(async (subQuestion: any, index: number) => {
          try {
            const executionSteps: any[] = [];
            // Map analysisSteps to executionSteps
            for (const step of (subQuestion.analysisSteps || [])) {
              if (step.queryType?.includes('sql') && step.sqlQuery) {
                // Ensure parameter placeholder and user filter
                let sqlText = String(step.sqlQuery);
                sqlText = sqlText.replace(/\$user_id/g, '$1');
                if (!/WHERE\s+[^;]*user_id\s*=\s*\$1/i.test(sqlText)) {
                  // Naively inject user filter if missing
                  const whereMatch = sqlText.match(/\bWHERE\b/i);
                  if (whereMatch) {
                    sqlText = sqlText.replace(/\bWHERE\b/i, 'WHERE user_id = $1 AND ');
                  } else {
                    // Insert WHERE before ORDER/LIMIT/; if possible
                    const insertIndex = sqlText.search(/\bORDER BY\b|\bLIMIT\b|;|$/i);
                    sqlText = `${sqlText.slice(0, insertIndex)} WHERE user_id = $1 ${sqlText.slice(insertIndex)}`;
                  }
                }
                executionSteps.push({
                  stepId: executionSteps.length + 1,
                  type: 'sql_query',
                  description: step.description || 'SQL analysis',
                  sql: {
                    query: sqlText,
                    parameters: ['$user_id'],
                    purpose: step.description || 'analysis'
                  },
                  vector: null
                });
              } else if (step.queryType === 'vector_search' && step.vectorSearch) {
                executionSteps.push({
                  stepId: executionSteps.length + 1,
                  type: 'vector_search',
                  description: step.description || 'Vector search',
                  sql: null,
                  vector: {
                    queryText: step.vectorSearch.query,
                    threshold: step.vectorSearch.threshold ?? 0.3,
                    limit: step.vectorSearch.limit ?? 10,
                    dateFilter: Boolean(normalizedTimeRange)
                  }
                });
              }
            }

            const validatedPlan = {
              subQuestions: [{
                question: subQuestion.question,
                searchStrategy: subQuestion.searchStrategy || 'hybrid',
                analysisSteps: subQuestion.analysisSteps || []
              }]
            };

            const executionResults = await executeValidatedPlan(validatedPlan, userId, normalizedTimeRange, supabase);

            return {
              subQuestion,
              researcherOutput: { validatedPlan, confidence: analysisPlan.confidence ?? 0.8, validationIssues: [], enhancements: [] },
              executionResults,
              index
            };
          } catch (err) {
            console.error('[smart-query-planner] Execution error:', err);
            return {
              subQuestion,
              researcherOutput: null,
              executionResults: { error: err.message },
              index
            };
          }
        })
      );
    }
    
    return new Response(JSON.stringify({
      success: true,
      queryPlan: analysisPlan,
      userEntryCount,
      researchResults: researchResults || undefined,
      analysisResults: researchResults || undefined,
      metadata: {
        plannerVersion: "analyst_agent_v2",
        timestamp: new Date().toISOString(),
        hasSubQuestions: Boolean(analysisPlan.subQuestions?.length),
        searchStrategies: analysisPlan.subQuestions?.map((sq: any) => sq.searchStrategy) || [],
        processedSubQuestions: researchResults?.length || 0,
        hasErrors: Array.isArray(researchResults) ? researchResults.some((r: any) => r.executionResults?.error) : false
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in Smart Query Planner:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      fallbackPlan: createFallbackPlan("general analysis")
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});