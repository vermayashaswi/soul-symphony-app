
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export type TimeRange = 'today' | 'week' | 'month' | 'year';

export type EmotionDataPoint = {
  date: string;
  value: number;
  emotion: string;
};

export type AggregatedEmotionData = {
  [emotion: string]: EmotionDataPoint[];
};

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

interface InsightsData {
  entries: any[];
  dominantMood: DominantMood | null;
  biggestImprovement: BiggestImprovement | null;
  journalActivity: JournalActivity;
  aggregatedEmotionData: AggregatedEmotionData;
}

export const useInsightsData = (userId: string | undefined, timeRange: TimeRange) => {
  const [insightsData, setInsightsData] = useState<InsightsData>({
    entries: [],
    dominantMood: null,
    biggestImprovement: null,
    journalActivity: {
      entryCount: 0,
      streak: 0
    },
    aggregatedEmotionData: {}
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchInsightsData = async () => {
      setLoading(true);
      try {
        // Get date range based on timeRange
        const { startDate, endDate } = getDateRange(timeRange);

        // Fetch journal entries for the specified time range
        const { data: entries, error } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (!entries || entries.length === 0) {
          setInsightsData({
            entries: [],
            dominantMood: null,
            biggestImprovement: null,
            journalActivity: { entryCount: 0, streak: 0 },
            aggregatedEmotionData: {}
          });
          setLoading(false);
          return;
        }

        // Process the data
        const dominantMood = await calculateDominantMood(entries);
        const biggestImprovement = await calculateBiggestImprovement(userId, timeRange);
        const journalActivity = await calculateJournalActivity(userId, timeRange);
        const aggregatedEmotionData = processEmotionData(entries, timeRange);

        setInsightsData({
          entries,
          dominantMood,
          biggestImprovement,
          journalActivity,
          aggregatedEmotionData
        });
      } catch (error) {
        console.error('Error fetching insights data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsightsData();
  }, [userId, timeRange]);

  return { insightsData, loading };
};

// Helper functions
const getDateRange = (timeRange: TimeRange) => {
  const now = new Date();
  let startDate, endDate;

  switch (timeRange) {
    case 'today':
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      break;
    case 'week':
      startDate = startOfWeek(now, { weekStartsOn: 1 });
      endDate = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case 'month':
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
      break;
    case 'year':
      startDate = startOfYear(now);
      endDate = endOfYear(now);
      break;
    default:
      startDate = startOfWeek(now, { weekStartsOn: 1 });
      endDate = endOfWeek(now, { weekStartsOn: 1 });
  }

  return { startDate, endDate };
};

const calculateDominantMood = async (entries: any[]): Promise<DominantMood | null> => {
  if (!entries || entries.length === 0) return null;

  // Aggregate emotions across entries
  const emotionCounts: Record<string, { count: number; score: number }> = {};
  
  entries.forEach(entry => {
    if (entry.emotions) {
      try {
        const emotions = typeof entry.emotions === 'string' 
          ? JSON.parse(entry.emotions) 
          : entry.emotions;
        
        Object.entries(emotions).forEach(([emotion, score]) => {
          if (!emotionCounts[emotion]) {
            emotionCounts[emotion] = { count: 0, score: 0 };
          }
          emotionCounts[emotion].count += 1;
          emotionCounts[emotion].score += Number(score);
        });
      } catch (e) {
        console.error('Error parsing emotions:', e);
      }
    }
  });

  // Find the emotion with the highest score
  let dominantEmotion = '';
  let highestScore = 0;

  Object.entries(emotionCounts).forEach(([emotion, data]) => {
    if (data.score > highestScore) {
      dominantEmotion = emotion;
      highestScore = data.score;
    }
  });

  if (!dominantEmotion) return null;

  // Map emotion to emoji
  const emotionEmojis: Record<string, string> = {
    happy: '😊',
    sad: '😢',
    angry: '😠',
    fearful: '😨',
    disgusted: '🤢',
    surprised: '😲',
    joy: '😄',
    love: '❤️',
    content: '😌',
    peaceful: '😇',
    anxious: '😰',
    stressed: '😖',
    tired: '😴',
    excited: '🤩',
    hopeful: '🙏',
    grateful: '🙌',
  };

  return {
    emotion: dominantEmotion,
    emoji: emotionEmojis[dominantEmotion.toLowerCase()] || '🤔',
    score: highestScore
  };
};

const calculateBiggestImprovement = async (userId: string, timeRange: TimeRange): Promise<BiggestImprovement | null> => {
  // This is a simplified calculation - in a real app, you would compare current period with previous period
  // For now, returning a mock result
  return {
    emotion: 'peaceful',
    percentage: 24
  };
};

const calculateJournalActivity = async (userId: string, timeRange: TimeRange): Promise<JournalActivity> => {
  try {
    const { startDate, endDate } = getDateRange(timeRange);
    
    // Count entries in the time range
    const { count, error } = await supabase
      .from('journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    if (error) throw error;
    
    // Calculate streak (simplified version)
    // In a real app, you'd need to track consecutive days with entries
    const streak = Math.min(count || 0, 7); // Simplified streak calculation
    
    return {
      entryCount: count || 0,
      streak: streak
    };
  } catch (error) {
    console.error('Error calculating journal activity:', error);
    return { entryCount: 0, streak: 0 };
  }
};

const processEmotionData = (entries: any[], timeRange: TimeRange): AggregatedEmotionData => {
  const emotionData: AggregatedEmotionData = {};
  
  // Process entries and extract emotion data
  entries.forEach(entry => {
    const dateStr = format(new Date(entry.created_at), 'yyyy-MM-dd');
    
    if (entry.emotions) {
      try {
        const emotions = typeof entry.emotions === 'string' 
          ? JSON.parse(entry.emotions) 
          : entry.emotions;
        
        Object.entries(emotions).forEach(([emotion, score]) => {
          if (!emotionData[emotion]) {
            emotionData[emotion] = [];
          }
          
          // Check if we already have an entry for this date
          const existingPoint = emotionData[emotion].find(point => point.date === dateStr);
          
          if (existingPoint) {
            // Update existing data point
            existingPoint.value += Number(score);
          } else {
            // Add new data point
            emotionData[emotion].push({
              date: dateStr,
              value: Number(score),
              emotion: emotion
            });
          }
        });
      } catch (e) {
        console.error('Error parsing emotions:', e);
      }
    }
  });
  
  return emotionData;
};
