
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { 
      originalQuery,
      searchResults,
      aggregations,
      queryPlan,
      conversationContext = [],
      userContext = {},
      contextualInsights = {}
    } = await req.json();

    console.log(`[Enhanced Response Synthesizer] Synthesizing enhanced response for: "${originalQuery}"`);

    // Build enhanced context from search results with user pattern awareness
    const contextEntries = searchResults.slice(0, 15).map((result: any, index: number) => {
      const relevanceScore = result.similarity || result.emotion_score || 0;
      const contextualWeight = result.contextual_weight || 0;
      const userWeight = result.user_emotion_weight || result.theme_relevance || 0;
      const totalRelevance = relevanceScore + contextualWeight + userWeight;
      
      return `Entry ${index + 1} (Relevance: ${totalRelevance.toFixed(3)}):
      Date: ${result.created_at}
      Content: ${result.content || result.chunk_content || 'No content'}
      ${result.emotions ? `Emotions: ${Object.entries(result.emotions)
        .sort(([,a]: any, [,b]: any) => b - a)
        .slice(0, 3)
        .map(([emotion, score]: any) => `${emotion}(${score.toFixed(2)})`)
        .join(', ')}` : ''}
      ${result.themes ? `Themes: ${result.themes.slice(0, 3).join(', ')}` : ''}
      ${userWeight > 0 ? `User Pattern Relevance: ${userWeight.toFixed(3)}` : ''}`;
    }).join('\n\n');

    // Build enhanced aggregation context with user pattern integration
    let aggregationContext = '';
    if (aggregations.emotionSummary) {
      aggregationContext += `\nEmotion Analysis: ${aggregations.emotionSummary.map((emotion: any) => {
        const userFreq = emotion.user_frequency || 0;
        const significance = emotion.contextual_significance || emotion.score;
        return `${emotion.emotion}: ${significance.toFixed(2)}${userFreq > 0 ? ` (Personal frequency: ${userFreq})` : ''}`;
      }).join(', ')}`;
    }

    if (aggregations.crossReference) {
      if (aggregations.crossReference.themeConnections?.length > 0) {
        aggregationContext += `\nTheme Connections: ${aggregations.crossReference.themeConnections
          .map((conn: any) => `${conn.theme}(${conn.entryCount} entries)`)
          .join(', ')}`;
      }
      if (aggregations.crossReference.emotionConnections?.length > 0) {
        aggregationContext += `\nEmotion Patterns: ${aggregations.crossReference.emotionConnections
          .map((conn: any) => `${conn.emotion}(${conn.entryCount} entries, avg: ${conn.avgIntensity.toFixed(2)})`)
          .join(', ')}`;
      }
    }

    // Build enhanced conversation context with state management
    const conversationContextString = conversationContext.length > 0 
      ? `\nConversation History: ${conversationContext.slice(-5).map((msg: any) => 
          `${msg.role}: ${msg.content}${msg.analysis ? ` [Previous insights: ${Object.keys(msg.analysis).join(', ')}]` : ''}`
        ).join('\n')}`
      : '';

    // Build comprehensive user context for personalization
    const userContextString = userContext.userProfile ? `
    \nUser Profile Context:
    - Subscription: ${userContext.userProfile.subscription_tier || 'free'}
    - Focus Areas: ${userContext.userProfile.focus_areas?.join(', ') || 'Not specified'}
    - Timezone: ${userContext.userProfile.timezone || 'Unknown'}
    
    Journaling Patterns:
    - Total Entries: ${userContext.entryCount || 0}
    - Recent Activity: ${userContext.hasRecentEntries ? 'Active' : 'Limited'}
    ${userContext.journalingPatterns ? `
    - Common Themes: ${Object.entries(userContext.journalingPatterns.common_themes || {})
      .sort(([,a]: any, [,b]: any) => b - a)
      .slice(0, 5)
      .map(([theme, count]: any) => `${theme}(${count})`)
      .join(', ')}
    - Emotional Patterns: ${Object.entries(userContext.journalingPatterns.emotional_patterns || {})
      .sort(([,a]: any, [,b]: any) => b - a)
      .slice(0, 5)
      .map(([emotion, count]: any) => `${emotion}(${count})`)
      .join(', ')}` : ''}` : '';

    // Build contextual insights summary
    const insightsContext = contextualInsights.dataQuality ? `
    \nAnalysis Quality Insights:
    - Query Complexity: ${contextualInsights.queryComplexity}
    - Data Coverage: ${contextualInsights.dataQuality.totalResults} results, avg relevance: ${contextualInsights.dataQuality.avgRelevance?.toFixed(3)}
    - Pattern Alignment: Themes ${contextualInsights.userPatternAlignment?.matchesCommonThemes ? '✓' : '✗'}, Emotions ${contextualInsights.userPatternAlignment?.matchesEmotionalPatterns ? '✓' : '✗'}
    - Temporal Scope: ${contextualInsights.userPatternAlignment?.temporalDistribution}
    - Conversation Continuity: ${contextualInsights.conversationContinuity?.buildsOnPrevious ? 'Building on previous' : 'New topic'}` : '';

    // Enhanced system prompt with comprehensive context awareness
    const systemPrompt = `You are SOULo, an advanced empathetic AI assistant specialized in personal growth and self-understanding through journal analysis. You have access to the user's complete journaling history and can provide deeply personalized, insightful responses based on their unique patterns and context.

ENHANCED QUERY ANALYSIS:
Query Type: ${queryPlan.queryType}
Strategy Used: ${queryPlan.strategy}
Confidence Level: ${queryPlan.confidence}
Total Results Found: ${searchResults.length}

COMPREHENSIVE JOURNAL CONTEXT:
${contextEntries}${aggregationContext}${conversationContextString}${userContextString}${insightsContext}

ADVANCED RESPONSE GUIDELINES:
1. **Deep Personalization**: Reference the user's specific patterns, themes, and emotional trends
2. **Contextual Awareness**: Build on conversation history and show understanding of their journey
3. **Pattern Recognition**: Identify and highlight meaningful connections across their entries
4. **Growth-Oriented**: Provide actionable insights that support their personal development
5. **Empathetic Tone**: Use a warm, understanding, and supportive voice throughout
6. **Intelligent Integration**: Weave together multiple data points for comprehensive understanding
7. **Future-Focused**: When appropriate, suggest areas for exploration or growth
8. **Conversation Continuity**: Reference previous discussions and build upon established themes

RESPONSE STRUCTURE:
- Start with acknowledgment of their specific situation/question
- Provide insights based on their actual journal patterns and data
- Make meaningful connections between different aspects of their experiences
- Offer personalized reflections that resonate with their unique journey
- Include specific examples from their entries when relevant (but keep them brief)
- End with thoughtful questions or suggestions that encourage deeper self-reflection

PERSONALIZATION FACTORS:
- Use their common themes and emotional patterns as context
- Consider their subscription level and focus areas
- Adapt language and suggestions to their journaling frequency and style
- Reference their temporal patterns (recent vs historical insights)
- Build on conversation history for continuity

TONE & STYLE:
- Conversational yet insightful (2-4 paragraphs typically)
- Personal and empathetic - this is THEIR data and journey
- Avoid clinical or overly analytical language
- Use "you" and "your" to maintain personal connection
- Balance validation with gentle challenges for growth

Your goal is to help them gain deeper self-understanding through their own words and experiences, while providing a supportive companion for their personal growth journey.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: originalQuery }
        ],
        temperature: 0.7,
        max_tokens: 1500
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const synthesizedResponse = aiData.choices[0].message.content;

    // Generate enhanced follow-up suggestions based on context
    const followUpSuggestions = generateEnhancedFollowUps(
      originalQuery,
      queryPlan,
      searchResults,
      userContext,
      contextualInsights
    );

    console.log('[Enhanced Response Synthesizer] Enhanced response synthesized with comprehensive personalization');

    return new Response(JSON.stringify({
      response: synthesizedResponse,
      totalResultsUsed: searchResults.length,
      enhancedInsights: {
        queryType: queryPlan.queryType,
        strategy: queryPlan.strategy,
        confidence: queryPlan.confidence,
        userPatternAlignment: contextualInsights.userPatternAlignment,
        conversationContinuity: contextualInsights.conversationContinuity,
        dataQuality: contextualInsights.dataQuality
      },
      references: searchResults.slice(0, 5).map((result: any) => ({
        id: result.id || result.journal_entry_id,
        content: (result.content || result.chunk_content || '').substring(0, 150),
        date: result.created_at,
        relevance: result.similarity || result.emotion_score || 0,
        contextualWeight: result.contextual_weight || 0,
        userPatternRelevance: result.user_emotion_weight || result.theme_relevance || 0
      })),
      conversationState: {
        followUpSuggestions,
        contextPreservation: queryPlan.conversationState?.contextPreservation || {},
        userIntent: queryPlan.conversationState?.userIntent || queryPlan.queryType,
        continuityFactors: {
          buildsOnPrevious: contextualInsights.conversationContinuity?.buildsOnPrevious,
          themeConnections: aggregations.crossReference?.themeConnections?.length || 0,
          emotionConnections: aggregations.crossReference?.emotionConnections?.length || 0
        }
      },
      enhancedFeatures: {
        personalizedAnalysis: true,
        contextualInsights: true,
        conversationAware: true,
        userPatternIntegration: true,
        crossReferenceAnalysis: !!aggregations.crossReference
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in enhanced gpt-response-synthesizer:', error);
    return new Response(JSON.stringify({
      error: error.message,
      response: "I'm sorry, I encountered an error while analyzing your journal entries with my enhanced personalization system. Please try again.",
      enhanced: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateEnhancedFollowUps(
  originalQuery: string,
  queryPlan: any,
  searchResults: any[],
  userContext: any,
  contextualInsights: any
): string[] {
  const suggestions = [];
  
  // Base suggestions from query plan
  if (queryPlan.conversationState?.followUpSuggestions) {
    suggestions.push(...queryPlan.conversationState.followUpSuggestions);
  }
  
  // Contextual suggestions based on results
  if (contextualInsights.userPatternAlignment?.matchesCommonThemes) {
    suggestions.push("How have these themes evolved over time?");
  }
  
  if (contextualInsights.userPatternAlignment?.matchesEmotionalPatterns) {
    suggestions.push("What triggers these emotional patterns for me?");
  }
  
  if (contextualInsights.dataQuality?.totalResults > 10) {
    suggestions.push("Can you identify any patterns I might have missed?");
  }
  
  // Query-type specific suggestions
  if (queryPlan.queryType === 'personal_insight') {
    suggestions.push(
      "What areas show the most growth?",
      "Are there recurring challenges I should address?"
    );
  } else if (queryPlan.queryType === 'emotional_pattern') {
    suggestions.push(
      "What helps me manage these emotions?",
      "How do these emotions connect to other life areas?"
    );
  } else if (queryPlan.queryType === 'temporal_analysis') {
    suggestions.push(
      "What seasonal patterns do I have?",
      "How do my patterns compare to previous periods?"
    );
  }
  
  // Remove duplicates and limit to 5 suggestions
  return [...new Set(suggestions)].slice(0, 5);
}
