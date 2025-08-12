
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
  sentiment?: number | null;
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
  languages?: string[]; // FIXED: Array of detected language codes from refinement step
  tempId?: string; // Temporary ID for tracking processing entries
  themeemotion?: Json; // FIXED: Theme-emotion relationships from enhanced processing
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
