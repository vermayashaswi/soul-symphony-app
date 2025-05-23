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
 * Keyword-based content search fallback
 */
async function searchByKeywords(
  supabase: any,
  userId: string,
  query: string
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
    const keywordPattern = keywords.map(k => `%${k}%`).join('|');
    
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('id, created_at, "refined text", "transcription text", emotions, master_themes')
      .eq('user_id', userId)
      .or(keywords.map(keyword => 
        `"refined text".ilike.%${keyword}%,"transcription text".ilike.%${keyword}%`
      ).join(','))
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (!error && data) {
      const results = data.map(entry => ({
        id: entry.id,
        content: entry['refined text'] || entry['transcription text'] || '',
        created_at: entry.created_at,
        similarity: 0.7, // Assign moderate similarity for keyword matches
        source: 'keyword_search',
        matched_keywords: keywords
      }));
      
      console.log(`[chat-with-rag] Keyword search found ${results.length} results`);
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
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
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
    
    // Apply enhanced fallback strategies if insufficient results
    if (results.length < 3 && searchPlan.fallbackStrategy) {
      console.log(`[chat-with-rag] Applying enhanced fallback strategy: ${searchPlan.fallbackStrategy}`);
      
      try {
        let fallbackResults = [];
        
        if (searchPlan.fallbackStrategy === 'keyword_search') {
          fallbackResults = await searchByKeywords(supabase, userId, subQuestion.question);
          fallbackResults = fallbackResults.map(entry => ({
            ...entry,
            source: 'fallback_keyword',
            subQuestion: subQuestion.question
          }));
        } else if (searchPlan.fallbackStrategy === 'recent_entries') {
          const { data, error } = await supabase
            .from('Journal Entries')
            .select('id, created_at, "refined text", "transcription text", emotions, master_themes')
            .eq('user_id', userId)
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
          const { data, error } = await supabase.rpc('get_top_emotions_with_entries', {
            user_id_param: userId,
            limit_count: 3
          });
          
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
        console.log(`[chat-with-rag] Enhanced fallback strategy added ${fallbackResults.length} results`);
        
      } catch (error) {
        console.error(`[chat-with-rag] Enhanced fallback strategy failed:`, error);
      }
    }
    
    return {
      subQuestion: subQuestion.question,
      purpose: subQuestion.purpose,
      results: results,
      resultCount: results.length
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
    
    subQuestionResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const subResult = result.value;
        allResults = allResults.concat(subResult.results);
        subQuestionSummary.push({
          question: subResult.subQuestion,
          purpose: subResult.purpose,
          resultCount: subResult.resultCount,
          status: 'success'
        });
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
    
    console.log(`[chat-with-rag] Sub-question execution completed: ${uniqueResults.length} unique results from ${subQuestionSummary.length} sub-questions`);
    
    return {
      results: uniqueResults.slice(0, 20),
      subQuestionSummary,
      totalResults: uniqueResults.length
    };
    
  } catch (error) {
    console.error('[chat-with-rag] Error in sub-question execution:', error);
    throw error;
  }
}

/**
 * Enhanced response generation with sub-question context
 */
async function generateResponseWithSubQuestionContext(
  message: string,
  aggregatedResults: any,
  queryPlan: any,
  conversationContext: any[],
  openAiApiKey: string
): Promise<string> {
  try {
    // Create system prompt based on query plan
    let systemPrompt = '';
    
    if (queryPlan.isPersonalityQuery) {
      systemPrompt = `You are SOULo, analyzing personality traits from journal entries. The analysis was conducted through ${queryPlan.subQuestions.length} targeted sub-questions to provide comprehensive insights.`;
    } else if (queryPlan.isEmotionQuery) {
      systemPrompt = `You are SOULo, analyzing emotional patterns from journal entries. The analysis used ${queryPlan.subQuestions.length} specific approaches to understand emotional trends.`;
    } else {
      systemPrompt = `You are SOULo, a supportive journaling assistant. The analysis was conducted through ${queryPlan.subQuestions.length} strategic sub-questions to provide thorough insights.`;
    }

    // Format results with sub-question context
    const formattedResults = aggregatedResults.results.slice(0, 15).map((entry, index) => {
      const date = new Date(entry.created_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric'
      });
      
      let metadata = `[${index + 1} - ${date}`;
      if (entry.emotion) metadata += ` - ${entry.emotion}`;
      if (entry.source) metadata += ` - ${entry.source}`;
      if (entry.subQuestion) metadata += ` - Found via: "${entry.subQuestion}"`;
      metadata += `]`;
      
      return `${metadata}\n${entry.content.substring(0, 300)}...\n`;
    }).join('\n');

    // Include sub-question summary
    const subQuestionSummary = aggregatedResults.subQuestionSummary.map(sq => 
      `- "${sq.question}": ${sq.resultCount} results (${sq.status})`
    ).join('\n');

    const userPrompt = `Analysis conducted through sub-questions:
${subQuestionSummary}

Journal Entries Found (${aggregatedResults.results.length} total):
${formattedResults}

Original Question: "${message}"

Based on the comprehensive analysis above, provide insights that directly answer the user's question. Reference specific examples from the entries and explain how the different aspects explored through the sub-questions contribute to your analysis.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationContext.slice(-1),
      { role: 'user', content: userPrompt }
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 600,
        temperature: 0.7,
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'I apologize, but I was unable to generate a comprehensive response based on your journal entries.';

  } catch (error) {
    console.error('[chat-with-rag] Error generating response:', error);
    
    if (error.name === 'AbortError') {
      return "I apologize, but the response took too long to generate. The analysis found relevant information, but please try rephrasing your question for a faster response.";
    }
    
    return "I encountered an error while analyzing your journal entries. The system successfully found relevant entries, but please try rephrasing your question or contact support if the issue persists.";
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

    // Quick entry count check
    let entryCount = 0;
    try {
      const { count, error: countError } = await supabase
        .from('Journal Entries')
        .select('id', { count: "exact", head: true })
        .eq('user_id', userId);

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

    // Get query embedding
    let queryEmbedding;
    try {
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
      });

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
        totalResults: fallbackResults.length
      };
    }

    console.log(`[chat-with-rag] Retrieved ${aggregatedResults.totalResults} total relevant entries from sub-questions`);

    if (aggregatedResults.totalResults === 0) {
      let noDataResponse = `I couldn't find relevant journal entries for "${message}".`;
      
      if (queryPlan.isPersonalityQuery) {
        noDataResponse += ` To analyze personality traits, try journaling about your thoughts, decisions, and daily experiences.`;
      } else if (queryPlan.isEmotionQuery) {
        noDataResponse += ` To analyze emotional patterns, try journaling about your feelings and what triggers them.`;
      } else {
        noDataResponse += ` Try adding more journal entries about your thoughts and experiences, then ask again.`;
      }
      
      return new Response(JSON.stringify({ data: noDataResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate comprehensive response with sub-question context
    const response = await generateResponseWithSubQuestionContext(
      message,
      aggregatedResults,
      queryPlan,
      conversationContext,
      openAiApiKey
    );

    const totalTime = Date.now() - startTime;
    console.log(`[chat-with-rag] Generated comprehensive response in ${totalTime}ms, length: ${response.length}`);

    return new Response(JSON.stringify({ data: response }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[chat-with-rag] Error after ${totalTime}ms:`, error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      data: `I encountered an error while analyzing your journal entries. Please try rephrasing your question or try again in a moment.`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
