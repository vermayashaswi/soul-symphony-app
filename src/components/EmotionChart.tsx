import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';
import { AggregatedEmotionData, TimeRange } from '@/hooks/use-insights-data';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';

type EmotionData = {
  day: string;
  [key: string]: number | string | null;
};

type ChartType = 'line' | 'entities';

interface EmotionChartProps {
  className?: string;
  timeframe?: TimeRange;
  aggregatedData?: AggregatedEmotionData;
  entries?: Array<any>; // Add entries prop if needed for entity calculations
}

// Color mapping for emotions (unchanged)
const EMOTION_COLORS: Record<string, string> = {
  joy: '#4299E1',
  happiness: '#48BB78',
  gratitude: '#0EA5E9',
  calm: '#8B5CF6',
  anxiety: '#F56565',
  sadness: '#3B82F6',
  anger: '#F97316',
  fear: '#EF4444',
  excitement: '#FBBF24',
  love: '#EC4899',
  stress: '#9333EA',
  surprise: '#F59E0B',
  confusion: '#6366F1',
  disappointment: '#2563EB',
  pride: '#06B6D4',
  shame: '#DC2626',
  guilt: '#B45309',
  hope: '#2DD4BF',
  boredom: '#4B5563',
  disgust: '#65A30D',
  contentment: '#0D9488',
  trust: '#A78BFA',
  anticipation: '#FB923C',
  pensiveness: '#93C5FD',
  serenity: '#A5F3FC',
  annoyance: '#FCD34D',
  vigilance: '#FCA5A5',
  interest: '#86EFAC',
  apprehension: '#FDA4AF',
  distraction: '#D8B4FE',
  admiration: '#C4B5FD'
};
const getEmotionColor = (emotion: string, index: number): string => {
  const normalized = emotion.toLowerCase();
  if (EMOTION_COLORS[normalized]) {
    return EMOTION_COLORS[normalized];
  }
  const fallbackColors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#EC4899', '#6366F1', '#D946EF', '#F97316', '#0EA5E9'
  ];
  return fallbackColors[index % fallbackColors.length];
};

export function EmotionChart({ 
  className, 
  timeframe = 'week',
  aggregatedData,
  entries = [],
}: EmotionChartProps) {
  // Chart toggles setup
  const [chartType, setChartType] = useState<ChartType>('line');
  const [visibleEmotions, setVisibleEmotions] = useState<string[]>([]);

  const { theme } = useTheme();
  const isMobile = useIsMobile();

  // Chart type toggle
  const chartTypes = [
    { id: 'line', label: 'Emotions' },
    { id: 'entities', label: 'Entities' },
  ];

  // Bubble logic removed!
  // Build line chart data for top 10 emotions
  const lineData = useMemo(() => {
    if (!aggregatedData || Object.keys(aggregatedData).length === 0) return [];
    const emotionTotals: Record<string, number> = {};
    const dateMap = new Map<string, Map<string, {total: number, count: number}>>();
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
    const top10Emotions = Object.entries(emotionTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([emotion]) => emotion);

    const result = Array.from(dateMap.entries())
      .map(([date, emotions]) => {
        const dataPoint: EmotionData = {
          day: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        };
        top10Emotions.forEach(emotion => {
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
    // Always select all for multi-emotion line
    if (visibleEmotions.length === 0 || !visibleEmotions.some(e => top10Emotions.includes(e))) {
      setVisibleEmotions(top10Emotions);
    }
    return result;
  // eslint-disable-next-line
  }, [aggregatedData]);

  // Entities: compute top 10 by frequency for the strip list
  const entityCounts = useMemo(() => {
    // Try to get entities from aggregatedData, fallback to raw entries.
    let allEntities: string[] = [];
    if (aggregatedData && Object.values(aggregatedData).length > 0) {
      // If any entry in aggregatedData has entities, merge them
      Object.values(aggregatedData).forEach((arr: any) => {
        arr.forEach((point: any) => {
          if (point.entities && Array.isArray(point.entities)) allEntities.push(...point.entities);
        });
      });
    }
    if ((!allEntities || allEntities.length === 0) && Array.isArray(entries) && entries.length > 0) {
      // Fallback: look in entries
      entries.forEach((entry: any) => {
        const entitiesAry = entry.entities || [];
        if (Array.isArray(entitiesAry)) allEntities.push(...entitiesAry);
        // Some models might use comma separated text
        else if (typeof entitiesAry === 'string') allEntities.push(...entitiesAry.split(',').map(e => e.trim()));
      });
    }
    // Frequency counter
    const counts: Record<string, number> = {};
    allEntities.forEach(e => {
      if (!e) return;
      if (typeof e !== 'string') return;
      const cleaned = e.trim();
      if (!cleaned) return;
      counts[cleaned] = (counts[cleaned] || 0) + 1;
    });
    // Top 10 & sort
    const sortedArr = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    return sortedArr;
  }, [aggregatedData, entries, timeframe]);

  // Emotion legend click
  const handleLegendClick = (emotion: string) => {
    setVisibleEmotions(prev => {
      if (prev.length === 1 && prev[0] === emotion) return prev;
      if (prev.includes(emotion)) return prev.filter(e => e !== emotion);
      else return [...prev, emotion];
    });
  };

  // Custom chart dot
  const CustomDot = (props: any) => {
    const { cx, cy, stroke, strokeWidth, r, value } = props;
    if (value === null) return null;
    return (
      <circle 
        cx={cx} 
        cy={cy} 
        r={r} 
        fill={theme === 'dark' ? '#1e293b' : 'white'} 
        stroke={stroke} 
        strokeWidth={strokeWidth} 
      />
    );
  };

  const renderLineChart = () => {
    if (lineData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No data available for this timeframe</p>
        </div>
      );
    }
    const allEmotions = Object.keys(lineData[0])
      .filter(key => key !== 'day')
      .filter(key => lineData.some(point => point[key] !== null));
    if (allEmotions.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No emotional data found</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col h-full">
        <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
          <LineChart
            data={lineData}
            margin={{ top: 20, right: isMobile ? 10 : 60, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#eee'} />
            <XAxis 
              dataKey="day" 
              stroke="#888" 
              fontSize={isMobile ? 10 : 12} 
              tickMargin={10}
              tick={{ fontSize: isMobile ? 10 : 12 }}
            />
            <YAxis 
              stroke="#888" 
              fontSize={isMobile ? 10 : 12} 
              tickMargin={isMobile ? 5 : 10} 
              domain={[0, 1]} 
              ticks={isMobile ? [0, 0.25, 0.5, 0.75, 1.0] : [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]}
              tickFormatter={(value) => (typeof value === "number" ? value.toFixed(1) : value)}
              width={isMobile ? 25 : 40}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: theme === 'dark' ? 'hsl(var(--card))' : 'rgba(255, 255, 255, 0.8)', 
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', 
                border: 'none',
                color: theme === 'dark' ? 'hsl(var(--card-foreground))' : 'inherit'
              }}
              formatter={(value: any) => value !== null ? [parseFloat(value).toFixed(1), ''] : ['No data', '']}
            />
            {allEmotions.map((emotion, index) => (
              <Line
                key={emotion}
                type="monotone"
                dataKey={emotion}
                stroke={getEmotionColor(emotion, index)}
                strokeWidth={2}
                dot={<CustomDot />}
                activeDot={{ r: isMobile ? 5 : 6 }}
                name={emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                hide={!visibleEmotions.includes(emotion)}
                connectNulls={true}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap justify-center gap-2 mt-6 px-2">
          {allEmotions.map((emotion, index) => {
            const isSelected = visibleEmotions.includes(emotion);
            return (
              <div 
                key={emotion} 
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200",
                  isSelected 
                    ? "bg-secondary font-medium shadow-sm border-2 border-primary" 
                    : "bg-secondary/30 hover:bg-secondary/50"
                )}
                onClick={() => handleLegendClick(emotion)}
              >
                <div 
                  className={cn("w-3 h-3 rounded-full", 
                    isSelected ? "animate-pulse" : "opacity-60"
                  )}
                  style={{ backgroundColor: getEmotionColor(emotion, index) }}
                ></div>
                <span 
                  className={cn("text-sm", 
                    isSelected ? "font-bold" : "text-muted-foreground"
                  )}
                >
                  {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
          <span>* Click on a legend item to focus on that emotion</span>
        </div>
      </div>
    );
  };

  // Render vertical entity strips (Entities mode)
  const renderEntityStrips = () => {
    if (!entityCounts || entityCounts.length === 0) {
      return (
        <div className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">No entities found for this timeframe</p>
        </div>
      );
    }
    // Pick app theme purple as base, fade down via opacity
    const baseColor = "#8b5cf6";
    // We'll linearly interpolate opacity from 1.0 (top) to 0.4 (bottom)
    const minOpacity = 0.4, maxOpacity = 1.0;
    const n = entityCounts.length;
    return (
      <div className="flex flex-col gap-2 py-4" style={{ maxWidth: 320, margin: "0 auto" }}>
        {entityCounts.map(([entity, count], idx) => {
          // Opacity from 1.0 -> 0.4
          const opacity = maxOpacity - ((maxOpacity - minOpacity) * idx / (n > 1 ? (n - 1) : 1));
          return (
            <div
              key={entity}
              className={cn(
                "flex items-center justify-between px-4 py-2 rounded-md font-medium text-white shadow transition-all",
                "hover:scale-105"
              )}
              style={{
                background: baseColor,
                opacity,
                minHeight: 38,
                fontSize: "1.05rem"
              }}
            >
              <span className="truncate font-semibold">{entity}</span>
              <span className="ml-3 text-xs font-mono bg-black/10 px-2 py-0.5 rounded">{count}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-wrap justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">TOP</h3>
        <div className="flex gap-2">
          {chartTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setChartType(type.id as ChartType)}
              className={cn(
                "px-3 py-1 rounded-full text-sm capitalize",
                chartType === type.id
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
              style={{
                minWidth: 90
              }}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-card p-4 rounded-xl shadow-sm relative min-h-[300px]">
        {chartType === 'line' && renderLineChart()}
        {chartType === 'entities' && renderEntityStrips()}
      </div>
    </div>
  );
}

export default EmotionChart;
