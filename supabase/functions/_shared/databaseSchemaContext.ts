
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
      description: "ID of the user who created this entry",
      nullable: false,
      example: "550e8400-e29b-41d4-a716-446655440000"
    },
    created_at: {
      type: "timestamp with time zone",
      description: "When the journal entry was created",
      nullable: false,
      example: "2024-01-15T14:30:00Z"
    },
    "transcription text": {
      type: "text",
      description: "Raw transcribed text from voice recording",
      nullable: true,
      example: "Today I felt really anxious about the meeting..."
    },
    "refined text": {
      type: "text",
      description: "Cleaned and refined version of the transcription",
      nullable: true,
      example: "Today I experienced anxiety about an upcoming meeting..."
    },
    emotions: {
      type: "jsonb",
      description: "AI-calculated emotion scores (0.0-1.0 scale). Each emotion has a numerical confidence score.",
      nullable: true,
      example: {
        "anxiety": 0.842,
        "worry": 0.735,
        "stress": 0.623,
        "hope": 0.234
      }
    },
    master_themes: {
      type: "text[]",
      description: "Array of AI-extracted main themes and topics from the entry",
      nullable: true,
      example: ["work stress", "relationships", "health", "personal growth"]
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
    "Emotion analysis results are pre-calculated and stored in emotions column"
  ],
  searchCapabilities: [
    "Vector similarity search using embeddings",
    "Emotion-based filtering with confidence thresholds",
    "Theme-based search and clustering",
    "Date range filtering and temporal analysis",
    "Content text search in both transcription and refined text",
    "Entity-based search for people, places, organizations",
    "Sentiment-based filtering using Google NL API scores"
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
