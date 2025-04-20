
import { useMemo } from 'react';
import { AggregatedEmotionData } from "@/hooks/use-insights-data";

type EmotionData = {
  day: string;
  [key: string]: number | string | null;
};
type UseTopEmotionsLineDataParams = {
  aggregatedData?: AggregatedEmotionData;
  topN?: number;
};

export function useTopEmotionsLineData({ aggregatedData, topN = 10 }: UseTopEmotionsLineDataParams) {
  return useMemo(() => {
    if (!aggregatedData || Object.keys(aggregatedData).length === 0) return { lineData: [], topEmotions: [] };
    const emotionTotals: Record<string, number> = {};
    const dateMap = new Map<string, Map<string, { total: number, count: number }>>();
    Object.entries(aggregatedData).forEach(([emotion, dataPoints]) => {
      let totalValue = 0;
      dataPoints.forEach(point => {
        if (!dateMap.has(point.date)) dateMap.set(point.date, new Map());
        const dateEntry = dateMap.get(point.date)!;
        if (!dateEntry.has(emotion)) dateEntry.set(emotion, { total: 0, count: 0 });
        const emotionEntry = dateEntry.get(emotion)!;
        emotionEntry.total += point.value;
        emotionEntry.count += 1;
        totalValue += point.value;
      });
      if (totalValue > 0) emotionTotals[emotion] = totalValue;
    });
    const topEmotions = Object.entries(emotionTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
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
        const [aMonth, aDay] = a.day.split(' ');
        const [bMonth, bDay] = b.day.split(' ');
        const dateA = new Date(`${aMonth} ${aDay}`);
        const dateB = new Date(`${bMonth} ${bDay}`);
        return dateA.getTime() - dateB.getTime();
      });

    return { lineData: result, topEmotions };
  }, [aggregatedData, topN]);
}
