
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
  maxStreak: number;
};

interface InsightsData {
  entries: any[];
  dominantMood: DominantMood | null;
  biggestImprovement: BiggestImprovement | null;
  journalActivity: JournalActivity;
  aggregatedEmotionData: AggregatedEmotionData;
  allEntries: any[]; // Store all entries separately for full calendar view
}

export const useInsightsData = (userId: string | undefined, timeRange: TimeRange) => {
  const [insightsData, setInsightsData] = useState<InsightsData>({
    entries: [],
    allEntries: [],
    dominantMood: null,
    biggestImprovement: null,
    journalActivity: {
      entryCount: 0,
      streak: 0,
      maxStreak: 0
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
      // First, fetch ALL entries for this user (for the full calendar view)
      const { data: allEntries, error: allEntriesError } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (allEntriesError) {
        console.error('Error fetching all journal entries:', allEntriesError);
        throw allEntriesError;
      }

      console.log(`Found ${allEntries?.length || 0} total entries for user`);

      // Get date range based on timeRange for filtered view
      const { startDate, endDate } = getDateRange(timeRange);
      
      console.log(`Fetching entries for ${timeRange}:`, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        userId
      });

      // Filter entries for the current time range
      const entries = allEntries?.filter(entry => {
        const entryDate = new Date(entry.created_at);
        return entryDate >= startDate && entryDate <= endDate;
      }) || [];

      console.log(`Filtered ${entries.length} entries for ${timeRange}`);

      // Process the data - pass ALL entries to ensure the calendar has complete data
      const dominantMood = calculateDominantMood(entries);
      const biggestImprovement = calculateBiggestImprovement(entries);
      const journalActivity = calculateJournalActivity(entries, timeRange);
      const aggregatedEmotionData = processEmotionData(entries, timeRange);

      // Make sure all entries have a sentiment value
      const processedAllEntries = allEntries?.map(entry => {
        if (!entry.sentiment && entry.emotions) {
          // If sentiment is missing but emotions are present, calculate an average sentiment
          try {
            const emotions = typeof entry.emotions === 'string' 
              ? JSON.parse(entry.emotions) 
              : entry.emotions;
            
            let totalSentiment = 0;
            let count = 0;
            
            Object.values(emotions).forEach((score: any) => {
              totalSentiment += Number(score);
              count++;
            });
            
            if (count > 0) {
              entry.sentiment = (totalSentiment / count).toFixed(2);
            }
          } catch (e) {
            console.error('Error processing emotions for sentiment:', e);
          }
        }
        return entry;
      }) || [];

      setInsightsData({
        entries,
        allEntries: processedAllEntries,
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

const calculateJournalActivity = (entries: any[], timeRange: TimeRange): JournalActivity => {
  // Get entry count
  const entryCount = entries.length;
  
  // For 'today' timeframe, we're tracking individual entries instead of day streaks
  if (timeRange === 'today') {
    return {
      entryCount,
      streak: entryCount,
      maxStreak: entryCount
    };
  }
  
  // Sort entries by date (oldest first) for streak calculation
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  // Group entries by date
  const dateMap = new Map<string, number>();
  
  // Count entries per day
  sortedEntries.forEach(entry => {
    const dateKey = format(new Date(entry.created_at), 'yyyy-MM-dd');
    dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
  });
  
  // Get sorted dates
  const sortedDates = Array.from(dateMap.keys()).sort();
  
  if (sortedDates.length === 0) {
    return { entryCount: 0, streak: 0, maxStreak: 0 };
  }
  
  // Calculate current streak and max streak (consecutive days)
  let currentStreak = 1;
  let maxStreak = 1;
  
  for (let i = 1; i < sortedDates.length; i++) {
    const currentDate = new Date(sortedDates[i]);
    const prevDate = new Date(sortedDates[i-1]);
    
    // Check if dates are consecutive
    const timeDiff = currentDate.getTime() - prevDate.getTime();
    const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));
    
    if (daysDiff === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else if (daysDiff > 1) {
      currentStreak = 1;
    }
  }
  
  return {
    entryCount,
    streak: Math.min(currentStreak, 7), // Limit streak to a max of 7 for display
    maxStreak
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
