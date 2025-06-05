
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with user's auth token for RLS compliance
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const requestBody = await req.json();
    const { 
      message, 
      userId, 
      threadId, 
      conversationContext = [], 
      userProfile = {},
      queryPlan = {},
      optimizedParams = {}
    } = requestBody;

    console.log(`[GPT-Master-Orchestrator] Processing query: "${message}"`);
    console.log(`[GPT-Master-Orchestrator] User ID: ${userId}`);
    console.log(`[GPT-Master-Orchestrator] Query plan strategy: ${queryPlan.strategy || 'standard'}`);

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Determine search strategy based on query plan
    let searchResults = [];
    let analysisMetadata = {
      searchMethod: 'none',
      queryComplexity: 'simple',
      resultsCount: 0,
      timestamp: new Date().toISOString()
    };

    // Phase 1: Semantic Search (using RLS-compliant functions)
    if (queryPlan.strategy === 'semantic' || queryPlan.strategy === 'hybrid') {
      console.log('[GPT-Master-Orchestrator] Performing semantic search');
      
      try {
        // Generate embedding for the query
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: message,
            encoding_format: 'float'
          }),
        });

        if (!embeddingResponse.ok) {
          throw new Error(`Failed to generate embedding: ${embeddingResponse.statusText}`);
        }

        const embeddingResult = await embeddingResponse.json();
        const queryEmbedding = embeddingResult.data[0].embedding;

        // Use RLS-compliant function (no userId parameter needed)
        const { data: semanticResults, error: semanticError } = await supabaseClient.rpc(
          'match_journal_entries_with_date',
          {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: optimizedParams.entryLimit || 10,
            start_date: queryPlan.timeRange?.startDate || null,
            end_date: queryPlan.timeRange?.endDate || null
          }
        );

        if (semanticError) {
          console.error('Semantic search error:', semanticError);
        } else {
          searchResults = semanticResults || [];
          analysisMetadata.searchMethod = 'semantic';
          analysisMetadata.resultsCount = searchResults.length;
          console.log(`[GPT-Master-Orchestrator] Found ${searchResults.length} semantic matches`);
        }
      } catch (error) {
        console.error('Error in semantic search:', error);
        analysisMetadata.searchMethod = 'semantic_failed';
      }
    }

    // Phase 2: Theme-based search if needed
    if ((queryPlan.strategy === 'theme' || queryPlan.strategy === 'hybrid') && searchResults.length < 5) {
      console.log('[GPT-Master-Orchestrator] Performing theme-based search');
      
      try {
        const { data: themeResults, error: themeError } = await supabaseClient.rpc(
          'match_journal_entries_by_theme',
          {
            theme_query: queryPlan.extractedThemes?.[0] || message,
            match_threshold: 0.4,
            match_count: 5,
            start_date: queryPlan.timeRange?.startDate || null,
            end_date: queryPlan.timeRange?.endDate || null
          }
        );

        if (themeError) {
          console.error('Theme search error:', themeError);
        } else if (themeResults && themeResults.length > 0) {
          // Merge with existing results, avoiding duplicates
          const existingIds = new Set(searchResults.map(r => r.id));
          const newResults = themeResults.filter(r => !existingIds.has(r.id));
          searchResults = [...searchResults, ...newResults];
          analysisMetadata.searchMethod = analysisMetadata.searchMethod === 'semantic' ? 'hybrid' : 'theme';
          analysisMetadata.resultsCount = searchResults.length;
          console.log(`[GPT-Master-Orchestrator] Added ${newResults.length} theme matches`);
        }
      } catch (error) {
        console.error('Error in theme search:', error);
      }
    }

    // Phase 3: Emotion-based search if specified
    if (queryPlan.strategy === 'emotion' && queryPlan.extractedEmotions?.length > 0) {
      console.log('[GPT-Master-Orchestrator] Performing emotion-based search');
      
      try {
        const { data: emotionResults, error: emotionError } = await supabaseClient.rpc(
          'match_journal_entries_by_emotion',
          {
            emotion_name: queryPlan.extractedEmotions[0],
            min_score: 0.3,
            start_date: queryPlan.timeRange?.startDate || null,
            end_date: queryPlan.timeRange?.endDate || null,
            limit_count: 5
          }
        );

        if (emotionError) {
          console.error('Emotion search error:', emotionError);
        } else if (emotionResults && emotionResults.length > 0) {
          // Merge with existing results
          const existingIds = new Set(searchResults.map(r => r.id));
          const newResults = emotionResults.filter(r => !existingIds.has(r.id));
          searchResults = [...searchResults, ...newResults];
          analysisMetadata.searchMethod = 'emotion';
          analysisMetadata.resultsCount = searchResults.length;
          console.log(`[GPT-Master-Orchestrator] Added ${newResults.length} emotion matches`);
        }
      } catch (error) {
        console.error('Error in emotion search:', error);
      }
    }

    // Phase 4: Statistical analysis for analytical queries
    let statisticalAnalysis = null;
    if (queryPlan.requiresStatistics && searchResults.length > 0) {
      console.log('[GPT-Master-Orchestrator] Performing statistical analysis');
      
      try {
        // Get top emotions for the time period
        const { data: topEmotions, error: emotionsError } = await supabaseClient.rpc(
          'get_top_emotions_with_entries',
          {
            start_date: queryPlan.timeRange?.startDate || null,
            end_date: queryPlan.timeRange?.endDate || null,
            limit_count: 5
          }
        );

        if (!emotionsError && topEmotions) {
          statisticalAnalysis = {
            topEmotions: topEmotions,
            entryCount: searchResults.length,
            timeRange: queryPlan.timeRange
          };
          console.log(`[GPT-Master-Orchestrator] Generated statistical analysis with ${topEmotions.length} top emotions`);
        }
      } catch (error) {
        console.error('Error in statistical analysis:', error);
      }
    }

    // Phase 5: Generate AI response
    console.log('[GPT-Master-Orchestrator] Generating AI response');
    
    const contextText = searchResults
      .slice(0, 8) // Limit context to avoid token limits
      .map(entry => `Entry ${entry.id} (${new Date(entry.created_at).toLocaleDateString()}): ${entry.content?.slice(0, 300) || 'No content'}`)
      .join('\n\n');

    const systemPrompt = `You are an empathetic AI journal analyst. Analyze the user's question based on their journal entries and provide helpful insights.

User Profile: ${JSON.stringify(userProfile)}
Query Context: ${JSON.stringify(queryPlan)}

Journal Entries Context:
${contextText}

${statisticalAnalysis ? `Statistical Analysis: ${JSON.stringify(statisticalAnalysis)}` : ''}

Guidelines:
- Be empathetic and supportive
- Provide specific insights based on the journal entries
- Reference specific entries when relevant
- If no relevant entries are found, acknowledge this and offer general guidance
- Keep responses conversational and helpful
- Focus on patterns, growth, and positive insights`;

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationContext.slice(-6), // Include recent conversation context
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    if (!chatResponse.ok) {
      throw new Error(`OpenAI API error: ${chatResponse.status} - ${await chatResponse.text()}`);
    }

    const chatResult = await chatResponse.json();
    const aiResponse = chatResult.choices[0].message.content;

    console.log('[GPT-Master-Orchestrator] Response generated successfully');

    return new Response(JSON.stringify({
      response: aiResponse,
      analysis: {
        ...analysisMetadata,
        hasStatistics: !!statisticalAnalysis,
        queryPlan: queryPlan
      },
      referenceEntries: searchResults.slice(0, 5).map(entry => ({
        id: entry.id,
        content: entry.content?.slice(0, 200) || 'No content',
        created_at: entry.created_at,
        themes: entry.themes || [],
        emotions: entry.emotions || {}
      })),
      statisticalData: statisticalAnalysis
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in GPT Master Orchestrator:', error);
    return new Response(JSON.stringify({
      error: error.message,
      response: "I apologize, but I encountered an error while analyzing your journal entries. Please try again.",
      analysis: {
        queryType: 'error',
        errorType: 'processing_error',
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
