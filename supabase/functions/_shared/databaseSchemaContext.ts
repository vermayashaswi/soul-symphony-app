export interface JournalEntry {
  id: number;
  user_id: string;
  "transcription text": string;
  "refined text": string;
  created_at: string;
  emotions?: Record<string, number>;
  themes?: string[];
  master_themes?: string[];
  entities?: Record<string, string[]>;
  sentiment?: string;
  duration?: number;
  languages?: string[];
  audio_url?: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  content: string;
  sender: 'user' | 'assistant' | 'error';
  created_at: string;
  reference_entries?: any[];
  has_numeric_result?: boolean;
  analysis_data?: any;
}

export interface ChatThread {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export const DATABASE_SCHEMA_CONTEXT = `
Database Schema Context:

JOURNAL ENTRIES TABLE:
- Primary content fields: "transcription text", "refined text" 
- Emotional data: emotions (JSON object with emotion names as keys, scores as values)
- Thematic data: themes (array), master_themes (array) - validated themes from our database
- Entity data: entities (JSON object with entity types as keys, arrays of entity names as values)
- Metadata: created_at, user_id, sentiment, duration, languages

EMOTIONS TABLE:
- Contains validated emotion names and descriptions
- Used to ensure emotional analysis uses consistent terminology

THEMES TABLE:  
- Contains validated theme names and descriptions
- Used to ensure thematic analysis uses consistent categorization

CHAT MESSAGES TABLE:
- Basic message data: content, sender, thread_id, created_at
- Analysis data: reference_entries, has_numeric_result, analysis_data

Always reference actual database field names in queries and ensure emotion/theme analysis aligns with our validated database values.
`;