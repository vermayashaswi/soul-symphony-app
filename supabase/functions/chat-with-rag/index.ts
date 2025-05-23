
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Optimized multi-strategy search execution with timeout handling
async function executeMultiStrategySearch(
  message: string,
  userId: string,
  supabase: any,
  queryPlan: any,
  queryEmbedding: number[]
): Promise<any[]> {
  console.log(`[chat-with-rag] Executing ${queryPlan.strategy} search strategy`);
  
  let allResults = [];
  const threshold = queryPlan.searchParameters?.vectorThreshold || 0.3;
  const searchTimeout = 8000; // 8 second timeout for searches
  
  try {
    // Strategy 1: Execute SQL queries if planned (with timeout)
    if (queryPlan.searchParameters?.executeSQLQueries && queryPlan.searchParameters?.sqlQueries?.length > 0) {
      console.log(`[chat-with-rag] Executing ${queryPlan.searchParameters.sqlQueries.length} SQL queries`);
      
      const sqlPromises = queryPlan.searchParameters.sqlQueries.map(async (sqlQuery) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout per SQL query
          
          let sqlResults = [];
          
          if (sqlQuery.function === 'get_top_emotions_with_entries') {
            const { data, error } = await supabase.rpc('get_top_emotions_with_entries', {
              user_id_param: userId,
              start_date: sqlQuery.parameters?.start_date || null,
              end_date: sqlQuery.parameters?.end_date || null,
              limit_count: sqlQuery.parameters?.limit_count || 5
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
              min_score: sqlQuery.parameters.min_score || 0.3,
              start_date: sqlQuery.parameters?.start_date || null,
              end_date: sqlQuery.parameters?.end_date || null,
              limit_count: sqlQuery.parameters?.limit_count || 5
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
      
      // Wait for all SQL queries with timeout
      const sqlResultsArrays = await Promise.allSettled(sqlPromises);
      sqlResultsArrays.forEach(result => {
        if (result.status === 'fulfilled') {
          allResults = allResults.concat(result.value);
        }
      });
    }
    
    // Strategy 2: Vector search with timeout
    console.log(`[chat-with-rag] Executing vector search with threshold ${threshold}`);
    
    try {
      const vectorController = new AbortController();
      const vectorTimeoutId = setTimeout(() => vectorController.abort(), 5000); // 5 second timeout
      
      let vectorResults = [];
      
      if (queryPlan.filters?.date_range?.startDate || queryPlan.filters?.date_range?.endDate) {
        const { data, error } = await supabase.rpc(
          'match_journal_entries_with_date',
          {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: 12,
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
            match_count: 12,
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
      allResults = allResults.concat(vectorResults);
      
    } catch (error) {
      console.error(`[chat-with-rag] Vector search error:`, error);
    }
    
    // Strategy 3: Fast fallback if insufficient results
    if (allResults.length < 3 && queryPlan.fallbackStrategy) {
      console.log(`[chat-with-rag] Executing fast fallback strategy: ${queryPlan.fallbackStrategy}`);
      
      try {
        if (queryPlan.fallbackStrategy === 'recent_entries') {
          const { data, error } = await supabase
            .from('Journal Entries')
            .select('id, created_at, "refined text", "transcription text", emotions, master_themes')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(8);
            
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
            
            console.log(`[chat-with-rag] Fallback recent entries returned ${recentResults.length} results`);
            allResults = allResults.concat(recentResults);
          }
        }
      } catch (error) {
        console.error(`[chat-with-rag] Fallback strategy error:`, error);
      }
    }
    
    // Remove duplicates and sort by relevance
    const uniqueResults = allResults.filter((entry, index, self) => 
      index === self.findIndex(e => e.id === entry.id)
    ).sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    
    console.log(`[chat-with-rag] Multi-strategy search completed: ${uniqueResults.length} unique results`);
    return uniqueResults.slice(0, 15); // Limit to top 15 results
    
  } catch (error) {
    console.error('[chat-with-rag] Error in multi-strategy search:', error);
    return [];
  }
}

// Enhanced response generation with optimized prompting
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
    
    if (queryPlan.isPersonalityQuery || queryPlan.domainContext === 'personal_insights') {
      systemPrompt = `You are SOULo, a voice journaling assistant specializing in personality analysis. Analyze the journal entries to identify personality traits and behavioral patterns for: "${message}"

Focus on:
- Emotional patterns and what they reveal about personality
- Behavioral traits and decision-making patterns
- Personal values evident in the writing
- Growth opportunities (framed positively)
- Specific strengths demonstrated

Be supportive, evidence-based, and reference specific examples. Keep response under 200 words.`;

    } else if (queryPlan.isEmotionQuery || queryPlan.domainContext === 'emotional_analysis') {
      systemPrompt = `You are SOULo, analyzing emotional patterns for: "${message}"

Focus on:
- Emotional trends and triggers
- How emotions are processed and managed
- Patterns the user might not be aware of
- Actionable insights for emotional wellbeing

Provide specific examples and keep response under 200 words.`;

    } else {
      systemPrompt = `You are SOULo, a supportive voice journaling assistant. Answer: "${message}"

Analyze the journal entries and provide insights based on the available data. Be encouraging and cite specific examples. Keep response under 200 words.`;
    }

    // Format entries efficiently
    const formattedEntries = entries.slice(0, 10).map((entry, index) => {
      const date = new Date(entry.created_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric'
      });
      
      let metadata = `[${index + 1} - ${date}`;
      if (entry.emotion) metadata += ` - ${entry.emotion}`;
      metadata += `]`;
      
      return `${metadata}\n${entry.content.substring(0, 300)}...\n`;
    }).join('\n');

    const userPrompt = `Journal Entries (${entries.length} total):
${formattedEntries}

User Question: "${message}"

Provide a comprehensive analysis based on the available journal data.`;

    // Include minimal conversation context
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationContext.slice(-2), // Only last 2 messages for context
      { role: 'user', content: userPrompt }
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

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
      const errorText = await response.text();
      console.error('[chat-with-rag] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

  } catch (error) {
    console.error('[chat-with-rag] Error generating response:', error);
    throw error;
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
        data: "I'm missing some required information to process your request."
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
        data: "The AI service is not properly configured. Please contact support."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Quick entry count check
    const { count: entryCount, error: countError } = await supabase
      .from('Journal Entries')
      .select('id', { count: "exact", head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('[chat-with-rag] Error checking entries:', countError);
      return new Response(JSON.stringify({
        data: "I encountered an error accessing your journal entries. Please try again."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!entryCount || entryCount === 0) {
      return new Response(JSON.stringify({
        data: "I don't have any journal entries to analyze yet. Please add some journal entries first, and then I'll be able to provide personalized insights!"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[chat-with-rag] User has ${entryCount} journal entries available`);

    // Get query embedding with timeout
    const embeddingController = new AbortController();
    const embeddingTimeoutId = setTimeout(() => embeddingController.abort(), 5000);

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
      const errorText = await embeddingResponse.text();
      console.error('[chat-with-rag] Failed to get embedding:', errorText);
      throw new Error('Failed to get query embedding');
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

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
      let noDataResponse = `I don't have enough relevant journal entries to answer "${message}".`;
      
      if (queryPlan.isPersonalityQuery) {
        noDataResponse += ` To analyze personality traits, I need journal entries describing your thoughts, feelings, and experiences.`;
      } else if (queryPlan.isEmotionQuery) {
        noDataResponse += ` To analyze emotional patterns, I need entries describing your feelings and emotional experiences.`;
      } else {
        noDataResponse += ` Try adding more journal entries about your thoughts and daily experiences.`;
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
