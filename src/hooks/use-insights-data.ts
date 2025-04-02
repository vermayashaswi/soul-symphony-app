
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
  sentiment?: number | {
    score: number;
  };
};

export type TimelineData = {
  date: string;
  sentimentScore: number;
  entryCount: number;
  entries: JournalInsight[];
};

export type TimeRange = 'today' | 'week' | 'month' | 'year' | 'all';

export type AggregatedEmotionData = Record<string, Array<{ date: string; value: number }>>;

export type DominantMood = {
  emotion: string;
  emoji: string;
  score: number;
};

export type BiggestImprovement = {
  emotion: string;
  percentage: number;
};

export type JournalActivity = {
  entryCount: number;
  streak: number;
};

export type InsightsOverview = {
  totalEntries: number;
  entriesThisMonth: number;
  entriesThisWeek: number;
  averageSentiment: number;
  topEmotions: EmotionData[];
  recentInsights: JournalInsight[];
  timelineData: TimelineData[];
  // Add the missing properties
  entries: JournalInsight[];
  dominantMood?: DominantMood;
  biggestImprovement?: BiggestImprovement;
  journalActivity: JournalActivity;
  aggregatedEmotionData: AggregatedEmotionData;
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
    timelineData: [],
    entries: [],
    journalActivity: { entryCount: 0, streak: 0 },
    aggregatedEmotionData: {},
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
      
      // Convert entries to JournalInsight format for use in components
      const entries: JournalInsight[] = entriesData.map(entry => ({
        id: entry.id,
        content: entry["refined text"] || '',
        created_at: entry.created_at,
        emotions: entry.emotions as Record<string, number> || {},
        themes: entry.master_themes || [],
        sentiment: entry.sentiment
      }));
      
      // Generate mock dominant mood based on top emotions
      let dominantMood: DominantMood | undefined;
      if (topEmotions.length > 0) {
        dominantMood = {
          emotion: topEmotions[0].emotion,
          emoji: getEmoji(topEmotions[0].emotion),
          score: topEmotions[0].score
        };
      }
      
      // Generate mock biggest improvement 
      const biggestImprovement: BiggestImprovement = {
        emotion: topEmotions.length > 1 ? topEmotions[1].emotion : 'happiness',
        percentage: 15 // Mock percentage improvement
      };
      
      // Generate journal activity data
      const journalActivity: JournalActivity = {
        entryCount: entriesThisWeek,
        streak: Math.min(7, entriesThisWeek) // Mock streak data
      };
      
      // Generate mock aggregated emotion data for the chart
      const aggregatedEmotionData: AggregatedEmotionData = {};
      
      if (topEmotions.length > 0) {
        // Get last 7 days for the timeline
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - i);
          return date.toISOString().split('T')[0];
        }).reverse();
        
        topEmotions.slice(0, 3).forEach(emotion => {
          aggregatedEmotionData[emotion.emotion] = last7Days.map(date => ({
            date,
            value: Math.random() * 0.5 + 0.2 // Random value between 0.2 and 0.7
          }));
        });
      }
      
      // Generate timeline data (simplified for demonstration)
      const timelineData: TimelineData[] = [];
      
      setInsights({
        totalEntries,
        entriesThisMonth,
        entriesThisWeek,
        averageSentiment,
        topEmotions,
        recentInsights,
        timelineData,
        entries,
        dominantMood,
        biggestImprovement,
        journalActivity,
        aggregatedEmotionData
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

// Helper function to get emoji based on emotion
function getEmoji(emotion: string): string {
  const emojiMap: Record<string, string> = {
    happiness: '😊',
    joy: '😄',
    excitement: '🤩',
    gratitude: '🙏',
    love: '❤️',
    contentment: '😌',
    sadness: '😢',
    anger: '😡',
    frustration: '😤',
    anxiety: '😰',
    fear: '😨',
    disappointment: '😞',
    confusion: '😕',
    exhaustion: '😫',
    hope: '🌟',
    pride: '🦚',
    amusement: '😂',
    surprise: '😲'
  };
  
  return emojiMap[emotion.toLowerCase()] || '🤔';
}
