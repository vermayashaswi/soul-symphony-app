
export interface JournalEntry {
  id: number;
  content?: string;
  "refined text"?: string;
  created_at: string;
  audio_url?: string;
  sentiment?: number | { score: number } | any;
  master_themes?: string[];
  emotions?: Record<string, number>;
  foreignKey?: string;
  entities?: Array<{
    type: string;
    name: string;
    text: string;
  }>;
}
