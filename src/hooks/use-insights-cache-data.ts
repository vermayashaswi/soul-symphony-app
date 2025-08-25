import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import { TimeRange, AggregatedEmotionData, DominantMood, BiggestImprovement, JournalActivity } from './use-insights-data';

interface CachedInsightsData {
  entries: any[];
  allEntries: any[];
  cacheTimestamp: number;
  cacheRange: {
    start: Date;
    end: Date;
  };
}

interface ProcessedInsightsData {
  entries: any[];
  allEntries: any[];
  dominantMood: DominantMood | null;
  biggestImprovement: BiggestImprovement | null;
  journalActivity: JournalActivity;
  aggregatedEmotionData: AggregatedEmotionData;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const PRELOAD_MONTHS = 3;

export const useInsightsCacheData = (
  userId: string | undefined,
  timeRange: TimeRange,
  currentDate?: Date
) => {
  const [cachedData, setCachedData] = useState<CachedInsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate 3-month cache range
  const cacheRange = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(subMonths(now, PRELOAD_MONTHS - 1));
    const end = endOfMonth(now);
    return { start, end };
  }, []);

  // Check if cache is valid
  const isCacheValid = useCallback((cache: CachedInsightsData | null) => {
    if (!cache) return false;
    const now = Date.now();
    const isTimestampValid = (now - cache.cacheTimestamp) < CACHE_DURATION;
    const isRangeValid = cache.cacheRange.start.getTime() === cacheRange.start.getTime() &&
                        cache.cacheRange.end.getTime() === cacheRange.end.getTime();
    return isTimestampValid && isRangeValid;
  }, [cacheRange]);

  // Fetch and cache 3 months of data
  const fetchCachedData = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    // Use existing cache if valid and not forcing refresh
    if (!forceRefresh && isCacheValid(cachedData)) {
      setIsLoading(false);
      return;
    }

    try {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      console.log(`[useInsightsCacheData] Fetching 3-month cache for user ${userId}:`, {
        start: cacheRange.start.toISOString(),
        end: cacheRange.end.toISOString()
      });

      // Fetch all entries for the user (for historical comparison)
      const { data: allEntries, error: allEntriesError } = await supabase
        .from('Journal Entries')
        .select('*')
        // RLS policies automatically filter to user's entries
        .order('created_at', { ascending: false });

      if (allEntriesError) {
        console.error('Error fetching all journal entries:', allEntriesError);
        throw allEntriesError;
      }

      // Filter entries within 3-month cache range
      const cachedEntries = allEntries?.filter(entry => {
        if (!entry.created_at) return false;
        const entryDate = new Date(entry.created_at);
        return isWithinInterval(entryDate, cacheRange);
      }) || [];

      console.log(`[useInsightsCacheData] Cached ${cachedEntries.length} entries out of ${allEntries?.length || 0} total`);

      // Process emotions data for all entries
      const processedAllEntries = allEntries?.map(entry => {
        if (entry.emotions && typeof entry.emotions === 'string') {
          try {
            entry.emotions = JSON.parse(entry.emotions);
          } catch (e) {
            console.error('Error parsing emotions JSON string:', e);
          }
        }

        // Calculate sentiment if missing
        if ((entry.sentiment == null || Number(entry.sentiment) === 0) && entry.emotions) {
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
                
                entry.sentiment = avgSentiment;
              }
            }
          } catch (e) {
            console.error('Error processing emotions for sentiment:', e);
          }
        }
        return entry;
      }) || [];

      const newCachedData: CachedInsightsData = {
        entries: cachedEntries,
        allEntries: processedAllEntries,
        cacheTimestamp: Date.now(),
        cacheRange
      };

      setCachedData(newCachedData);
      console.log(`[useInsightsCacheData] Cache updated successfully`);

    } catch (error) {
      console.error('Error fetching cached insights data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId, cacheRange, isCacheValid, cachedData]);

  // Process cached data for stats cards (uses timeRange and current date only)
  const statsInsightsData = useMemo((): ProcessedInsightsData => {
    if (!cachedData) {
      return {
        entries: [],
        allEntries: [],
        dominantMood: null,
        biggestImprovement: null,
        journalActivity: { entryCount: 0, streak: 0, maxStreak: 0 },
        aggregatedEmotionData: {}
      };
    }

    // For stats cards, always use current date (not navigation date)
    const effectiveBaseDate = new Date(); // Always use current date for stats
    const { startDate, endDate } = getDateRange(timeRange, effectiveBaseDate);

    console.log(`[statsInsightsData] Time range: ${timeRange}, Base date: ${effectiveBaseDate.toISOString()}, Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Filter cached entries for the specific time range
    const filteredEntries = cachedData.entries.filter(entry => {
      if (!entry.created_at) return false;
      const entryDate = new Date(entry.created_at);
      const isInRange = entryDate >= startDate && entryDate <= endDate;
      
      if (!isInRange) {
        console.log(`[statsInsightsData] Entry ${entry.id} created at ${entryDate.toISOString()} is outside range ${startDate.toISOString()} to ${endDate.toISOString()}`);
      }
      
      return isInRange;
    });

    console.log(`[statsInsightsData] Filtered ${filteredEntries.length} entries from ${cachedData.entries.length} cached entries for time range ${timeRange}`);

    return {
      entries: filteredEntries,
      allEntries: cachedData.allEntries,
      dominantMood: calculateDominantMood(filteredEntries),
      biggestImprovement: calculateBiggestImprovement(cachedData.allEntries, filteredEntries, timeRange),
      journalActivity: calculateJournalActivity(filteredEntries, timeRange),
      aggregatedEmotionData: processEmotionData(filteredEntries, timeRange)
    };
  }, [cachedData, timeRange]); // Note: removed currentDate dependency for stats

  // Process cached data for charts (uses timeRange and currentDate for navigation)
  const chartInsightsData = useMemo((): ProcessedInsightsData => {
    if (!cachedData) {
      return {
        entries: [],
        allEntries: [],
        dominantMood: null,
        biggestImprovement: null,
        journalActivity: { entryCount: 0, streak: 0, maxStreak: 0 },
        aggregatedEmotionData: {}
      };
    }

    // For charts, use the navigation date (currentDate)
    const effectiveBaseDate = currentDate || new Date();
    const { startDate, endDate } = getDateRange(timeRange, effectiveBaseDate);

    console.log(`[chartInsightsData] Time range: ${timeRange}, Base date: ${effectiveBaseDate.toISOString()}, Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Filter cached entries for the specific time range
    const filteredEntries = cachedData.entries.filter(entry => {
      if (!entry.created_at) return false;
      const entryDate = new Date(entry.created_at);
      return entryDate >= startDate && entryDate <= endDate;
    });

    console.log(`[chartInsightsData] Filtered ${filteredEntries.length} entries from ${cachedData.entries.length} cached entries for time range ${timeRange}`);

    return {
      entries: filteredEntries,
      allEntries: cachedData.allEntries,
      dominantMood: calculateDominantMood(filteredEntries),
      biggestImprovement: calculateBiggestImprovement(cachedData.allEntries, filteredEntries, timeRange),
      journalActivity: calculateJournalActivity(filteredEntries, timeRange),
      aggregatedEmotionData: processEmotionData(filteredEntries, timeRange)
    };
  }, [cachedData, timeRange, currentDate]); // Charts depend on currentDate

  // Initial cache load
  useEffect(() => {
    fetchCachedData();
  }, [fetchCachedData]);

  // Public refresh function
  const refreshCache = useCallback(() => {
    fetchCachedData(true);
  }, [fetchCachedData]);

  return {
    statsInsightsData,
    chartInsightsData,
    loading: isLoading,
    refreshing: isRefreshing,
    refreshCache,
    isCacheHit: Boolean(cachedData && isCacheValid(cachedData))
  };
};

// Fixed getDateRange function with proper week calculation
const getDateRange = (timeRange: TimeRange, baseDate: Date = new Date()) => {
  let startDate, endDate;
  
  console.log(`[getDateRange] Calculating range for ${timeRange} with base date: ${baseDate.toISOString()}`);
  
  switch (timeRange) {
    case 'today':
      startDate = new Date(baseDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(baseDate);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'week':
      // Use date-fns functions for proper week calculation
      // Start of week (Monday) and end of week (Sunday)
      startDate = startOfWeek(baseDate, { weekStartsOn: 1 }); // Monday = 1
      endDate = endOfWeek(baseDate, { weekStartsOn: 1 });
      
      // Set time boundaries
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'month':
      startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'year':
      startDate = new Date(baseDate.getFullYear(), 0, 1);
      endDate = new Date(baseDate.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    default:
      // Default to week
      startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
      endDate = endOfWeek(baseDate, { weekStartsOn: 1 });
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
  }
  
  console.log(`[getDateRange] ${timeRange} range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  return { startDate, endDate };
};

// ... keep existing code (all the helper functions like calculateDominantMood, calculateBiggestImprovement, etc.)
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
      percentageChange = 100;
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
    emotion: 'Peaceful',
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
