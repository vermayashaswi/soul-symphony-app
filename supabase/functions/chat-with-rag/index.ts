
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced multi-strategy search execution with much lower thresholds
async function executeMultiStrategySearch(
  message: string,
  userId: string,
  supabase: any,
  queryPlan: any,
  queryEmbedding: number[]
): Promise<any[]> {
  console.log(`[chat-with-rag] Executing ${queryPlan.strategy} search strategy`);
  
  let allResults = [];
  
  // Force very low thresholds based on query type
  let threshold = queryPlan.searchParameters?.vectorThreshold || 0.2;
  
  // Apply aggressive threshold reduction
  if (queryPlan.isPersonalityQuery) {
    threshold = 0.05; // Extremely low for personality
    console.log("[chat-with-rag] Using ultra-low threshold 0.05 for personality query");
  } else if (queryPlan.isEmotionQuery) {
    threshold = 0.1; // Very low for emotions
    console.log("[chat-with-rag] Using low threshold 0.1 for emotion query");
  } else if (threshold > 0.3) {
    threshold = 0.2; // Cap any high thresholds
    console.log(`[chat-with-rag] Capped threshold to 0.2 from ${queryPlan.searchParameters?.vectorThreshold}`);
  }
  
  console.log(`[chat-with-rag] Final threshold: ${threshold} for domain: ${queryPlan.domainContext}`);
  
  try {
    // Strategy 1: Execute SQL queries if planned (parallel execution)
    const sqlPromise = (async () => {
      if (queryPlan.searchParameters?.executeSQLQueries && queryPlan.searchParameters?.sqlQueries?.length > 0) {
        console.log(`[chat-with-rag] Executing ${queryPlan.searchParameters.sqlQueries.length} SQL queries in parallel`);
        
        const sqlPromises = queryPlan.searchParameters.sqlQueries.map(async (sqlQuery) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            let sqlResults = [];
            
            if (sqlQuery.function === 'get_top_emotions_with_entries') {
              const { data, error } = await supabase.rpc('get_top_emotions_with_entries', {
                user_id_param: userId,
                start_date: sqlQuery.parameters?.start_date || null,
                end_date: sqlQuery.parameters?.end_date || null,
                limit_count: sqlQuery.parameters?.limit_count || 15
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
                    emotion_score: emotion.score
                  }))
                );
              }
            } else if (sqlQuery.function === 'match_journal_entries_by_emotion') {
              const { data, error } = await supabase.rpc('match_journal_entries_by_emotion', {
                emotion_name: sqlQuery.parameters.emotion_name,
                user_id_filter: userId,
                min_score: 0.05, // Very low minimum score
                start_date: sqlQuery.parameters?.start_date || null,
                end_date: sqlQuery.parameters?.end_date || null,
                limit_count: sqlQuery.parameters?.limit_count || 15
              });
              
              clearTimeout(timeoutId);
              
              if (!error && data) {
                sqlResults = data.map(entry => ({
                  id: entry.id,
                  content: entry.content,
                  created_at: entry.created_at,
                  similarity: 0.8,
                  source: 'sql_emotion_specific',
                  emotion_score: entry.emotion_score
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
        const sqlResults = [];
        sqlResultsArrays.forEach(result => {
          if (result.status === 'fulfilled') {
            sqlResults.push(...result.value);
          }
        });
        
        console.log(`[chat-with-rag] SQL queries completed, ${sqlResults.length} results`);
        return sqlResults;
      }
      return [];
    })();
    
    // Strategy 2: Vector search (parallel execution)
    const vectorPromise = (async () => {
      console.log(`[chat-with-rag] Executing vector search with threshold ${threshold}`);
      
      try {
        const vectorController = new AbortController();
        const vectorTimeoutId = setTimeout(() => vectorController.abort(), 3000);
        
        let vectorResults = [];
        
        if (queryPlan.filters?.date_range?.startDate || queryPlan.filters?.date_range?.endDate) {
          const { data, error } = await supabase.rpc(
            'match_journal_entries_with_date',
            {
              query_embedding: queryEmbedding,
              match_threshold: threshold,
              match_count: 20,
              user_id_filter: userId,
              start_date: queryPlan.filters.date_range.startDate,
              end_date: queryPlan.filters.date_range.endDate
            }
          );
          
          if (!error && data) {
            vectorResults = data.map(entry => ({
              ...entry,
              source: 'vector_time_filtered'
            }));
          }
        } else {
          const { data, error } = await supabase.rpc(
            'match_journal_entries_fixed',
            {
              query_embedding: queryEmbedding,
              match_threshold: threshold,
              match_count: 20,
              user_id_filter: userId
            }
          );
          
          if (!error && data) {
            vectorResults = data.map(entry => ({
              ...entry,
              source: 'vector_semantic'
            }));
          }
        }
        
        clearTimeout(vectorTimeoutId);
        console.log(`[chat-with-rag] Vector search returned ${vectorResults.length} results`);
        return vectorResults;
        
      } catch (error) {
        console.error(`[chat-with-rag] Vector search error:`, error);
        return [];
      }
    })();
    
    // Execute SQL and vector searches in parallel
    const [sqlResults, vectorResults] = await Promise.all([sqlPromise, vectorPromise]);
    allResults = [...sqlResults, ...vectorResults];
    
    // Strategy 3: Progressive fallback if insufficient results
    if (allResults.length < 5) {
      console.log(`[chat-with-rag] Insufficient results (${allResults.length}), executing progressive fallback`);
      
      // Fallback 1: Try with even lower threshold
      if (allResults.length < 3 && threshold > 0.05) {
        console.log("[chat-with-rag] Trying ultra-low threshold 0.05");
        try {
          const { data, error } = await supabase.rpc(
            'match_journal_entries_fixed',
            {
              query_embedding: queryEmbedding,
              match_threshold: 0.05,
              match_count: 15,
              user_id_filter: userId
            }
          );
          
          if (!error && data) {
            const ultraLowResults = data.map(entry => ({
              ...entry,
              source: 'vector_ultra_low'
            }));
            allResults = allResults.concat(ultraLowResults);
            console.log(`[chat-with-rag] Ultra-low threshold search returned ${ultraLowResults.length} results`);
          }
        } catch (error) {
          console.error("[chat-with-rag] Ultra-low threshold search failed:", error);
        }
      }
      
      // Fallback 2: Recent entries
      if (allResults.length < 5) {
        try {
          const { data, error } = await supabase
            .from('Journal Entries')
            .select('id, created_at, "refined text", "transcription text", emotions, master_themes')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(15);
            
          if (!error && data) {
            const recentResults = data.map(entry => ({
              id: entry.id,
              content: entry['refined text'] || entry['transcription text'] || '',
              created_at: entry.created_at,
              similarity: 0.5,
              source: 'fallback_recent',
              emotions: entry.emotions,
              themes: entry.master_themes
            }));
            
            console.log(`[chat-with-rag] Recent entries fallback returned ${recentResults.length} results`);
            allResults = allResults.concat(recentResults);
          }
        } catch (error) {
          console.error("[chat-with-rag] Recent entries fallback failed:", error);
        }
      }
      
      // Fallback 3: Keyword-based search for personality/emotion queries
      if (allResults.length < 8 && (queryPlan.isPersonalityQuery || queryPlan.isEmotionQuery)) {
        const keywords = extractKeywords(message);
        if (keywords.length > 0) {
          console.log(`[chat-with-rag] Executing keyword fallback with: ${keywords.join(', ')}`);
          
          try {
            const keywordQuery = keywords.map(keyword => 
              `("refined text" ILIKE '%${keyword}%' OR "transcription text" ILIKE '%${keyword}%')`
            ).join(' OR ');
            
            const { data, error } = await supabase
              .from('Journal Entries')
              .select('id, created_at, "refined text", "transcription text", emotions, master_themes')
              .eq('user_id', userId)
              .or(keywordQuery)
              .order('created_at', { ascending: false })
              .limit(10);
              
            if (!error && data) {
              const keywordResults = data.map(entry => ({
                id: entry.id,
                content: entry['refined text'] || entry['transcription text'] || '',
                created_at: entry.created_at,
                similarity: 0.4,
                source: 'fallback_keyword',
                emotions: entry.emotions,
                themes: entry.master_themes
              }));
              
              console.log(`[chat-with-rag] Keyword fallback returned ${keywordResults.length} results`);
              allResults = allResults.concat(keywordResults);
            }
          } catch (error) {
            console.error("[chat-with-rag] Keyword fallback failed:", error);
          }
        }
      }
    }
    
    // Remove duplicates and sort by relevance
    const uniqueResults = allResults.filter((entry, index, self) => 
      index === self.findIndex(e => e.id === entry.id)
    ).sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    
    console.log(`[chat-with-rag] Multi-strategy search completed: ${uniqueResults.length} unique results`);
    return uniqueResults.slice(0, 20);
    
  } catch (error) {
    console.error('[chat-with-rag] Error in multi-strategy search:', error);
    
    // Emergency fallback - get ANY recent entries
    try {
      console.log("[chat-with-rag] Executing emergency fallback");
      const { data, error } = await supabase
        .from('Journal Entries')
        .select('id, created_at, "refined text", "transcription text", emotions')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (!error && data) {
        return data.map(entry => ({
          id: entry.id,
          content: entry['refined text'] || entry['transcription text'] || '',
          created_at: entry.created_at,
          similarity: 0.3,
          source: 'emergency_fallback'
        }));
      }
    } catch (emergencyError) {
      console.error("[chat-with-rag] Emergency fallback failed:", emergencyError);
    }
    
    return [];
  }
}

// Extract keywords for fallback search
function extractKeywords(message: string): string[] {
  const personalityKeywords = ['personality', 'trait', 'character', 'behavior', 'habit', 'pattern', 'tend', 'usually', 'often', 'always', 'never', 'am i', 'do i'];
  const emotionKeywords = ['feel', 'emotion', 'mood', 'happy', 'sad', 'angry', 'anxious', 'excited', 'calm', 'stressed', 'joy', 'fear', 'emotional'];
  
  const words = message.toLowerCase().split(/\s+/);
  const keywords = [];
  
  words.forEach(word => {
    if (personalityKeywords.some(keyword => word.includes(keyword)) || 
        emotionKeywords.some(keyword => word.includes(keyword))) {
      keywords.push(word);
    }
  });
  
  return [...new Set(keywords)].slice(0, 4);
}

// Enhanced response generation with better error handling
async function generateContextAwareResponse(
  message: string,
  entries: any[],
  queryPlan: any,
  conversationContext: any[],
  openAiApiKey: string
): Promise<string> {
  try {
    // Optimize prompt based on query plan
    let systemPrompt = '';
    
    if (queryPlan.isPersonalityQuery) {
      systemPrompt = `You are SOULo, analyzing personality traits. For "${message}", focus on:
- Behavioral patterns and decision-making
- Personal values and strengths
- Growth opportunities (positive framing)
- Specific examples from the entries
Be supportive and evidence-based. Limit: 200 words.`;

    } else if (queryPlan.isEmotionQuery) {
      systemPrompt = `You are SOULo, analyzing emotions. For "${message}", focus on:
- Emotional trends and triggers
- Processing patterns
- Insights for wellbeing
- Specific examples
Be encouraging and actionable. Limit: 200 words.`;

    } else {
      systemPrompt = `You are SOULo, a supportive journaling assistant. Answer "${message}" based on the journal entries.
Provide insights with specific examples. Be encouraging. Limit: 200 words.`;
    }

    // Format entries efficiently
    const formattedEntries = entries.slice(0, 12).map((entry, index) => {
      const date = new Date(entry.created_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric'
      });
      
      let metadata = `[${index + 1} - ${date}`;
      if (entry.emotion) metadata += ` - ${entry.emotion}`;
      if (entry.source) metadata += ` - ${entry.source}`;
      metadata += `]`;
      
      return `${metadata}\n${entry.content.substring(0, 250)}...\n`;
    }).join('\n');

    const userPrompt = `Journal Entries (${entries.length} found):
${formattedEntries}

Question: "${message}"

Analyze based on available data and provide insights.`;

    // Minimal conversation context
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationContext.slice(-1), // Only last message for context
      { role: 'user', content: userPrompt }
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Reduced from 10s

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[chat-with-rag] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response based on your journal entries.';

  } catch (error) {
    console.error('[chat-with-rag] Error generating response:', error);
    
    // Return a helpful error message instead of throwing
    if (error.name === 'AbortError') {
      return "I apologize, but the response took too long to generate. Please try rephrasing your question or try again.";
    }
    
    return "I encountered an error while analyzing your journal entries. Please try rephrasing your question or contact support if the issue persists.";
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

    console.log(`[chat-with-rag] Processing query: "${message}"`);

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

    // Validate OpenAI API key
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      console.error('[chat-with-rag] CRITICAL: OpenAI API key not configured');
      return new Response(JSON.stringify({
        data: "The AI service is temporarily unavailable. Please try again in a moment."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Quick entry count check with timeout
    let entryCount = 0;
    try {
      const countController = new AbortController();
      const countTimeoutId = setTimeout(() => countController.abort(), 1000);
      
      const { count, error: countError } = await supabase
        .from('Journal Entries')
        .select('id', { count: "exact", head: true })
        .eq('user_id', userId);

      clearTimeout(countTimeoutId);

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
      // Continue without count check
    }

    console.log(`[chat-with-rag] User has ${entryCount} journal entries available`);

    // Get query embedding with reduced timeout
    let queryEmbedding;
    try {
      const embeddingController = new AbortController();
      const embeddingTimeoutId = setTimeout(() => embeddingController.abort(), 3000);

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
        signal: embeddingController.signal
      });

      clearTimeout(embeddingTimeoutId);

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

    // Execute optimized multi-strategy search
    const relevantEntries = await executeMultiStrategySearch(
      message,
      userId,
      supabase,
      queryPlan,
      queryEmbedding
    );

    console.log(`[chat-with-rag] Retrieved ${relevantEntries.length} relevant entries`);

    if (relevantEntries.length === 0) {
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

    // Generate optimized response
    const response = await generateContextAwareResponse(
      message,
      relevantEntries,
      queryPlan,
      conversationContext,
      openAiApiKey
    );

    const totalTime = Date.now() - startTime;
    console.log(`[chat-with-rag] Generated response in ${totalTime}ms, length: ${response.length}`);

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
