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
  allEntries: any[]; // Store all entries separately for full calendar view
  dominantMood: DominantMood | null;
  biggestImprovement: BiggestImprovement | null;
  journalActivity: JournalActivity;
  aggregatedEmotionData: AggregatedEmotionData;
}

export const useInsightsData = (
  userId: string | undefined,
  timeRange: TimeRange,
  currentDate?: Date
) => {
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

  const getDateRange = (timeRange: TimeRange, baseDate: Date = new Date()) => {
    let startDate, endDate;
    switch (timeRange) {
      case 'today':
        startDate = startOfDay(baseDate);
        endDate = endOfDay(baseDate);
        break;
      case 'week':
        startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
        endDate = endOfWeek(baseDate, { weekStartsOn: 1 });
        break;
      case 'month':
        startDate = startOfMonth(baseDate);
        endDate = endOfMonth(baseDate);
        break;
      case 'year':
        startDate = startOfYear(baseDate);
        endDate = endOfYear(baseDate);
        break;
      default:
        startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
        endDate = endOfWeek(baseDate, { weekStartsOn: 1 });
    }
    return { startDate, endDate };
  };

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
        // RLS policies automatically filter to user's entries
        .order('created_at', { ascending: false });

      if (allEntriesError) {
        console.error('Error fetching all journal entries:', allEntriesError);
        throw allEntriesError;
      }

      console.log(`Found ${allEntries?.length || 0} total entries for user`);
      console.log('Sample entry data:', allEntries?.[0] || 'No entries found');

      const effectiveBaseDate = currentDate || new Date();
      const { startDate, endDate } = getDateRange(timeRange, effectiveBaseDate);
      
      console.log(`Fetching entries for ${timeRange}:`, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        currentDate: effectiveBaseDate.toISOString(),
        userId
      });

      const entries = allEntries?.filter(entry => {
        if (!entry.created_at) return false;
        const entryDate = new Date(entry.created_at);
        return entryDate >= startDate && entryDate <= endDate;
      }) || [];

      console.log(`Filtered ${entries.length} entries for ${timeRange} with currentDate ${effectiveBaseDate.toISOString()}`);

      const processedEntries = entries.map(entry => {
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

      const processedAllEntries = allEntries?.map(entry => {
        if ((!entry.sentiment || entry.sentiment === '0') && entry.emotions) {
          try {
            const emotions = typeof entry.emotions === 'string' 
              ? JSON.parse(entry.emotions) 
              : entry.emotions;
            
            if (emotions && typeof emotions === 'object') {
              let totalSentiment = 0;
              let count = 0;
              
              if (Array.isArray(emotions.emotions)) {
                emotions.emotions.forEach((emotion: any) => {
                  if (emotion && emotion.name && emotion.intensity) {
                    const negativeEmotions = ['sad', 'angry', 'anxious', 'fearful', 'stressed', 'disappointed', 'frustrated'];
                    const emotionName = emotion.name.toLowerCase();
                    const multiplier = negativeEmotions.includes(emotionName) ? -1 : 1;
                    totalSentiment += emotion.intensity * multiplier;
                    count++;
                  }
                });
              } else {
                Object.entries(emotions).forEach(([emotion, score]: [string, any]) => {
                  if (emotion.toLowerCase() === 'id' || 
                      emotion.toLowerCase() === 'intensity' || 
                      emotion.toLowerCase() === 'name' ||
                      /^\d+$/.test(emotion) || 
                      emotion.length < 2) {
                    return;
                  }
                  
                  const emotionValue = Number(score);
                  if (!isNaN(emotionValue)) {
                    const negativeEmotions = ['sad', 'angry', 'anxious', 'fearful', 'stressed', 'disappointed', 'frustrated'];
                    const multiplier = negativeEmotions.includes(emotion.toLowerCase()) ? -1 : 1;
                    totalSentiment += emotionValue * multiplier;
                    count++;
                  }
                });
              }
              
              if (count > 0) {
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
  }, [userId, timeRange, currentDate]);

  useEffect(() => {
    if (timeRange !== lastTimeRange) {
      console.log(`[useInsightsData] TimeRange changed from ${lastTimeRange} to ${timeRange}, refetching data`);
      setLastTimeRange(timeRange);
    }
    
    fetchInsightsData();
  }, [userId, timeRange, currentDate, fetchInsightsData]);

  return { insightsData, loading };
};

const calculateDominantMood = (entries: any[]): DominantMood | null => {
  if (!entries || entries.length === 0) return null;

  const emotionCounts: Record<string, { count: number; score: number }> = {};
  
  entries.forEach(entry => {
    if (entry.emotions) {
      try {
        let processedEmotions: Record<string, number> = {};
        
        if (typeof entry.emotions === 'string') {
          const parsed = JSON.parse(entry.emotions);
          if (Array.isArray(parsed.emotions)) {
            const topEmotions = parsed.emotions
              .sort((a: any, b: any) => b.intensity - a.intensity)
              .slice(0, 5);
            
            topEmotions.forEach((emotion: any) => {
              if (emotion && emotion.name && emotion.intensity) {
                processedEmotions[emotion.name.toLowerCase()] = emotion.intensity;
              }
            });
          } else {
            processedEmotions = parsed;
          }
        } else if (entry.emotions && typeof entry.emotions === 'object') {
          if (Array.isArray(entry.emotions.emotions)) {
            const topEmotions = entry.emotions.emotions
              .sort((a: any, b: any) => b.intensity - a.intensity)
              .slice(0, 5);
            
            topEmotions.forEach((emotion: any) => {
              if (emotion && emotion.name && emotion.intensity) {
                processedEmotions[emotion.name.toLowerCase()] = emotion.intensity;
              }
            });
          } else {
            processedEmotions = entry.emotions;
          }
        }

        Object.entries(processedEmotions).forEach(([emotion, score]) => {
          const emotionKey = emotion.toLowerCase();
          if (!emotionCounts[emotionKey]) {
            emotionCounts[emotionKey] = { count: 0, score: 0 };
          }
          emotionCounts[emotionKey].count += 1;
          emotionCounts[emotionKey].score += Number(score);
        });
      } catch (e) {
        console.error('Error processing emotions:', e);
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
    satisfaction: '😌',
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
  
  const currentEntries = [...timeRangeEntries].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  const earliestTimeRangeDate = new Date(
    Math.min(...timeRangeEntries.map(entry => new Date(entry.created_at).getTime()))
  );
  
  const previousEntries = allEntries.filter(entry => 
    new Date(entry.created_at) < earliestTimeRangeDate
  );
  
  if (previousEntries.length === 0) {
    if (currentEntries.length < 4) {
      return {
        emotion: currentEntries.length > 0 ? 'Peaceful' : 'Content',
        percentage: 24
      };
    }
    
    const midpoint = Math.floor(currentEntries.length / 2);
    const firstHalf = currentEntries.slice(0, midpoint);
    const secondHalf = currentEntries.slice(midpoint);
    
    return calculateEmotionChanges(firstHalf, secondHalf);
  }
  
  return calculateEmotionChanges(previousEntries, currentEntries);
};

function calculateEmotionChanges(previousEntries: any[], currentEntries: any[]): BiggestImprovement {
  const previousEmotions: Record<string, { total: number, count: number }> = {};
  const currentEmotions: Record<string, { total: number, count: number }> = {};
  
  for (const entry of previousEntries) {
    if (entry.emotions) {
      try {
        const emotions = typeof entry.emotions === 'string' 
          ? JSON.parse(entry.emotions) 
          : entry.emotions;
        
        processEmotionsForEntry(emotions, previousEmotions);
      } catch (e) {
        console.error('Error parsing emotions for previous entries:', e);
      }
    }
  }
  
  for (const entry of currentEntries) {
    if (entry.emotions) {
      try {
        const emotions = typeof entry.emotions === 'string' 
          ? JSON.parse(entry.emotions) 
          : entry.emotions;
        
        processEmotionsForEntry(emotions, currentEmotions);
      } catch (e) {
        console.error('Error parsing emotions for current entries:', e);
      }
    }
  }
  
  const emotionChanges: Array<{emotion: string, percentage: number}> = [];
  
  Object.keys({...previousEmotions, ...currentEmotions}).forEach(emotion => {
    const prevAvg = previousEmotions[emotion] 
      ? previousEmotions[emotion].total / previousEmotions[emotion].count 
      : 0;
    
    const currAvg = currentEmotions[emotion] 
      ? currentEmotions[emotion].total / currentEmotions[emotion].count 
      : 0;
    
    if (prevAvg === 0 && currAvg === 0) return;
    
    let percentageChange = 0;
    if (prevAvg === 0 && currAvg > 0) {
      percentageChange = 100; // New emotion appeared
    } else if (prevAvg > 0) {
      percentageChange = ((currAvg - prevAvg) / prevAvg) * 100;
    }
    
    const displayEmotion = emotion.charAt(0).toUpperCase() + emotion.slice(1);
    
    emotionChanges.push({
      emotion: displayEmotion,
      percentage: Math.round(percentageChange)
    });
  });
  
  emotionChanges.sort((a, b) => Math.abs(b.percentage) - Math.abs(a.percentage));
  
  if (emotionChanges.length > 0) {
    return emotionChanges[0];
  }
  
  return {
    emotion: currentEntries.length > 0 ? 'Peaceful' : 'Content',
    percentage: 24
  };
}

function processEmotionsForEntry(emotions: any, emotionMap: Record<string, { total: number, count: number }>) {
  if (!emotions || typeof emotions !== 'object') return;
  
  if (Array.isArray(emotions.emotions)) {
    emotions.emotions.forEach((emotion: any) => {
      if (emotion && emotion.name && emotion.intensity) {
        const emotionKey = emotion.name.toLowerCase();
        if (!emotionMap[emotionKey]) {
          emotionMap[emotionKey] = { total: 0, count: 0 };
        }
        emotionMap[emotionKey].total += emotion.intensity;
        emotionMap[emotionKey].count += 1;
      }
    });
    return;
  }
  
  Object.entries(emotions).forEach(([emotion, score]) => {
    if (emotion.toLowerCase() === 'id' || 
        emotion.toLowerCase() === 'intensity' || 
        emotion.toLowerCase() === 'name' ||
        /^\d+$/.test(emotion) || 
        emotion.length < 2) {
      return;
    }
    
    const emotionValue = Number(score);
    if (!isNaN(emotionValue)) {
      const emotionKey = emotion.toLowerCase();
      if (!emotionMap[emotionKey]) {
        emotionMap[emotionKey] = { total: 0, count: 0 };
      }
      emotionMap[emotionKey].total += emotionValue;
      emotionMap[emotionKey].count += 1;
    }
  });
}

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
        let processedEmotions: Record<string, number> = {};
        
        if (typeof entry.emotions === 'string') {
          const parsed = JSON.parse(entry.emotions);
          if (Array.isArray(parsed.emotions)) {
            const topEmotions = parsed.emotions
              .sort((a: any, b: any) => b.intensity - a.intensity)
              .slice(0, 5);
            
            topEmotions.forEach((emotion: any) => {
              if (emotion && emotion.name && emotion.intensity) {
                processedEmotions[emotion.name.toLowerCase()] = emotion.intensity;
              }
            });
          } else {
            processedEmotions = parsed;
          }
        } else if (entry.emotions && typeof entry.emotions === 'object') {
          if (Array.isArray(entry.emotions.emotions)) {
            const topEmotions = entry.emotions.emotions
              .sort((a: any, b: any) => b.intensity - a.intensity)
              .slice(0, 5);
            
            topEmotions.forEach((emotion: any) => {
              if (emotion && emotion.name && emotion.intensity) {
                processedEmotions[emotion.name.toLowerCase()] = emotion.intensity;
              }
            });
          } else {
            processedEmotions = entry.emotions;
          }
        }

        Object.entries(processedEmotions).forEach(([emotion, score]) => {
          const emotionKey = emotion.charAt(0).toUpperCase() + emotion.slice(1);
          
          if (!emotionData[emotionKey]) {
            emotionData[emotionKey] = [];
          }
          
          if (!emotionCounts.has(dateStr)) {
            emotionCounts.set(dateStr, new Map());
          }
          const dateEmotionCounts = emotionCounts.get(dateStr)!;
          if (!dateEmotionCounts.has(emotionKey)) {
            dateEmotionCounts.set(emotionKey, 0);
          }
          dateEmotionCounts.set(emotionKey, dateEmotionCounts.get(emotionKey)! + 1);
          
          const existingPoint = emotionData[emotionKey].find(point => point.date === dateStr);
          
          if (existingPoint) {
            existingPoint.value += Number(score);
          } else {
            emotionData[emotionKey].push({
              date: dateStr,
              value: Number(score),
              emotion: emotionKey
            });
          }
        });
      } catch (e) {
        console.error('Error processing emotions:', e);
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
