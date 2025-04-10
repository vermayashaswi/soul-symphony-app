import { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Label,
  ReferenceLine,
  Text
} from 'recharts';
import { cn } from '@/lib/utils';
import { AggregatedEmotionData, TimeRange } from '@/hooks/use-insights-data';
import EmotionBubbles from './EmotionBubbles';
import { Sparkles, CalendarX } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  TooltipProvider,
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { addDays, format, eachDayOfInterval, isAfter, isBefore, isSameDay, parseISO, startOfWeek, endOfWeek } from 'date-fns';

type EmotionData = {
  day: string;
  dayFormatted: string;
  rawDate: string;
  noEntry?: boolean;
  [key: string]: number | string | boolean | undefined;
};

type ChartType = 'line' | 'bubble';

interface EmotionChartProps {
  className?: string;
  timeframe?: TimeRange;
  aggregatedData?: AggregatedEmotionData;
}

const EMOTION_COLORS: Record<string, string> = {
  joy: '#4299E1',           // Blue
  happiness: '#48BB78',     // Green
  gratitude: '#0EA5E9',     // Light Blue
  calm: '#8B5CF6',          // Purple
  anxiety: '#F56565',       // Red
  sadness: '#3B82F6',       // Bright Blue
  anger: '#F97316',         // Orange
  fear: '#EF4444',          // Bright Red
  excitement: '#FBBF24',    // Yellow
  love: '#EC4899',          // Pink
  stress: '#9333EA',        // Violet
  surprise: '#F59E0B',      // Amber
  confusion: '#6366F1',     // Indigo
  disappointment: '#2563EB', // Blue
  pride: '#06B6D4',         // Cyan
  shame: '#DC2626',         // Dark Red
  guilt: '#B45309',         // Brown
  hope: '#2DD4BF',          // Teal
  boredom: '#4B5563',       // Gray
  disgust: '#65A30D',       // Lime
  contentment: '#0D9488',   // Dark Teal
  trust: '#A78BFA',         // Light Purple
  anticipation: '#FB923C',  // Light Orange
  pensiveness: '#93C5FD',   // Light Blue
  serenity: '#A5F3FC',      // Light Cyan
  annoyance: '#FCD34D',     // Light Yellow
  vigilance: '#FCA5A5',     // Light Red
  interest: '#86EFAC',      // Light Green
  apprehension: '#FDA4AF',  // Light Pink
  distraction: '#D8B4FE',   // Light Violet
  admiration: '#C4B5FD'     // Lavender
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

const CustomDot = (props: any) => {
  const { cx, cy, stroke, fill, dataKey, payload, value, noEntry } = props;

  if (payload.noEntry) {
    return (
      <circle 
        cx={cx} 
        cy={cy} 
        r={5} 
        fill="#EF4444" 
        stroke="none" 
      />
    );
  }
  
  return (
    <circle 
      cx={cx} 
      cy={cy} 
      r={4} 
      fill={fill || stroke} 
      stroke="#fff" 
      strokeWidth={2} 
    />
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    if (payload[0].payload.noEntry) {
      return (
        <div className="bg-background border border-border/50 shadow-lg rounded-lg p-2 text-sm flex items-center gap-2">
          <CalendarX size={16} className="text-red-500" />
          <span>No Entry</span>
          <span className="text-xs text-muted-foreground ml-1">
            {payload[0].payload.dayFormatted}
          </span>
        </div>
      );
    }
    
    return (
      <div className="bg-background border border-border/50 shadow-lg rounded-lg p-2">
        <p className="font-medium mb-1">{payload[0].payload.dayFormatted}</p>
        {payload.map((entry: any, index: number) => (
          <div 
            key={`tooltip-${index}`} 
            className="flex items-center gap-2 py-0.5"
          >
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.stroke }}
            ></div>
            <span className="capitalize">{entry.dataKey}: </span>
            <span className="font-mono font-medium">{Number(entry.value).toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }

  return null;
};

export function EmotionChart({ 
  className, 
  timeframe = 'week',
  aggregatedData 
}: EmotionChartProps) {
  const [chartType, setChartType] = useState<ChartType>('bubble');
  const [bubbleKey, setBubbleKey] = useState(0); 
  const [selectedEmotionInfo, setSelectedEmotionInfo] = useState<{name: string, percentage: number} | null>(null);
  const [visibleEmotions, setVisibleEmotions] = useState<string[]>([]);
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  
  const chartTypes = [
    { id: 'line', label: 'Line' },
    { id: 'bubble', label: 'Emotion Bubbles' },
  ];
  
  const bubbleData = useMemo(() => {
    if (!aggregatedData || Object.keys(aggregatedData).length === 0) {
      console.log('[EmotionChart] No aggregated data available for timeframe:', timeframe);
      return {};
    }
    
    const emotionScores: Record<string, number> = {};
    
    Object.entries(aggregatedData).forEach(([emotion, dataPoints]) => {
      if (dataPoints.length > 0) {
        const totalScore = dataPoints.reduce((sum, point) => sum + point.value, 0);
        if (totalScore > 0) {
          emotionScores[emotion] = totalScore / dataPoints.length;
          if (emotionScores[emotion] > 1.0) {
            emotionScores[emotion] = 1.0;
          }
        }
      }
    });
    
    const filteredEmotions = Object.fromEntries(
      Object.entries(emotionScores).filter(([_, value]) => value > 0)
    );
    
    console.log(`[EmotionChart] Bubble data updated for timeframe: ${timeframe}`, {
      emotionCount: Object.keys(filteredEmotions).length,
      firstFewEmotions: Object.entries(filteredEmotions).slice(0, 3)
    });
    
    return filteredEmotions;
  }, [aggregatedData, timeframe]);
  
  useEffect(() => {
    setBubbleKey(prev => prev + 1);
  }, [chartType]);
  
  useEffect(() => {
    console.log('[EmotionChart] Timeframe or aggregatedData changed, updating bubble chart', {
      timeframe,
      hasData: aggregatedData ? Object.keys(aggregatedData).length > 0 : false,
      bubbleDataSize: Object.keys(bubbleData).length
    });
    setBubbleKey(prev => prev + 1);
  }, [timeframe, aggregatedData, bubbleData]);

  const handleEmotionClick = (emotion: string) => {
    if (bubbleData && emotion in bubbleData) {
      const total = Object.values(bubbleData).reduce((sum, value) => sum + value, 0);
      const percentage = (bubbleData[emotion] / total) * 100;
      
      setSelectedEmotionInfo({
        name: emotion,
        percentage: Math.round(percentage * 10) / 10
      });
      
      setTimeout(() => {
        setSelectedEmotionInfo(null);
      }, 2000);
    }
  };
  
  const lineData = useMemo(() => {
    if (!aggregatedData || Object.keys(aggregatedData).length === 0) {
      return [];
    }
    
    const emotionTotals: Record<string, number> = {};
    
    const dateMap = new Map<string, Map<string, {total: number, count: number}>>();
    
    Object.entries(aggregatedData).forEach(([emotion, dataPoints]) => {
      let totalValue = 0;
      
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
      
      if (totalValue > 0) {
        emotionTotals[emotion] = totalValue;
      }
    });
    
    const topEmotions = Object.entries(emotionTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emotion]) => emotion);
    
    if (visibleEmotions.length === 0 && chartType === 'line') {
      setVisibleEmotions(topEmotions);
    }
    
    const allDates: Date[] = [];
    const now = new Date();
    
    if (timeframe === 'week') {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      allDates = eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else if (timeframe === 'today') {
      allDates = [now];
    } else if (timeframe === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      allDates = eachDayOfInterval({ start: monthStart, end: monthEnd });
    } else if (timeframe === 'year') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearEnd = new Date(now.getFullYear(), 11, 31);
      for (let month = 0; month < 12; month++) {
        allDates.push(new Date(now.getFullYear(), month, 1));
      }
    }
    
    const existingDates = new Set<string>(Array.from(dateMap.keys()));
    
    const mergedData: EmotionData[] = allDates.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayFormatted = format(date, 'MMM d, yyyy');
      const day = format(date, 'MMM d');
      const hasData = existingDates.has(dateStr);
      
      const dataPoint: EmotionData = { 
        day,
        dayFormatted,
        rawDate: dateStr,
        noEntry: !hasData
      };
      
      if (hasData) {
        const emotions = dateMap.get(dateStr)!;
        
        topEmotions.forEach(emotion => {
          const emotionData = emotions.get(emotion);
          if (emotionData && emotionData.count > 0) {
            let avgValue = emotionData.total / emotionData.count;
            if (avgValue > 1.0) avgValue = 1.0;
            dataPoint[emotion] = parseFloat(avgValue.toFixed(2));
          } else {
            dataPoint[emotion] = 0;
          }
        });
      } else {
        topEmotions.forEach(emotion => {
          dataPoint[emotion] = 0;
        });
      }
      
      return dataPoint;
    }).sort((a, b) => {
      const dateA = parseISO(a.rawDate);
      const dateB = parseISO(b.rawDate);
      return dateA.getTime() - dateB.getTime();
    });
    
    return mergedData;
  }, [aggregatedData, visibleEmotions, chartType, timeframe]);

  const EmotionLineLabel = (props: any) => {
    const { x, y, stroke, value, index, data, dataKey } = props;
    
    if (index !== data.length - 1) return null;
    
    const emotionName = dataKey.charAt(0).toUpperCase() + dataKey.slice(1);
    
    return (
      <text 
        x={x + 5} 
        y={y} 
        dy={4} 
        fill={stroke} 
        fontSize={12} 
        textAnchor="start"
        fontWeight="500"
      >
        {emotionName}
      </text>
    );
  };

  const handleLegendClick = (emotion: string) => {
    setVisibleEmotions(prev => {
      if (prev.includes(emotion)) {
        if (prev.length > 1) {
          return prev.filter(e => e !== emotion);
        } else {
          return lineData.length > 0 
            ? Object.keys(lineData[0]).filter(key => !['day', 'dayFormatted', 'rawDate', 'noEntry'].includes(key))
            : [];
        }
      } else {
        return [...prev, emotion];
      }
    });
  };

  const renderLineChart = () => {
    if (lineData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No data available for this timeframe</p>
        </div>
      );
    }
    
    const allEmotions = Object.keys(lineData[0]).filter(key => !['day', 'dayFormatted', 'rawDate', 'noEntry'].includes(key));
    
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
              tickFormatter={(value) => value.toFixed(1)}
              width={isMobile ? 25 : 40}
            />
            <Tooltip content={<CustomTooltip />} />
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
                label={isMobile ? null : <EmotionLineLabel />}
                hide={!visibleEmotions.includes(emotion)}
                connectNulls={false}
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
        
        <div className="flex items-center justify-center gap-4 mt-4 bg-secondary/30 rounded-md py-2 px-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs text-muted-foreground">No Entry</span>
          </div>
          <div className="text-xs text-muted-foreground">
            * Click on a legend item to focus on specific emotions
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-wrap justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Emotions</h3>
        <div className="flex gap-2">
          {chartTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setChartType(type.id as ChartType)}
              className={cn(
                "px-3 py-1 rounded-full text-sm",
                chartType === type.id
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="bg-card p-4 rounded-xl shadow-sm relative">
        {chartType === 'line' && renderLineChart()}
        {chartType === 'bubble' && (
          <div className="w-full h-[350px]" key={bubbleKey}>
            {Object.keys(bubbleData).length > 0 ? (
              <>
                <EmotionBubbles 
                  emotions={bubbleData} 
                  preventOverlap={true}
                  onEmotionClick={handleEmotionClick}
                />
                {selectedEmotionInfo && (
                  <div className="absolute top-3 left-3 bg-background/90 border border-border rounded-lg px-3 py-2 shadow-md flex items-center gap-2 animate-fade-in z-10">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{selectedEmotionInfo.name}: {selectedEmotionInfo.percentage.toFixed(1)}%</span>
                  </div>
                )}
                <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-background/70 px-2 py-1 rounded-md">
                  Tip: Tap bubbles to see percentages
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No emotions data available for this timeframe
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default EmotionChart;
