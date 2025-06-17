
import { AggregatedEmotionData } from '@/hooks/use-insights-data';
import { addDays, startOfDay, startOfWeek, startOfMonth, startOfYear, addWeeks, addMonths, addYears } from 'date-fns';

type EmotionData = {
  day: string;
  [key: string]: number | string | null;
};

export const filterAggregatedData = (
  aggregatedData: AggregatedEmotionData,
  timeframe: string,
  activeDate: Date
): AggregatedEmotionData => {
  if (!aggregatedData) return {};
  
  // Determine period bounds
  let periodStart: Date, periodEnd: Date;
  switch (timeframe) {
    case 'today':
      periodStart = startOfDay(activeDate);
      periodEnd = addDays(periodStart, 1);
      break;
    case 'week':
      periodStart = startOfWeek(activeDate, { weekStartsOn: 1 });
      periodEnd = addWeeks(periodStart, 1);
      break;
    case 'month':
      periodStart = startOfMonth(activeDate);
      periodEnd = addMonths(periodStart, 1);
      break;
    case 'year':
      periodStart = startOfYear(activeDate);
      periodEnd = addYears(periodStart, 1);
      break;
    default:
      periodStart = startOfDay(activeDate);
      periodEnd = addDays(periodStart, 1);
  }
  
  // Filter data points in each emotion to this period
  const filtered: AggregatedEmotionData = {};
  for (const [emotion, points] of Object.entries(aggregatedData)) {
    if (Array.isArray(points)) {
      filtered[emotion] = points.filter(pt => {
        const dateObj = new Date(pt.date);
        return dateObj >= periodStart && dateObj < periodEnd;
      });
    }
  }
  return filtered;
};

export const processLineData = (
  filteredAggregatedData: AggregatedEmotionData,
  visibleEmotions: string[]
): EmotionData[] => {
  if (!filteredAggregatedData || Object.keys(filteredAggregatedData).length === 0) {
    return [];
  }
  
  const emotionTotals: Record<string, number> = {};
  const dateMap = new Map<string, Map<string, {total: number, count: number}>>();
  
  Object.entries(filteredAggregatedData).forEach(([emotion, dataPoints]) => {
    let totalValue = 0;
    
    if (Array.isArray(dataPoints)) {
      dataPoints.forEach(point => {
        if (!dateMap.has(point.date)) {
          dateMap.set(point.date, new Map());
        }
        const dateEntry = dateMap.get(point.date)!;
        if (!dateEntry.has(emotion)) {
          dateEntry.set(emotion, { total: 0, count: 0 });
        }
        const emotionEntry = dateEntry.get(emotion)!;
        emotionEntry.total += point.value;
        emotionEntry.count += 1;
        totalValue += point.value;
      });
    }
    
    if (totalValue > 0) {
      emotionTotals[emotion] = totalValue;
    }
  });
  
  const topEmotions = Object.entries(emotionTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emotion]) => emotion);
  
  const result = Array.from(dateMap.entries())
    .map(([date, emotions]) => {
      const dataPoint: EmotionData = { 
        day: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) 
      };
      
      topEmotions.forEach(emotion => {
        const emotionData = emotions.get(emotion);
        if (emotionData && emotionData.count > 0) {
          let avgValue = emotionData.total / emotionData.count;
          if (avgValue > 1.0) avgValue = 1.0;
          dataPoint[emotion] = parseFloat(avgValue.toFixed(2));
        } else {
          dataPoint[emotion] = null;
        }
      });
      
      return dataPoint;
    })
    .sort((a, b) => {
      const dateA = new Date(a.day);
      const dateB = new Date(b.day);
      return dateA.getTime() - dateB.getTime();
    });
  
  return result;
};

export const processBubbleData = (filteredAggregatedData: AggregatedEmotionData): Record<string, number> => {
  if (!filteredAggregatedData || Object.keys(filteredAggregatedData).length === 0) {
    return {};
  }
  
  const emotionScores: Record<string, number> = {};
  
  Object.entries(filteredAggregatedData).forEach(([emotion, dataPoints]) => {
    if (Array.isArray(dataPoints) && dataPoints.length > 0) {
      const totalScore = dataPoints.reduce((sum, point) => sum + point.value, 0);
      if (totalScore > 0) {
        emotionScores[emotion] = totalScore / dataPoints.length;
        if (emotionScores[emotion] > 1.0) {
          emotionScores[emotion] = 1.0;
        }
      }
    }
  });
  
  return emotionScores;
};

export const getDominantEmotion = (filteredAggregatedData: AggregatedEmotionData): string => {
  if (!filteredAggregatedData || Object.keys(filteredAggregatedData).length === 0) {
    return '';
  }
  const emotionTotals: Record<string, number> = {};
  Object.entries(filteredAggregatedData).forEach(([emotion, dataPoints]) => {
    let totalValue = 0;
    if (Array.isArray(dataPoints)) {
      dataPoints.forEach(point => {
        totalValue += point.value;
      });
    }
    if (totalValue > 0) {
      emotionTotals[emotion] = totalValue;
    }
  });
  const sortedEmotions = Object.entries(emotionTotals)
    .sort((a, b) => b[1] - a[1]);
  return sortedEmotions.length > 0 ? sortedEmotions[0][0] : '';
};
