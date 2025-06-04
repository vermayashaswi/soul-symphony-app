
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
      userMetadata = {}
    } = await req.json();

    console.log(`[Intelligent Query Planner] Planning query: "${message}"`);

    // Get user's journal entry count and recent patterns
    const { count: entryCount } = await supabaseClient
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get recent entry patterns for context
    const { data: recentEntries } = await supabaseClient
      .from('Journal Entries')
      .select('created_at, emotions, master_themes')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Build context for GPT
    const contextString = conversationContext.length > 0 
      ? `\nConversation context: ${conversationContext.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    const userContextString = recentEntries?.length > 0
      ? `\nUser's recent journaling patterns: ${recentEntries.map(entry => 
          `Date: ${entry.created_at}, Themes: ${entry.master_themes?.join(', ') || 'none'}, Top emotions: ${
            entry.emotions ? Object.keys(entry.emotions).slice(0, 3).join(', ') : 'none'
          }`
        ).slice(0, 3).join('; ')}`
      : '';

    const prompt = `You are an intelligent query planner for a voice journaling app called SOULo. Your task is to create a comprehensive execution plan for analyzing user queries against their personal journal entries.

User query: "${message}"
User has ${entryCount || 0} total journal entries.${contextString}${userContextString}

Available Analysis Tools:
1. Vector similarity search (for semantic matching)
2. Emotion-based filtering (happy, sad, anxious, excited, calm, stressed, angry, peaceful, grateful, frustrated, hopeful, lonely, etc.)
3. Theme-based filtering (work, relationships, family, health, goals, travel, creativity, learning, challenges, growth, etc.)
4. Date range filtering (for temporal queries)
5. SQL aggregation functions (for statistical queries)

Your task is to create an intelligent execution plan that:
1. Determines the optimal search strategy
2. Identifies required filters and parameters
3. Plans the sequence of operations
4. Estimates confidence levels
5. Provides fallback strategies

Return a JSON object with this structure:
{
  "queryType": "personal_insight" | "temporal_analysis" | "emotional_pattern" | "factual_lookup" | "comparative_analysis",
  "confidence": number (0-1),
  "strategy": "comprehensive_search" | "targeted_search" | "temporal_focus" | "emotion_focus" | "multi_phase",
  "searchPlan": {
    "primarySearch": {
      "method": "vector" | "emotion" | "theme" | "hybrid",
      "parameters": {
        "vectorThreshold": number (0.01-0.3),
        "emotionFilters": string[],
        "themeFilters": string[],
        "dateRange": null | {"startDate": "ISO", "endDate": "ISO"},
        "maxResults": number
      }
    },
    "secondarySearches": [
      {
        "method": string,
        "parameters": object,
        "purpose": string
      }
    ],
    "aggregations": [
      {
        "type": "emotion_summary" | "theme_analysis" | "temporal_patterns" | "statistical",
        "parameters": object
      }
    ]
  },
  "expectedOutcome": string,
  "fallbackStrategy": string,
  "processingNotes": string[]
}

Key Intelligence Rules:
- Personal pronoun queries (I, me, my) should use comprehensive search with low thresholds
- Time-specific queries must use exact date filtering with no fallbacks
- Emotional queries should combine emotion filtering with vector search
- Complex questions need multi-phase analysis with aggregations
- Simple factual questions can use targeted high-threshold searches

Be intelligent about balancing precision vs recall based on query intent.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1200
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
      console.error('[Intelligent Query Planner] Failed to parse GPT response:', planContent);
      // Create intelligent fallback based on query analysis
      queryPlan = createIntelligentFallback(message, entryCount || 0);
    }

    console.log('[Intelligent Query Planner] Generated plan:', JSON.stringify(queryPlan, null, 2));

    return new Response(JSON.stringify({
      queryPlan,
      originalQuery: message,
      userContext: {
        entryCount: entryCount || 0,
        hasRecentEntries: (recentEntries?.length || 0) > 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in intelligent-query-planner:', error);
    
    // Intelligent error fallback
    const { message } = await req.json();
    const fallbackPlan = createIntelligentFallback(message || '', 0, true);
    
    return new Response(JSON.stringify({
      queryPlan: fallbackPlan,
      error: error.message,
      fallback: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function createIntelligentFallback(message: string, entryCount: number, isError: boolean = false): any {
  const lowerMessage = message.toLowerCase();
  
  // Intelligent pattern detection
  const hasPersonalPronouns = /\b(i|me|my|mine|myself|am i|do i|how am i)\b/i.test(lowerMessage);
  const hasTimeReference = /\b(last week|yesterday|today|this week|last month|recently|lately)\b/i.test(lowerMessage);
  const hasEmotionWords = /\b(feel|emotion|mood|happy|sad|anxious|stressed|calm|angry|peaceful)\b/i.test(lowerMessage);
  
  let queryType = 'factual_lookup';
  let strategy = 'targeted_search';
  let vectorThreshold = 0.15;
  
  if (hasPersonalPronouns) {
    queryType = 'personal_insight';
    strategy = 'comprehensive_search';
    vectorThreshold = 0.03;
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
    confidence: isError ? 0.2 : 0.6,
    strategy,
    searchPlan: {
      primarySearch: {
        method: hasEmotionWords ? 'hybrid' : 'vector',
        parameters: {
          vectorThreshold,
          emotionFilters: hasEmotionWords ? ['happy', 'sad', 'anxious', 'calm'] : [],
          themeFilters: [],
          dateRange: null,
          maxResults: hasPersonalPronouns ? 20 : 10
        }
      },
      secondarySearches: [],
      aggregations: hasPersonalPronouns ? [{ type: 'emotion_summary', parameters: {} }] : []
    },
    expectedOutcome: `Intelligent ${isError ? 'error ' : ''}fallback analysis for: ${message}`,
    fallbackStrategy: 'comprehensive_search',
    processingNotes: [`Generated ${isError ? 'error ' : ''}fallback plan using pattern detection`]
  };
}
