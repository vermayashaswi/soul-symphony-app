import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export type TimeRange = 'today' | 'week' | 'month' | 'year';

export type EmotionDataPoint = {
  date: string;
  value: number;
  emotion: string;
};

export type DailySentimentDataPoint = {
  date: string;
  value: number;
  day: string;
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
  dailySentimentData: DailySentimentDataPoint[];
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
    aggregatedEmotionData: {},
    dailySentimentData: []
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

      const entries = allEntries?.filter(entry => {
        if (!entry.created_at) return false;
        const entryDate = new Date(entry.created_at);
        return entryDate >= startDate && entryDate <= endDate;
      }) || [];

      console.log(`Filtered ${entries.length} entries for ${timeRange}`);

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
      const dailySentimentData = processDailySentimentData(processedEntries, timeRange);

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
        aggregatedEmotionData,
        dailySentimentData
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

const processDailySentimentData = (entries: any[], timeRange: TimeRange): DailySentimentDataPoint[] => {
  console.log('[processDailySentimentData] ========== STARTING DETAILED PROCESSING ==========');
  console.log('[processDailySentimentData] Input parameters:', { 
    timeRange, 
    entryCount: entries.length,
    entries: entries.map(e => ({ 
      id: e.id, 
      created_at: e.created_at, 
      sentiment: e.sentiment,
      emotions: e.emotions ? 'has emotions' : 'no emotions'
    }))
  });

  if (timeRange !== 'month') {
    console.log('[processDailySentimentData] Exiting early - not month view, timeRange:', timeRange);
    return [];
  }

  if (!entries || entries.length === 0) {
    console.log('[processDailySentimentData] Exiting early - no entries provided');
    return [];
  }

  // Group entries by day with detailed logging
  const dailyGroups = new Map<string, any[]>();
  
  entries.forEach((entry, index) => {
    if (!entry.created_at) {
      console.log(`[processDailySentimentData] SKIPPING entry ${index} - missing created_at:`, entry);
      return;
    }
    
    const entryDate = new Date(entry.created_at);
    const dateStr = format(entryDate, 'yyyy-MM-dd');
    
    console.log(`[processDailySentimentData] Processing entry ${index}:`, {
      entryId: entry.id,
      created_at: entry.created_at,
      entryDate: entryDate.toISOString(),
      dateStr,
      sentiment: entry.sentiment,
      hasEmotions: !!entry.emotions,
      emotionsType: typeof entry.emotions
    });
    
    if (!dailyGroups.has(dateStr)) {
      dailyGroups.set(dateStr, []);
      console.log(`[processDailySentimentData] Created new day group for: ${dateStr}`);
    }
    dailyGroups.get(dateStr)!.push(entry);
    console.log(`[processDailySentimentData] Added entry to day ${dateStr}, group size now: ${dailyGroups.get(dateStr)!.length}`);
  });

  console.log('[processDailySentimentData] ========== DAILY GROUPS SUMMARY ==========');
  console.log('[processDailySentimentData] Total unique days:', dailyGroups.size);
  console.log('[processDailySentimentData] All dates found:', Array.from(dailyGroups.keys()).sort());
  
  Array.from(dailyGroups.entries()).forEach(([date, dayEntries]) => {
    console.log(`[processDailySentimentData] Day ${date}: ${dayEntries.length} entries`, {
      entryIds: dayEntries.map(e => e.id),
      sentiments: dayEntries.map(e => e.sentiment)
    });
  });

  // Calculate average sentiment for each day with enhanced debugging
  const dailySentimentData: DailySentimentDataPoint[] = [];
  
  Array.from(dailyGroups.entries())
    .sort(([a], [b]) => a.localeCompare(b)) // Sort by date chronologically
    .forEach(([dateStr, dayEntries]) => {
      console.log(`[processDailySentimentData] ========== PROCESSING DAY: ${dateStr} ==========`);
      console.log(`[processDailySentimentData] Day entries count: ${dayEntries.length}`);

      let totalSentiment = 0;
      let sentimentCount = 0;

      dayEntries.forEach((entry, entryIndex) => {
        console.log(`[processDailySentimentData] Processing entry ${entryIndex + 1}/${dayEntries.length} for day ${dateStr}:`, {
          entryId: entry.id,
          existingSentiment: entry.sentiment,
          sentimentType: typeof entry.sentiment,
          hasEmotions: !!entry.emotions
        });

        // Use existing sentiment if available and valid
        if (entry.sentiment && entry.sentiment !== '0' && entry.sentiment !== 0) {
          const sentimentValue = parseFloat(entry.sentiment);
          if (!isNaN(sentimentValue)) {
            totalSentiment += sentimentValue;
            sentimentCount++;
            console.log(`[processDailySentimentData] ✓ Used existing sentiment for entry ${entry.id}:`, {
              sentimentValue,
              runningTotal: totalSentiment,
              count: sentimentCount
            });
            return;
          } else {
            console.log(`[processDailySentimentData] ✗ Invalid sentiment value for entry ${entry.id}:`, entry.sentiment);
          }
        }

        // Calculate sentiment from emotions if not available
        if (entry.emotions) {
          console.log(`[processDailySentimentData] Calculating sentiment from emotions for entry ${entry.id}`);
          try {
            let emotions: any = entry.emotions;
            if (typeof emotions === 'string') {
              emotions = JSON.parse(emotions);
              console.log(`[processDailySentimentData] Parsed emotions string for entry ${entry.id}`);
            }

            let entrySentiment = 0;
            let emotionCount = 0;

            if (emotions && typeof emotions === 'object') {
              if (Array.isArray(emotions.emotions)) {
                console.log(`[processDailySentimentData] Processing emotions array for entry ${entry.id}, count: ${emotions.emotions.length}`);
                emotions.emotions.forEach((emotion: any, idx: number) => {
                  if (emotion && emotion.name && emotion.intensity) {
                    const negativeEmotions = ['sad', 'angry', 'anxious', 'fearful', 'stressed', 'disappointed', 'frustrated'];
                    const emotionName = emotion.name.toLowerCase();
                    const multiplier = negativeEmotions.includes(emotionName) ? -1 : 1;
                    entrySentiment += emotion.intensity * multiplier;
                    emotionCount++;
                    console.log(`[processDailySentimentData] Emotion ${idx}: ${emotion.name} (${emotion.intensity}) * ${multiplier} = ${emotion.intensity * multiplier}`);
                  }
                });
              } else {
                console.log(`[processDailySentimentData] Processing emotions object for entry ${entry.id}`);
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
                    entrySentiment += emotionValue * multiplier;
                    emotionCount++;
                    console.log(`[processDailySentimentData] Emotion: ${emotion} (${emotionValue}) * ${multiplier} = ${emotionValue * multiplier}`);
                  }
                });
              }

              if (emotionCount > 0) {
                let avgSentiment = entrySentiment / (emotionCount * 2); // Normalize to -1 to 1 range
                if (avgSentiment > 1.0) avgSentiment = 1.0;
                if (avgSentiment < -1.0) avgSentiment = -1.0;
                
                totalSentiment += avgSentiment;
                sentimentCount++;
                
                console.log(`[processDailySentimentData] ✓ Calculated sentiment from emotions for entry ${entry.id}:`, {
                  emotionCount,
                  rawSentiment: entrySentiment,
                  avgSentiment,
                  runningTotal: totalSentiment,
                  count: sentimentCount
                });
              } else {
                console.log(`[processDailySentimentData] ✗ No valid emotions found for entry ${entry.id}`);
              }
            } else {
              console.log(`[processDailySentimentData] ✗ Invalid emotions object for entry ${entry.id}:`, emotions);
            }
          } catch (e) {
            console.error(`[processDailySentimentData] ✗ Error processing emotions for entry ${entry.id}:`, e);
          }
        } else {
          console.log(`[processDailySentimentData] ✗ Entry ${entry.id} has no emotions data`);
        }
      });

      console.log(`[processDailySentimentData] Day ${dateStr} summary:`, {
        totalSentiment,
        sentimentCount,
        willCreateDataPoint: sentimentCount > 0
      });

      if (sentimentCount > 0) {
        const avgDailySentiment = totalSentiment / sentimentCount;
        const dayFormatted = format(new Date(dateStr), 'MMM d');
        
        const dataPoint = {
          date: dateStr,
          value: parseFloat(avgDailySentiment.toFixed(3)),
          day: dayFormatted
        };
        
        dailySentimentData.push(dataPoint);

        console.log(`[processDailySentimentData] ✓ CREATED DATA POINT for ${dayFormatted}:`, {
          originalDate: dateStr,
          formattedDay: dayFormatted,
          avgDailySentiment,
          finalValue: dataPoint.value,
          sentimentCount,
          totalDataPointsNow: dailySentimentData.length
        });
      } else {
        console.log(`[processDailySentimentData] ✗ NO DATA POINT created for day ${dateStr} - no valid sentiment data`);
      }
    });

  console.log('[processDailySentimentData] ========== FINAL RESULTS ==========');
  console.log('[processDailySentimentData] Total data points created:', dailySentimentData.length);
  console.log('[processDailySentimentData] All data points:', dailySentimentData.map(dp => ({
    date: dp.date,
    day: dp.day,
    value: dp.value
  })));

  // Sort by date to ensure chronological order
  const sortedData = dailySentimentData.sort((a, b) => a.date.localeCompare(b.date));
  console.log('[processDailySentimentData] Final sorted data:', sortedData);

  return sortedData;
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
