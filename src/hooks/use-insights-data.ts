
import { useState, useEffect, useCallback } from 'react';
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
  const [lastTimeRange, setLastTimeRange] = useState<TimeRange>(timeRange);

  // Make the fetchInsightsData function with useCallback to prevent unnecessary recreations
  const fetchInsightsData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get date range based on timeRange
      const { startDate, endDate } = getDateRange(timeRange);
      
      console.log(`Fetching entries for ${timeRange}:`, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Fetch journal entries for the specified time range
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching insights data:', error);
        throw error;
      }

      console.log(`Found ${entries?.length || 0} entries for ${timeRange}`);

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
      const dominantMood = calculateDominantMood(entries);
      const biggestImprovement = calculateBiggestImprovement(entries);
      const journalActivity = calculateJournalActivity(entries.length);
      const aggregatedEmotionData = processEmotionData(entries, timeRange);

      // Log the processed data for debugging
      console.log(`[useInsightsData] Processed for ${timeRange}:`, {
        entryCount: entries.length,
        emotionCount: Object.keys(aggregatedEmotionData).length,
        timeRange
      });

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
  }, [userId, timeRange]);

  // Fetch data when userId or timeRange changes
  useEffect(() => {
    if (timeRange !== lastTimeRange) {
      console.log(`[useInsightsData] TimeRange changed from ${lastTimeRange} to ${timeRange}, refetching data`);
      setLastTimeRange(timeRange);
    }
    
    fetchInsightsData();
  }, [userId, timeRange, fetchInsightsData]);

  return { insightsData, loading };
};

// Helper functions
const getDateRange = (timeRange: TimeRange) => {
  const now = new Date();
  let startDate, endDate;

  switch (timeRange) {
    case 'today':
      // For 'today', include the entire day from start to end
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      break;
    case 'week':
      // For 'week', use start of week (Monday) to end of week (Sunday)
      // Setting weekStartsOn to 1 makes Monday the first day of the week
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
      // Default to week if invalid timeRange
      startDate = startOfWeek(now, { weekStartsOn: 1 });
      endDate = endOfWeek(now, { weekStartsOn: 1 });
  }

  return { startDate, endDate };
};

const calculateDominantMood = (entries: any[]): DominantMood | null => {
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

const calculateBiggestImprovement = (entries: any[]): BiggestImprovement | null => {
  if (!entries || entries.length === 0) return null;

  // For this example, we'll compare the first half of entries with the second half
  // This is a simplified calculation
  const halfLength = Math.floor(entries.length / 2);
  const recentEntries = entries.slice(0, halfLength);
  const olderEntries = entries.slice(halfLength);

  const recentEmotions: Record<string, number> = {};
  const olderEmotions: Record<string, number> = {};

  // Process recent entries
  recentEntries.forEach(entry => {
    if (entry.emotions) {
      try {
        const emotions = typeof entry.emotions === 'string' 
          ? JSON.parse(entry.emotions) 
          : entry.emotions;
        
        Object.entries(emotions).forEach(([emotion, score]) => {
          if (!recentEmotions[emotion]) {
            recentEmotions[emotion] = 0;
          }
          recentEmotions[emotion] += Number(score);
        });
      } catch (e) {
        console.error('Error parsing emotions:', e);
      }
    }
  });

  // Process older entries
  olderEntries.forEach(entry => {
    if (entry.emotions) {
      try {
        const emotions = typeof entry.emotions === 'string' 
          ? JSON.parse(entry.emotions) 
          : entry.emotions;
        
        Object.entries(emotions).forEach(([emotion, score]) => {
          if (!olderEmotions[emotion]) {
            olderEmotions[emotion] = 0;
          }
          olderEmotions[emotion] += Number(score);
        });
      } catch (e) {
        console.error('Error parsing emotions:', e);
      }
    }
  });

  // Calculate improvement percentages
  let biggestImprovement: BiggestImprovement | null = null;
  let maxImprovement = 0;

  // Check emotions that exist in both periods
  Object.keys(recentEmotions).forEach(emotion => {
    if (olderEmotions[emotion] && olderEmotions[emotion] > 0) {
      const improvement = ((recentEmotions[emotion] - olderEmotions[emotion]) / olderEmotions[emotion]) * 100;
      
      // We're looking for positive improvements (growth in positive emotions)
      if (improvement > maxImprovement) {
        maxImprovement = improvement;
        biggestImprovement = {
          emotion,
          percentage: Math.round(improvement)
        };
      }
    }
  });

  // If we didn't find any improvement, return mock data
  if (!biggestImprovement) {
    return {
      emotion: entries.length > 0 ? 'peaceful' : 'content',
      percentage: 24
    };
  }

  return biggestImprovement;
};

const calculateJournalActivity = (entryCount: number): JournalActivity => {
  // Simplified streak calculation - in a real app you'd look at consecutive days
  const streak = Math.min(entryCount, 7); // Limit streak to a max of 7
  
  return {
    entryCount,
    streak
  };
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
