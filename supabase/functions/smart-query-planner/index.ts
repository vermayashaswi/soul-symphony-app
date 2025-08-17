
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
          stepResult = await executeVectorSearch(step, userId, supabaseClient, requestId);
        } else if (step.queryType === 'sql_analysis') {
          console.log(`[${requestId}] SQL analysis:`, step.sqlQuery);
          stepResult = await executeSQLAnalysis(step, userId, supabaseClient, requestId);
        } else if (step.queryType === 'hybrid_search') {
          console.log(`[${requestId}] Hybrid search:`, step.vectorSearch.query, step.sqlQuery);
          stepResult = await executeHybridSearch(step, userId, supabaseClient, requestId);
        } else {
          console.warn(`[${requestId}] Unknown query type:`, step.queryType);
          stepResult = { error: `Unknown query type: ${step.queryType}` };
        }

        subResults.push({ step: step.step, result: stepResult });

      } catch (stepError) {
        console.error(`[${requestId}] Error executing step:`, step.step, stepError);
        subResults.push({ step: step.step, error: stepError.message });
      }
    }

    results.push({ question: subQuestion.question, results: subResults });
  }

  console.log(`[${requestId}] Execution complete. Results:`, JSON.stringify(results, null, 2));
  return results;
}

async function executeVectorSearch(step: any, userId: string, supabaseClient: any, requestId: string) {
  try {
    const { data, error } = await supabaseClient.rpc('match_journal_entries', {
      query_embedding: await generateEmbedding(step.vectorSearch.query),
      match_threshold: step.vectorSearch.threshold || 0.3,
      match_count: step.vectorSearch.limit || 10,
      user_id_filter: userId
    });

    if (error) {
      console.error(`[${requestId}] Vector search error:`, error);
      throw error;
    }

    console.log(`[${requestId}] Vector search results:`, data?.length);
    return data;

  } catch (error) {
    console.error(`[${requestId}] Error in vector search:`, error);
    throw error;
  }
}

async function executeSQLAnalysis(step: any, userId: string, supabaseClient: any, requestId: string) {
  try {
    const { data, error } = await supabaseClient
      .from('Journal Entries')
      .select('*')
      .eq('user_id', userId)
      .limit(10);

    if (error) {
      console.error(`[${requestId}] SQL analysis error:`, error);
      throw error;
    }

    console.log(`[${requestId}] SQL analysis results:`, data?.length);
    return data;

  } catch (error) {
    console.error(`[${requestId}] Error in SQL analysis:`, error);
    throw error;
  }
}

async function executeHybridSearch(step: any, userId: string, supabaseClient: any, requestId: string) {
  try {
    // Execute both vector and SQL searches in parallel
    const [vectorResults, sqlResults] = await Promise.all([
      executeVectorSearch(step, userId, supabaseClient, requestId),
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
 * Enhanced Analyst Agent with timezone-aware date processing
 */
async function analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount, isFollowUp = false, supabaseClient, userTimezone = 'UTC') {
  try {
    const last = Array.isArray(conversationContext) ? conversationContext.slice(-5) : [];
    
    console.log(`[Analyst Agent] Processing query with user timezone: ${userTimezone}`);
    
    // Enhanced content-seeking detection with comprehensive patterns
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

    // Get live database schema with real themes and emotions using the authenticated client
    const databaseSchemaContext = await generateDatabaseSchemaContext(supabaseClient);

    const prompt = `You are SOULo's Enhanced Analyst Agent - an intelligent query planning specialist for journal data analysis with MANDATORY VECTOR SEARCH for content-seeking queries and TIMEZONE-AWARE date processing.

${databaseSchemaContext}

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
5. Ensures comprehensive coverage of user's intent

Response format:
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
          "sqlQuery": "SQL query if needed" or null,
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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Analyst Agent response:", data.choices[0].message.content);

    let analysisResult;
    try {
      analysisResult = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error("Failed to parse Analyst Agent response:", parseError);
      return createEnhancedFallbackPlan(message, isContentSeekingQuery || requiresMandatoryVector, null, supabaseClient, userTimezone);
    }

    if (!analysisResult || !analysisResult.subQuestions) {
      console.error("Failed to parse Analyst Agent response, using enhanced fallback for content queries");
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

    console.log("Final Analyst Plan with timezone handling:", JSON.stringify(finalResult, null, 2));
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

async function generateDatabaseSchemaContext(supabaseClient: any): Promise<string> {
  try {
    const { data: emotions, error: emotionError } = await supabaseClient
      .from('Emotions')
      .select('name, description');

    if (emotionError) {
      console.error('Error fetching emotions:', emotionError);
      throw emotionError;
    }

    const { data: themes, error: themeError } = await supabaseClient
      .from('Themes')
      .select('name, description');

    if (themeError) {
      console.error('Error fetching themes:', themeError);
      throw themeError;
    }

    const emotionDescriptions = emotions
      .map(emotion => `- ${emotion.name}: ${emotion.description}`)
      .join('\n');

    const themeDescriptions = themes
      .map(theme => `- ${theme.name}: ${theme.description}`)
      .join('\n');

    return `
DATABASE CONTEXT:
- The database contains journal entries with text content, emotions, and themes.
- Each entry is associated with a user ID.
- The Emotions table contains a list of emotions with descriptions:
${emotionDescriptions}
- The Themes table contains a list of themes with descriptions:
${themeDescriptions}
`;
  } catch (error) {
    console.error('Error generating database schema context:', error);
    return 'Error generating database schema context. Using limited context.';
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

    // Generate comprehensive analysis plan with timezone support
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
