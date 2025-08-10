
/**
 * Database Schema Context Helper
 * Provides comprehensive schema information for GPT-intelligent RAG operations
 */

export interface JournalEntrySchema {
  table: string;
  columns: {
    [key: string]: {
      type: string;
      description: string;
      nullable: boolean;
      example?: any;
    };
  };
  relationships: string[];
  searchCapabilities: string[];
}

// Master tables data for complete context
export const THEMES_MASTER_TABLE = [
  { id: 1, name: "work", description: "Professional life, career, job-related activities and concerns", category_type: "life_category", is_active: true },
  { id: 2, name: "relationships", description: "Interpersonal connections, family, friends, romantic relationships", category_type: "life_category", is_active: true },
  { id: 3, name: "health", description: "Physical and mental health, wellness, medical concerns", category_type: "life_category", is_active: true },
  { id: 4, name: "family", description: "Family relationships, dynamics, and interactions", category_type: "life_category", is_active: true },
  { id: 5, name: "goals", description: "Personal objectives, aspirations, and achievement pursuits", category_type: "life_category", is_active: true },
  { id: 6, name: "travel", description: "Journeys, exploration, and travel experiences", category_type: "life_category", is_active: true },
  { id: 7, name: "creativity", description: "Creative pursuits, artistic expression, and innovation", category_type: "life_category", is_active: true },
  { id: 8, name: "learning", description: "Education, skill development, and knowledge acquisition", category_type: "life_category", is_active: true },
  { id: 9, name: "challenges", description: "Difficulties, obstacles, and problem-solving situations", category_type: "life_category", is_active: true },
  { id: 10, name: "growth", description: "Personal development, self-improvement, and transformation", category_type: "life_category", is_active: true },
  { id: 11, name: "nature", description: "Connection with natural environment and outdoor experiences", category_type: "life_category", is_active: true },
  { id: 12, name: "spirituality", description: "Spiritual practices, beliefs, and inner connection", category_type: "life_category", is_active: true },
  { id: 13, name: "hobbies", description: "Leisure activities, interests, and recreational pursuits", category_type: "life_category", is_active: true },
  { id: 14, name: "home", description: "Domestic life, living space, and household activities", category_type: "life_category", is_active: true },
  { id: 15, name: "finances", description: "Money management, financial planning, and economic concerns", category_type: "life_category", is_active: true }
];

export const EMOTIONS_MASTER_TABLE = [
  { id: 1, name: "happy", description: "Feeling joy, contentment, or satisfaction" },
  { id: 2, name: "sad", description: "Feeling sorrow, melancholy, or downcast" },
  { id: 3, name: "anxious", description: "Feeling worried, nervous, or apprehensive" },
  { id: 4, name: "excited", description: "Feeling enthusiastic, eager, or thrilled" },
  { id: 5, name: "calm", description: "Feeling peaceful, relaxed, or tranquil" },
  { id: 6, name: "stressed", description: "Feeling pressure, tension, or overwhelmed" },
  { id: 7, name: "angry", description: "Feeling irritated, frustrated, or enraged" },
  { id: 8, name: "peaceful", description: "Feeling serene, harmonious, or at ease" },
  { id: 9, name: "grateful", description: "Feeling thankful, appreciative, or blessed" },
  { id: 10, name: "frustrated", description: "Feeling blocked, hindered, or annoyed" },
  { id: 11, name: "hopeful", description: "Feeling optimistic, positive, or expectant" },
  { id: 12, name: "lonely", description: "Feeling isolated, disconnected, or alone" },
  { id: 13, name: "confident", description: "Feeling self-assured, certain, or bold" },
  { id: 14, name: "overwhelmed", description: "Feeling swamped, burdened, or overloaded" },
  { id: 15, name: "content", description: "Feeling satisfied, fulfilled, or at peace" },
  { id: 16, name: "worried", description: "Feeling concerned, troubled, or uneasy" },
  { id: 17, name: "energetic", description: "Feeling vigorous, dynamic, or lively" },
  { id: 18, name: "tired", description: "Feeling fatigued, weary, or exhausted" },
  { id: 19, name: "curious", description: "Feeling inquisitive, interested, or wondering" },
  { id: 20, name: "inspired", description: "Feeling motivated, uplifted, or stimulated" }
];

export const JOURNAL_ENTRY_SCHEMA: JournalEntrySchema = {
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
      example: ["work", "relationships", "health", "growth"]
    },
    themeemotion: {
      type: "jsonb",
      description: "Combination of themes and emotions with correlation scores. Structure: {theme_name: {emotion_name: score}}. Provides context of which emotions are associated with which themes in this entry.",
      nullable: true,
      example: {
        "work": {"stressed": 0.8, "anxious": 0.6},
        "relationships": {"happy": 0.7, "grateful": 0.5}
      }
    },
    sentiment: {
      type: "text",
      description: "Overall sentiment score from Google NL API (-1.0 to 1.0 scale stored as text)",
      nullable: true,
      example: "0.75"
    },
    entities: {
      type: "jsonb",
      description: "Named entities extracted from the text (people, places, organizations)",
      nullable: true,
      example: {
        "PERSON": ["Sarah", "Dr. Smith"],
        "ORG": ["Google", "Hospital"],
        "GPE": ["New York", "California"]
      }
    },
    entityemotion: {
      type: "jsonb",
      description: "Entity-emotion relationships with strength scores. Structure: {entity_name: {emotion_name: strength_score}}",
      nullable: true,
      example: {
        "Sarah": {"happy": 0.8, "grateful": 0.6},
        "work": {"stressed": 0.9, "anxious": 0.7}
      }
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
    "Language detection results are stored in languages array for multi-language support"
  ],
  searchCapabilities: [
    "Vector similarity search using embeddings",
    "Emotion-based filtering with confidence thresholds",
    "Theme-based search and clustering",
    "Date range filtering and temporal analysis",
    "Content text search in both transcription and refined text",
    "Entity-based search for people, places, organizations",
    "Sentiment-based filtering using Google NL API scores",
    "Multi-language content filtering using detected languages array",
    "Language-specific content retrieval and analysis"
  ]
};

export function generateDatabaseSchemaContext(): string {
  return `
**JOURNAL ENTRY DATABASE SCHEMA:**

Table: "${JOURNAL_ENTRY_SCHEMA.table}"

**KEY COLUMNS:**
${Object.entries(JOURNAL_ENTRY_SCHEMA.columns).map(([column, info]) => 
  `• ${column} (${info.type}): ${info.description}${info.example ? `\n  Example: ${JSON.stringify(info.example)}` : ''}`
).join('\n')}

**LANGUAGE DETECTION SYSTEM:**
- Languages are detected during transcription using multiple detection methods
- Stored as JSON array of ISO 639-1 language codes (e.g., ["en", "hi", "es"])
- Primary language is stored in original_language field
- Supports multi-language content analysis and filtering
- Translation results are stored in translation_text field

**EMOTION SCORING SYSTEM:**
- Emotions are PRE-CALCULATED using advanced AI analysis
- Scores range from 0.0 (not present) to 1.0 (strongly present)
- Typical threshold for significance: 0.3+
- DO NOT attempt to infer emotions from text - use the provided scores

**SENTIMENT ANALYSIS:**
- Sentiment scores are calculated using Google Natural Language API
- Scores range from -1.0 (very negative) to 1.0 (very positive)
- Stored as text in the sentiment column
- Scores >= 0.3 are considered positive
- Scores >= -0.1 and < 0.3 are considered neutral
- Scores < -0.1 are considered negative

**MASTER THEMES:**
- AI-extracted main topics and themes from journal entries
- Useful for categorical analysis and pattern recognition
- Examples: "work stress", "family relationships", "health concerns"

**SEARCH CAPABILITIES:**
${JOURNAL_ENTRY_SCHEMA.searchCapabilities.map(cap => `• ${cap}`).join('\n')}

**RELATIONSHIPS:**
${JOURNAL_ENTRY_SCHEMA.relationships.map(rel => `• ${rel}`).join('\n')}

**IMPORTANT ANALYSIS NOTES:**
- All emotion data is pre-calculated and stored as numerical scores
- Use "refined text" as primary content source when available
- Master themes provide categorical context for grouping and analysis
- Vector embeddings enable semantic similarity search
- Date filtering supports temporal pattern analysis
- Sentiment analysis uses Google NL API for accurate sentiment scoring
- Language detection supports multi-language journaling and content analysis
- Translation capabilities preserve original language context while enabling cross-language analysis
`;
}

export function getEmotionAnalysisGuidelines(): string {
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

export function getThemeAnalysisGuidelines(): string {
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

export function getSentimentAnalysisGuidelines(): string {
  return `
**SENTIMENT ANALYSIS GUIDELINES:**

1. **Google NL API Sentiment Scoring**
   - Sentiment scores are calculated using Google Natural Language API
   - Scores range from -1.0 (very negative) to 1.0 (very positive)
   - Stored as text strings in the sentiment column

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

export function getLanguageAnalysisGuidelines(): string {
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
