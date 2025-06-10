
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
  themes?: string[];
  user_feedback?: string | null;
  Edit_Status?: number | null;
  content: string; // Changed from optional to required
  original_language?: string; // Keep as optional
  translation_text?: string; // Keep as optional
  languages?: string[]; // Array of detected language codes
  tempId?: string; // Temporary ID for tracking processing entries
  themeemotion?: Json; // FIXED: Added themeemotion field to replace entityemotion
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
