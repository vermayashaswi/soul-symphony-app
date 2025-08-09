

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

    console.log('[Intelligent Query Planner] Analyzing query with enhanced entity-emotion relationship detection:', message);

    // Get user's recent journaling patterns
    const { data: recentEntries } = await supabaseClient
      .from('Journal Entries')
      .select('created_at, emotions, master_themes, entities, sentiment, entityemotion')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Analyze user's journaling patterns including entity-emotion relationships
    const userPatterns = await analyzeUserPatterns(recentEntries || [], supabaseClient, userId);

    // Generate database schema context
    const databaseContext = generateDatabaseSchemaContext();
    const emotionGuidelines = getEmotionAnalysisGuidelines();
    const themeGuidelines = getThemeAnalysisGuidelines();

    // Generate intelligent query plan using GPT with enhanced entity-emotion awareness
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

    console.log('[Intelligent Query Planner] Generated plan with enhanced entity-emotion relationship filtering:', queryPlan);

    return new Response(JSON.stringify({
      queryPlan,
      userPatterns,
      databaseContext,
      enhancedThemeFiltering: true,
      enhancedEntityFiltering: true,
      entityEmotionRelationshipAnalysis: true,
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
  const systemPrompt = `You are an intelligent query planning system for a personal journal analysis AI with ADVANCED ENTITY-EMOTION RELATIONSHIP ANALYSIS CAPABILITIES.

${databaseContext}

${emotionGuidelines}

${themeGuidelines}

ENHANCED THEME FILTERING CAPABILITIES:
- PostgreSQL array-based theme filtering with GIN index optimization
- Array overlap operations (&&) for efficient multi-theme queries
- Exact theme matching using ANY(array) operations
- Theme statistics and analytics with get_theme_statistics function
- Enhanced theme search with match_journal_entries_by_theme_array function

ENHANCED ENTITY FILTERING CAPABILITIES:
- JSONB-based entity filtering with optimized JSONB operations
- Entity search across multiple entity types (people, places, organizations, events, etc.)
- Exact entity matching using JSONB array operations
- Entity statistics and analytics with get_entity_statistics function
- Enhanced entity search with match_journal_entries_by_entities function
- Entity overlap operations for multi-entity queries

ADVANCED ENTITY-EMOTION RELATIONSHIP ANALYSIS:
- Specialized database function: match_journal_entries_by_entity_emotion
- Top entity-emotion relationships: get_top_entity_emotion_relationships  
- Entity-emotion statistics: get_entity_emotion_statistics
- Relationship strength calculation and ranking
- Cross-analysis of how users feel about specific entities over time
- Emotional pattern recognition related to people, places, events
- Supports complex queries like "How do I feel about work?" or "My relationship with mom"
- Temporal analysis of relationship evolution

USER CONTEXT:
- Recent journaling patterns: ${JSON.stringify(userPatterns)}
- User's common themes: ${userPatterns.commonThemes?.join(', ') || 'None identified'}
- User's common entities: ${userPatterns.commonEntities?.join(', ') || 'None identified'}
- Entity-emotion relationships: ${userPatterns.entityEmotionRelationships?.length || 0} detected
- Theme frequency statistics: ${JSON.stringify(userPatterns.themeStats || {})}
- Entity frequency statistics: ${JSON.stringify(userPatterns.entityStats || {})}
- Conversation history: ${conversationContext.slice(-6).map(c => c.content).join('; ')}
- User timezone: ${userProfile.timezone || 'UTC'}

AVAILABLE SEARCH METHODS (ENHANCED):
1. vector_search - Semantic similarity search using embeddings
2. emotion_analysis - Search by PRE-CALCULATED emotion scores (0.0-1.0 scale)
3. temporal_search - Time-based search with date ranges
4. theme_search - ENHANCED array-based theme search with PostgreSQL operators
5. entity_search - Array-based entity search with JSONB operators
6. entity_emotion_search - ADVANCED: Entity-emotion relationship analysis
7. entity_emotion_statistics - NEW: Statistical analysis of entity-emotion patterns
8. hybrid_search - Combine multiple methods intelligently
9. aggregation_search - Statistical analysis across entries for patterns
10. temporal_stats - Time-of-day distribution stats (counts, percentages) using get_time_of_day_distribution

ENTITY-EMOTION QUERY DETECTION:
- Look for relationship queries: "How do I feel about X?", "My feelings toward Y"
- Detect emotional connections to people: "relationship with mom", "feelings about boss"
- Identify place-emotion associations: "how work makes me feel", "emotions at home"
- Recognize event-emotion patterns: "stress from meetings", "anxiety about presentations"
- Consider temporal emotional changes: "my feelings about X over time"
- Pattern analysis: "What emotions do I associate with family?"

QUERY TO ANALYZE: "${message}"

Generate a comprehensive query execution plan with advanced entity-emotion relationship analysis:

{
  "strategy": "primary_strategy_name",
  "searchMethods": ["method1", "method2"],
  "filters": {
    "timeRange": null or {"startDate": "ISO_DATE", "endDate": "ISO_DATE"},
    "emotionThreshold": 0.3,
    "themes": ["theme1", "theme2"] or null,
    "entities": ["entity1", "entity2"] or null,
    "emotions": ["emotion1", "emotion2"] or null,
    "requirePersonalPronouns": boolean,
    "emotionFocus": "specific_emotion" or null,
    "themeMatchType": "exact" or "partial" or "semantic",
    "entityMatchType": "exact" or "partial" or "semantic",
    "entityEmotionAnalysis": boolean,
    "relationshipAnalysis": boolean,
    "relationshipStrengthThreshold": 0.3,
    "useEntityEmotionStatistics": boolean
  },
  "emotionFocus": "emotion_name" or null,
  "subQueries": ["sub_query1", "sub_query2"] or null,
  "expectedResponseType": "narrative|analysis|data|direct_answer|relationship_analysis|statistical_summary",
  "confidence": 0.85,
  "reasoning": "Detailed explanation leveraging advanced entity-emotion relationship analysis capabilities",
  "databaseContext": "How this plan uses the enhanced database schema including entity-emotion relationship operations and statistics"
}

ENHANCED ANALYSIS GUIDELINES:
- Prioritize entity-emotion relationship analysis for queries about feelings toward people, places, or things
- Use exact matching when entities and emotions are clearly specified
- Consider entity-emotion combinations and relationship strength patterns
- Leverage user's historical entity-emotion patterns for better relevance
- Utilize specialized entity-emotion database functions for optimal performance
- Apply semantic fallback only when relationship analysis doesn't yield sufficient results
- Combine entity, emotion, and relationship searches when all are relevant to the query
- Use statistical functions for pattern recognition and trend analysis
- Consider temporal aspects of relationship evolution`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-mini-2025-08-07',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_completion_tokens: 1000
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
      // Ensure enhanced database context is included
      plan.databaseContext = plan.databaseContext || "Query plan generated with advanced entity-emotion relationship analysis using specialized database functions and statistics";
      plan.enhancedThemeFiltering = true;
      plan.enhancedEntityFiltering = true;
      plan.entityEmotionAnalysis = true;
      plan.entityEmotionStatistics = true; // NEW
      return plan;
    }
  } catch (parseError) {
    console.error('Failed to parse GPT response:', parseError);
  }

  return generateFallbackPlan();
}

async function analyzeUserPatterns(entries: any[], supabaseClient: any, userId: string) {
  const patterns = {
    avgEntriesPerWeek: 0,
    commonEmotions: [] as string[],
    commonThemes: [] as string[],
    commonEntities: [] as string[],
    entityEmotionRelationships: [] as any[], // NEW
    themeStats: {} as any,
    entityStats: {} as any,
    entityEmotionStats: {} as any, // NEW
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

  // Analyze themes with enhanced statistics
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

  // Analyze entities with enhanced statistics
  const entityCounts = new Map<string, number>();
  entries.forEach(entry => {
    if (entry.entities) {
      Object.values(entry.entities).forEach((entityArray: any) => {
        if (Array.isArray(entityArray)) {
          entityArray.forEach((entity: string) => {
            entityCounts.set(entity, (entityCounts.get(entity) || 0) + 1);
          });
        }
      });
    }
  });

  patterns.commonEntities = Array.from(entityCounts.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([entity]) => entity);

  // NEW: Analyze entity-emotion relationships
  const entityEmotionRelationships: any[] = [];
  entries.forEach(entry => {
    if (entry.entityemotion) {
      Object.entries(entry.entityemotion).forEach(([entity, emotions]: [string, any]) => {
        Object.entries(emotions).forEach(([emotion, strength]: [string, any]) => {
          entityEmotionRelationships.push({
            entity,
            emotion,
            strength: typeof strength === 'number' ? strength : parseFloat(strength) || 0,
            entryId: entry.id,
            date: entry.created_at
          });
        });
      });
    }
  });

  patterns.entityEmotionRelationships = entityEmotionRelationships;

  // Get enhanced theme statistics from the database
  try {
    const { data: themeStats } = await supabaseClient.rpc(
      'get_theme_statistics',
      {
        user_id_filter: userId,
        limit_count: 10
      }
    );

    if (themeStats) {
      patterns.themeStats = themeStats.reduce((acc: any, stat: any) => {
        acc[stat.theme] = {
          entryCount: stat.entry_count,
          avgSentiment: stat.avg_sentiment_score,
          firstOccurrence: stat.first_occurrence,
          lastOccurrence: stat.last_occurrence
        };
        return acc;
      }, {});
    }
  } catch (error) {
    console.log('[Query Planner] Could not fetch theme statistics:', error);
  }

  // Get enhanced entity statistics from the database
  try {
    const { data: entityStats } = await supabaseClient.rpc(
      'get_entity_statistics',
      {
        user_id_filter: userId,
        limit_count: 10
      }
    );

    if (entityStats) {
      patterns.entityStats = entityStats.reduce((acc: any, stat: any) => {
        acc[stat.entity_name] = {
          entityType: stat.entity_type,
          entryCount: stat.entry_count,
          avgSentiment: stat.avg_sentiment_score,
          firstOccurrence: stat.first_occurrence,
          lastOccurrence: stat.last_occurrence
        };
        return acc;
      }, {});
    }
  } catch (error) {
    console.log('[Query Planner] Could not fetch entity statistics:', error);
  }

  // NEW: Get entity-emotion statistics from the database
  try {
    const { data: entityEmotionStats } = await supabaseClient.rpc(
      'get_entity_emotion_statistics',
      {
        user_id_filter: userId,
        limit_count: 15
      }
    );

    if (entityEmotionStats) {
      patterns.entityEmotionStats = entityEmotionStats.reduce((acc: any, stat: any) => {
        const key = `${stat.entity_name}|${stat.emotion_name}`;
        acc[key] = {
          entityType: stat.entity_type,
          relationshipCount: stat.relationship_count,
          avgStrength: stat.avg_strength,
          maxStrength: stat.max_strength,
          firstOccurrence: stat.first_occurrence,
          lastOccurrence: stat.last_occurrence
        };
        return acc;
      }, {});
    }
  } catch (error) {
    console.log('[Query Planner] Could not fetch entity-emotion statistics:', error);
  }

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
      entities: null,
      emotions: null,
      requirePersonalPronouns: false,
      themeMatchType: "semantic",
      entityMatchType: "semantic",
      entityEmotionAnalysis: false,
      relationshipAnalysis: false,
      relationshipStrengthThreshold: 0.3,
      useEntityEmotionStatistics: false
    },
    expectedResponseType: "narrative",
    confidence: 0.5,
    reasoning: "Fallback plan using hybrid search approach with enhanced database schema awareness including advanced entity-emotion relationship analysis",
    databaseContext: "Using vector search and emotion analysis as safe fallback methods with array optimization, JSONB entity support, and advanced entity-emotion relationship capabilities including statistics",
    enhancedThemeFiltering: true,
    enhancedEntityFiltering: true,
    entityEmotionAnalysis: true,
    entityEmotionStatistics: true // NEW
  };
}
