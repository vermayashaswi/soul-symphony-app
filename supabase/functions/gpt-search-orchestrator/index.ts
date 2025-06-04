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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { 
      queryPlan,
      originalQuery,
      userId,
      userContext = {},
      conversationContext = []
    } = await req.json();

    console.log(`[Enhanced Search Orchestrator] Executing enhanced search plan for: "${originalQuery}"`);

    let searchResults = [];
    let executionLog = [];
    let contextualInsights = {};

    // Enhanced context-aware embedding generation
    const contextualQuery = buildContextualQuery(originalQuery, queryPlan, userContext, conversationContext);
    
    executionLog.push(`Enhanced context integration: ${contextualQuery !== originalQuery ? 'Applied' : 'Not needed'}`);

    // Execute primary search with enhanced context awareness
    const primarySearch = queryPlan.searchPlan.primarySearch;
    
    if (primarySearch.method === 'vector' || primarySearch.method === 'hybrid' || primarySearch.method === 'temporal') {
      executionLog.push('Executing enhanced vector similarity search with contextual awareness...');
      
      // Generate contextually-enhanced embedding
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: contextualQuery
        }),
      });

      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json();
        const queryEmbedding = embeddingData.data[0].embedding;

        // Execute enhanced vector search with conversation context integration
        const vectorResults = await executeEnhancedVectorSearch(
          supabaseClient,
          queryEmbedding,
          primarySearch.parameters,
          userId,
          queryPlan.searchPlan.contextIntegration
        );
        
        searchResults.push(...vectorResults);
        executionLog.push(`Enhanced vector search returned ${vectorResults.length} results with contextual weighting`);
      }
    }

    // Execute enhanced emotion-based search with user pattern awareness
    if (primarySearch.method === 'emotion' || primarySearch.method === 'hybrid') {
      if (primarySearch.parameters.emotionFilters?.length > 0) {
        executionLog.push('Executing enhanced emotion-based search with user pattern integration...');
        
        const enhancedEmotionFilters = enhanceEmotionFilters(
          primarySearch.parameters.emotionFilters,
          userContext.journalingPatterns?.emotional_patterns || {}
        );
        
        for (const emotion of enhancedEmotionFilters) {
          const emotionResults = await executeEnhancedEmotionSearch(
            supabaseClient,
            emotion,
            primarySearch.parameters,
            userId,
            userContext
          );
          searchResults.push(...emotionResults);
        }
        executionLog.push(`Enhanced emotion search completed for ${enhancedEmotionFilters.length} emotions with user pattern weighting`);
      }
    }

    // Execute enhanced secondary searches with conversation state management
    for (const secondarySearch of queryPlan.searchPlan.secondarySearches || []) {
      executionLog.push(`Executing enhanced secondary search: ${secondarySearch.purpose} (Priority: ${secondarySearch.priority})`);
      
      if (secondarySearch.method === 'theme') {
        const themeResults = await executeEnhancedThemeSearch(
          supabaseClient,
          originalQuery,
          secondarySearch.parameters,
          userId,
          userContext.journalingPatterns?.common_themes || {}
        );
        searchResults.push(...themeResults);
      }
    }

    // Execute enhanced aggregations with contextual weighting
    let aggregationResults = {};
    for (const aggregation of queryPlan.searchPlan.aggregations || []) {
      executionLog.push(`Executing enhanced aggregation: ${aggregation.type} with contextual weighting`);
      
      if (aggregation.type === 'emotion_summary') {
        const emotionSummary = await executeEnhancedEmotionSummary(
          supabaseClient, 
          userId, 
          primarySearch.parameters,
          userContext,
          aggregation.contextWeighting
        );
        aggregationResults.emotionSummary = emotionSummary;
      } else if (aggregation.type === 'cross_reference') {
        const crossReference = await executeCrossReferenceAnalysis(
          supabaseClient,
          searchResults,
          userContext,
          originalQuery
        );
        aggregationResults.crossReference = crossReference;
      }
    }

    // Enhanced deduplication and contextual relevance scoring
    const uniqueResults = removeEnhancedDuplicates(searchResults, userContext);
    const contextuallyRankedResults = sortByEnhancedRelevance(
      uniqueResults, 
      queryPlan,
      userContext,
      conversationContext
    );

    // Generate contextual insights for conversation state management
    contextualInsights = generateContextualInsights(
      contextuallyRankedResults,
      queryPlan,
      userContext,
      aggregationResults
    );

    console.log(`[Enhanced Search Orchestrator] Enhanced search completed: ${contextuallyRankedResults.length} unique results with contextual insights`);

    return new Response(JSON.stringify({
      results: contextuallyRankedResults.slice(0, primarySearch.parameters.maxResults || 20),
      aggregations: aggregationResults,
      contextualInsights,
      executionLog,
      totalResults: contextuallyRankedResults.length,
      strategy: queryPlan.strategy,
      enhancedFeatures: {
        contextualRanking: true,
        conversationAware: true,
        userPatternIntegration: true,
        crossReferenceAnalysis: Object.keys(aggregationResults.crossReference || {}).length > 0
      },
      conversationState: queryPlan.conversationState || {}
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in enhanced gpt-search-orchestrator:', error);
    return new Response(JSON.stringify({
      error: error.message,
      results: [],
      executionLog: [`Error: ${error.message}`],
      enhanced: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildContextualQuery(originalQuery: string, queryPlan: any, userContext: any, conversationContext: any[]): string {
  if (!queryPlan.searchPlan?.contextIntegration?.useConversationHistory || conversationContext.length === 0) {
    return originalQuery;
  }

  const recentContext = conversationContext.slice(-2)
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');

  return `${originalQuery}\n\nConversation context:\n${recentContext}`;
}

function enhanceEmotionFilters(emotionFilters: string[], userEmotionalPatterns: Record<string, number>): string[] {
  const enhancedFilters = [...emotionFilters];
  
  // Add user's most common emotions if not already included
  const topUserEmotions = Object.entries(userEmotionalPatterns)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([emotion]) => emotion);
    
  for (const emotion of topUserEmotions) {
    if (!enhancedFilters.includes(emotion)) {
      enhancedFilters.push(emotion);
    }
  }
  
  return enhancedFilters.slice(0, 8); // Limit to avoid over-filtering
}

async function executeEnhancedVectorSearch(
  supabase: any, 
  embedding: number[], 
  parameters: any, 
  userId: string,
  contextIntegration: any
) {
  try {
    let query;
    
    if (parameters.dateRange) {
      query = supabase.rpc('match_journal_entries_with_date', {
        query_embedding: embedding,
        match_threshold: parameters.vectorThreshold,
        match_count: parameters.maxResults || 20,
        user_id_filter: userId,
        start_date: parameters.dateRange.startDate,
        end_date: parameters.dateRange.endDate
      });
    } else {
      query = supabase.rpc('match_journal_entries_fixed', {
        query_embedding: embedding,
        match_threshold: parameters.vectorThreshold,
        match_count: parameters.maxResults || 20,
        user_id_filter: userId
      });
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Enhanced vector search error:', error);
      return [];
    }

    // Apply contextual weighting if user profile integration is enabled
    if (contextIntegration?.useUserProfile && data) {
      return data.map(result => ({
        ...result,
        contextual_weight: calculateContextualWeight(result, contextIntegration)
      }));
    }

    return data || [];
  } catch (error) {
    console.error('Enhanced vector search execution error:', error);
    return [];
  }
}

async function executeEnhancedEmotionSearch(
  supabase: any, 
  emotion: string, 
  parameters: any, 
  userId: string,
  userContext: any
) {
  try {
    const { data, error } = await supabase.rpc('match_journal_entries_by_emotion', {
      emotion_name: emotion,
      user_id_filter: userId,
      min_score: 0.25, // Slightly lower threshold for enhanced recall
      start_date: parameters.dateRange?.startDate || null,
      end_date: parameters.dateRange?.endDate || null,
      limit_count: Math.floor((parameters.maxResults || 20) / 3)
    });

    if (error) {
      console.error('Enhanced emotion search error:', error);
      return [];
    }

    // Add user emotional pattern weighting
    const userEmotionFrequency = userContext.journalingPatterns?.emotional_patterns?.[emotion] || 1;
    
    return (data || []).map(result => ({
      ...result,
      user_emotion_weight: Math.log(userEmotionFrequency + 1) / 10 // Logarithmic weighting
    }));
  } catch (error) {
    console.error('Enhanced emotion search execution error:', error);
    return [];
  }
}

async function executeEnhancedThemeSearch(
  supabase: any,
  query: string,
  parameters: any,
  userId: string,
  userThemePatterns: Record<string, number>
) {
  try {
    // Use the most relevant themes from user's patterns
    const relevantThemes = Object.keys(userThemePatterns).slice(0, 5);
    if (relevantThemes.length === 0) return [];

    const results = [];
    for (const theme of relevantThemes) {
      const { data, error } = await supabase.rpc('match_journal_entries_by_theme', {
        theme_query: `${query} ${theme}`,
        user_id_filter: userId,
        match_threshold: 0.3,
        match_count: 5
      });

      if (!error && data) {
        results.push(...data.map(result => ({
          ...result,
          theme_relevance: userThemePatterns[theme] || 1
        })));
      }
    }

    return results;
  } catch (error) {
    console.error('Enhanced theme search execution error:', error);
    return [];
  }
}

async function executeEnhancedEmotionSummary(
  supabase: any, 
  userId: string, 
  parameters: any,
  userContext: any,
  contextWeighting: boolean
) {
  try {
    const { data, error } = await supabase.rpc('get_top_emotions_with_entries', {
      user_id_param: userId,
      start_date: parameters.dateRange?.startDate || null,
      end_date: parameters.dateRange?.endDate || null,
      limit_count: 8
    });

    if (error) {
      console.error('Enhanced emotion summary error:', error);
      return null;
    }

    if (contextWeighting && data && userContext.journalingPatterns?.emotional_patterns) {
      // Apply user pattern weighting to emotion summary
      return data.map(emotion => ({
        ...emotion,
        user_frequency: userContext.journalingPatterns.emotional_patterns[emotion.emotion] || 0,
        contextual_significance: calculateEmotionalSignificance(
          emotion, 
          userContext.journalingPatterns.emotional_patterns
        )
      }));
    }

    return data;
  } catch (error) {
    console.error('Enhanced emotion summary execution error:', error);
    return null;
  }
}

async function executeCrossReferenceAnalysis(
  supabase: any,
  searchResults: any[],
  userContext: any,
  originalQuery: string
) {
  try {
    if (searchResults.length < 2) return {};

    // Group results by themes and emotions for cross-reference analysis
    const themeGroups: Record<string, any[]> = {};
    const emotionGroups: Record<string, any[]> = {};

    searchResults.forEach(result => {
      if (result.themes) {
        result.themes.forEach((theme: string) => {
          if (!themeGroups[theme]) themeGroups[theme] = [];
          themeGroups[theme].push(result);
        });
      }
      
      if (result.emotions) {
        Object.keys(result.emotions).forEach(emotion => {
          if (!emotionGroups[emotion]) emotionGroups[emotion] = [];
          emotionGroups[emotion].push(result);
        });
      }
    });

    return {
      themeConnections: Object.entries(themeGroups)
        .filter(([, results]) => results.length > 1)
        .slice(0, 5)
        .map(([theme, results]) => ({
          theme,
          entryCount: results.length,
          avgSimilarity: results.reduce((sum, r) => sum + (r.similarity || 0), 0) / results.length
        })),
      emotionConnections: Object.entries(emotionGroups)
        .filter(([, results]) => results.length > 1)
        .slice(0, 5)
        .map(([emotion, results]) => ({
          emotion,
          entryCount: results.length,
          avgIntensity: results.reduce((sum, r) => sum + (r.emotion_score || 0), 0) / results.length
        }))
    };
  } catch (error) {
    console.error('Cross-reference analysis error:', error);
    return {};
  }
}

function calculateContextualWeight(result: any, contextIntegration: any): number {
  let weight = 1.0;
  
  // Factor in recency if using conversation context
  if (contextIntegration.useConversationHistory && result.created_at) {
    const daysSinceCreation = (Date.now() - new Date(result.created_at).getTime()) / (1000 * 60 * 60 * 24);
    weight *= Math.exp(-daysSinceCreation / 30); // Exponential decay over 30 days
  }
  
  return weight;
}

function calculateEmotionalSignificance(emotion: any, userPatterns: Record<string, number>): number {
  const userFrequency = userPatterns[emotion.emotion] || 0;
  const globalScore = parseFloat(emotion.score) || 0;
  
  // Combine global emotional intensity with user-specific frequency
  return (globalScore * 0.7) + (Math.log(userFrequency + 1) * 0.3);
}

function removeEnhancedDuplicates(results: any[], userContext: any): any[] {
  const seen = new Map();
  
  return results.filter(result => {
    const key = result.id || result.journal_entry_id || result.chunk_id;
    if (seen.has(key)) {
      // Keep the result with higher contextual relevance
      const existing = seen.get(key);
      const currentRelevance = (result.similarity || result.emotion_score || 0) + 
                              (result.contextual_weight || 0) + 
                              (result.user_emotion_weight || 0);
      const existingRelevance = (existing.similarity || existing.emotion_score || 0) + 
                               (existing.contextual_weight || 0) + 
                               (existing.user_emotion_weight || 0);
      
      if (currentRelevance > existingRelevance) {
        seen.set(key, result);
        return true;
      }
      return false;
    }
    seen.set(key, result);
    return true;
  });
}

function sortByEnhancedRelevance(results: any[], queryPlan: any, userContext: any, conversationContext: any[]): any[] {
  return results.sort((a, b) => {
    // Base relevance score
    const aScore = a.similarity || a.emotion_score || 0;
    const bScore = b.similarity || b.emotion_score || 0;
    
    // Contextual weighting
    const aContextual = (a.contextual_weight || 0) + (a.user_emotion_weight || 0) + (a.theme_relevance || 0);
    const bContextual = (b.contextual_weight || 0) + (b.user_emotion_weight || 0) + (b.theme_relevance || 0);
    
    // Conversation relevance (for follow-up queries)
    let aConversational = 0, bConversational = 0;
    if (conversationContext.length > 0 && queryPlan.searchPlan?.contextIntegration?.useConversationHistory) {
      aConversational = calculateConversationalRelevance(a, conversationContext);
      bConversational = calculateConversationalRelevance(b, conversationContext);
    }
    
    const totalA = aScore + aContextual + aConversational;
    const totalB = bScore + bContextual + bConversational;
    
    return totalB - totalA;
  });
}

function calculateConversationalRelevance(result: any, conversationContext: any[]): number {
  // Simple heuristic: check for theme/emotion continuity with recent conversation
  const recentContent = conversationContext.slice(-2)
    .map(msg => msg.content.toLowerCase())
    .join(' ');
    
  let relevance = 0;
  
  if (result.themes) {
    result.themes.forEach((theme: string) => {
      if (recentContent.includes(theme.toLowerCase())) {
        relevance += 0.1;
      }
    });
  }
  
  if (result.emotions && typeof result.emotions === 'object') {
    Object.keys(result.emotions).forEach(emotion => {
      if (recentContent.includes(emotion.toLowerCase())) {
        relevance += 0.15;
      }
    });
  }
  
  return relevance;
}

function generateContextualInsights(
  results: any[], 
  queryPlan: any, 
  userContext: any, 
  aggregations: any
): any {
  const insights = {
    queryComplexity: queryPlan.queryType,
    dataQuality: {
      totalResults: results.length,
      avgRelevance: results.reduce((sum, r) => sum + (r.similarity || r.emotion_score || 0), 0) / results.length,
      hasEmotionalData: results.some(r => r.emotions),
      hasThematicData: results.some(r => r.themes)
    },
    userPatternAlignment: {
      matchesCommonThemes: false,
      matchesEmotionalPatterns: false,
      temporalDistribution: 'unknown'
    },
    conversationContinuity: {
      buildsOnPrevious: queryPlan.searchPlan?.contextIntegration?.useConversationHistory || false,
      suggestedFollowUps: queryPlan.conversationState?.followUpSuggestions || []
    }
  };

  // Analyze alignment with user patterns
  if (userContext.journalingPatterns?.common_themes) {
    const userThemes = Object.keys(userContext.journalingPatterns.common_themes);
    const resultThemes = results.flatMap(r => r.themes || []);
    insights.userPatternAlignment.matchesCommonThemes = userThemes.some(theme => 
      resultThemes.includes(theme)
    );
  }

  if (userContext.journalingPatterns?.emotional_patterns) {
    const userEmotions = Object.keys(userContext.journalingPatterns.emotional_patterns);
    const resultEmotions = results.flatMap(r => r.emotions ? Object.keys(r.emotions) : []);
    insights.userPatternAlignment.matchesEmotionalPatterns = userEmotions.some(emotion => 
      resultEmotions.includes(emotion)
    );
  }

  // Analyze temporal distribution
  if (results.length > 0 && results[0].created_at) {
    const dates = results.map(r => new Date(r.created_at).getTime()).sort();
    const span = dates[dates.length - 1] - dates[0];
    const days = span / (1000 * 60 * 60 * 24);
    
    if (days < 7) insights.userPatternAlignment.temporalDistribution = 'recent';
    else if (days < 30) insights.userPatternAlignment.temporalDistribution = 'monthly';
    else if (days < 90) insights.userPatternAlignment.temporalDistribution = 'quarterly';
    else insights.userPatternAlignment.temporalDistribution = 'historical';
  }

  return insights;
}
