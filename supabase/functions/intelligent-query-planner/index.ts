
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
      message, 
      userId, 
      conversationContext = [],
      userMetadata = {},
      threadId,
      messageId
    } = await req.json();

    console.log(`[Enhanced Query Planner] Planning query: "${message}"`);

    // Enhanced database schema integration - get user's data patterns
    const [entryCountResult, recentEntriesResult, userProfileResult, threadContextResult] = await Promise.allSettled([
      supabaseClient
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      
      supabaseClient
        .from('Journal Entries')
        .select('created_at, emotions, master_themes, sentiment')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      
      supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single(),
      
      threadId ? supabaseClient
        .from('chat_messages')
        .select('content, sender, created_at, analysis_data')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(10) : Promise.resolve({ data: null })
    ]);

    const entryCount = entryCountResult.status === 'fulfilled' ? entryCountResult.value.count || 0 : 0;
    const recentEntries = recentEntriesResult.status === 'fulfilled' ? recentEntriesResult.value.data || [] : [];
    const userProfile = userProfileResult.status === 'fulfilled' ? userProfileResult.value.data : null;
    const threadMessages = threadContextResult.status === 'fulfilled' ? threadContextResult.value.data || [] : [];

    // Enhanced conversation context analysis
    const conversationHistory = conversationContext.length > 0 
      ? conversationContext.slice(-5)
      : threadMessages.slice(0, 5).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.created_at,
          analysis: msg.analysis_data
        }));

    // Enhanced user profile context integration
    const userContextData = {
      profile: userProfile ? {
        timezone: userProfile.timezone,
        subscription_tier: userProfile.subscription_tier,
        onboarding_completed: userProfile.onboarding_completed,
        journal_focus_areas: userProfile.journal_focus_areas,
        tutorial_completed: userProfile.tutorial_completed
      } : null,
      journaling_patterns: {
        total_entries: entryCount,
        recent_activity: recentEntries.length,
        common_themes: recentEntries
          .filter(entry => entry.master_themes)
          .flatMap(entry => entry.master_themes)
          .reduce((acc, theme) => {
            acc[theme] = (acc[theme] || 0) + 1;
            return acc;
          }, {}),
        emotional_patterns: recentEntries
          .filter(entry => entry.emotions)
          .map(entry => Object.keys(entry.emotions).slice(0, 3))
          .flat()
          .reduce((acc, emotion) => {
            acc[emotion] = (acc[emotion] || 0) + 1;
            return acc;
          }, {}),
        sentiment_trends: recentEntries
          .filter(entry => entry.sentiment)
          .map(entry => entry.sentiment)
      },
      mental_health_insights: userMetadata
    };

    // Enhanced prompt engineering with comprehensive context
    const systemPrompt = `You are an advanced intelligent query planner for SOULo, a voice journaling app. Your role is to create sophisticated execution plans for analyzing user queries against their personal journal data.

COMPREHENSIVE USER CONTEXT:
- Total journal entries: ${entryCount}
- Recent entries analyzed: ${recentEntries.length}
- User timezone: ${userProfile?.timezone || 'Unknown'}
- Subscription tier: ${userProfile?.subscription_tier || 'free'}
- Focus areas: ${userProfile?.journal_focus_areas?.join(', ') || 'Not specified'}

CONVERSATION CONTEXT:
${conversationHistory.length > 0 ? 
  conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n') : 
  'No previous conversation context'}

JOURNALING PATTERNS:
- Common themes: ${Object.entries(userContextData.journaling_patterns.common_themes)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
  .map(([theme, count]) => `${theme}(${count})`)
  .join(', ') || 'None identified'}
- Emotional patterns: ${Object.entries(userContextData.journaling_patterns.emotional_patterns)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
  .map(([emotion, count]) => `${emotion}(${count})`)
  .join(', ') || 'None identified'}

CURRENT QUERY: "${message}"

Available Analysis Capabilities:
1. Vector similarity search (semantic matching with adjustable thresholds)
2. Emotion-based filtering with 20+ emotions (happy, sad, anxious, excited, calm, stressed, angry, peaceful, grateful, frustrated, hopeful, lonely, confident, worried, proud, disappointed, content, overwhelmed, curious, inspired)
3. Theme-based analysis (work, relationships, family, health, goals, travel, creativity, learning, challenges, growth, personal development, spirituality, finances, hobbies)
4. Temporal analysis with smart date processing
5. Statistical aggregation and pattern analysis
6. Cross-reference analysis for complex queries

Intelligence Rules:
1. Personal pronouns (I, me, my) + no explicit time = search ALL entries for comprehensive analysis
2. Emotion queries = hybrid approach (emotion filtering + semantic search)
3. Pattern/trend queries = temporal analysis with aggregations
4. Specific timeframes = strict date filtering with semantic search
5. Complex questions = multi-phase analysis with cross-referencing
6. Simple factual queries = targeted high-threshold vector search

Create a comprehensive execution plan that considers the user's full context, conversation history, and journaling patterns to provide the most insightful and personalized analysis.

Return ONLY a valid JSON object with this structure:
{
  "queryType": "personal_insight" | "temporal_analysis" | "emotional_pattern" | "factual_lookup" | "comparative_analysis" | "pattern_discovery",
  "confidence": number (0-1),
  "strategy": "comprehensive_search" | "targeted_search" | "temporal_focus" | "emotion_focus" | "multi_phase" | "contextual_analysis",
  "searchPlan": {
    "primarySearch": {
      "method": "vector" | "emotion" | "theme" | "hybrid" | "temporal",
      "parameters": {
        "vectorThreshold": number (0.01-0.4),
        "emotionFilters": string[],
        "themeFilters": string[],
        "dateRange": null | {"startDate": "ISO", "endDate": "ISO"},
        "maxResults": number (5-50),
        "useConversationContext": boolean,
        "personalityAnalysis": boolean
      }
    },
    "secondarySearches": [
      {
        "method": string,
        "parameters": object,
        "purpose": string,
        "priority": "high" | "medium" | "low"
      }
    ],
    "aggregations": [
      {
        "type": "emotion_summary" | "theme_analysis" | "temporal_patterns" | "statistical" | "cross_reference",
        "parameters": object,
        "contextWeighting": boolean
      }
    ],
    "contextIntegration": {
      "useUserProfile": boolean,
      "useConversationHistory": boolean,
      "useJournalingPatterns": boolean,
      "personalityFactors": string[]
    }
  },
  "expectedOutcome": string,
  "fallbackStrategy": string,
  "processingNotes": string[],
  "conversationState": {
    "followUpSuggestions": string[],
    "contextPreservation": object,
    "userIntent": string
  }
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.1,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const planContent = aiData.choices[0].message.content;

    let queryPlan;
    try {
      queryPlan = JSON.parse(planContent);
    } catch (parseError) {
      console.error('[Enhanced Query Planner] Failed to parse GPT response:', planContent);
      // Enhanced intelligent fallback with user context
      queryPlan = createEnhancedFallback(message, userContextData, conversationHistory);
    }

    // Store user query with enhanced metadata for conversation state management
    if (messageId) {
      try {
        await supabaseClient.rpc('store_user_query', {
          user_id: userId,
          query_text: message,
          query_embedding: null, // Will be generated in search orchestrator
          thread_id: threadId,
          message_id: messageId
        });
      } catch (error) {
        console.error('Error storing user query:', error);
      }
    }

    console.log('[Enhanced Query Planner] Generated comprehensive plan with user context integration');

    return new Response(JSON.stringify({
      queryPlan,
      originalQuery: message,
      userContext: {
        entryCount,
        hasRecentEntries: recentEntries.length > 0,
        userProfile: userProfile ? {
          timezone: userProfile.timezone,
          subscription_tier: userProfile.subscription_tier,
          focus_areas: userProfile.journal_focus_areas
        } : null,
        conversationLength: conversationHistory.length,
        journalingPatterns: userContextData.journaling_patterns
      },
      enhancedFeatures: {
        contextIntegration: true,
        conversationState: true,
        personalizedAnalysis: true,
        schemaAware: true
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in enhanced intelligent-query-planner:', error);
    
    // Enhanced error fallback with minimal context
    const { message = '', userId } = await req.json().catch(() => ({}));
    const fallbackPlan = createEnhancedFallback(message, {}, [], true);
    
    return new Response(JSON.stringify({
      queryPlan: fallbackPlan,
      error: error.message,
      fallback: true,
      enhanced: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function createEnhancedFallback(message: string, userContext: any, conversationHistory: any[], isError: boolean = false): any {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced pattern detection with user context
  const hasPersonalPronouns = /\b(i|me|my|mine|myself|am i|do i|how am i)\b/i.test(lowerMessage);
  const hasTimeReference = /\b(last week|yesterday|today|this week|last month|recently|lately)\b/i.test(lowerMessage);
  const hasEmotionWords = /\b(feel|emotion|mood|happy|sad|anxious|stressed|calm|angry|peaceful)\b/i.test(lowerMessage);
  const hasPatternQuery = /\b(pattern|trend|usually|often|always|never|typical)\b/i.test(lowerMessage);
  
  // Consider user's common themes and emotions from context
  const userThemes = userContext.journaling_patterns?.common_themes || {};
  const userEmotions = userContext.journaling_patterns?.emotional_patterns || {};
  
  let queryType = 'factual_lookup';
  let strategy = 'targeted_search';
  let vectorThreshold = 0.15;
  let useContextualAnalysis = false;
  
  if (hasPersonalPronouns) {
    queryType = 'personal_insight';
    strategy = 'comprehensive_search';
    vectorThreshold = 0.02;
    useContextualAnalysis = true;
  } else if (hasPatternQuery) {
    queryType = 'pattern_discovery';
    strategy = 'multi_phase';
    vectorThreshold = 0.05;
    useContextualAnalysis = true;
  } else if (hasEmotionWords) {
    queryType = 'emotional_pattern';
    strategy = 'emotion_focus';
    vectorThreshold = 0.08;
  } else if (hasTimeReference) {
    queryType = 'temporal_analysis';
    strategy = 'temporal_focus';
    vectorThreshold = 0.1;
  }

  return {
    queryType,
    confidence: isError ? 0.2 : 0.7,
    strategy,
    searchPlan: {
      primarySearch: {
        method: hasEmotionWords ? 'hybrid' : 'vector',
        parameters: {
          vectorThreshold,
          emotionFilters: hasEmotionWords ? Object.keys(userEmotions).slice(0, 5) : [],
          themeFilters: Object.keys(userThemes).slice(0, 3),
          dateRange: null,
          maxResults: hasPersonalPronouns ? 30 : 15,
          useConversationContext: conversationHistory.length > 0,
          personalityAnalysis: hasPersonalPronouns
        }
      },
      secondarySearches: useContextualAnalysis ? [{
        method: 'theme',
        parameters: { maxResults: 10 },
        purpose: 'contextual_analysis',
        priority: 'medium'
      }] : [],
      aggregations: hasPersonalPronouns || hasPatternQuery ? [
        { 
          type: 'emotion_summary', 
          parameters: {}, 
          contextWeighting: true 
        }
      ] : [],
      contextIntegration: {
        useUserProfile: true,
        useConversationHistory: conversationHistory.length > 0,
        useJournalingPatterns: Object.keys(userThemes).length > 0,
        personalityFactors: hasPersonalPronouns ? ['self_reflection', 'personal_growth'] : []
      }
    },
    expectedOutcome: `Enhanced ${isError ? 'error ' : ''}fallback analysis with user context integration`,
    fallbackStrategy: 'comprehensive_search_with_context',
    processingNotes: [`Generated enhanced fallback plan using pattern detection and user context`],
    conversationState: {
      followUpSuggestions: [
        "Tell me more about this pattern",
        "How has this changed over time?",
        "What other themes relate to this?"
      ],
      contextPreservation: {
        queryType,
        userThemes: Object.keys(userThemes).slice(0, 3),
        detectedPatterns: { hasPersonalPronouns, hasEmotionWords, hasPatternQuery }
      },
      userIntent: queryType
    }
  };
}
