
export interface JournalEntry {
  id: number;
  user_id?: string;
  content: string;
  refined_text?: string;
  transcription_text?: string;
  created_at?: string;
  audio_url?: string | null;
  duration?: number;
  sentiment?: string;
  emotions?: Record<string, number>;
  entities?: any;
  master_themes?: string[];
  tempId?: string;
  is_chunked?: boolean;
  original_language?: string; // Add original language field
}

export interface JournalState {
  entries: JournalEntry[];
  filteredEntries: JournalEntry[];
  selectedDateRange: DateRange;
  isLoading: boolean;
  error: Error | null;
  searchQuery: string;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface ProcessingEntry {
  tempId: string;
  startTime: number;
  state: 'processing' | 'completed' | 'error' | 'canceled';
  error?: string;
  entryId?: number;
  content?: string;
}

export interface ExtractThemesResponse {
  themes: string[];
  master_themes: string[];
}
