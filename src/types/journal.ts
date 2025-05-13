
// Define Json type for type safety across the application
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// Define JournalEntry interface
export interface JournalEntry {
  id: number;
  user_id?: string;
  content: string; // Making content required to satisfy both usages
  "refined text"?: string;
  "transcription text"?: string;
  created_at: string; // Making created_at required to satisfy both usages
  updated_at?: string;
  sentiment?: number | string;
  themes?: string[] | null;
  entities?: Json;
  tempId?: string;
  analysis_complete?: boolean;
  audio_url?: string;
  language?: string;
}

// Define JournalEntryReference interface
export interface JournalEntryReference {
  date: string;
  content: string;
  sentiment?: string;
  snippet?: string;
}
