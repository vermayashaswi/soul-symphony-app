
/**
 * Type definitions for journal entries and related data
 */

export interface JournalEntry {
  id: number;
  "refined text"?: string | null;
  user_id?: string | null;
  [key: string]: any;
}

export interface EmbeddingReference {
  journal_entry_id: number;
  [key: string]: any;
}
