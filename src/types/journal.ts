
import { Json } from '@/integrations/supabase/types';

export interface JournalEntry {
  id: number; // Making this required (not optional)
  user_id?: string;
  created_at: string;
  "transcription text"?: string;
  "refined text"?: string;
  audio_url?: string;
  duration?: number;
  emotions?: Json;
  sentiment?: string;
  translation_status?: string;
  entities?: Array<{
    type: string;
    name: string;
    text?: string;
  }>;
  "foreign key"?: string;
  master_themes?: string[];
  user_feedback?: string | null;
  Edit_Status?: number | null;
  content?: string; // Adding content as an optional property
  themes?: string[]; // Add the missing themes property
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
