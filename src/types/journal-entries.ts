
import { JournalEntry as DatabaseJournalEntry } from '@/types/journal';

export interface UIJournalEntry {
  id: number;
  content: string;
  created_at: string;
  audio_url?: string;
  sentiment?: string | null;
  themes?: string[];
  master_themes?: string[];
  entities?: Array<{
    type: string;
    name: string;
    text?: string;
  }>;
  Edit_Status?: number | null;
  user_feedback?: string | null;
}

export const transformDatabaseToUIEntry = (entry: DatabaseJournalEntry): UIJournalEntry => {
  return {
    id: entry.id || 0,
    content: entry["refined text"] || entry["transcription text"] || "",
    created_at: entry.created_at || new Date().toISOString(),
    audio_url: entry.audio_url,
    sentiment: entry.sentiment,
    themes: entry.master_themes,
    master_themes: entry.master_themes,
    entities: entry.entities,
    Edit_Status: entry.Edit_Status,
    user_feedback: entry.user_feedback
  };
};
