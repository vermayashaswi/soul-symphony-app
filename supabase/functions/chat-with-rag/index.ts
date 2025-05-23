import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Progressive threshold reduction for vector search
 */
async function searchWithProgressiveThresholds(
  supabase: any,
  userId: string,
  queryEmbedding: number[],
  initialThreshold: number,
  searchPlan: any
): Promise<any[]> {
  const thresholds = [initialThreshold, 0.05, 0.03, 0.01];
  
  for (const threshold of thresholds) {
    console.log(`[chat-with-rag] Trying vector search with threshold ${threshold}`);
    
    try {
      let results = [];
      
      if (searchPlan.dateFilter) {
        const { data, error } = await supabase.rpc(
          'match_journal_entries_with_date',
          {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: 15,
            user_id_filter: userId,
            start_date: searchPlan.dateFilter.startDate,
            end_date: searchPlan.dateFilter.endDate
          }
        );
        
        if (!error && data) {
          results = data;
        }
      } else {
        const { data, error } = await supabase.rpc(
          'match_journal_entries_fixed',
          {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: 15,
            user_id_filter: userId
          }
        );
        
        if (!error && data) {
          results = data;
        }
      }
      
      if (results.length > 0) {
        console.log(`[chat-with-rag] Found ${results.length} results with threshold ${threshold}`);
        return results;
      }
    } catch (error) {
      console.error(`[chat-with-rag] Error with threshold ${threshold}:`, error);
    }
  }
  
  console.log(`[chat-with-rag] No results found with progressive thresholds`);
  return [];
}

/**
 * Enhanced keyword-based content search with date filtering support
 */
async function searchByKeywords(
  supabase: any,
  userId: string,
  query: string,
  dateFilter?: { startDate?: string; endDate?: string }
): Promise<any[]> {
  console.log(`[chat-with-rag] Attempting keyword search for: "${query}"`);
  
  // Extract meaningful keywords from the query
  const keywords = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !['what', 'when', 'where', 'how', 'why', 'the', 'and', 'for', 'are', 'with'].includes(word))
    .slice(0, 5);
  
  if (keywords.length === 0) {
    return [];
  }
  
  try {
    let query_builder = supabase
      .from('Journal Entries')
      .select('id, created_at, "refined text", "transcription text", emotions, master_themes')
      .eq('user_id', userId)
      .or(keywords.map(keyword => 
        `"refined text".ilike.%${keyword}%,"transcription text".ilike.%${keyword}%`
      ).join(','));
    
    // Apply date filters if provided
    if (dateFilter?.startDate) {
      query_builder = query_builder.gte('created_at', dateFilter.startDate);
      console.log(`[chat-with-rag] Applying keyword search start date filter: ${dateFilter.startDate}`);
    }
    
    if (dateFilter?.endDate) {
      query_builder = query_builder.lte('created_at', dateFilter.endDate);
      console.log(`[chat-with-rag] Applying keyword search end date filter: ${dateFilter.endDate}`);
    }
    
    const { data, error } = await query_builder
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (!error && data) {
      const results = data.map(entry => ({
        id: entry.id,
        content: entry['refined text'] || entry['transcription text'] || '',
        created_at: entry.created_at,
        similarity: 0.7,
        source: 'keyword_search',
        matched_keywords: keywords
      }));
      
      console.log(`[chat-with-rag] Keyword search found ${results.length} results with date filtering`);
      return results;
    }
  } catch (error) {
    console.error(`[chat-with-rag] Error in keyword search:`, error);
  }
  
  return [];
}

/**
 * Execute a single sub-question's search plan with enhanced fallbacks
 */
async function executeSubQuestionPlan(
  subQuestion: any,
  userId: string,
  supabase: any,
  queryEmbedding: number[]
): Promise<any> {
  console.log(`[chat-with-rag] Executing sub-question: "${subQuestion.question}"`);
  
  let results = [];
  const searchPlan = subQuestion.searchPlan;
  
  try {
    // Execute SQL queries if specified
    if (searchPlan.sqlQueries && searchPlan.sqlQueries.length > 0) {
      console.log(`[chat-with-rag] Executing ${searchPlan.sqlQueries.length} SQL queries for sub-question`);
      
      const sqlPromises = searchPlan.sqlQueries.map(async (sqlQuery) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds
          
          // Replace USER_ID_PLACEHOLDER with actual userId
          const parameters = { ...sqlQuery.parameters };
          Object.keys(parameters).forEach(key => {
            if (parameters[key] === 'USER_ID_PLACEHOLDER') {
              parameters[key] = userId;
            }
          });
          
          let sqlResults = [];
          
          if (sqlQuery.function === 'get_top_emotions_with_entries') {
            const { data, error } = await supabase.rpc('get_top_emotions_with_entries', {
              user_id_param: userId,
              start_date: parameters.start_date || null,
              end_date: parameters.end_date || null,
              limit_count: parameters.limit_count || 10
            });
            
            clearTimeout(timeoutId);
            
            if (!error && data) {
              sqlResults = data.flatMap(emotion => 
                emotion.sample_entries.map(entry => ({
                  id: entry.id,
                  content: entry.content,
                  created_at: entry.created_at,
                  similarity: 0.9,
                  source: 'sql_emotion',
                  emotion: emotion.emotion,
                  emotion_score: emotion.score,
                  subQuestion: subQuestion.question
                }))
              );
            }
          } else if (sqlQuery.function === 'match_journal_entries_by_emotion') {
            const { data, error } = await supabase.rpc('match_journal_entries_by_emotion', {
              emotion_name: parameters.emotion_name,
              user_id_filter: userId,
              min_score: 0.05,
              start_date: parameters.start_date || null,
              end_date: parameters.end_date || null,
              limit_count: parameters.limit_count || 10
            });
            
            clearTimeout(timeoutId);
            
            if (!error && data) {
              sqlResults = data.map(entry => ({
                id: entry.id,
                content: entry.content,
                created_at: entry.created_at,
                similarity: 0.8,
                source: 'sql_emotion_specific',
                emotion_score: entry.emotion_score,
                subQuestion: subQuestion.question
              }));
            }
          }
          
          console.log(`[chat-with-rag] SQL query ${sqlQuery.function} returned ${sqlResults.length} results`);
          return sqlResults;
          
        } catch (error) {
          console.error(`[chat-with-rag] Error executing SQL query ${sqlQuery.function}:`, error);
          return [];
        }
      });
      
      const sqlResultsArrays = await Promise.allSettled(sqlPromises);
      sqlResultsArrays.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        }
      });
    }
    
    // Execute vector search with progressive threshold reduction
    if (searchPlan.vectorSearch && searchPlan.vectorSearch.enabled) {
      console.log(`[chat-with-rag] Executing progressive vector search starting with threshold ${searchPlan.vectorSearch.threshold}`);
      
      try {
        // Use the optimized query from the search plan or fallback to sub-question
        const searchQuery = searchPlan.vectorSearch.query || subQuestion.question;
        
        // Generate embedding for the specific sub-question query
        let subQuestionEmbedding = queryEmbedding; // Default to main query embedding
        if (searchQuery !== subQuestion.question) {
          try {
            const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                input: searchQuery,
                model: 'text-embedding-3-small',
              }),
            });
            
            if (embeddingResponse.ok) {
              const embeddingData = await embeddingResponse.json();
              subQuestionEmbedding = embeddingData.data[0].embedding;
            }
          } catch (embeddingError) {
            console.error('[chat-with-rag] Failed to generate sub-question embedding:', embeddingError);
          }
        }
        
        const vectorResults = await searchWithProgressiveThresholds(
          supabase,
          userId,
          subQuestionEmbedding,
          searchPlan.vectorSearch.threshold,
          searchPlan.vectorSearch
        );
        
        const enhancedVectorResults = vectorResults.map(entry => ({
          ...entry,
          source: searchPlan.vectorSearch.dateFilter ? 'vector_time_filtered' : 'vector_semantic',
          subQuestion: subQuestion.question
        }));
        
        results = results.concat(enhancedVectorResults);
        console.log(`[chat-with-rag] Progressive vector search returned ${enhancedVectorResults.length} results`);
        
      } catch (error) {
        console.error(`[chat-with-rag] Vector search error for sub-question:`, error);
      }
    }
    
    // Apply enhanced fallback strategies with strict date filtering
    if (results.length < 3 && searchPlan.fallbackStrategy) {
      console.log(`[chat-with-rag] Applying enhanced fallback strategy: ${searchPlan.fallbackStrategy}`);
      
      // Extract date filter from vector search plan
      const dateFilter = searchPlan.vectorSearch?.dateFilter || null;
      
      // If we have a date filter but no results, don't apply fallback - return empty
      if (dateFilter) {
        console.log(`[chat-with-rag] Date filter detected: ${JSON.stringify(dateFilter)} - checking if fallback should respect it`);
        
        // For date-filtered queries, if we have no results, we should NOT fall back to broader searches
        if (results.length === 0) {
          console.log(`[chat-with-rag] No results found within date range ${dateFilter.startDate} to ${dateFilter.endDate} - NOT applying fallback to maintain date constraint integrity`);
          return {
            subQuestion: subQuestion.question,
            purpose: subQuestion.purpose,
            results: [],
            resultCount: 0,
            dateFilterApplied: true,
            dateRange: dateFilter
          };
        }
      }
      
      try {
        let fallbackResults = [];
        
        if (searchPlan.fallbackStrategy === 'keyword_search') {
          fallbackResults = await searchByKeywords(supabase, userId, subQuestion.question, dateFilter);
          fallbackResults = fallbackResults.map(entry => ({
            ...entry,
            source: 'fallback_keyword',
            subQuestion: subQuestion.question
          }));
        } else if (searchPlan.fallbackStrategy === 'recent_entries') {
          let query_builder = supabase
            .from('Journal Entries')
            .select('id, created_at, "refined text", "transcription text", emotions, master_themes')
            .eq('user_id', userId);
          
          // Apply date filters to recent entries fallback if they exist
          if (dateFilter?.startDate) {
            query_builder = query_builder.gte('created_at', dateFilter.startDate);
            console.log(`[chat-with-rag] Applying recent entries fallback start date filter: ${dateFilter.startDate}`);
          }
          
          if (dateFilter?.endDate) {
            query_builder = query_builder.lte('created_at', dateFilter.endDate);
            console.log(`[chat-with-rag] Applying recent entries fallback end date filter: ${dateFilter.endDate}`);
          }
          
          const { data, error } = await query_builder
            .order('created_at', { ascending: false })
            .limit(10);
            
          if (!error && data) {
            fallbackResults = data.map(entry => ({
              id: entry.id,
              content: entry['refined text'] || entry['transcription text'] || '',
              created_at: entry.created_at,
              similarity: 0.5,
              source: 'fallback_recent',
              subQuestion: subQuestion.question
            }));
          }
        } else if (searchPlan.fallbackStrategy === 'emotion_based') {
          // Apply date filters to emotion-based fallback
          const emotionParams = {
            user_id_param: userId,
            limit_count: 3
          };
          
          if (dateFilter?.startDate) {
            emotionParams.start_date = dateFilter.startDate;
            console.log(`[chat-with-rag] Applying emotion fallback start date filter: ${dateFilter.startDate}`);
          }
          
          if (dateFilter?.endDate) {
            emotionParams.end_date = dateFilter.endDate;
            console.log(`[chat-with-rag] Applying emotion fallback end date filter: ${dateFilter.endDate}`);
          }
          
          const { data, error } = await supabase.rpc('get_top_emotions_with_entries', emotionParams);
          
          if (!error && data) {
            fallbackResults = data.flatMap(emotion => 
              emotion.sample_entries.map(entry => ({
                id: entry.id,
                content: entry.content,
                created_at: entry.created_at,
                similarity: 0.6,
                source: 'fallback_emotion',
                emotion: emotion.emotion,
                subQuestion: subQuestion.question
              }))
            );
          }
        }
        
        results = results.concat(fallbackResults);
        console.log(`[chat-with-rag] Enhanced fallback strategy added ${fallbackResults.length} results (with date filtering: ${dateFilter ? 'yes' : 'no'})`);
        
      } catch (error) {
        console.error(`[chat-with-rag] Enhanced fallback strategy failed:`, error);
      }
    }
    
    return {
      subQuestion: subQuestion.question,
      purpose: subQuestion.purpose,
      results: results,
      resultCount: results.length,
      dateFilterApplied: !!searchPlan.vectorSearch?.dateFilter
    };
    
  } catch (error) {
    console.error(`[chat-with-rag] Error executing sub-question plan:`, error);
    return {
      subQuestion: subQuestion.question,
      purpose: subQuestion.purpose,
      results: [],
      resultCount: 0,
      error: error.message
    };
  }
}

/**
 * Execute all sub-questions in parallel and aggregate results
 */
async function executeIntelligentSubQueries(
  message: string,
  userId: string,
  supabase: any,
  queryPlan: any,
  queryEmbedding: number[]
): Promise<any> {
  console.log(`[chat-with-rag] Executing ${queryPlan.subQuestions.length} sub-questions in parallel`);
  
  try {
    // Execute all sub-questions in parallel
    const subQuestionPromises = queryPlan.subQuestions.map(subQuestion => 
      executeSubQuestionPlan(subQuestion, userId, supabase, queryEmbedding)
    );
    
    const subQuestionResults = await Promise.allSettled(subQuestionPromises);
    
    // Aggregate all results
    let allResults = [];
    const subQuestionSummary = [];
    let hasDateFilters = false;
    
    subQuestionResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const subResult = result.value;
        allResults = allResults.concat(subResult.results);
        subQuestionSummary.push({
          question: subResult.subQuestion,
          purpose: subResult.purpose,
          resultCount: subResult.resultCount,
          status: 'success',
          dateFilterApplied: subResult.dateFilterApplied
        });
        
        if (subResult.dateFilterApplied) {
          hasDateFilters = true;
        }
      } else {
        console.error(`Sub-question ${index} failed:`, result.reason);
        subQuestionSummary.push({
          question: queryPlan.subQuestions[index].question,
          resultCount: 0,
          status: 'failed',
          error: result.reason
        });
      }
    });
    
    // Remove duplicates and sort by relevance
    const uniqueResults = allResults.filter((entry, index, self) => 
      index === self.findIndex(e => e.id === entry.id)
    ).sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    
    console.log(`[chat-with-rag] Sub-question execution completed: ${uniqueResults.length} unique results from ${subQuestionSummary.length} sub-questions (date filters applied: ${hasDateFilters})`);
    
    return {
      results: uniqueResults.slice(0, 20),
      subQuestionSummary,
      totalResults: uniqueResults.length,
      hasDateFilters
    };
    
  } catch (error) {
    console.error('[chat-with-rag] Error in sub-question execution:', error);
    throw error;
  }
}

/**
 * Enhanced response generation with improved SOULo persona and formatting
 */
async function generateResponseWithSubQuestionContext(
  message: string,
  aggregatedResults: any,
  queryPlan: any,
  conversationContext: any[],
  openAiApiKey: string
): Promise<{ content: string; analysisMetadata: any }> {
  const responseStartTime = Date.now();
  
  try {
    // Enhanced system prompt with SOULo's personality and formatting instructions
    let systemPrompt = `You are SOULo, a warm and supportive mental health assistant for the SOULo voice journaling app. You analyze users' voice journal entries to provide personalized insights and emotional support.

Your personality:
- Speak in first person, directly to the user using "you" and "your"
- Be warm, empathetic, and understanding like a trusted friend
- Reference yourself as "I" when appropriate (e.g., "I can see from your entries...")
- Never use clinical terms like "the individual" - always speak directly to the user
- Be encouraging and focus on growth and self-awareness

Response formatting requirements:
- ALWAYS use **bold headers** for main sections
- Use bullet points (•) for key insights and observations
- Structure your response with clear sections
- Keep responses concise but meaningful
- Example format:
  **Your Emotional Patterns**
  • Main insight here
  • Another key observation
  
  **What I Notice**
  • Specific pattern from your entries
  • Growth opportunity or strength`;

    if (queryPlan.isPersonalityQuery) {
      systemPrompt += `\n\nFocus: Provide personality insights based on ${queryPlan.subQuestions.length} approaches to analyzing the user's journal entries.`;
    } else if (queryPlan.isEmotionQuery) {
      systemPrompt += `\n\nFocus: Analyze emotional patterns using ${queryPlan.subQuestions.length} targeted approaches.`;
    }

    // Check if we have date filters but no results - provide specific message
    if (aggregatedResults.hasDateFilters && aggregatedResults.results.length === 0) {
      // Extract date information from the query for a more specific response
      let timeReference = "that time period";
      if (message.toLowerCase().includes("last week")) {
        timeReference = "last week";
      } else if (message.toLowerCase().includes("yesterday")) {
        timeReference = "yesterday";
      } else if (message.toLowerCase().includes("last month")) {
        timeReference = "last month";
      } else if (message.toLowerCase().includes("this week")) {
        timeReference = "this week";
      } else if (message.toLowerCase().includes("this month")) {
        timeReference = "this month";
      }
      
      const noEntriesResponse = `I don't see any journal entries from ${timeReference} to analyze. To help me understand your patterns and provide insights, try journaling regularly during the time periods you're curious about. Once you have some entries, I'll be able to give you personalized analysis!`;
      
      return {
        content: noEntriesResponse,
        analysisMetadata: {
          entriesAnalyzed: 0,
          totalEntries: 0,
          dateFilterApplied: true,
          timeReference: timeReference,
          reason: "No entries found in specified date range"
        }
      };
    }

    // Optimize journal entry formatting
    const formattedResults = aggregatedResults.results.slice(0, 12).map((entry, index) => {
      const date = new Date(entry.created_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric'
      });
      
      let metadata = `[${index + 1} - ${date}`;
      if (entry.emotion) metadata += ` - ${entry.emotion}`;
      metadata += `]`;
      
      return `${metadata}\n${entry.content.substring(0, 200)}...\n`;
    }).join('\n');

    // Create analysis metadata for the UI
    const analysisMetadata = {
      entriesAnalyzed: aggregatedResults.results.length,
      totalEntries: aggregatedResults.totalResults,
      dateRange: {
        earliest: aggregatedResults.results.length > 0 ? 
          new Date(Math.min(...aggregatedResults.results.map(r => new Date(r.created_at).getTime()))) : null,
        latest: aggregatedResults.results.length > 0 ? 
          new Date(Math.max(...aggregatedResults.results.map(r => new Date(r.created_at).getTime()))) : null
      },
      subQuestionsUsed: aggregatedResults.subQuestionSummary.length,
      analysisApproaches: aggregatedResults.subQuestionSummary.map(sq => sq.question),
      dateFilterApplied: aggregatedResults.hasDateFilters
    };

    const userPrompt = `Based on your ${aggregatedResults.results.length} journal entries, here's what I found:

${formattedResults}

Your question: "${message}"

Please provide a warm, personal response with **bold headers** and bullet points. Speak directly to the user as their supportive mental health assistant.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationContext.slice(-1),
      { role: 'user', content: userPrompt }
    ];

    console.log(`[chat-with-rag] Starting OpenAI request after ${Date.now() - responseStartTime}ms of preparation`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('[chat-with-rag] OpenAI request timed out after 25 seconds');
      controller.abort();
    }, 25000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    const totalPreparationTime = Date.now() - responseStartTime;
    console.log(`[chat-with-rag] OpenAI request completed after ${totalPreparationTime}ms total time`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[chat-with-rag] OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const generatedResponse = data.choices[0]?.message?.content;
    
    if (!generatedResponse) {
      console.error('[chat-with-rag] No content in OpenAI response');
      throw new Error('No content in OpenAI response');
    }
    
    console.log(`[chat-with-rag] Generated response successfully, length: ${generatedResponse.length}`);
    return { content: generatedResponse, analysisMetadata };

  } catch (error) {
    const totalTime = Date.now() - responseStartTime;
    console.error(`[chat-with-rag] Error generating response after ${totalTime}ms:`, error);
    
    if (error.name === 'AbortError') {
      console.error('[chat-with-rag] Response generation timed out');
      return { 
        content: "I found relevant information in your journal entries, but the response took too long to generate. Please try asking a more specific question.", 
        analysisMetadata: null 
      };
    }
    
    return { 
      content: "I found relevant information in your journal entries but encountered an error while generating the response. Please try again.", 
      analysisMetadata: null 
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { 
      message, 
      userId, 
      threadId, 
      timeRange, 
      referenceDate, 
      conversationContext = [], 
      queryPlan = {},
      isMentalHealthQuery,
      clientTimeInfo,
      userTimezone 
    } = await req.json();

    console.log(`[chat-with-rag] Processing intelligent sub-query for: "${message}"`);

    // Validate required parameters
    if (!message || !userId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required parameters',
        data: "I'm missing some required information to process your request. Please try again."
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      console.error('[chat-with-rag] CRITICAL: OpenAI API key not configured');
      return new Response(JSON.stringify({
        data: "The AI service is temporarily unavailable. Please try again in a moment."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Quick entry count check with 25s timeout
    let entryCount = 0;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      
      const { count, error: countError } = await supabase
        .from('Journal Entries')
        .select('id', { count: "exact", head: true })
        .eq('user_id', userId)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (countError) {
        console.error('[chat-with-rag] Error checking entries:', countError);
      } else if (!count || count === 0) {
        return new Response(JSON.stringify({
          data: "I don't have any journal entries to analyze yet. Please add some journal entries first, and then I'll be able to provide personalized insights!"
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        entryCount = count;
      }
    } catch (error) {
      console.error('[chat-with-rag] Entry count check failed:', error);
    }

    console.log(`[chat-with-rag] User has ${entryCount} journal entries available`);

    // Get query embedding with 25s timeout
    let queryEmbedding;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: message,
          model: 'text-embedding-3-small',
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!embeddingResponse.ok) {
        throw new Error('Failed to get query embedding');
      }

      const embeddingData = await embeddingResponse.json();
      queryEmbedding = embeddingData.data[0].embedding;
    } catch (error) {
      console.error('[chat-with-rag] Failed to get embedding:', error);
      return new Response(JSON.stringify({
        data: "I encountered an issue processing your question. Please try rephrasing it or try again in a moment."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Execute intelligent sub-question planning
    let aggregatedResults;
    if (queryPlan.strategy === 'intelligent_sub_query' && queryPlan.subQuestions && queryPlan.subQuestions.length > 0) {
      aggregatedResults = await executeIntelligentSubQueries(
        message,
        userId,
        supabase,
        queryPlan,
        queryEmbedding
      );
    } else {
      // Fallback to single query if no sub-questions available
      console.log('[chat-with-rag] No sub-questions available, using fallback single query');
      
      const { data, error } = await supabase.rpc(
        'match_journal_entries_fixed',
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.1,
          match_count: 15,
          user_id_filter: userId
        }
      );
      
      const fallbackResults = data ? data.map(entry => ({
        ...entry,
        source: 'fallback_single',
        subQuestion: 'Direct search'
      })) : [];
      
      aggregatedResults = {
        results: fallbackResults,
        subQuestionSummary: [{ question: 'Direct search', resultCount: fallbackResults.length, status: 'success' }],
        totalResults: fallbackResults.length,
        hasDateFilters: false
      };
    }

    console.log(`[chat-with-rag] Retrieved ${aggregatedResults.totalResults} total relevant entries from sub-questions`);

    if (aggregatedResults.totalResults === 0) {
      let noDataResponse = `I couldn't find relevant journal entries for your question about "${message}".`;
      
      if (queryPlan.isPersonalityQuery) {
        noDataResponse += ` To help me analyze your personality patterns, try journaling about your thoughts, decisions, and daily experiences.`;
      } else if (queryPlan.isEmotionQuery) {
        noDataResponse += ` To help me understand your emotional patterns, try journaling about your feelings and what triggers them.`;
      } else {
        noDataResponse += ` Try adding more journal entries about your thoughts and experiences, then ask me again.`;
      }
      
      return new Response(JSON.stringify({ data: noDataResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate comprehensive response with analysis metadata
    const { content: response, analysisMetadata } = await generateResponseWithSubQuestionContext(
      message,
      aggregatedResults,
      queryPlan,
      conversationContext,
      openAiApiKey
    );

    const totalTime = Date.now() - startTime;
    console.log(`[chat-with-rag] SUCCESSFULLY generated comprehensive response in ${totalTime}ms, length: ${response.length}`);

    return new Response(JSON.stringify({ 
      data: response,
      analysisMetadata: analysisMetadata
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[chat-with-rag] CRITICAL ERROR after ${totalTime}ms:`, error);
    
    let errorMessage = `I encountered an error while analyzing your journal entries.`;
    
    if (error.message.includes('timeout') || error.name === 'AbortError') {
      errorMessage = `The analysis took too long to complete. Please try asking a more specific question or try again in a moment.`;
    } else if (error.message.includes('OpenAI')) {
      errorMessage = `I found relevant entries but the AI service had an issue. Please try again shortly.`;
    }
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      data: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
