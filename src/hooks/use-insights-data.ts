
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, subDays } from 'date-fns';
import { toast } from 'sonner';
import { JournalEntry } from '@/components/journal/JournalEntryCard';

export type TimeRange = 'today' | 'week' | 'month' | 'year';

export type InsightsData = {
  entries: JournalEntry[];
  dominantMood: {
    emotion: string;
    score: number;
    emoji: string;
  } | null;
  biggestImprovement: {
    emotion: string;
    percentage: number;
  } | null;
  journalActivity: {
    entryCount: number;
    streak: number;
  };
  aggregatedEmotionData: Array<{
    date: string;
    emotions: { [key: string]: number };
  }>;
};

// Emoji mapping for emotions
const EMOTION_EMOJIS: Record<string, string> = {
  joy: '😊',
  happiness: '😄',
  gratitude: '🙏',
  calm: '😌',
  peace: '☮️',
  anxiety: '😰',
  sadness: '😢',
  anger: '😠',
  fear: '😨',
  excitement: '🤩',
  love: '❤️',
  stress: '😓',
  surprise: '😲',
  confusion: '😕',
  disappointment: '😞',
  pride: '🦚',
  shame: '😳',
  guilt: '😔',
  hope: '🌈',
  boredom: '😑',
  disgust: '🤢',
  contentment: '😊'
};

export function useInsightsData(userId: string | undefined, timeRange: TimeRange) {
  const [loading, setLoading] = useState(true);
  const [insightsData, setInsightsData] = useState<InsightsData>({
    entries: [],
    dominantMood: null,
    biggestImprovement: null,
    journalActivity: {
      entryCount: 0,
      streak: 0
    },
    aggregatedEmotionData: []
  });

  useEffect(() => {
    if (userId) {
      fetchInsightsData(timeRange);
    }
  }, [userId, timeRange]);

  const getDateRangeFilter = (range: TimeRange) => {
    const now = new Date();
    
    switch (range) {
      case 'today':
        return startOfDay(now).toISOString();
      case 'week':
        return startOfWeek(now, { weekStartsOn: 1 }).toISOString(); // Start week on Monday
      case 'month':
        return startOfMonth(now).toISOString();
      case 'year':
        return startOfYear(now).toISOString();
      default:
        return startOfWeek(now, { weekStartsOn: 1 }).toISOString();
    }
  };

  const fetchInsightsData = async (range: TimeRange) => {
    try {
      setLoading(true);
      const startDate = getDateRangeFilter(range);
      
      // Fetch entries for the selected time range
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching entries:', error);
        toast.error('Failed to load insights data');
        throw error;
      }
      
      if (!entries || entries.length === 0) {
        setInsightsData({
          entries: [],
          dominantMood: null,
          biggestImprovement: null,
          journalActivity: {
            entryCount: 0,
            streak: 0
          },
          aggregatedEmotionData: []
        });
        setLoading(false);
        return;
      }

      // Get additional data for comparison (previous period)
      const previousStartDate = getDateRangeFilter(range);
      const previousEndDate = startDate;
      
      const { data: previousEntries } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', userId)
        .lt('created_at', previousStartDate)
        .gte('created_at', previousEndDate)
        .order('created_at', { ascending: false });
      
      // Process entries to determine insights
      const typedEntries = entries as JournalEntry[];
      const typedPreviousEntries = (previousEntries || []) as JournalEntry[];
      
      // Calculate dominant mood
      const dominantMood = calculateDominantMood(typedEntries);
      
      // Calculate biggest improvement
      const biggestImprovement = calculateBiggestImprovement(typedEntries, typedPreviousEntries);
      
      // Calculate journal activity
      const journalActivity = calculateJournalActivity(typedEntries, userId);
      
      // Prepare aggregated emotion data for charts
      const aggregatedEmotionData = prepareEmotionData(typedEntries);
      
      setInsightsData({
        entries: typedEntries,
        dominantMood,
        biggestImprovement,
        journalActivity,
        aggregatedEmotionData
      });
      
    } catch (error) {
      console.error('Error processing insights data:', error);
      toast.error('Failed to process insights data');
    } finally {
      setLoading(false);
    }
  };

  const calculateDominantMood = (entries: JournalEntry[]) => {
    if (entries.length === 0) return null;
    
    // Aggregate emotions across all entries
    const emotionScores: Record<string, number> = {};
    let totalEntries = 0;
    
    entries.forEach(entry => {
      if (entry.emotions) {
        totalEntries++;
        Object.entries(entry.emotions).forEach(([emotion, score]) => {
          emotionScores[emotion] = (emotionScores[emotion] || 0) + score;
        });
      }
    });
    
    if (totalEntries === 0) return null;
    
    // Find the dominant emotion
    let dominantEmotion = '';
    let highestScore = 0;
    
    Object.entries(emotionScores).forEach(([emotion, score]) => {
      const avgScore = score / totalEntries;
      if (avgScore > highestScore) {
        highestScore = avgScore;
        dominantEmotion = emotion;
      }
    });
    
    if (!dominantEmotion) return null;
    
    return {
      emotion: dominantEmotion,
      score: highestScore,
      emoji: EMOTION_EMOJIS[dominantEmotion.toLowerCase()] || '😊'
    };
  };

  const calculateBiggestImprovement = (
    currentEntries: JournalEntry[],
    previousEntries: JournalEntry[]
  ) => {
    if (currentEntries.length === 0 || previousEntries.length === 0) return null;
    
    // Calculate average scores for each emotion in current period
    const currentEmotions: Record<string, { total: number, count: number }> = {};
    
    currentEntries.forEach(entry => {
      if (entry.emotions) {
        Object.entries(entry.emotions).forEach(([emotion, score]) => {
          if (!currentEmotions[emotion]) {
            currentEmotions[emotion] = { total: 0, count: 0 };
          }
          currentEmotions[emotion].total += score;
          currentEmotions[emotion].count += 1;
        });
      }
    });
    
    // Calculate average scores for each emotion in previous period
    const previousEmotions: Record<string, { total: number, count: number }> = {};
    
    previousEntries.forEach(entry => {
      if (entry.emotions) {
        Object.entries(entry.emotions).forEach(([emotion, score]) => {
          if (!previousEmotions[emotion]) {
            previousEmotions[emotion] = { total: 0, count: 0 };
          }
          previousEmotions[emotion].total += score;
          previousEmotions[emotion].count += 1;
        });
      }
    });
    
    // Find the emotion with the biggest improvement (or reduction for negative emotions)
    let biggestImprovement = '';
    let biggestChange = 0;
    
    // Consider both positive and negative emotions
    const positiveEmotions = ['joy', 'happiness', 'gratitude', 'calm', 'peace', 'excitement', 
                              'love', 'pride', 'hope', 'contentment'];
    const negativeEmotions = ['anxiety', 'sadness', 'anger', 'fear', 'stress', 'confusion', 
                             'disappointment', 'shame', 'guilt', 'boredom', 'disgust'];
    
    Object.keys(currentEmotions).forEach(emotion => {
      if (currentEmotions[emotion].count === 0) return;
      
      const currentAvg = currentEmotions[emotion].total / currentEmotions[emotion].count;
      
      // If emotion wasn't present in previous period, consider it as 0
      const previousAvg = previousEmotions[emotion] && previousEmotions[emotion].count > 0
        ? previousEmotions[emotion].total / previousEmotions[emotion].count
        : 0;
      
      let changePercent = 0;
      
      if (previousAvg === 0) {
        // New emotion
        changePercent = 100;
      } else {
        // Calculate percentage change
        changePercent = ((currentAvg - previousAvg) / previousAvg) * 100;
      }
      
      // For negative emotions, we want a reduction (negative change)
      if (negativeEmotions.includes(emotion.toLowerCase())) {
        changePercent = -changePercent;
      }
      
      // Update biggest improvement if this is better
      if (Math.abs(changePercent) > Math.abs(biggestChange)) {
        biggestChange = changePercent;
        biggestImprovement = emotion;
      }
    });
    
    if (!biggestImprovement) return null;
    
    return {
      emotion: biggestImprovement,
      percentage: Math.round(biggestChange)
    };
  };

  const calculateJournalActivity = async (entries: JournalEntry[], userId: string | undefined) => {
    // Calculate streak
    let streak = 0;
    const today = new Date();
    
    // Format a date to YYYY-MM-DD for comparison
    const formatDateKey = (date: Date) => {
      return date.toISOString().split('T')[0];
    };
    
    // Get all user's entries for streak calculation
    const { data: allEntries, error } = await supabase
      .from('Journal Entries')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error || !allEntries) {
      console.error('Error fetching entries for streak:', error);
      return { entryCount: entries.length, streak: 0 };
    }
    
    // Create a set of days with entries
    const daysWithEntries = new Set<string>();
    allEntries.forEach(entry => {
      const entryDate = new Date(entry.created_at);
      daysWithEntries.add(formatDateKey(entryDate));
    });
    
    // Check for streak
    let currentDate = today;
    let checkingToday = true;
    
    while (true) {
      const dateKey = formatDateKey(currentDate);
      
      // Skip today if no entries yet
      if (checkingToday && !daysWithEntries.has(dateKey)) {
        checkingToday = false;
        currentDate = subDays(currentDate, 1);
        continue;
      }
      
      checkingToday = false;
      
      // If we find this day in the entries, increase streak
      if (daysWithEntries.has(dateKey)) {
        streak++;
        currentDate = subDays(currentDate, 1);
      } else {
        // Break the loop when the streak is broken
        break;
      }
    }
    
    return {
      entryCount: entries.length,
      streak
    };
  };

  const prepareEmotionData = (entries: JournalEntry[]) => {
    // Group entries by day
    const entriesByDay: Record<string, Array<JournalEntry>> = {};
    
    entries.forEach(entry => {
      const date = new Date(entry.created_at).toISOString().split('T')[0];
      if (!entriesByDay[date]) {
        entriesByDay[date] = [];
      }
      entriesByDay[date].push(entry);
    });
    
    // Calculate average emotion scores for each day
    return Object.entries(entriesByDay).map(([date, dayEntries]) => {
      const emotionScores: Record<string, number> = {};
      
      dayEntries.forEach(entry => {
        if (entry.emotions) {
          Object.entries(entry.emotions).forEach(([emotion, score]) => {
            if (!emotionScores[emotion]) {
              emotionScores[emotion] = 0;
            }
            emotionScores[emotion] += score;
          });
        }
      });
      
      // Average the scores
      Object.keys(emotionScores).forEach(emotion => {
        emotionScores[emotion] = emotionScores[emotion] / dayEntries.length;
      });
      
      return {
        date,
        emotions: emotionScores
      };
    });
  };

  return { insightsData, loading, refetch: () => fetchInsightsData(timeRange) };
}
