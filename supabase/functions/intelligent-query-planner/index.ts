import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { 
  generateDatabaseSchemaContext, 
  getEmotionAnalysisGuidelines, 
  getThemeAnalysisGuidelines 
} from '../_shared/databaseSchemaContext.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryPlan {
  strategy: string;
  searchMethods: string[];
  filters: any;
  emotionFocus?: string;
  timeRange?: any;
  subQueries?: string[];
  expectedResponseType: string;
  confidence: number;
  reasoning: string;
  databaseContext: string;
}

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

    const { message, userId, conversationContext = [], userProfile = {} } = await req.json();

    console.log('[Intelligent Query Planner] Analyzing query with database context:', message);

    // Get user's recent journaling patterns
    const { data: recentEntries } = await supabaseClient
      .from('Journal Entries')
      .select('created_at, emotions, master_themes, sentiment')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Analyze user's journaling patterns
    const userPatterns = analyzeUserPatterns(recentEntries || []);

    // Generate database schema context
    const databaseContext = generateDatabaseSchemaContext();
    const emotionGuidelines = getEmotionAnalysisGuidelines();
    const themeGuidelines = getThemeAnalysisGuidelines();

    // Generate intelligent query plan using GPT with full database context
    const queryPlan = await generateIntelligentQueryPlan(
      message,
      conversationContext,
      userPatterns,
      userProfile,
      databaseContext,
      emotionGuidelines,
      themeGuidelines,
      openaiApiKey
    );

    console.log('[Intelligent Query Planner] Generated plan with database context:', queryPlan);

    return new Response(JSON.stringify({
      queryPlan,
      userPatterns,
      databaseContext,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in intelligent query planner:', error);
    return new Response(JSON.stringify({
      error: error.message,
      fallbackPlan: generateFallbackPlan()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateIntelligentQueryPlan(
  message: string,
  conversationContext: any[],
  userPatterns: any,
  userProfile: any,
  databaseContext: string,
  emotionGuidelines: string,
  themeGuidelines: string,
  openaiApiKey: string
): Promise<QueryPlan> {
  const systemPrompt = `You are an intelligent query planning system for a personal journal analysis AI with FULL DATABASE SCHEMA AWARENESS.

${databaseContext}

${emotionGuidelines}

${themeGuidelines}

USER CONTEXT:
- Recent journaling patterns: ${JSON.stringify(userPatterns)}
- Conversation history: ${conversationContext.slice(-3).map(c => c.content).join('; ')}
- User timezone: ${userProfile.timezone || 'UTC'}

AVAILABLE SEARCH METHODS:
1. vector_search - Semantic similarity search using embeddings
2. emotion_analysis - Search by PRE-CALCULATED emotion scores (0.0-1.0 scale)
3. temporal_search - Time-based search with date ranges
4. theme_search - Search by master_themes array
5. hybrid_search - Combine multiple methods intelligently
6. aggregation_search - Statistical analysis across entries for patterns

QUERY TO ANALYZE: "${message}"

Generate a comprehensive query execution plan that leverages the database schema knowledge:

{
  "strategy": "primary_strategy_name",
  "searchMethods": ["method1", "method2"],
  "filters": {
    "timeRange": null or {"startDate": "ISO_DATE", "endDate": "ISO_DATE"},
    "emotionThreshold": 0.3,
    "themes": ["theme1", "theme2"] or null,
    "requirePersonalPronouns": boolean,
    "emotionFocus": "specific_emotion" or null
  },
  "emotionFocus": "emotion_name" or null,
  "subQueries": ["sub_query1", "sub_query2"] or null,
  "expectedResponseType": "narrative|analysis|data|direct_answer",
  "confidence": 0.85,
  "reasoning": "Detailed explanation leveraging database schema knowledge",
  "databaseContext": "How this plan uses the database schema effectively"
}

CRITICAL ANALYSIS GUIDELINES:
- Personal pronouns (I, me, my) suggest comprehensive analysis across ALL entries
- Emotion queries should focus on PRE-CALCULATED emotion scores, not text inference
- Theme queries should leverage the master_themes array for categorization
- Time references require temporal search with accurate date ranges
- Statistical queries need aggregation methods with emotion score analysis
- Always consider both refined text and transcription text for content analysis`;

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
        { role: 'user', content: message }
      ],
      temperature: 0.1,
      max_tokens: 1000
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const planText = data.choices[0].message.content;

  try {
    // Extract JSON from response
    const jsonMatch = planText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const plan = JSON.parse(jsonMatch[0]);
      // Ensure database context is included
      plan.databaseContext = plan.databaseContext || "Query plan generated with full database schema awareness";
      return plan;
    }
  } catch (parseError) {
    console.error('Failed to parse GPT response:', parseError);
  }

  return generateFallbackPlan();
}

function analyzeUserPatterns(entries: any[]) {
  const patterns = {
    avgEntriesPerWeek: 0,
    commonEmotions: [] as string[],
    commonThemes: [] as string[],
    typicalEntryLength: 0,
    emotionalVariability: 0,
    lastEntryDate: null as string | null,
    dominantSentiment: null as string | null,
    emotionScoreStats: {} as any
  };

  if (entries.length === 0) return patterns;

  // Calculate average entries per week
  const dateRange = new Date(entries[0].created_at).getTime() - new Date(entries[entries.length - 1].created_at).getTime();
  const weeks = dateRange / (1000 * 60 * 60 * 24 * 7);
  patterns.avgEntriesPerWeek = Math.round(entries.length / Math.max(weeks, 1));

  // Analyze emotions with score statistics
  const emotionCounts = new Map<string, number>();
  const emotionScores = new Map<string, number[]>();
  
  entries.forEach(entry => {
    if (entry.emotions) {
      Object.entries(entry.emotions).forEach(([emotion, score]) => {
        if (typeof score === 'number' && score > 0.3) {
          emotionCounts.set(emotion, (emotionCounts.get(emotion) || 0) + 1);
          if (!emotionScores.has(emotion)) {
            emotionScores.set(emotion, []);
          }
          emotionScores.get(emotion)!.push(score as number);
        }
      });
    }
  });

  patterns.commonEmotions = Array.from(emotionCounts.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([emotion]) => emotion);

  // Calculate emotion score statistics
  patterns.emotionScoreStats = {};
  emotionScores.forEach((scores, emotion) => {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    patterns.emotionScoreStats[emotion] = {
      avgScore: avg,
      maxScore: Math.max(...scores),
      frequency: scores.length
    };
  });

  // Analyze themes
  const themeCounts = new Map<string, number>();
  entries.forEach(entry => {
    if (entry.master_themes) {
      entry.master_themes.forEach((theme: string) => {
        themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
      });
    }
  });

  patterns.commonThemes = Array.from(themeCounts.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([theme]) => theme);

  // Analyze sentiment patterns
  const sentimentCounts = new Map<string, number>();
  entries.forEach(entry => {
    if (entry.sentiment) {
      sentimentCounts.set(entry.sentiment, (sentimentCounts.get(entry.sentiment) || 0) + 1);
    }
  });

  if (sentimentCounts.size > 0) {
    patterns.dominantSentiment = Array.from(sentimentCounts.entries())
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  patterns.lastEntryDate = entries[0]?.created_at || null;

  return patterns;
}

function generateFallbackPlan(): QueryPlan {
  return {
    strategy: "hybrid_search",
    searchMethods: ["vector_search", "emotion_analysis"],
    filters: {
      timeRange: null,
      emotionThreshold: 0.3,
      themes: null,
      requirePersonalPronouns: false
    },
    expectedResponseType: "narrative",
    confidence: 0.5,
    reasoning: "Fallback plan using hybrid search approach with database schema awareness",
    databaseContext: "Using vector search and emotion analysis as safe fallback methods"
  };
}
