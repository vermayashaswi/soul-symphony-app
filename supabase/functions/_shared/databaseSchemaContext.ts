
/**
 * Database Schema Context Helper
 * Provides comprehensive schema information for GPT-intelligent RAG operations
 */ // Dynamic data fetching for real-time master tables
let cachedThemes = [];
let cachedEmotions = [];
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
export async function fetchLiveMasterData(supabaseClient) {
  const now = Date.now();
  if (cachedThemes.length > 0 && cachedEmotions.length > 0 && now - cacheTimestamp < CACHE_DURATION) {
    return {
      themes: cachedThemes,
      emotions: cachedEmotions
    };
  }
  if (!supabaseClient) {
    // Return hardcoded fallback if no client provided
    return {
      themes: [
        {
          name: "Self & Identity",
          description: "Personal growth, self-reflection, and identity exploration"
        },
        {
          name: "Body & Health",
          description: "Physical health, fitness, body image, and medical concerns"
        },
        {
          name: "Mental Health",
          description: "Emotional wellbeing, mental health challenges, and therapy"
        },
        {
          name: "Romantic Relationships",
          description: "Dating, marriage, partnerships, and romantic connections"
        },
        {
          name: "Family",
          description: "Family relationships, parenting, and family dynamics"
        },
        {
          name: "Friendships & Social Circle",
          description: "Friendships, social connections, and community"
        },
        {
          name: "Career & Workplace",
          description: "Work, career development, and professional relationships"
        },
        {
          name: "Money & Finances",
          description: "Financial planning, money management, and economic concerns"
        },
        {
          name: "Education & Learning",
          description: "Formal education, skill development, and learning experiences"
        },
        {
          name: "Habits & Routines",
          description: "Daily habits, routines, and lifestyle patterns"
        },
        {
          name: "Sleep & Rest",
          description: "Sleep quality, rest, and recovery"
        },
        {
          name: "Creativity & Hobbies",
          description: "Creative pursuits, hobbies, and artistic expression"
        },
        {
          name: "Spirituality & Beliefs",
          description: "Spiritual practices, religious beliefs, and philosophy"
        },
        {
          name: "Technology & Social Media",
          description: "Digital life, social media, and technology use"
        },
        {
          name: "Environment & Living Space",
          description: "Home, living environment, and physical spaces"
        },
        {
          name: "Time & Productivity",
          description: "Time management, productivity, and organization"
        },
        {
          name: "Travel & Movement",
          description: "Travel experiences, moving, and location changes"
        },
        {
          name: "Loss & Grief",
          description: "Dealing with loss, grief, and major life transitions"
        },
        {
          name: "Purpose & Fulfillment",
          description: "Life purpose, meaning, and personal fulfillment"
        },
        {
          name: "Conflict & Trauma",
          description: "Conflict resolution, trauma processing, and difficult experiences"
        },
        {
          name: "Celebration & Achievement",
          description: "Achievements, celebrations, and positive milestones"
        }
      ],
      emotions: [
        {
          name: "amusement",
          description: "The state or experience of finding something funny"
        },
        {
          name: "anger",
          description: "A strong feeling of annoyance, displeasure, or hostility"
        },
        {
          name: "anticipation",
          description: "The action of anticipating something; expectation or prediction"
        },
        {
          name: "anxiety",
          description: "A feeling of worry, nervousness, or unease, typically about an imminent event"
        },
        {
          name: "awe",
          description: "A feeling of reverential respect mixed with fear or wonder"
        },
        {
          name: "boredom",
          description: "The state of feeling weary because one is unoccupied or lacks interest"
        },
        {
          name: "compassion",
          description: "Sympathetic pity and concern for the sufferings or misfortunes of others"
        },
        {
          name: "concern",
          description: "Anxiety; worry; a matter of interest or importance to someone"
        },
        {
          name: "confidence",
          description: "The feeling or belief that one can rely on someone or something; firm trust"
        },
        {
          name: "confusion",
          description: "Lack of understanding; uncertainty"
        },
        {
          name: "contentment",
          description: "A state of happiness and satisfaction"
        },
        {
          name: "curiosity",
          description: "A strong desire to know or learn something"
        },
        {
          name: "depression",
          description: "Feelings of severe despondency and dejection"
        },
        {
          name: "disappointment",
          description: "Sadness or displeasure caused by the non-fulfillment of one's hopes or expectations"
        },
        {
          name: "disgust",
          description: "A feeling of revulsion or strong disapproval"
        },
        {
          name: "embarrassment",
          description: "A feeling of self-consciousness, shame, or awkwardness"
        },
        {
          name: "empathy",
          description: "The ability to understand and share the feelings of another"
        },
        {
          name: "enthusiasm",
          description: "Intense and eager enjoyment, interest, or approval"
        },
        {
          name: "envy",
          description: "A feeling of discontented or resentful longing aroused by someone else's possessions, qualities, or luck"
        },
        {
          name: "excitement",
          description: "A feeling of great enthusiasm and eagerness"
        },
        {
          name: "fear",
          description: "An unpleasant emotion caused by the belief that someone or something is dangerous"
        },
        {
          name: "frustration",
          description: "The feeling of being upset or annoyed, especially because of inability to change or achieve something"
        },
        {
          name: "gratitude",
          description: "The quality of being thankful; readiness to show appreciation"
        },
        {
          name: "guilt",
          description: "A feeling of having done wrong or failed in an obligation"
        },
        {
          name: "hate",
          description: "Feel intense or passionate dislike for someone or something"
        },
        {
          name: "hope",
          description: "A feeling of expectation and desire for a certain thing to happen"
        },
        {
          name: "hurt",
          description: "Feeling emotional pain or distress"
        },
        {
          name: "interest",
          description: "The feeling of wanting to know or learn about something"
        },
        {
          name: "jealousy",
          description: "Feeling or showing envy of someone or their achievements and advantages"
        },
        {
          name: "joy",
          description: "A feeling of great pleasure and happiness"
        },
        {
          name: "loneliness",
          description: "Sadness because one has no friends or company"
        },
        {
          name: "love",
          description: "An intense feeling of deep affection"
        },
        {
          name: "nostalgia",
          description: "A sentimental longing or wistful affection for the past"
        },
        {
          name: "optimism",
          description: "Hopefulness and confidence about the future or the successful outcome of something"
        },
        {
          name: "overwhelm",
          description: "A feeling of being completely overcome or overpowered by emotion"
        },
        {
          name: "pessimism",
          description: "A tendency to see the worst aspect of things or believe that the worst will happen"
        },
        {
          name: "pride",
          description: "A feeling of deep pleasure or satisfaction derived from achievements"
        },
        {
          name: "regret",
          description: "Feel sad, repentant, or disappointed over something that has happened"
        },
        {
          name: "relief",
          description: "A feeling of reassurance and relaxation following release from anxiety or distress"
        },
        {
          name: "remorse",
          description: "Deep regret or guilt for a wrong committed"
        },
        {
          name: "sadness",
          description: "Feeling or showing sorrow; unhappy"
        },
        {
          name: "satisfaction",
          description: "Fulfillment of one's wishes, expectations, or needs"
        },
        {
          name: "serenity",
          description: "The state of being calm, peaceful, and untroubled"
        },
        {
          name: "shame",
          description: "A painful feeling of humiliation or distress caused by consciousness of wrong or foolish behavior"
        },
        {
          name: "surprise",
          description: "A feeling of mild astonishment or shock caused by something unexpected"
        },
        {
          name: "trust",
          description: "Firm belief in the reliability, truth, ability, or strength of someone or something"
        }
      ]
    };
  }
  try {
    const [themesResult, emotionsResult] = await Promise.all([
      supabaseClient.from('themes').select('name, description').eq('is_active', true).order('display_order', {
        ascending: true
      }),
      supabaseClient.from('emotions').select('name, description').order('name', {
        ascending: true
      })
    ]);
    cachedThemes = themesResult.data || [];
    cachedEmotions = emotionsResult.data || [];
    cacheTimestamp = now;
    return {
      themes: cachedThemes,
      emotions: cachedEmotions
    };
  } catch (error) {
    console.error('Failed to fetch live master data:', error);
    return {
      themes: [],
      emotions: []
    };
  }
}
export const JOURNAL_ENTRY_SCHEMA = {
  table: "Journal Entries",
  columns: {
    id: {
      type: "bigint",
      description: "Unique identifier for the journal entry",
      nullable: false,
      example: 12345
    },
    user_id: {
      type: "uuid",
      description: "ID of the user who created this entry - MUST be included in all queries for user isolation",
      nullable: false,
      example: "550e8400-e29b-41d4-a716-446655440000"
    },
    created_at: {
      type: "timestamp with time zone",
      description: "When the journal entry was created - use for temporal analysis and date filtering",
      nullable: false,
      example: "2024-01-15T14:30:00Z"
    },
    "transcription text": {
      type: "text",
      description: "Raw transcribed text from voice recording - original user input",
      nullable: true,
      example: "Today I felt really anxious about the meeting..."
    },
    "refined text": {
      type: "text",
      description: "Cleaned and refined version of the transcription - use as primary content source",
      nullable: true,
      example: "Today I experienced anxiety about an upcoming meeting..."
    },
    emotions: {
      type: "jsonb",
      description: "AI-calculated emotion scores (0.0-1.0 scale). Keys match emotions master table names. Use for emotion-based analysis.",
      nullable: true,
      example: {
        "anxious": 0.842,
        "worried": 0.735,
        "stressed": 0.623,
        "hopeful": 0.234
      }
    },
    master_themes: {
      type: "text[]",
      description: "Array of theme names from themes master table. Use for categorical analysis.",
      nullable: true,
      example: [
        "work",
        "relationships",
        "health",
        "growth"
      ]
    },
    themeemotion: {
      type: "jsonb",
      description: "CRITICAL FOR THEME-EMOTION ANALYSIS: Combination of themes and emotions with correlation scores. Structure: {theme_name: {emotion_name: score}}. Use this column to find emotions related to specific themes. For queries like 'emotions about family', use themeemotion->'Family' to get all emotions with scores for the Family theme.",
      nullable: true,
      example: {
        "Family": {
          "anxiety": 0.8,
          "love": 0.6,
          "concern": 0.4
        },
        "Career & Workplace": {
          "stress": 0.9,
          "satisfaction": 0.3
        },
        "Body & Health": {
          "concern": 0.7,
          "hope": 0.5
        }
      }
    },
    sentiment: {
      type: "real",
      description: "Overall sentiment score (-1.0 to 1.0) stored as a numeric real",
      nullable: true,
      example: 0.75
    },
    entities: {
      type: "jsonb",
      description: "Named entities extracted from the text (people, places, organizations)",
      nullable: true,
      example: {
        "PERSON": [
          "Sarah",
          "Dr. Smith"
        ],
        "ORG": [
          "Google",
          "Hospital"
        ],
        "GPE": [
          "New York",
          "California"
        ]
      }
    },
    languages: {
      type: "jsonb",
      description: "JSON array of ISO 639-1 language codes detected for the entry",
      nullable: true,
      example: [
        "en",
        "hi"
      ]
    },
    themes: {
      type: "text[]",
      description: "Additional themes/categories extracted from content (legacy/auxiliary)",
      nullable: true,
      example: [
        "work",
        "relationships"
      ]
    },
    "foreign key": {
      type: "text",
      description: "Legacy reference or external system foreign key (if any)",
      nullable: true
    },
    translation_status: {
      type: "text",
      description: "Translation processing status for the entry",
      nullable: true,
      example: "completed"
    },
    user_feedback: {
      type: "text",
      description: "Optional user-provided feedback on the AI processing",
      nullable: true
    },
    Edit_Status: {
      type: "integer",
      description: "Editing status flag for the entry (0 by default)",
      nullable: false,
      example: 0
    },
    duration: {
      type: "numeric",
      description: "Duration of the voice recording in seconds",
      nullable: true,
      example: 180.5
    },
    audio_url: {
      type: "text",
      description: "URL to the stored audio file",
      nullable: true
    }
  },
  relationships: [
    "journal_embeddings table contains vector embeddings for semantic search",
    "User profile information available in profiles table",
    "Emotion analysis results are pre-calculated and stored in emotions column",
    "Language detection results are stored in languages jsonb array for multi-language support"
  ],
  searchCapabilities: [
    "Vector similarity search using embeddings",
    "Emotion-based filtering with confidence thresholds",
    "Theme-based search and clustering",
    "Date range filtering and temporal analysis",
    "Content text search in both transcription and refined text",
    "Entity-based search for people, places, organizations",
    "Sentiment-based filtering using Google NL API scores",
    "Multi-language content filtering using detected languages jsonb array",
    "Language-specific content retrieval and analysis"
  ]
};
export async function generateDatabaseSchemaContext(supabaseClient) {
  const { themes, emotions } = await fetchLiveMasterData(supabaseClient);
  return `
Schema context version: 2025-08-12

**JOURNAL ENTRY DATABASE SCHEMA:**

Table: "${JOURNAL_ENTRY_SCHEMA.table}"

**KEY COLUMNS:**
${Object.entries(JOURNAL_ENTRY_SCHEMA.columns).map(([column, info])=>`• ${column} (${info.type}): ${info.description}${info.example ? `\n  Example: ${JSON.stringify(info.example)}` : ''}`).join('\n')}

**MASTER THEMES (COMPLETE LIST FOR SQL QUERIES):**
${themes.map((theme)=>`• "${theme.name}": ${theme.description}`).join('\n')}

**MASTER EMOTIONS (COMPLETE LIST FOR SQL QUERIES):**
${emotions.map((emotion)=>`• "${emotion.name}": ${emotion.description}`).join('\n')}

**CRITICAL DATABASE INSIGHTS:**
- emotions column: Contains ONLY emotion names from the master emotions list above with scores 0.0-1.0
- master_themes column: Contains ONLY theme names from the master themes list above as text array
- themeemotion column: Combines themes and emotions {theme_name: {emotion_name: score}}
- languages column: JSONB array of ISO 639-1 codes (e.g., ["en", "hi"]) 
- sentiment column: real (numeric), typically in range -1.0..1.0
- For theme-specific emotion queries (like "family emotions"), use: themeemotion->'theme_name' 
- For general emotion queries, use: emotions column with jsonb operators
- Always include WHERE user_id = $user_id for security

**SQL QUERY PATTERNS - CRITICAL CORRECT JSONB SYNTAX:**

**EMOTION ANALYSIS (emotions JSONB column):**
✅ CORRECT: SELECT emotion_key, AVG((emotion_value::text)::float) as avg_score, COUNT(*) as frequency 
            FROM "Journal Entries", jsonb_each(emotions) as em(emotion_key, emotion_value) 
            WHERE user_id = $user_id GROUP BY emotion_key ORDER BY avg_score DESC LIMIT 5;

**THEME ANALYSIS (master_themes array column):**
✅ CORRECT: SELECT theme, COUNT(*) as frequency FROM "Journal Entries", unnest(master_themes) as theme 
            WHERE user_id = $user_id GROUP BY theme ORDER BY frequency DESC LIMIT 5;

**THEME-EMOTION ANALYSIS (themeemotion JSONB column):**
✅ CORRECT: SELECT theme_name, emotion_key, AVG((emotion_value::text)::float) as avg_score
            FROM "Journal Entries", jsonb_each(themeemotion) as te(theme_name, theme_emotions),
            jsonb_each(theme_emotions) as em(emotion_key, emotion_value)
            WHERE user_id = $user_id AND theme_name = 'Family'
            GROUP BY theme_name, emotion_key ORDER BY avg_score DESC LIMIT 5;

**ENTITY ANALYSIS (entities JSONB column):**
✅ CORRECT: SELECT entity_type, entity_name, COUNT(*) as frequency 
            FROM "Journal Entries", jsonb_each(entities) as ent(entity_type, entity_values), 
            jsonb_array_elements_text(entity_values) as entity_name 
            WHERE user_id = $user_id GROUP BY entity_type, entity_name ORDER BY frequency DESC;

**TIME-BASED EMOTION ANALYSIS:**
✅ CORRECT: SELECT DATE_TRUNC('month', created_at) as month, emotion_key,
            AVG((emotion_value::text)::float) as avg_score
            FROM "Journal Entries", jsonb_each(emotions) as em(emotion_key, emotion_value)
            WHERE user_id = $user_id GROUP BY month, emotion_key ORDER BY month, avg_score DESC;

**ENTRIES WITH SPECIFIC THEME-EMOTION COMBINATIONS:**
✅ CORRECT: SELECT id, created_at, "refined text" as content, te.theme_emotions
            FROM "Journal Entries", jsonb_each(themeemotion) as te(theme_name, theme_emotions)
            WHERE user_id = $user_id AND theme_name = 'Family';

**SEARCH CAPABILITIES:**
${JOURNAL_ENTRY_SCHEMA.searchCapabilities.map((cap)=>`• ${cap}`).join('\n')}

**IMPORTANT ANALYSIS NOTES:**
- All emotion data is pre-calculated and stored as numerical scores
- Use "refined text" as primary content source when available
- themeemotion column is KEY for theme-specific emotion analysis
- Vector embeddings enable semantic similarity search
- Date filtering supports temporal pattern analysis
`;
}
export function getEmotionAnalysisGuidelines() {
  return `
**EMOTION ANALYSIS GUIDELINES:**

1. **Use Pre-Calculated Scores Only**
   - Emotion scores are already computed and stored in the emotions JSONB column
   - Each emotion has a confidence score from 0.0 to 1.0
   - NEVER attempt to infer emotions from text snippets

2. **Significance Thresholds**
   - Scores > 0.7: Strongly present emotion
   - Scores 0.4-0.7: Moderately present emotion  
   - Scores 0.3-0.4: Weakly present emotion
   - Scores < 0.3: Generally not significant

3. **Common Emotions in Database**
   - anxiety, worry, stress, fear (negative cluster)
   - joy, happiness, excitement, contentment (positive cluster)
   - sadness, depression, loneliness, grief (melancholic cluster)
   - anger, frustration, irritation (anger cluster)
   - hope, optimism, gratitude (aspirational cluster)

4. **Analysis Approach**
   - Focus on quantitative patterns and trends
   - Reference specific scores when discussing emotions
   - Compare emotional intensity across time periods
   - Identify emotional progression and changes
`;
}
export function getThemeAnalysisGuidelines() {
  return `
**THEME ANALYSIS GUIDELINES:**

1. **Master Themes Structure**
   - Stored as an array of strings in master_themes column
   - Each theme represents a key topic or subject area
   - Themes are AI-extracted and semantically meaningful

2. **Common Theme Categories**
   - Work/Career: "work stress", "career development", "job satisfaction"
   - Relationships: "family relationships", "friendships", "romantic relationships"
   - Health: "mental health", "physical health", "wellness"
   - Personal Growth: "self-improvement", "learning", "goals"
   - Lifestyle: "hobbies", "travel", "daily routine"

3. **Theme-Based Analysis**
   - Use themes for categorical grouping and pattern recognition
   - Identify dominant life areas and concerns
   - Track theme evolution over time
   - Correlate themes with emotional patterns
`;
}
export function getSentimentAnalysisGuidelines() {
  return `
**SENTIMENT ANALYSIS GUIDELINES:**

1. **Google NL API Sentiment Scoring**
   - Sentiment scores are calculated using Google Natural Language API
   - Scores range from -1.0 (very negative) to 1.0 (very positive)
   - Stored as real (numeric) in the sentiment column

2. **Sentiment Categories**
   - Positive: >= 0.3
   - Neutral: >= -0.1 and < 0.3
   - Negative: < -0.1

3. **Analysis Approach**
   - Use numerical sentiment scores for quantitative analysis
   - Track sentiment trends over time
   - Correlate sentiment with emotions and themes
   - Reference specific scores when discussing sentiment patterns
`;
}
export function getLanguageAnalysisGuidelines() {
  return `
**LANGUAGE ANALYSIS GUIDELINES:**

1. **Multi-Language Detection System**
   - Languages are detected using OpenAI transcription and Google language detection
   - Stored as JSON array of ISO 639-1 language codes in languages column
   - Primary language stored in original_language field
   - Supports analysis of mixed-language content

2. **Language Data Structure**
   - languages: ["en", "hi", "es"] - All detected languages in order of prominence
   - original_language: "hi" - Primary detected language
   - translation_text: Translated content when needed

3. **Language-Based Analysis**
   - Filter content by specific languages
   - Analyze multilingual patterns in user journaling
   - Support cross-language sentiment and emotion analysis
   - Enable language-specific insights and recommendations
`;
}
