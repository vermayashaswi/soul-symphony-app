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
- For percentages: Use COUNT(CASE WHEN condition THEN 1 END) * 100.0 / COUNT(*) 
- For date filtering: Use created_at with timestamp comparisons
- For theme-based queries like "family": AUTOMATICALLY expand to related terms (mom, dad, wife, husband, children, parents, siblings, mother, father, son, daughter, family) and search in master_themes, entities, AND text content
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

// Execute a validated plan with proper SQL and vector search execution
async function executeValidatedPlan(validatedPlan: any, userId: string, normalizedTimeRange: { start?: string | null; end?: string | null } | null, supabaseClient: any) {
  const results: any[] = [];

  // Handle both old structure (subQuestions) and new structure (executionSteps)
  const stepsToProcess = validatedPlan.subQuestions || 
    (validatedPlan.executionSteps ? [{ question: 'Analysis', analysisSteps: validatedPlan.executionSteps }] : []);

  console.log(`[executeValidatedPlan] Processing ${stepsToProcess.length} sub-questions/steps`);

  // Execute all sub-questions asynchronously for better performance
  const subQuestionPromises = stepsToProcess.map(async (subQuestion, index) => {
    console.log(`[executeValidatedPlan] Processing sub-question: ${subQuestion.question}`);
    
    const stepResults: any[] = [];
    
    // Execute all steps within this sub-question asynchronously
    const stepPromises = (subQuestion.analysisSteps || []).map(async (step, stepIndex) => {
      try {
        console.log(`[executeValidatedPlan] Executing step ${step.step}: ${step.description}`);
        
        if (step.queryType === 'vector_search') {
          // Execute vector search with proper embedding generation
          if (step.vectorSearch) {
            console.log(`[executeValidatedPlan] Executing vector search: ${step.vectorSearch.query}`);
            
            try {
              // Generate embedding for the search query
              const queryEmbedding = await generateEmbedding(step.vectorSearch.query);
              
              // Call the vector search function with proper parameters
              const { data: vectorData, error: vectorError } = await supabaseClient.rpc('match_journal_entries', {
                query_embedding: queryEmbedding,
                match_threshold: step.vectorSearch.threshold || 0.3,
                match_count: step.vectorSearch.limit || 10,
                user_id_filter: userId
              });
              
              if (vectorError) {
                return { 
                  stepId: `${subQuestion.question}_${step.step}`, 
                  type: 'vector_search', 
                  error: vectorError.message,
                  query: step.vectorSearch.query
                };
              } else {
                return { 
                  stepId: `${subQuestion.question}_${step.step}`, 
                  type: 'vector_search', 
                  success: true,
                  entries: vectorData || [],
                  query: step.vectorSearch.query,
                  subQuestion: subQuestion.question,
                  description: step.description
                };
              }
            } catch (vectorErr) {
              return { 
                stepId: `${subQuestion.question}_${step.step}`, 
                type: 'vector_search', 
                error: (vectorErr as Error).message,
                query: step.vectorSearch.query
              };
            }
          } else {
            return { 
              stepId: `${subQuestion.question}_${step.step}`, 
              type: 'vector_search', 
              skipped: true, 
              reason: 'No vector search parameters provided' 
            };
          }
        }

        if (step.queryType === 'sql_analysis' || step.queryType === 'sql_calculation' || step.queryType === 'sql_count') {
          const sqlQuery = step.sqlQuery;
          
          if (!sqlQuery) {
            return { 
              stepId: `${subQuestion.question}_${step.step}`, 
              type: 'sql_query', 
              error: 'No SQL query provided' 
            };
          }

          console.log(`[executeValidatedPlan] Executing SQL: ${sqlQuery.substring(0, 100)}...`);

          // Execute the SQL query with proper parameter binding
          const { data, error } = await supabaseClient.rpc('execute_dynamic_query', {
            query_text: sqlQuery.replace(/\$user_id/g, `'${userId}'`)
          });

          if (error) {
            console.error(`[executeValidatedPlan] SQL execution error:`, error);
            return { 
              stepId: `${subQuestion.question}_${step.step}`, 
              type: 'sql_query', 
              error: error.message,
              sql: sqlQuery
            };
          } else {
            console.log(`[executeValidatedPlan] SQL success, rows: ${data?.data?.length || 0}`);
            return { 
              stepId: `${subQuestion.question}_${step.step}`, 
              type: 'sql_query', 
              success: true,
              rows: data?.data || [],
              sql: sqlQuery,
              subQuestion: subQuestion.question,
              description: step.description
            };
          }
        }

        // Unknown step type
        return { 
          stepId: `${subQuestion.question}_${step.step}`, 
          type: step.queryType, 
          skipped: true, 
          reason: 'Unknown step type' 
        };
        
      } catch (e) {
        console.error(`[executeValidatedPlan] Step execution error:`, e);
        return { 
          stepId: `${subQuestion.question}_${step.step}`, 
          type: step.queryType, 
          error: (e as Error).message 
        };
      }
    });

    // Wait for all steps in this sub-question to complete
    const stepResults_resolved = await Promise.all(stepPromises);
    return stepResults_resolved;
  });

  // Wait for all sub-questions to complete
  const allResults = await Promise.all(subQuestionPromises);
  
  // Flatten the results
  const flattenedResults = allResults.flat();
  results.push(...flattenedResults);

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
      researchResults: executionResult.steps,
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