import { supabase } from '@/integrations/supabase/client';

/**
 * Optimized Journal Service
 * Uses the new optimized database functions for better journal loading performance
 */

export interface OptimizedJournalEntry {
  id: number;
  content: string;
  created_at: string;
  emotions: any;
  themes: string[];
  master_themes: string[];
  sentiment: string;
  audio_url: string | null;
  duration: number | null;
}

export const optimizedJournalService = {
  /**
   * Get user journal entries using optimized direct query
   */
  async getUserJournalEntries(
    userId: string, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<{ entries: OptimizedJournalEntry[]; error?: string }> {
    try {
      // Use direct table query with optimized indexes
      const { data: entriesData, error: entriesError } = await supabase
        .from('Journal Entries')
        .select(`
          id,
          "refined text",
          "transcription text",
          created_at,
          emotions,
          themes,
          master_themes,
          sentiment,
          audio_url,
          duration
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (entriesError) {
        console.error('[OptimizedJournalService] Query error:', entriesError);
        return { entries: [], error: entriesError.message };
      }

      // Transform data to match optimized interface
      const transformedEntries = entriesData?.map(entry => ({
        id: entry.id,
        content: entry["refined text"] || entry["transcription text"] || '',
        created_at: entry.created_at,
        emotions: entry.emotions,
        themes: entry.themes || [],
        master_themes: entry.master_themes || [],
        sentiment: entry.sentiment || '',
        audio_url: entry.audio_url,
        duration: entry.duration
      })) || [];

      return { entries: transformedEntries };
    } catch (error: any) {
      console.error('[OptimizedJournalService] Exception getting journal entries:', error);
      return { entries: [], error: error.message };
    }
  },

  /**
   * Get journal entries count for pagination
   */
  async getJournalEntriesCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        console.error('[OptimizedJournalService] Error getting count:', error);
        return 0;
      }

      return count || 0;
    } catch (error: any) {
      console.error('[OptimizedJournalService] Exception getting count:', error);
      return 0;
    }
  },

  /**
   * Get recent journal entries for dashboard
   */
  async getRecentEntries(userId: string, limit: number = 5): Promise<OptimizedJournalEntry[]> {
    const result = await this.getUserJournalEntries(userId, limit, 0);
    return result.entries;
  },

  /**
   * Get journal entries with specific emotions
   */
  async getEntriesByEmotion(
    userId: string, 
    emotionName: string, 
    minScore: number = 0.3,
    limit: number = 10
  ): Promise<OptimizedJournalEntry[]> {
    try {
      const { data, error } = await supabase.rpc('match_journal_entries_by_emotion', {
        emotion_name: emotionName,
        user_id_filter: userId,
        min_score: minScore,
        limit_count: limit
      });

      if (error) {
        console.error('[OptimizedJournalService] Error getting entries by emotion:', error);
        return [];
      }

      // Transform the data to match our interface
      return data?.map((entry: any) => ({
        id: entry.id,
        content: entry.content,
        created_at: entry.created_at,
        emotions: { [emotionName]: entry.emotion_score },
        themes: [],
        master_themes: [],
        sentiment: '',
        audio_url: null,
        duration: null
      })) || [];
    } catch (error: any) {
      console.error('[OptimizedJournalService] Exception getting entries by emotion:', error);
      return [];
    }
  },

  /**
   * Get journal entries by theme
   */
  async getEntriesByTheme(
    userId: string, 
    themeQuery: string, 
    limit: number = 10
  ): Promise<OptimizedJournalEntry[]> {
    try {
      const { data, error } = await supabase.rpc('match_journal_entries_by_theme', {
        theme_query: themeQuery,
        user_id_filter: userId,
        match_count: limit
      });

      if (error) {
        console.error('[OptimizedJournalService] Error getting entries by theme:', error);
        return [];
      }

      // Transform the data to match our interface
      return data?.map((entry: any) => ({
        id: entry.id,
        content: entry.content,
        created_at: entry.created_at,
        emotions: {},
        themes: entry.themes || [],
        master_themes: entry.themes || [],
        sentiment: '',
        audio_url: null,
        duration: null
      })) || [];
    } catch (error: any) {
      console.error('[OptimizedJournalService] Exception getting entries by theme:', error);
      return [];
    }
  }
};