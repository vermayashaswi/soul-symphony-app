
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

  const fetchInsightsData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
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
      console.log('Sample entry data:', allEntries?.[0] || 'No entries found');

      const { startDate, endDate } = getDateRange(timeRange);
      
      console.log(`Fetching entries for ${timeRange}:`, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        userId
      });

      // Fix: Proper date filtering for entries
      const entries = allEntries?.filter(entry => {
        if (!entry.created_at) return false;
        const entryDate = new Date(entry.created_at);
        return entryDate >= startDate && entryDate <= endDate;
      }) || [];

      console.log(`Filtered ${entries.length} entries for ${timeRange}`);

      const processedEntries = entries.map(entry => {
        // Process emotions data
        if (entry.emotions && typeof entry.emotions === 'string') {
          try {
            entry.emotions = JSON.parse(entry.emotions);
          } catch (e) {
            console.error('Error parsing emotions JSON string:', e);
          }
        }
        return entry;
      });

      const dominantMood = calculateDominantMood(processedEntries);
      const biggestImprovement = calculateBiggestImprovement(allEntries, processedEntries, timeRange);
      const journalActivity = calculateJournalActivity(processedEntries, timeRange);
      const aggregatedEmotionData = processEmotionData(processedEntries, timeRange);

      // Process all entries for sentiment data
      const processedAllEntries = allEntries?.map(entry => {
        // If sentiment is missing but emotions exist, calculate it
        if ((!entry.sentiment || entry.sentiment === '0') && entry.emotions) {
          try {
            const emotions = typeof entry.emotions === 'string' 
              ? JSON.parse(entry.emotions) 
              : entry.emotions;
            
            if (emotions && typeof emotions === 'object') {
              let totalSentiment = 0;
              let count = 0;
              
              Object.entries(emotions).forEach(([emotion, score]: [string, any]) => {
                // Convert positive emotions to positive values, negative emotions to negative values
                const emotionValue = Number(score);
                if (!isNaN(emotionValue)) {
                  // Map certain emotions to negative sentiment values
                  const negativeEmotions = ['sad', 'angry', 'anxious', 'fearful', 'stressed', 'disappointed', 'frustrated'];
                  const multiplier = negativeEmotions.includes(emotion.toLowerCase()) ? -1 : 1;
                  totalSentiment += emotionValue * multiplier;
                  count++;
                }
              });
              
              if (count > 0) {
                // Normalize to range between -1 and 1
                let avgSentiment = totalSentiment / (count * 2);
                if (avgSentiment > 1.0) avgSentiment = 1.0;
                if (avgSentiment < -1.0) avgSentiment = -1.0;
                
                entry.sentiment = avgSentiment.toString();
                console.log(`Calculated sentiment for entry ${entry.id}: ${entry.sentiment}`);
              }
            }
          } catch (e) {
            console.error('Error processing emotions for sentiment:', e);
          }
        }
        return entry;
      }) || [];

      setInsightsData({
        entries: processedEntries,
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
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      break;
    case 'week':
      startDate = startOfWeek(now, { weekStartsOn: 1 }); // Monday as week start
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

const calculateDominantMood = (entries: any[]): DominantMood | null => {
  if (!entries || entries.length === 0) return null;

  const emotionCounts: Record<string, { count: number; score: number }> = {};
  
  entries.forEach(entry => {
    if (entry.emotions) {
      try {
        const emotions = typeof entry.emotions === 'string' 
          ? JSON.parse(entry.emotions) 
          : entry.emotions;
        
        if (emotions && typeof emotions === 'object') {
          Object.entries(emotions).forEach(([emotion, score]) => {
            // Important: Normalize the emotion key to handle different formats
            // Convert keys like "id" to proper emotion names
            const emotionKey = emotion.toLowerCase();
            
            // Skip if emotion is literally "id" or looks like an ID (number or very short)
            if (emotionKey === 'id' || /^\d+$/.test(emotionKey) || emotionKey.length < 2) {
              console.log('Skipping invalid emotion key:', emotion);
              return;
            }
            
            if (!emotionCounts[emotionKey]) {
              emotionCounts[emotionKey] = { count: 0, score: 0 };
            }
            emotionCounts[emotionKey].count += 1;
            emotionCounts[emotionKey].score += Number(score);
          });
        }
      } catch (e) {
        console.error('Error parsing emotions:', e);
      }
    }
  });

  let dominantEmotion = '';
  let highestScore = 0;

  Object.entries(emotionCounts).forEach(([emotion, data]) => {
    if (data.score > highestScore) {
      dominantEmotion = emotion;
      highestScore = data.score;
    }
  });

  if (!dominantEmotion) return null;

  // Capitalize the first letter of the emotion for display
  dominantEmotion = dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1);

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

const calculateBiggestImprovement = (allEntries: any[], timeRangeEntries: any[], timeRange: TimeRange): BiggestImprovement | null => {
  if (!allEntries || allEntries.length === 0 || !timeRangeEntries || timeRangeEntries.length === 0) {
    return null;
  }
  
  const sortedEntries = [...allEntries].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  const initialEmotionValues: Record<string, number> = {};
  
  const currentEmotionAverages: Record<string, { total: number, count: number }> = {};
  
  for (const entry of sortedEntries) {
    if (entry.emotions) {
      try {
        const emotions = typeof entry.emotions === 'string' 
          ? JSON.parse(entry.emotions) 
          : entry.emotions;
        
        if (emotions && typeof emotions === 'object') {
          Object.entries(emotions).forEach(([emotion, score]) => {
            // Normalize emotion key and skip IDs
            const emotionKey = emotion.toLowerCase();
            if (emotionKey === 'id' || /^\d+$/.test(emotionKey) || emotionKey.length < 2) {
              return;
            }
            
            if (!(emotionKey in initialEmotionValues)) {
              initialEmotionValues[emotionKey] = Number(score);
            }
          });
        }
      } catch (e) {
        console.error('Error parsing emotions for initial values:', e);
      }
    }
  }
  
  for (const entry of timeRangeEntries) {
    if (entry.emotions) {
      try {
        const emotions = typeof entry.emotions === 'string' 
          ? JSON.parse(entry.emotions) 
          : entry.emotions;
        
        if (emotions && typeof emotions === 'object') {
          Object.entries(emotions).forEach(([emotion, score]) => {
            // Normalize emotion key and skip IDs
            const emotionKey = emotion.toLowerCase();
            if (emotionKey === 'id' || /^\d+$/.test(emotionKey) || emotionKey.length < 2) {
              return;
            }
            
            if (!currentEmotionAverages[emotionKey]) {
              currentEmotionAverages[emotionKey] = { total: 0, count: 0 };
            }
            currentEmotionAverages[emotionKey].total += Number(score);
            currentEmotionAverages[emotionKey].count += 1;
          });
        }
      } catch (e) {
        console.error('Error parsing emotions for current averages:', e);
      }
    }
  }
  
  const emotionChanges: Array<{emotion: string, percentage: number}> = [];
  
  Object.keys(initialEmotionValues).forEach(emotion => {
    if (currentEmotionAverages[emotion] && currentEmotionAverages[emotion].count > 0) {
      const initialValue = initialEmotionValues[emotion];
      const currentAverage = currentEmotionAverages[emotion].total / currentEmotionAverages[emotion].count;
      
      if (initialValue === 0) return;
      
      const percentageChange = ((currentAverage - initialValue) / initialValue) * 100;
      
      // Capitalize the first letter of the emotion for display
      const displayEmotion = emotion.charAt(0).toUpperCase() + emotion.slice(1);
      
      emotionChanges.push({
        emotion: displayEmotion,
        percentage: Math.round(percentageChange)
      });
    }
  });
  
  emotionChanges.sort((a, b) => Math.abs(b.percentage) - Math.abs(a.percentage));
  
  if (emotionChanges.length > 0) {
    return emotionChanges[0];
  }
  
  console.log('No emotion changes found, returning default');
  
  // Default values with proper capitalization
  return {
    emotion: timeRangeEntries.length > 0 ? 'Peaceful' : 'Content',
    percentage: 24
  };
};

const calculateJournalActivity = (entries: any[], timeRange: TimeRange): JournalActivity => {
  const entryCount = entries.length;
  
  if (timeRange === 'today') {
    return {
      entryCount,
      streak: entryCount,
      maxStreak: entryCount
    };
  }
  
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  const dateMap = new Map<string, number>();
  
  sortedEntries.forEach(entry => {
    const dateKey = format(new Date(entry.created_at), 'yyyy-MM-dd');
    dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
  });
  
  const sortedDates = Array.from(dateMap.keys()).sort();
  
  if (sortedDates.length === 0) {
    return { entryCount: 0, streak: 0, maxStreak: 0 };
  }
  
  let currentStreak = 1;
  let maxStreak = 1;
  
  for (let i = 1; i < sortedDates.length; i++) {
    const currentDate = new Date(sortedDates[i]);
    const prevDate = new Date(sortedDates[i-1]);
    
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
    streak: Math.min(currentStreak, 7),
    maxStreak
  };
};

const processEmotionData = (entries: any[], timeRange: TimeRange): AggregatedEmotionData => {
  const emotionData: AggregatedEmotionData = {};
  
  const emotionCounts = new Map<string, Map<string, number>>();
  
  entries.forEach(entry => {
    const dateStr = format(new Date(entry.created_at), 'yyyy-MM-dd');
    
    if (entry.emotions) {
      try {
        const emotions = typeof entry.emotions === 'string' 
          ? JSON.parse(entry.emotions) 
          : entry.emotions;
        
        if (emotions && typeof emotions === 'object') {
          Object.entries(emotions).forEach(([emotion, score]) => {
            // Normalize emotion key and skip IDs
            const emotionKey = emotion.toLowerCase();
            if (emotionKey === 'id' || /^\d+$/.test(emotionKey) || emotionKey.length < 2) {
              return;
            }
            
            // Use normalized key but capitalize first letter for display
            const displayEmotion = emotionKey.charAt(0).toUpperCase() + emotionKey.slice(1);
            
            if (!emotionData[displayEmotion]) {
              emotionData[displayEmotion] = [];
            }
            
            if (!emotionCounts.has(dateStr)) {
              emotionCounts.set(dateStr, new Map());
            }
            const dateEmotionCounts = emotionCounts.get(dateStr)!;
            if (!dateEmotionCounts.has(displayEmotion)) {
              dateEmotionCounts.set(displayEmotion, 0);
            }
            dateEmotionCounts.set(displayEmotion, dateEmotionCounts.get(displayEmotion)! + 1);
            
            const existingPoint = emotionData[displayEmotion].find(point => point.date === dateStr);
            
            if (existingPoint) {
              existingPoint.value += Number(score);
            } else {
              emotionData[displayEmotion].push({
                date: dateStr,
                value: Number(score),
                emotion: displayEmotion
              });
            }
          });
        }
      } catch (e) {
        console.error('Error parsing emotions:', e);
      }
    }
  });
  
  Object.entries(emotionData).forEach(([emotion, dataPoints]) => {
    dataPoints.forEach(point => {
      const dateEmotionCounts = emotionCounts.get(point.date);
      if (dateEmotionCounts && dateEmotionCounts.has(emotion)) {
        const count = dateEmotionCounts.get(emotion)!;
        if (count > 1) {
          point.value = point.value / count;
          if (point.value > 1.0) point.value = 1.0;
        }
      }
    });
  });
  
  return emotionData;
};
