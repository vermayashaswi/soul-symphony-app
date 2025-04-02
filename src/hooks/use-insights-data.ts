
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type EmotionData = {
  emotion: string;
  score: number;
  sample_entries?: {
    id: number;
    content: string;
    created_at: string;
    score: number;
  }[];
};

export type JournalInsight = {
  id: number;
  content: string;
  created_at: string;
  emotions?: Record<string, number>;
  themes?: string[];
};

export type TimelineData = {
  date: string;
  sentimentScore: number;
  entryCount: number;
  entries: JournalInsight[];
};

export type TimeRange = 'today' | 'week' | 'month' | 'year' | 'all';

export type AggregatedEmotionData = Record<string, Array<{ date: string; value: number }>>;

export type InsightsOverview = {
  totalEntries: number;
  entriesThisMonth: number;
  entriesThisWeek: number;
  averageSentiment: number;
  topEmotions: EmotionData[];
  recentInsights: JournalInsight[];
  timelineData: TimelineData[];
};

export function useInsightsData() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [insights, setInsights] = useState<InsightsOverview>({
    totalEntries: 0,
    entriesThisMonth: 0,
    entriesThisWeek: 0,
    averageSentiment: 0,
    topEmotions: [],
    recentInsights: [],
    timelineData: []
  });
  
  const { user } = useAuth();
  
  const fetchInsights = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get entry counts and recent entries
      const { data: entriesData, error: entriesError } = await supabase
        .from('Journal_Entries')
        .select('id, "refined text", created_at, sentiment, emotions, master_themes')
        .eq('user_id', user.id);
      
      if (entriesError) throw new Error(entriesError.message);
      
      const totalEntries = entriesData.length;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      
      const entriesThisMonth = entriesData.filter(entry => new Date(entry.created_at) >= startOfMonth).length;
      const entriesThisWeek = entriesData.filter(entry => new Date(entry.created_at) >= startOfWeek).length;
      
      // Calculate average sentiment
      const validSentimentEntries = entriesData.filter(entry => typeof entry.sentiment === 'number');
      const totalSentiment = validSentimentEntries.reduce((sum, entry) => {
        // Add type safety check for sentiment
        const sentimentValue = typeof entry.sentiment === 'string' ? 
          parseFloat(entry.sentiment) : (entry.sentiment as number || 0);
        return sum + sentimentValue;
      }, 0);
      
      const averageSentiment = validSentimentEntries.length > 0 ? totalSentiment / validSentimentEntries.length : 0;
      
      // Get top emotions
      const emotionCounts: Record<string, number> = {};
      entriesData.forEach(entry => {
        if (entry.emotions && typeof entry.emotions === 'object') {
          Object.entries(entry.emotions).forEach(([emotion, score]) => {
            if (typeof score === 'number') {
              emotionCounts[emotion] = (emotionCounts[emotion] || 0) + score;
            }
          });
        }
      });
      
      const topEmotions: EmotionData[] = Object.entries(emotionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([emotion, score]) => ({ emotion, score }));
      
      // Get recent insights
      const recentInsights: JournalInsight[] = entriesData.slice(0, 5).map(entry => ({
        id: entry.id,
        content: entry["refined text"] || '',
        created_at: entry.created_at,
        emotions: entry.emotions as Record<string, number> || {},
        themes: entry.master_themes || []
      }));
      
      // Generate timeline data (simplified for demonstration)
      const timelineData: TimelineData[] = [];
      
      setInsights({
        totalEntries,
        entriesThisMonth,
        entriesThisWeek,
        averageSentiment,
        topEmotions,
        recentInsights,
        timelineData
      });
    } catch (err) {
      console.error('Error fetching insights:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch insights'));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);
  
  useEffect(() => {
    if (user?.id) {
      fetchInsights();
    }
  }, [user?.id, fetchInsights]);
  
  return { insights, isLoading, error, refreshInsights: fetchInsights };
}
