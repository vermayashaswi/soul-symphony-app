
/**
 * Type definitions for journal entries and related data
 */

export interface JournalEntry {
  id: number;
  "transcription text"?: string | null;
  "refined text"?: string | null;
  user_id?: string | null;
  audio_url?: string | null;
  created_at: string;
  emotions?: string[] | null;
  master_themes?: string[] | null;
  duration?: number | null;
}

export interface EmbeddingReference {
  journal_entry_id: number;
  [key: string]: any;
}
