
import { supabase } from '@/integrations/supabase/client';
import { 
  calculateRelativeDateRange, 
  getUserTimezoneOffset, 
  getUserTimezoneName, 
  debugTimezoneInfo 
} from './dateUtils';
import { format, formatInTimeZone } from 'date-fns-tz';

/**
 * Analyzes journal entries based on time patterns in a user query
 * @param userId The user ID to fetch journal entries for
 * @param timeRange Optional time range to filter entries
 * @returns Analysis of time patterns found in journal entries
 */
export async function analyzeTimePatterns(
  userId: string,
  timeRange?: { startDate?: string; endDate?: string; periodName?: string; duration?: number }
) {
  if (!userId) {
    console.error("No user ID provided for time pattern analysis");
    return {
      hasEntries: false,
      error: "Missing user ID"
    };
  }

  try {
    // Log timezone debug info to help diagnose issues
    debugTimezoneInfo();
    
    const timezoneName = getUserTimezoneName() || 'UTC';
    console.log(`Time pattern analysis using timezone: ${timezoneName}`);
    
    // Build the query with time filters if provided
    let query = supabase
      .from('Journal Entries')
      .select('id, created_at, sentiment, emotions')
      // RLS policies automatically filter to user's entries
      .order('created_at', { ascending: false });

    // Apply time range filters if provided
    if (timeRange?.startDate && timeRange?.endDate) {
      console.log(`Applying time filters: ${timeRange.startDate} to ${timeRange.endDate}`);
      
      // Parse dates for logging
      const startDate = new Date(timeRange.startDate);
      const endDate = new Date(timeRange.endDate);
      console.log(`Time range dates (formatted): ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`);
      console.log(`Time range details: ${timeRange.periodName || 'custom range'}`);
      
      query = query.gte('created_at', timeRange.startDate).lte('created_at', timeRange.endDate);
    }

    console.log("Fetching all journal entries for time pattern analysis");
    // Do NOT limit entries for time pattern analysis - we want all entries
    const { data: entries, error } = await query;

    if (error) {
      console.error("Error fetching journal entries for time analysis:", error);
      return {
        hasEntries: false,
        error: "Failed to fetch journal entries"
      };
    }

    // If no entries found, return early
    if (!entries || entries.length === 0) {
      return {
        hasEntries: false,
        entryCount: 0,
        timeRange: timeRange?.periodName || "all time"
      };
    }

    console.log(`Found and analyzing all ${entries.length} entries for time pattern analysis`);
    
    // Log the date range of entries found
    if (entries.length > 0) {
      const oldestEntry = new Date(entries[entries.length - 1].created_at);
      const newestEntry = new Date(entries[0].created_at);
      console.log(`Entry date range: ${format(oldestEntry, 'yyyy-MM-dd')} to ${format(newestEntry, 'yyyy-MM-dd')}`);
    }

    // Analyze entry distribution by time
    const entriesByDate = groupEntriesByDate(entries);
    const mostActiveDay = findMostActiveDay(entriesByDate);
    const timeDistribution = analyzeTimeOfDayDistribution(entries);
    
    // Analyze frequency patterns
    const frequencyPatterns = analyzeJournalingFrequency(entries);

    return {
      hasEntries: true,
      entryCount: entries.length,
      timeRange: timeRange?.periodName || "all time",
      mostActiveDay,
      timeDistribution,
      frequencyPatterns,
      firstEntryDate: entries[entries.length - 1].created_at,
      lastEntryDate: entries[0].created_at
    };
  } catch (error) {
    console.error("Error in time pattern analysis:", error);
    return {
      hasEntries: false,
      error: "Error analyzing time patterns"
    };
  }
}

/**
 * Group entries by date for analysis
 */
function groupEntriesByDate(entries: any[]) {
  const entriesByDate: Record<string, any[]> = {};
  
  entries.forEach(entry => {
    const date = new Date(entry.created_at).toISOString().split('T')[0];
    if (!entriesByDate[date]) {
      entriesByDate[date] = [];
    }
    entriesByDate[date].push(entry);
  });
  
  return entriesByDate;
}

/**
 * Find the day with most journal entries
 */
function findMostActiveDay(entriesByDate: Record<string, any[]>) {
  let maxCount = 0;
  let mostActiveDay = null;
  
  for (const [date, dayEntries] of Object.entries(entriesByDate)) {
    if (dayEntries.length > maxCount) {
      maxCount = dayEntries.length;
      mostActiveDay = date;
    }
  }
  
  return {
    date: mostActiveDay,
    entryCount: maxCount
  };
}

/**
 * Analyze when during the day entries are created
 */
function analyzeTimeOfDayDistribution(entries: any[]) {
  // Get user's timezone offset
  const timezoneOffset = getUserTimezoneOffset();
  
  const timeDistribution = {
    morning: 0, // 5:00 AM - 11:59 AM
    afternoon: 0, // 12:00 PM - 4:59 PM
    evening: 0, // 5:00 PM - 8:59 PM
    night: 0 // 9:00 PM - 4:59 AM
  };
  
  entries.forEach(entry => {
    // Create entry date adjusted for user's timezone
    const entryDate = new Date(entry.created_at);
    // Adjust the hour based on user's timezone
    const hour = entryDate.getHours();
    
    // Categorize by time of day
    if (hour >= 5 && hour < 12) {
      timeDistribution.morning += 1;
    } else if (hour >= 12 && hour < 17) {
      timeDistribution.afternoon += 1;
    } else if (hour >= 17 && hour < 21) {
      timeDistribution.evening += 1;
    } else {
      timeDistribution.night += 1;
    }
  });
  
  return timeDistribution;
}

/**
 * Analyze journaling frequency patterns
 */
function analyzeJournalingFrequency(entries: any[]) {
  // Sort entries by date (oldest first)
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  if (sortedEntries.length <= 1) {
    return {
      averageDaysBetweenEntries: null,
      consistency: "not enough data",
      longestStreak: 0,
      currentStreak: 0
    };
  }
  
  // Calculate days between entries
  const daysBetweenEntries: number[] = [];
  let longestStreak = 1;
  let currentStreak = 1;
  let streakDates: string[] = [new Date(sortedEntries[0].created_at).toISOString().split('T')[0]];
  
  for (let i = 1; i < sortedEntries.length; i++) {
    const currentDate = new Date(sortedEntries[i].created_at);
    const previousDate = new Date(sortedEntries[i-1].created_at);
    
    // Calculate days between entries
    const timeDiff = currentDate.getTime() - previousDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    daysBetweenEntries.push(daysDiff);
    
    // Check for consecutive days to track streaks
    const currentDateStr = currentDate.toISOString().split('T')[0];
    if (!streakDates.includes(currentDateStr)) {
      streakDates.push(currentDateStr);
      
      if (daysDiff <= 1) {
        currentStreak++;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
      } else {
        currentStreak = 1;
      }
    }
  }
  
  // Calculate average days between entries
  const averageDaysBetween = daysBetweenEntries.length > 0 
    ? daysBetweenEntries.reduce((sum, days) => sum + days, 0) / daysBetweenEntries.length 
    : null;
    
  // Determine consistency level
  let consistency = "irregular";
  if (averageDaysBetween !== null) {
    if (averageDaysBetween <= 1.5) consistency = "daily";
    else if (averageDaysBetween <= 3) consistency = "every few days";
    else if (averageDaysBetween <= 7) consistency = "weekly";
    else if (averageDaysBetween <= 14) consistency = "bi-weekly";
    else if (averageDaysBetween <= 31) consistency = "monthly";
  }
  
  return {
    averageDaysBetweenEntries: averageDaysBetween,
    consistency,
    longestStreak,
    currentStreak
  };
}

/**
 * Find patterns or correlations between time and emotional states
 */
export async function analyzeTimeEmotionPatterns(
  userId: string,
  timeRange?: { startDate?: string; endDate?: string; periodName?: string; duration?: number }
) {
  try {
    // Log timezone debug info
    debugTimezoneInfo();
    
    const timezoneName = getUserTimezoneName() || 'UTC';
    console.log(`Time-emotion pattern analysis using timezone: ${timezoneName}`);
    
    // Build the query with time filters if provided
    let query = supabase
      .from('Journal Entries')
      .select('id, created_at, sentiment, emotions')
      // RLS policies automatically filter to user's entries
      .order('created_at', { ascending: true });

    // Apply time range filters if provided
    if (timeRange?.startDate && timeRange?.endDate) {
      console.log(`Applying time emotion filters: ${timeRange.startDate} to ${timeRange.endDate}`);
      
      // Parse dates for logging
      const startDate = new Date(timeRange.startDate);
      const endDate = new Date(timeRange.endDate);
      console.log(`Time range dates (formatted): ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`);
      console.log(`Time range details: ${timeRange.periodName || 'custom range'}`);
      
      query = query.gte('created_at', timeRange.startDate).lte('created_at', timeRange.endDate);
    }

    const { data: entries, error } = await query;

    if (error || !entries || entries.length === 0) {
      console.error("Error or no entries found for time-emotion analysis:", error);
      return null;
    }
    
    console.log(`Found ${entries.length} entries for time-emotion pattern analysis`);
    
    // Log the date range of entries found
    if (entries.length > 0) {
      const oldestEntry = new Date(entries[0].created_at);
      const newestEntry = new Date(entries[entries.length - 1].created_at);
      console.log(`Entry date range: ${format(oldestEntry, 'yyyy-MM-dd')} to ${format(newestEntry, 'yyyy-MM-dd')}`);
    }

    // Analyze sentiment by time of day
    const sentimentByTimeOfDay = {
      morning: [], 
      afternoon: [],
      evening: [],
      night: []
    };
    
    // Analyze common emotions by day of week
    const dayOfWeekEmotions = {
      0: [], // Sunday
      1: [], // Monday
      2: [], // Tuesday
      3: [], // Wednesday
      4: [], // Thursday
      5: [], // Friday
      6: []  // Saturday
    };

    // Get user's timezone offset
    const timezoneOffset = getUserTimezoneOffset();
    
    // Process each entry
    entries.forEach(entry => {
      // Create date object adjusted for user's timezone
      const entryDate = new Date(entry.created_at);
      const hour = entryDate.getHours();
      const dayOfWeek = entryDate.getDay();
      const sentiment = entry.sentiment;
      const emotions = entry.emotions;
      
      // Add sentiment to time of day
      if (hour >= 5 && hour < 12) {
        sentimentByTimeOfDay.morning.push(sentiment);
      } else if (hour >= 12 && hour < 17) {
        sentimentByTimeOfDay.afternoon.push(sentiment);
      } else if (hour >= 17 && hour < 21) {
        sentimentByTimeOfDay.evening.push(sentiment);
      } else {
        sentimentByTimeOfDay.night.push(sentiment);
      }
      
      // Add emotions to day of week
      if (emotions && Array.isArray(emotions)) {
        dayOfWeekEmotions[dayOfWeek] = [...dayOfWeekEmotions[dayOfWeek], ...emotions];
      }
    });

    // Calculate average sentiment by time of day
    const avgSentimentByTime = {};
    for (const [timeOfDay, sentiments] of Object.entries(sentimentByTimeOfDay)) {
      if (sentiments.length === 0) continue;
      
      // Calculate numeric values for average
      const numericSentiments = sentiments
        .filter(s => typeof s === 'string')
        .map(s => {
          if (s === 'POSITIVE') return 1;
          if (s === 'NEGATIVE') return -1;
          return 0; // NEUTRAL
        });
      
      const avg = numericSentiments.length > 0
        ? numericSentiments.reduce((sum, val) => sum + val, 0) / numericSentiments.length
        : null;
        
      avgSentimentByTime[timeOfDay] = avg;
    }
    
    // Find most common emotions by day of week
    const topEmotionsByDay = {};
    for (const [day, emotionList] of Object.entries(dayOfWeekEmotions)) {
      if (emotionList.length === 0) continue;
      
      const emotionCounts = {};
      emotionList.forEach(emotion => {
        if (!emotionCounts[emotion]) emotionCounts[emotion] = 0;
        emotionCounts[emotion]++;
      });
      
      // Sort by count and take top 3
      const sortedEmotions = Object.entries(emotionCounts)
        .sort(([, countA], [, countB]) => (countB as number) - (countA as number))
        .slice(0, 3)
        .map(([emotion]) => emotion);
        
      topEmotionsByDay[day] = sortedEmotions;
    }

    return {
      avgSentimentByTimeOfDay: avgSentimentByTime,
      topEmotionsByDayOfWeek: topEmotionsByDay
    };
  } catch (error) {
    console.error("Error in time-emotion pattern analysis:", error);
    return null;
  }
}
