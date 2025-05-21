import { supabase } from '@/integrations/supabase/client';
import { calculateRelativeDateRange, formatDateForUser } from './dateUtils';

/**
 * Analyzes journal entries based on time patterns in a user query
 * @param userId The user ID to fetch journal entries for
 * @param timeRange Optional time range to filter entries
 * @param timezoneOffset User's timezone offset in minutes (from UTC)
 * @returns Analysis of time patterns found in journal entries
 */
export async function analyzeTimePatterns(
  userId: string,
  timeRange?: { startDate?: string; endDate?: string; periodName?: string; duration?: number },
  timezoneOffset: number = new Date().getTimezoneOffset() * -1 // Default to browser's timezone
) {
  if (!userId) {
    console.error("No user ID provided for time pattern analysis");
    return {
      hasEntries: false,
      error: "Missing user ID"
    };
  }

  try {
    // Build the query with time filters if provided
    let query = supabase
      .from('Journal Entries')
      .select('id, created_at, sentiment, emotions')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply time range filters if provided
    if (timeRange?.startDate && timeRange?.endDate) {
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

    // Analyze entry distribution by time
    const entriesByDate = groupEntriesByDate(entries);
    const mostActiveDay = findMostActiveDay(entriesByDate);
    const timeDistribution = analyzeTimeOfDayDistribution(entries);
    
    // Analyze frequency patterns
    const frequencyPatterns = analyzeJournalingFrequency(entries, timezoneOffset);

    // Format dates in the user's timezone 
    const firstEntryDate = formatDateForUser(entries[entries.length - 1].created_at, timezoneOffset);
    const lastEntryDate = formatDateForUser(entries[0].created_at, timezoneOffset);
    const mostActiveDayFormatted = mostActiveDay.date ? 
      formatDateForUser(mostActiveDay.date, timezoneOffset) : 
      "No active day found";

    return {
      hasEntries: true,
      entryCount: entries.length,
      timeRange: timeRange?.periodName || "all time",
      mostActiveDay: {
        date: mostActiveDayFormatted,
        entryCount: mostActiveDay.entryCount
      },
      timeDistribution,
      frequencyPatterns,
      firstEntryDate,
      lastEntryDate
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
  const timeDistribution = {
    morning: 0, // 5:00 AM - 11:59 AM
    afternoon: 0, // 12:00 PM - 4:59 PM
    evening: 0, // 5:00 PM - 8:59 PM
    night: 0 // 9:00 PM - 4:59 AM
  };
  
  entries.forEach(entry => {
    const entryDate = new Date(entry.created_at);
    const hour = entryDate.getHours();
    
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
 * @param entries Journal entries to analyze
 * @param timezoneOffset User's timezone offset in minutes
 */
function analyzeJournalingFrequency(entries: any[], timezoneOffset: number = 0) {
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
  
  // Calculate days between entries, accounting for timezone
  const daysBetweenEntries: number[] = [];
  let longestStreak = 1;
  let currentStreak = 1;
  
  // Group by local date (adjusted for timezone) to handle date boundaries correctly
  const entriesByLocalDate = new Map<string, boolean>();
  
  sortedEntries.forEach(entry => {
    const entryDate = new Date(entry.created_at);
    // Adjust for timezone to get the correct local date
    const adjustedDate = new Date(entryDate.getTime() + (timezoneOffset * 60 * 1000));
    const localDateKey = adjustedDate.toISOString().split('T')[0];
    entriesByLocalDate.set(localDateKey, true);
  });
  
  // Convert to array of dates for streak calculation
  const localDates = Array.from(entriesByLocalDate.keys()).sort();
  
  for (let i = 1; i < localDates.length; i++) {
    const currentDate = new Date(localDates[i]);
    const previousDate = new Date(localDates[i-1]);
    
    // Calculate days between entries
    const timeDiff = currentDate.getTime() - previousDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    daysBetweenEntries.push(daysDiff);
    
    // Check for consecutive days to track streaks
    if (daysDiff <= 1) {
      currentStreak++;
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
    } else {
      currentStreak = 1;
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
 * @param userId The user ID to fetch journal entries for
 * @param timeRange Optional time range to filter entries
 * @param timezoneOffset User's timezone offset in minutes
 */
export async function analyzeTimeEmotionPatterns(
  userId: string,
  timeRange?: { startDate?: string; endDate?: string; periodName?: string; duration?: number },
  timezoneOffset: number = new Date().getTimezoneOffset() * -1
) {
  try {
    // Build the query with time filters if provided
    let query = supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text", created_at, master_themes, emotions')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    // Apply time range filters if provided
    if (timeRange?.startDate && timeRange?.endDate) {
      query = query.gte('created_at', timeRange.startDate).lte('created_at', timeRange.endDate);
    }

    const { data: entries, error } = await query;

    if (error || !entries || entries.length === 0) {
      console.error("Error or no entries found for time-emotion analysis:", error);
      return null;
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

    // Process each entry, accounting for timezone
    entries.forEach(entry => {
      const entryDateUTC = new Date(entry.created_at);
      // Adjust for timezone - this ensures we're working in the user's local time
      const entryLocalDate = new Date(entryDateUTC.getTime() + (timezoneOffset * 60 * 1000));
      const hour = entryLocalDate.getHours();
      const dayOfWeek = entryLocalDate.getDay();
      
      // Get emotions from the entry
      const emotions = entry.emotions;
      
      // Add emotions to day of week
      if (emotions && Array.isArray(emotions)) {
        dayOfWeekEmotions[dayOfWeek] = [...dayOfWeekEmotions[dayOfWeek], ...emotions];
      }
    });

    // Find most common emotions by day of week
    const topEmotionsByDay = {};
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
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
      
      // Use day name instead of number for clearer output
      const dayName = dayNames[parseInt(day)];  
      topEmotionsByDay[dayName] = sortedEmotions;
    }

    // Since we're not using sentimentByTimeOfDay anymore, we'll return only emotions data
    return {
      topEmotionsByDayOfWeek: topEmotionsByDay
    };
  } catch (error) {
    console.error("Error in time-emotion pattern analysis:", error);
    return null;
  }
}
