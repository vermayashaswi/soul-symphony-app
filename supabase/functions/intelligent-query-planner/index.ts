

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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

    // Generate intelligent query plan using GPT with enhanced entity-emotion awareness
    const queryPlan = await generateIntelligentQueryPlan(
      message,
      conversationContext,
      userPatterns,
      userProfile,
      openaiApiKey
    );

    console.log('[Intelligent Query Planner] Generated plan with enhanced entity-emotion relationship filtering:', queryPlan);

    return new Response(JSON.stringify({
      queryPlan,
      userPatterns,
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
  openaiApiKey: string
): Promise<QueryPlan> {
  const systemPrompt = `You are Ruh's Enhanced Intelligent Query Planner - a precise execution engine for a voice journaling app called SOuLO. Your job is to analyze user queries and return structured JSON plans with BULLETPROOF PostgreSQL queries.


USER QUERY: "${message}"
USER TIMEZONE: "${userProfile.timezone || 'UTC'}"
CURRENT DATE: ${new Date().toISOString().split('T')[0]} (YYYY-MM-DD format)
CURRENT YEAR: ${new Date().getFullYear()}
CURRENT TIME: ${new Date().toLocaleString('en-US', {
      timeZone: userProfile.timezone || 'UTC'
    })} (in user timezone)
CONVERSATION CONTEXT: ${conversationContext.length > 0 ? 
  (() => {
    // Enhanced conversation context processing with proper role mapping and ordering  
    const processedContext = conversationContext
      .slice(-10) // Expand to last 10 messages for richer context
      .sort((a, b) => new Date(a.created_at || a.timestamp || 0) - new Date(b.created_at || b.timestamp || 0)) // Chronological order (oldest to newest)
      .map((msg, index) => ({
        role: msg.sender === 'assistant' ? 'assistant' : 'user', // Standardize role mapping using sender field
        content: msg.content || 'N/A',
        messageOrder: index + 1,
        timestamp: msg.created_at || msg.timestamp,
        id: msg.id
      }));
    
    return `${processedContext.length} messages in conversation (chronological order, oldest to newest):
${processedContext.map((m) => `  [Message ${m.messageOrder}] ${m.role}: ${m.content}`).join('\n')}`;
  })() : 
  'None - This is the start of the conversation'}


===== COMPLETE JOURNAL ENTRIES TABLE COLUMN SPECIFICATION =====
In this databse we have a table: "Journal Entries" (ALWAYS use quotes); this contains all user's journal entries on the app SOuLO
MANDATORY COLUMNS & DATA TYPES listed below(PostgreSQL):

1. **id** (bigint, Primary Key): Entry identifier
   ✅ VALID: entries.id = 123
   ❌ INVALID: entries.id::text = '123'
   Example data in column on table: "605" 

2. **user_id** (uuid, NOT NULL): User identifier ("ID of the user who created this entry - MUST be included in all queries for user isolation)
   ✅ VALID: entries.user_id = auth.uid()
   ✅ VALID: entries.user_id = '1e7caad7-180d-439c-abd4-2f0d45256f68'
   ❌ INVALID: entries.user_id::text = 'uuid-string'
   Example data in column on table: "1e7caad7-180d-439c-abd4-2f0d45256f68"

3. **"refined text"** (text, Nullable): Main content - ALWAYS use quotes
   ✅ VALID: entries."refined text"
   ✅ VALID: COALESCE(entries."refined text", entries."transcription text") as content
   ❌ INVALID: entries.refined_text, entries.refinedtext
   Example data in column on table: "Today was very productive. I finished all my pending work and also started working on a new project. I feel quite satisfied on days when everything seems to be on track. Even meditation helped improve my focus today."

5. **sentiment** (real, Nullable): Sentiment score (-1 to 1)
   Example data in column on table: "0.4"
   ✅ VALID: ROUND(AVG(entries.sentiment::numeric), 3) as avg_sentiment
   ✅ VALID: entries.sentiment::numeric > 0.5
   ❌ BROKEN: ROUND(AVG(entries.sentiment), 3) -- WILL FAIL: real type incompatible
   ❌ BROKEN: SELECT sentiment FROM... -- Direct real math operations fail

6. **emotions** (jsonb, Nullable): Emotion scores as {"emotion": 0.85}
   Example data in column on table: {"joy": 0.4, "pride": 0.3, "relief": 0.5, "sadness": 0.5, "contentment": 0.6}
   ✅ VALID: SELECT e.key as emotion, ROUND(AVG((e.value::text)::numeric), 3) as avg_score FROM "Journal Entries" entries, jsonb_each(entries.emotions) e WHERE entries.user_id = auth.uid() GROUP BY e.key
   ✅ VALID: entries.emotions ? 'happiness' AND (entries.emotions->>'happiness')::numeric > 0.5
   ❌ BROKEN: jsonb_object_keys(emotions) -- Function doesn't exist
   ❌ BROKEN: json_object_keys(emotions) -- Wrong function for jsonb
   - This column only contain fixed values from this list (nothing else): "amusement","anger", "anticipation",
          "anxiety", "awe", "boredom", "compassion", "concern", "confidence", "confusion", "contentment", "curiosity", "depression",
          "disappointment","disgust","embarrassment","empathy","Enthusiasm","envy","excitement","fear","frustration","gratitude","guilt",
          "hate","hope","hurt","interest","jealousy","joy","loneliness","love","nostalgia","optimism","overwhelm","pessimism","pride","regret",
          "relief","remorse","sadness","satisfaction","serenity","shame","surprise","trust",
   

7. **master_themes** (text[], Nullable): Theme categories
   Example data in column on table: ["Mental Health","Creativity & Hobbies","Self & Identity"]
   ✅ VALID: SELECT theme, COUNT(*) FROM "Journal Entries" entries, unnest(entries.master_themes) as theme WHERE entries.user_id = auth.uid() GROUP BY theme
   ✅ VALID: entries.master_themes @> ARRAY['work']
   ✅ VALID: 'work' = ANY(entries.master_themes)
   ❌ INVALID: entries.master_themes[0] -- Direct array indexing risky
   - This column only contain fixed values from this list (nothing else): 
           "Self & Identity" (description: "Personal growth, self-reflection, and identity exploration")
           "Body & Health" (description: "Physical health, fitness, body image, and medical concerns")
           "Mental Health" (description: "Emotional wellbeing, mental health challenges, and therapy")
           "Romantic Relationships" (description: "Dating, marriage, partnerships, and romantic connections")
           "Family" (description: "Family relationships, parenting, and family dynamics")
           "Friendships & Social Circle" (description: "Friendships, social connections, and community")
           "Career & Workplace" (description: "Work, career development, and professional relationships")
           "Money & Finances" (description: "Financial planning, money management, and economic concerns")
           "Education & Learning" (description: "Formal education, skill development, and learning experiences")
           "Habits & Routines" (description: "Daily habits, routines, and lifestyle patterns")
           "Sleep & Rest" (description: "Sleep quality, rest, and recovery")
           "Creativity & Hobbies" (description: "Creative pursuits, hobbies, and artistic expression")
           "Spirituality & Beliefs" (description: "Spiritual practices, religious beliefs, and philosophy")
           "Technology & Social Media" (description: "Digital life, social media, and technology use")
           "Environment & Living Space" (description: "Home, living environment, and physical spaces")
           "Time & Productivity" (description: "Time management, productivity, and organization")
           "Travel & Movement" (description: "Travel experiences, moving, and location changes")
           "Loss & Grief" (description: "Dealing with loss, grief, and major life transitions")
           "Purpose & Fulfillment" (description: "Life purpose, meaning, and personal fulfillment")
           "Conflict & Trauma" (description: "Conflict resolution, trauma processing, and difficult experiences")
           "Celebration & Achievement" (description: "Achievements, celebrations, and positive milestones")
        
   

8. **entities** (jsonb, Nullable): Named entities as {"person": ["John", "Mary"]}
   Example data in column on table: ["life of surprises","walk in nature","AI project"]
   ✅ VALID: SELECT entity_name, COUNT(*) FROM "Journal Entries" entries, jsonb_each(entries.entities) as ent(ent_key, ent_value), jsonb_array_elements_text(ent_value) as entity_name WHERE entries.user_id = auth.uid() GROUP BY entity_name
   ❌ INVALID: Mixing jsonb functions incorrectly
   

9. **created_at** (timestamp with time zone, NOT NULL): Entry creation time (description: "When the journal entry was created - use for temporal analysis and date filtering")
   Example data in column on table: "2025-06-02 00:23:49.641397+00"
   ✅ VALID: entries.created_at >= (NOW() AT TIME ZONE '${userProfile.timezone || 'UTC'}' - INTERVAL '7 days')
   ✅ VALID: entries.created_at >= '2025-08-21T00:00:00+05:30'::timestamptz
   ✅ VALID: DATE_TRUNC('day', entries.created_at AT TIME ZONE '${userProfile.timezone || 'UTC'}')
   ❌ INVALID: created_at > 'today' -- Use proper timestamp

10. **duration** (numeric, Nullable): Journal Entry length in seconds
    Example data in column on table: "19"
    ✅ VALID: entries.duration > 60.0
    ✅ VALID: AVG(entries.duration)

11. **themeemotion** (jsonb, Nullable): Mater_Theme-emotions relationships
Example data in column on table:{"Mental Health": {"relief": 0.5, "sadness": 0.5, "contentment": 0.6}, "Self & Identity": {"pride": 0.3, "relief": 0.5, "contentment": 0.6}, "Creativity & Hobbies": {"joy": 0.4, "pride": 0.3, "contentment": 0.6}}
    ✅ VALID: jsonb_each(entries.themeemotion)
    NOTE: This only contains combinations of "master_themes" and "emotions" column values , noting else! 
    
    
12. **themes** (text[], Nullable): general conversational topical themes
    Example data in column on table: ["life of surprises","walk in nature","AI project"]      
    NOTE: This column doesn't have any constrained master list 

===== JOURNAL EMBEDDINGS TABLE SPECIFICATION =====
We also have a related table "journal_embeddings" for vector search operations:

Table: "journal_embeddings"
COLUMNS:
1. **id** (bigint, Primary Key): Embedding identifier
2. **journal_entry_id** (bigint, NOT NULL): Foreign key to "Journal Entries".id
3. **embedding** (vector, NOT NULL): Vector embedding for semantic search
4. **content** (text, NOT NULL): Text content used to generate the embedding
5. **created_at** (timestamp with time zone, NOT NULL): When embedding was created

VECTOR SEARCH FUNCTIONS:
1. **match_journal_entries(query_embedding, match_threshold, match_count, user_id_filter)**
   - Basic vector search without time constraints
   - Returns: id, content, similarity, embedding, created_at, themes, emotions
   
2. **match_journal_entries_with_date(query_embedding, match_threshold, match_count, user_id_filter, start_date, end_date)**
   - Vector search with time range filtering (REQUIRED for time-based queries)
   - Returns: id, content, created_at, similarity, themes, emotions
   
3. **match_journal_entries_by_emotion(emotion_name, user_id_filter, min_score, start_date, end_date, limit_count)**
   - Search entries by specific emotion with optional time filtering
   - Returns: id, content, created_at, emotion_score, embedding

4. **match_journal_entries_by_entity_emotion(entity_queries, emotion_queries, user_id_filter, match_threshold, match_count, start_date, end_date)**
   - Search entries matching both entities and emotions with relationship analysis
   - Returns: id, content, created_at, entities, emotions, entityemotion, similarity, entity_emotion_matches, relationship_strength

VECTOR SEARCH USAGE RULES:
- For time-constrained queries: ALWAYS use match_journal_entries_with_date
- For basic semantic search: Use match_journal_entries  
- For emotion-specific search: Use match_journal_entries_by_emotion
- For entity-emotion relationships: Use match_journal_entries_by_entity_emotion
- Threshold: 0.12-0.18 for time-constrained searches (lower to compensate for filtering)
- Limit: 20-30 for time-constrained searches (higher to ensure good results)


===== CRITICAL DATA TYPE CASTING RULES =====

**REAL TO NUMERIC CASTING (MANDATORY for sentiment):**
✅ CORRECT: entries.sentiment::numeric
✅ CORRECT: ROUND(AVG(entries.sentiment::numeric), 3)
✅ CORRECT: CAST(entries.sentiment AS numeric)
❌ BROKEN: ROUND(AVG(entries.sentiment), 3) -- WILL FAIL
❌ BROKEN: entries.sentiment + 1 -- WILL FAIL

**JSONB VALUE EXTRACTION:**
✅ CORRECT: (entries.emotions->>'happiness')::numeric
✅ CORRECT: (e.value::text)::numeric from jsonb_each
❌ BROKEN: entries.emotions->'happiness'::numeric -- Wrong cast order

**TEXT ARRAY OPERATIONS:**
✅ CORRECT: unnest(entries.master_themes) as theme
✅ CORRECT: array_length(entries.master_themes, 1)
❌ BROKEN: entries.master_themes[*] -- Postgres doesn't support

===== MANDATORY SQL PATTERNS =====

EMOTION ANALYSIS (COPY EXACTLY):
SELECT e.key as emotion, ROUND(AVG((e.value::text)::numeric), 3) as avg_score 
FROM "Journal Entries" entries, jsonb_each(entries.emotions) e 
WHERE entries.user_id = auth.uid() 
GROUP BY e.key 
ORDER BY avg_score DESC LIMIT 5

SENTIMENT ANALYSIS (COPY EXACTLY):
SELECT ROUND(AVG(entries.sentiment::numeric), 3) as avg_sentiment 
FROM "Journal Entries" entries 
WHERE entries.user_id = auth.uid()

THEME ANALYSIS (COPY EXACTLY):
SELECT theme, COUNT(*) as count 
FROM "Journal Entries" entries, unnest(entries.master_themes) as theme 
WHERE entries.user_id = auth.uid() 
GROUP BY theme 
ORDER BY count DESC LIMIT 5

TIME-FILTERED CONTENT (COPY EXACTLY):
SELECT entries.id, entries."refined text", entries.created_at
FROM "Journal Entries" entries
WHERE entries.user_id = auth.uid() 
AND entries.created_at >= (NOW() AT TIME ZONE '${userProfile.timezone || 'UTC'}' - INTERVAL '7 days')
ORDER BY entries.created_at DESC

===== CRITICAL: VECTOR SEARCH FUNCTION SPECIFICATION =====

ONLY FUNCTION FOR TIME-CONSTRAINED VECTOR SEARCH:
Function: match_journal_entries_with_date
Parameters: (query_embedding, match_threshold, match_count, user_id_filter, start_date, end_date)

VECTOR SEARCH PARAMETERS:
- threshold: 0.12-0.18 for time-constrained (LOWERED to compensate for filtering)
- limit: 20-30 for time-constrained (INCREASED to compensate for filtering)  
- query: Use user's semantic terms + EMOTION FAMILIES + context (emotions, themes, time words)


EXAMPLE VECTOR SEARCH STEP WITH DYNAMIC TIME CALCULATION:
{
  "step": 1,
  "description": "Vector search for emotional content from this week",
  "queryType": "vector_search",
  "vectorSearch": {
    "query": "emotions feelings mood sadness depression hurt disappointment this week recent",
    "threshold": 0.15,
    "limit": 25
  },
  "timeRange": {
    "start": "[CALCULATE Monday of current week in user timezone]T00:00:00+[user timezone offset]",
    "end": "[CALCULATE Sunday of current week in user timezone]T23:59:59+[user timezone offset]", 
    "timezone": "${userProfile.timezone || 'UTC'}"
  }
}

EXAMPLE SQL WITH DYNAMIC TIME CALCULATION:
{
  "step": 1,
  "description": "Analyze emotions from last 7 days",
  "queryType": "sql_analysis",
  "sqlQueryType": "analysis",
  "sqlQuery": "SELECT e.key as emotion, ROUND(AVG((e.value::text)::numeric), 3) as avg_score FROM \"Journal Entries\" entries, jsonb_each(entries.emotions) e WHERE entries.user_id = auth.uid() AND entries.created_at >= '[CALCULATE 7 days ago]T00:00:00+[timezone offset]'::timestamptz GROUP BY e.key ORDER BY avg_score DESC LIMIT 5",
  "timeRange": {
    "start": "[CALCULATE 7 days ago]T00:00:00+[timezone offset]",
    "end": "[CALCULATE current time]T23:59:59+[timezone offset]",
    "timezone": "${userProfile.timezone || 'UTC'}"
  }
}

===== CRITICAL: TIME RANGE CALCULATION INSTRUCTIONS =====

**MANDATORY TIME CALCULATIONS FOR COMMON PHRASES:**

When user mentions time phrases, you MUST calculate exact ISO timestamps:

 **"today"** = Start: ${new Date().toLocaleDateString('sv-SE', {
      timeZone: userProfile.timezone || 'UTC'
    })}T00:00:00+XX:XX, End: ${new Date().toLocaleDateString('sv-SE', {
      timeZone: userProfile.timezone || 'UTC'
    })}T23:59:59+XX:XX


**TIMEZONE OFFSET CALCULATION:**
- For timezone "${userProfile.timezone || 'UTC'}": Use appropriate offset (e.g., +05:30 for Asia/Kolkata, -08:00 for US/Pacific)
- ALWAYS include timezone offset in ISO timestamps
- Convert "NOW()" references to actual calculated timestamps

**EXAMPLE TIME RANGE CALCULATIONS:**

For "last 7 days" in Asia/Kolkata timezone:
{
  "timeRange": {
    "start": "${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}T00:00:00+05:30",
    "end": "${new Date().toISOString().split('T')[0]}T23:59:59+05:30",
    "timezone": "${userProfile.timezone || 'UTC'}"
  }
}

For "this week" in user timezone:
{
  "timeRange": {
    "start": "[Calculate Monday of current week]T00:00:00+[offset]",
    "end": "[Calculate Sunday of current week]T23:59:59+[offset]", 
    "timezone": "${userProfile.timezone || 'UTC'}"
  }
}

**CRITICAL: EVERY TIME REFERENCE MUST HAVE CALCULATED timeRange**
- NO null timeRange values when user mentions time
- NO "recent" without specific date calculations  
- NO relative terms without absolute timestamps
- ALWAYS provide both start and end ISO timestamps with timezone offset


ANALYSIS STATUS:
- User timezone: ${userProfile.timezone || 'UTC'}

SUB-QUESTION/QUERIES GENERATION GUIDELINE (MANDATORY): 

STEP1: 
Look at the USER QUERY: "${message}" and find out if this alone is sufficient to generate sub-questions (each will have a research plan). If the user query is ambiguous, the look at conversation context provided to you and the figure out what the "ASK" is. ("ASK" refers to a detailed questions that will answer user's queries)

STEP2: 
Find out if there are any time references in the conversation context and modify the "ASK"

STEP3: 
Your JSON response will be executed by our RAG pipeline system that processes each sub-question sequentially or in parallel based on your specified execution strategy and dependencies. The system will run your SQL queries against our PostgreSQL database to extract journal entries, emotions, and patterns, while simultaneously performing vector searches on journal embeddings when specified. Results from each sub-question will be collected and passed forward to dependent sub-questions as context (when resultForwarding is specified), allowing complex multi-step analysis where later queries can use insights from earlier ones. Once all sub-questions are executed, the collected data - including emotion scores, journal content, themes, and patterns - will be aggregated and sent to a final synthesis prompt that generates the personalized response to the user. 

STEP4:
Now, depending on the "ASK" ,create atleast 2 or more sub-questions other things required form you in the JSON response format that will answer the ASK as each sub-question will be analyzed in totality. FINAL step must be a final_content_retrieval step (see below in JSON response format). This is basically done so that all upstream sql question provide filtered resuls to this final_content_retrieval step so that a vector search is performed only on this subset of entries primarily to be provided downstream to the consolidator function to reference actual entries w.r.t the ASK


**RESPONSE FORMAT (MUST be valid JSON):**
{
  "queryType": "journal_specific|general_inquiry|mental_health",
  "strategy": "intelligent_sub_query|comprehensive_hybrid|vector_mandatory",
  "userStatusMessage": "Brief status for user",
  "subQuestions": [
    {
      "id": "sq1",
      "question": "Specific sub-question",
      "purpose": "Why this question is needed",
      "searchStrategy": "sql_primary|hybrid_parallel",
      "executionStage": 1,
      "dependencies": [],
      "resultForwarding": "emotion_data_for_ranking|theme_data_for_context|null",
      "executionMode": "parallel",
      "analysisSteps": [
        {
          "step": 1,
          "description": "What this step does",
          "queryType": "sql_analysis",
          "sqlQueryType": "analysis",
          "sqlQuery": "COMPLETE PostgreSQL query using EXACT patterns above",
          "vectorSearch": null,
          "timeRange": {"start": "[CALCULATED ISO TIMESTAMP WITH TIMEZONE]", "end": "[CALCULATED ISO TIMESTAMP WITH TIMEZONE]", "timezone": "${userProfile.timezone || 'UTC'}"} or null,
          "resultContext": null,
          "dependencies": []
        }
      ]
    },
    {
      "id": "final_content_retrieval",
      "question": "Retrieve actual journal entries that match the analysis",
      "purpose": "Provide specific journal content to support and illustrate the statistical findings",
      "searchStrategy": "vector_mandatory",
      "executionStage": 2,
      "dependencies": ["sq1"],
      "resultForwarding": "journal_entries_for_consolidator",
      "executionMode": "sequential",
      "analysisSteps": [{
        "step": 1,
        "description": "Vector search for journal entries matching user's semantic query with context from SQL results",
        "queryType": "vector_search",
        "vectorSearch": {
          "query": "[DYNAMIC_CONTEXT_QUERY]",
          "threshold": 0.15,
          "limit": 25
        },
        "timeRange": null,
        "resultContext": "use_sql_context_for_semantic_search",
        "dependencies": ["sq1"]
      }]
    }
    }
  ],
  "confidence": 0.8,
  "reasoning": "Strategy explanation with context awareness",
  "useAllEntries": boolean,
  "userTimezone": "${userProfile.timezone || 'UTC'}",
  "sqlValidationEnabled": true
}

**MANDATORY QUALITY CHECKS:**
✓ All SQL queries use exact patterns from examples above
✓ timeRange preserved across ALL analysisSteps when applicable
✓ JSONB queries use jsonb_each() not json_object_keys()
✓ Proper column/table quoting with spaces
✓ Timezone-aware date operations
✓ EVERY time reference in user query MUST have calculated timeRange with actual ISO timestamps
✓ NO null timeRange when user mentions any temporal phrases
✓ ALL timestamps MUST include proper timezone offset for "${userProfile.timezone || 'UTC'}"

**FINAL VALIDATION - TIME RANGE REQUIREMENTS:**
- If user mentions "today", "yesterday", "this week", "last week", "recently", "lately", "past few days", "last N days/weeks/months" → timeRange is MANDATORY
- Calculate actual start/end timestamps, don't use placeholders
- Use proper timezone offset for "${userProfile.timezone || 'UTC'}"
- Both SQL and vector search steps MUST include the same timeRange when time is mentioned`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
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
