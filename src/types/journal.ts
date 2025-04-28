
import { Json } from '@/integrations/supabase/types';

export interface JournalEntry {
  id: number;
  user_id?: string;
  created_at: string;
  "transcription text"?: string;
  "refined text"?: string;
  audio_url?: string;
  duration?: number;
  emotions?: Json;
  sentiment?: string;
  entities?: Array<{
    type: string;
    name: string;
    text?: string;
  }>;
  "foreign key"?: string;
  master_themes?: string[];
  user_feedback?: string | null;
  Edit_Status?: number | null;
  content?: string; // Content field for easier access
  original_language?: string; // Original language of the entry
  translation_text?: string; // Translated text when available
  translation_status?: string; // Status of translation process
}

export interface JournalEntryFormData extends JournalEntry {
  text?: string;
}

export interface MoodDataPoint {
  date: Date;
  sentiment: number;
  category?: 'positive' | 'neutral' | 'negative';
}

export { type Json } from '@/integrations/supabase/types';
