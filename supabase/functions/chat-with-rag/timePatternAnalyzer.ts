
/**
 * Time pattern analyzer for chat-with-rag
 * This module analyzes journal entries to find patterns in time-of-day journaling
 */

// Define time periods of the day
export type TimePeriod = 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';

export interface TimeFrequency {
  period: TimePeriod;
  count: number;
  percentage: number;
  hourRange: string;
}

export interface TimeAnalysis {
  mostFrequentPeriod: TimePeriod;
  mostFrequentPercentage: number;
  hourHistogram: Record<number, number>;
  periodFrequencies: TimeFrequency[];
  totalEntries: number;
  hasSufficientData: boolean;
  summaryText: string;
}

// Maps hours to time periods
const hourToPeriod: Record<number, TimePeriod> = {
  0: 'late_night', 1: 'late_night', 2: 'late_night', 3: 'late_night',
  4: 'early_morning', 5: 'early_morning', 6: 'early_morning', 7: 'early_morning',
  8: 'morning', 9: 'morning', 10: 'morning', 11: 'morning',
  12: 'afternoon', 13: 'afternoon', 14: 'afternoon', 15: 'afternoon', 16: 'afternoon',
  17: 'evening', 18: 'evening', 19: 'evening', 20: 'evening',
  21: 'night', 22: 'night', 23: 'night'
};

// Display names for periods
const periodDisplayNames: Record<TimePeriod, string> = {
  'early_morning': 'Early Morning (4-8 AM)',
  'morning': 'Morning (8 AM-12 PM)',
  'afternoon': 'Afternoon (12-5 PM)',
  'evening': 'Evening (5-9 PM)',
  'night': 'Night (9 PM-12 AM)',
  'late_night': 'Late Night (12-4 AM)'
};

// Hour ranges for periods
const periodHourRanges: Record<TimePeriod, string> = {
  'early_morning': '4-8 AM',
  'morning': '8 AM-12 PM',
  'afternoon': '12-5 PM',
  'evening': '5-9 PM',
  'night': '9 PM-12 AM',
  'late_night': '12-4 AM'
};

/**
 * Analyzes timestamps from journal entries to identify patterns in time-of-day journaling
 */
export function analyzeTimePatterns(
  entries: Array<{ created_at: string | Date }>,
  timezone: number = 0
): TimeAnalysis {
  if (!entries || entries.length === 0) {
    return createEmptyAnalysis();
  }
  
  console.log(`Analyzing time patterns for ${entries.length} entries with timezone offset ${timezone} minutes`);

  // Initialize counters
  const periodCounts: Record<TimePeriod, number> = {
    'early_morning': 0,
    'morning': 0,
    'afternoon': 0,
    'evening': 0,
    'night': 0,
    'late_night': 0
  };
  
  // Initialize hour histogram
  const hourHistogram: Record<number, number> = {};
  for (let i = 0; i < 24; i++) {
    hourHistogram[i] = 0;
  }

  // Process each entry
  entries.forEach(entry => {
    try {
      // Parse the date and adjust for timezone
      const date = new Date(entry.created_at);
      
      // Apply timezone offset if provided (minutes)
      if (timezone) {
        // JavaScript uses milliseconds for date operations
        date.setTime(date.getTime() + timezone * 60 * 1000);
      }
      
      // Extract hour
      const hour = date.getHours();
      
      // Increment hour count
      hourHistogram[hour] = (hourHistogram[hour] || 0) + 1;
      
      // Increment period count
      const period = hourToPeriod[hour];
      periodCounts[period] = (periodCounts[period] || 0) + 1;
    } catch (error) {
      console.error('Error parsing date:', error);
    }
  });
  
  // Find most frequent period
  let mostFrequentPeriod: TimePeriod = 'afternoon'; // Default
  let mostFrequentCount = 0;
  
  Object.entries(periodCounts).forEach(([period, count]) => {
    if (count > mostFrequentCount) {
      mostFrequentCount = count;
      mostFrequentPeriod = period as TimePeriod;
    }
  });
  
  // Calculate percentages and build period frequencies array
  const totalEntries = entries.length;
  const mostFrequentPercentage = Math.round((mostFrequentCount / totalEntries) * 100);
  
  const periodFrequencies: TimeFrequency[] = Object.entries(periodCounts)
    .map(([period, count]) => ({
      period: period as TimePeriod,
      count,
      percentage: Math.round((count / totalEntries) * 100),
      hourRange: periodHourRanges[period as TimePeriod]
    }))
    .sort((a, b) => b.count - a.count);
  
  // Check if we have sufficient data for a reliable analysis
  const hasSufficientData = totalEntries >= 5;
  
  // Generate summary text
  const summaryText = generateSummaryText(
    periodFrequencies, 
    mostFrequentPeriod, 
    mostFrequentPercentage,
    totalEntries,
    hasSufficientData
  );
  
  return {
    mostFrequentPeriod,
    mostFrequentPercentage,
    hourHistogram,
    periodFrequencies,
    totalEntries,
    hasSufficientData,
    summaryText
  };
}

/**
 * Generates human-readable summary of time pattern analysis
 */
function generateSummaryText(
  periodFrequencies: TimeFrequency[],
  mostFrequentPeriod: TimePeriod,
  mostFrequentPercentage: number,
  totalEntries: number,
  hasSufficientData: boolean
): string {
  if (!hasSufficientData) {
    return `Based on only ${totalEntries} journal entries, there isn't enough data to determine a strong pattern yet. Continue journaling to reveal your preferred times.`;
  }
  
  // Get the top 2 time periods
  const top2Periods = periodFrequencies.slice(0, 2);
  const topPeriod = top2Periods[0];
  
  // Calculate the difference between top periods if we have at least 2
  let comparisonText = '';
  if (top2Periods.length > 1 && top2Periods[1].count > 0) {
    const secondPeriod = top2Periods[1];
    const difference = topPeriod.percentage - secondPeriod.percentage;
    
    if (difference > 20) {
      comparisonText = `This is significantly more than during ${periodDisplayNames[secondPeriod.period]} (${secondPeriod.percentage}%).`;
    } else if (difference > 10) {
      comparisonText = `This is moderately more than during ${periodDisplayNames[secondPeriod.period]} (${secondPeriod.percentage}%).`;
    } else {
      comparisonText = `This is closely followed by ${periodDisplayNames[secondPeriod.period]} (${secondPeriod.percentage}%).`;
    }
  }
  
  // Format the main summary
  return `Based on the analysis of ${totalEntries} journal entries, you journal most frequently during ${periodDisplayNames[topPeriod.period]} (${topPeriod.percentage}% of entries). ${comparisonText}`;
}

/**
 * Creates an empty analysis object for cases with no data
 */
function createEmptyAnalysis(): TimeAnalysis {
  return {
    mostFrequentPeriod: 'afternoon',
    mostFrequentPercentage: 0,
    hourHistogram: {},
    periodFrequencies: [],
    totalEntries: 0,
    hasSufficientData: false,
    summaryText: "No journal entries were found to analyze time patterns."
  };
}
