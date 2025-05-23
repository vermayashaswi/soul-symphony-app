
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Multi-strategy search execution
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
  
  try {
    // Strategy 1: Execute SQL queries if planned
    if (queryPlan.searchParameters?.executeSQLQueries && queryPlan.searchParameters?.sqlQueries?.length > 0) {
      console.log(`[chat-with-rag] Executing ${queryPlan.searchParameters.sqlQueries.length} SQL queries`);
      
      for (const sqlQuery of queryPlan.searchParameters.sqlQueries) {
        try {
          let sqlResults = [];
          
          if (sqlQuery.function === 'get_top_emotions_with_entries') {
            const { data, error } = await supabase.rpc('get_top_emotions_with_entries', {
              user_id_param: userId,
              start_date: sqlQuery.parameters?.start_date || null,
              end_date: sqlQuery.parameters?.end_date || null,
              limit_count: sqlQuery.parameters?.limit_count || 5
            });
            
            if (!error && data) {
              sqlResults = data.flatMap(emotion => 
                emotion.sample_entries.map(entry => ({
                  id: entry.id,
                  content: entry.content,
                  created_at: entry.created_at,
                  similarity: 0.9, // High confidence for SQL results
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
          allResults = allResults.concat(sqlResults);
          
        } catch (error) {
          console.error(`[chat-with-rag] Error executing SQL query ${sqlQuery.function}:`, error);
        }
      }
    }
    
    // Strategy 2: Vector search with adaptive threshold
    console.log(`[chat-with-rag] Executing vector search with threshold ${threshold}`);
    
    let vectorResults = [];
    if (queryPlan.filters?.date_range?.startDate || queryPlan.filters?.date_range?.endDate) {
      // Time-filtered vector search
      const { data, error } = await supabase.rpc(
        'match_journal_entries_with_date',
        {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: 15,
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
      // Regular vector search
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
        vectorResults = data.map(entry => ({
          ...entry,
          source: 'vector_semantic'
        }));
      }
    }
    
    console.log(`[chat-with-rag] Vector search returned ${vectorResults.length} results`);
    allResults = allResults.concat(vectorResults);
    
    // Strategy 3: Fallback strategies if insufficient results
    if (allResults.length < 3 && queryPlan.fallbackStrategy) {
      console.log(`[chat-with-rag] Executing fallback strategy: ${queryPlan.fallbackStrategy}`);
      
      if (queryPlan.fallbackStrategy === 'recent_entries') {
        const { data, error } = await supabase
          .from('Journal Entries')
          .select('id, created_at, "refined text", "transcription text", emotions, master_themes')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);
          
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
      } else if (queryPlan.fallbackStrategy === 'emotion_based') {
        // Get entries with any strong emotions
        const { data, error } = await supabase.rpc('get_top_emotions_with_entries', {
          user_id_param: userId,
          limit_count: 3
        });
        
        if (!error && data) {
          const emotionResults = data.flatMap(emotion => 
            emotion.sample_entries.map(entry => ({
              id: entry.id,
              content: entry.content,
              created_at: entry.created_at,
              similarity: 0.6,
              source: 'fallback_emotion',
              emotion: emotion.emotion,
              emotion_score: emotion.score
            }))
          );
          
          console.log(`[chat-with-rag] Fallback emotion-based returned ${emotionResults.length} results`);
          allResults = allResults.concat(emotionResults);
        }
      }
    }
    
    // Remove duplicates and sort by relevance
    const uniqueResults = allResults.filter((entry, index, self) => 
      index === self.findIndex(e => e.id === entry.id)
    ).sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    
    console.log(`[chat-with-rag] Multi-strategy search completed: ${uniqueResults.length} unique results`);
    return uniqueResults.slice(0, 20); // Limit to top 20 results
    
  } catch (error) {
    console.error('[chat-with-rag] Error in multi-strategy search:', error);
    return [];
  }
}

// Enhanced response generation with context-aware prompting
async function generateContextAwareResponse(
  message: string,
  entries: any[],
  queryPlan: any,
  conversationContext: any[],
  openAiApiKey: string
): Promise<string> {
  try {
    // Determine prompt strategy based on query plan
    let systemPrompt = '';
    
    if (queryPlan.isPersonalityQuery || queryPlan.domainContext === 'personal_insights') {
      systemPrompt = `You are SOULo, a voice journaling assistant specializing in personality and trait analysis. 

Analyze the journal entries below to identify personality traits, behavioral patterns, and characteristics. For the user's question about "${message}", provide insights based on:

1. **Emotional patterns** - What emotions appear frequently and in what contexts
2. **Behavioral traits** - Consistent behaviors, reactions, and decision-making patterns  
3. **Personal values** - What matters most to the user based on their writing
4. **Growth areas** - Areas for potential improvement, but frame constructively
5. **Strengths** - Positive traits and capabilities evident in the entries

Be supportive, evidence-based, and reference specific examples from the entries. If asking about negative traits, focus on growth opportunities rather than harsh judgments.

**Confidence Level: ${queryPlan.confidence || 0.5}/1.0** - Indicate if analysis is based on limited vs comprehensive data.`;

    } else if (queryPlan.isEmotionQuery || queryPlan.domainContext === 'emotional_analysis') {
      systemPrompt = `You are SOULo, a voice journaling assistant specializing in emotional analysis.

Analyze the emotional patterns in the journal entries to answer: "${message}"

Focus on:
1. **Emotional trends** - How emotions change over time
2. **Emotional triggers** - What situations or thoughts cause specific emotions
3. **Emotional regulation** - How the user manages and processes emotions
4. **Emotional insights** - Patterns the user might not be aware of

Provide specific examples from the entries and actionable insights for emotional wellbeing.`;

    } else {
      systemPrompt = `You are SOULo, a supportive voice journaling assistant. Analyze the journal entries below to answer the user's question: "${message}"

Provide insights based on the available data, cite specific examples, and be encouraging. If data is limited, acknowledge this and suggest ways to gather more insights through journaling.`;
    }

    // Format entries with source information
    const formattedEntries = entries.map((entry, index) => {
      const date = new Date(entry.created_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
      
      let metadata = `[Entry ${index + 1} - ${date}`;
      if (entry.source) metadata += ` - Source: ${entry.source}`;
      if (entry.emotion) metadata += ` - Emotion: ${entry.emotion} (${entry.emotion_score})`;
      metadata += `]`;
      
      return `${metadata}\n${entry.content}\n`;
    }).join('\n');

    const userPrompt = `Journal Entries (${entries.length} total):
${formattedEntries}

User Question: "${message}"

Search Strategy Used: ${queryPlan.strategy}
Data Sources: ${[...new Set(entries.map(e => e.source))].join(', ')}

Please provide a comprehensive analysis based on the available journal data.`;

    // Include conversation context if available
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationContext.slice(-3), // Last 3 messages for context
      { role: 'user', content: userPrompt }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

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

    console.log(`[chat-with-rag] Processing query with intelligent strategy: "${message}"`);
    console.log(`[chat-with-rag] Query plan:`, JSON.stringify(queryPlan, null, 2));

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

    // Check if user has journal entries
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
        data: "I don't have any journal entries to analyze yet. Please add some journal entries first, and then I'll be able to provide personalized insights based on your experiences and emotions!"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[chat-with-rag] User has ${entryCount} journal entries available`);

    // Get query embedding for semantic search
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
      const errorText = await embeddingResponse.text();
      console.error('[chat-with-rag] Failed to get embedding:', errorText);
      throw new Error('Failed to get query embedding');
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Execute multi-strategy search
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
        noDataResponse += ` To analyze personality traits, I need journal entries that describe your thoughts, feelings, reactions, and experiences. Try writing about your daily interactions, challenges you face, or situations that made you feel strongly.`;
      } else if (queryPlan.isEmotionQuery) {
        noDataResponse += ` To analyze emotional patterns, I need entries that describe your feelings and emotional experiences. Consider writing about what makes you happy, sad, anxious, or excited.`;
      } else {
        noDataResponse += ` Try adding more journal entries about your thoughts, feelings, and daily experiences to get better personalized insights.`;
      }
      
      return new Response(JSON.stringify({ data: noDataResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate context-aware response
    const response = await generateContextAwareResponse(
      message,
      relevantEntries,
      queryPlan,
      conversationContext,
      openAiApiKey
    );

    console.log(`[chat-with-rag] Generated response length: ${response.length}`);

    return new Response(JSON.stringify({ data: response }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[chat-with-rag] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      data: `I encountered an error while analyzing your journal entries: ${error.message}. Please try rephrasing your question or contact support if the problem persists.`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
