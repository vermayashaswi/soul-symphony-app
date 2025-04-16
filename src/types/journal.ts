
import { Json } from '@/integrations/supabase/types';

export interface JournalEntry {
  id?: number;
  user_id?: string;
  created_at?: string;
  "transcription text"?: string;
  "refined text"?: string;
  audio_url?: string;
  duration?: number;
  emotions?: Json;
  sentiment?: string;
  entities?: Json;
  "foreign key"?: string;
  master_themes?: string[];
  user_feedback?: string | null;  // Added this line
}

export interface JournalEntryFormData extends JournalEntry {
  text?: string;
}
