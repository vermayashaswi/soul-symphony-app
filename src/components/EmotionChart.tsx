
import { useState, useMemo, useEffect, useRef } from 'react';
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
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from '@/lib/utils';
import { AggregatedEmotionData, TimeRange } from '@/hooks/use-insights-data';
import EmotionBubbles from './EmotionBubbles';
import EntityStrips from './insights/EntityStrips';
import { Sparkles, CircleDot } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { formatDateForTimeRange } from '@/utils/date-formatter';
import {
  addDays, addWeeks, addMonths, addYears, 
  subDays, subWeeks, subMonths, subYears,
  startOfDay, startOfWeek, startOfMonth, startOfYear
} from 'date-fns';

type EmotionData = {
  day: string;
  [key: string]: number | string | null;
};

type ChartType = 'line' | 'bubble';

interface EmotionChartProps {
  className?: string;
  timeframe?: TimeRange;
  aggregatedData?: AggregatedEmotionData;
  // Add for navigation:
  currentDate?: Date;
  onTimeRangeNavigate?: (nextDate: Date) => void;
}

// Color palette for emotions
const EMOTION_COLORS = [
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Teal
];

const getEmotionColor = (emotion: string, index: number): string => {
  // Use a hash of the emotion name for consistent colors
  const emotionHash = emotion.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  const colorIndex = Math.abs(emotionHash) % EMOTION_COLORS.length;
  return EMOTION_COLORS[colorIndex];
};

// Persist chartType via local storage so that navigation doesn't reset chart type for user UX continuity
function usePersistedState<T>(key: string, defaultValue: T): [T, (val: T) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored);
    }
    return defaultValue;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(state));
    }
  }, [state, key]);
  return [state, setState];
}

export function EmotionChart({ 
  className, 
  timeframe = 'week',
  aggregatedData,
  currentDate,
  onTimeRangeNavigate,
}: EmotionChartProps) {
  // Chart type (persisted per device!)
  const [chartType, setChartType] = usePersistedState<ChartType>('emotion-chart-type', 'bubble');
  const [bubbleKey, setBubbleKey] = useState(0); 
  const [selectedEmotionInfo, setSelectedEmotionInfo] = useState<{name: string, percentage: number} | null>(null);
  const [visibleEmotions, setVisibleEmotions] = useState<string[]>([]);
  const [topRightPercentage, setTopRightPercentage] = useState<{
    emotion: string;
    percentage: number;
  } | null>(null);
  // Add local loading state for navigation
  const [isNavigating, setIsNavigating] = useState(false);
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const initialRenderRef = useRef(true);
  const { user } = useAuth();

  // Chart period navigation: Use controlled prop from above or local state if not present
  const [internalDate, setInternalDate] = useState<Date>(new Date());
  // If parent passes a controlled currentDate, use it; otherwise use internal
  const activeDate = typeof currentDate === 'object' ? currentDate : internalDate;

  useEffect(() => {
    // On timeframe change, always reset visibleEmotions
    setVisibleEmotions([]);
    if (!currentDate) setInternalDate(new Date());
  }, [timeframe]);

  // Bubble and Line chart base
  const chartTypes = [
    { id: 'line', label: 'Emotions' },
    { id: 'bubble', label: 'Life Areas' },
  ];
  
  // Navigation handlers with loading state
  const goToPrevious = () => {
    setIsNavigating(true);
    let newDate: Date;
    switch (timeframe) {
      case 'today':
        newDate = subDays(activeDate, 1);
        break;
      case 'week':
        newDate = subWeeks(activeDate, 1);
        break;
      case 'month':
        newDate = subMonths(activeDate, 1);
        break;
      case 'year':
        newDate = subYears(activeDate, 1);
        break;
      default:
        newDate = subWeeks(activeDate, 1);
    }
    if (onTimeRangeNavigate) onTimeRangeNavigate(newDate);
    else setInternalDate(newDate);
    
    // Reset loading after a short delay to allow for data filtering
    setTimeout(() => setIsNavigating(false), 300);
  };
  
  const goToNext = () => {
    setIsNavigating(true);
    let newDate: Date;
    switch (timeframe) {
      case 'today':
        newDate = addDays(activeDate, 1);
        break;
      case 'week':
        newDate = addWeeks(activeDate, 1);
        break;
      case 'month':
        newDate = addMonths(activeDate, 1);
        break;
      case 'year':
        newDate = addYears(activeDate, 1);
        break;
      default:
        newDate = addWeeks(activeDate, 1);
    }
    if (onTimeRangeNavigate) onTimeRangeNavigate(newDate);
    else setInternalDate(newDate);
    
    // Reset loading after a short delay to allow for data filtering
    setTimeout(() => setIsNavigating(false), 300);
  };
  
  // Reset period on timeframe change (keep currentDate prop precedence)
  useEffect(() => {
    if (!currentDate) setInternalDate(new Date());
  }, [timeframe, currentDate]);
  
  // Period label
  const getPeriodLabel = () => {
    const now = activeDate;
    switch (timeframe) {
      case 'today':
        return formatDateForTimeRange(now, 'day');
      case 'week': {
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);
        return `${formatDateForTimeRange(weekStart, 'short')} - ${formatDateForTimeRange(weekEnd, 'short')}`;
      }
      case 'month':
        return formatDateForTimeRange(now, 'month');
      case 'year':
        return now.getFullYear().toString();
      default:
        return '';
    }
  };

  // FILTER/AGGREGATE: Only include data for the current period, like MoodCalendar does.
  const filteredAggregatedData = useMemo(() => {
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
      filtered[emotion] = points.filter(pt => {
        const dateObj = new Date(pt.date);
        return dateObj >= periodStart && dateObj < periodEnd;
      });
    }
    return filtered;
  }, [aggregatedData, timeframe, activeDate]);

  // -- All rest of the code same, except replace aggregatedData -> filteredAggregatedData in appropriate places below --

  const bubbleData = useMemo(() => {
    if (!filteredAggregatedData || Object.keys(filteredAggregatedData).length === 0) {
      console.log('[EmotionChart] No aggregated data available for timeframe:', timeframe);
      return {};
    }
    
    const emotionScores: Record<string, number> = {};
    
    Object.entries(filteredAggregatedData).forEach(([emotion, dataPoints]) => {
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
    
    console.log(`[EmotionChart] Bubble data updated for timeframe: ${timeframe}`, {
      emotionCount: Object.keys(emotionScores).length,
      firstFewEmotions: Object.entries(emotionScores).slice(0, 3)
    });
    
    return emotionScores;
  }, [filteredAggregatedData, timeframe]);
  
  useEffect(() => {
    if (initialRenderRef.current) {
      console.log('[EmotionChart] Initial render, forcing bubble update');
      setBubbleKey(prev => prev + 1);
      
      setTimeout(() => {
        setBubbleKey(prev => prev + 1);
        console.log('[EmotionChart] Forced additional bubble update after timeout');
      }, 100);
      
      initialRenderRef.current = false;
    }
  }, []);
  
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
    
    setTimeout(() => {
      setBubbleKey(prev => prev + 1);
    }, 50);
  }, [timeframe, aggregatedData, bubbleData]);

  const handleEmotionClick = (emotion: string) => {
    if (bubbleData && emotion in bubbleData) {
      const total = Object.values(bubbleData).reduce((sum, value) => sum + value, 0);
      const percentage = (bubbleData[emotion] / total) * 100;
      
      setTopRightPercentage({
        emotion: emotion,
        percentage: Math.round(percentage * 10) / 10
      });
      
      setTimeout(() => {
        setTopRightPercentage(null);
      }, 2000);
    }
  };
  
  const handleEntityClick = (entity: string, sentiment: number) => {
    setTopRightPercentage({
      emotion: entity,
      percentage: Math.round(sentiment * 100) / 100
    });
    
    setTimeout(() => {
      setTopRightPercentage(null);
    }, 2000);
  };
  
  // Build lineData for this period only
  const lineData = useMemo(() => {
    if (!filteredAggregatedData || Object.keys(filteredAggregatedData).length === 0) {
      return [];
    }
    
    const emotionTotals: Record<string, number> = {};
    const dateMap = new Map<string, Map<string, {total: number, count: number}>>();
    
    Object.entries(filteredAggregatedData).forEach(([emotion, dataPoints]) => {
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
    
    const mostDominantEmotion = topEmotions[0] || '';
    
    if (chartType === 'line' && visibleEmotions.length === 0 && mostDominantEmotion) {
      setVisibleEmotions([mostDominantEmotion]);
    }
    
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
  }, [filteredAggregatedData, visibleEmotions, chartType]);

  const dominantEmotion = useMemo(() => {
    if (!filteredAggregatedData || Object.keys(filteredAggregatedData).length === 0) {
      return '';
    }
    const emotionTotals: Record<string, number> = {};
    Object.entries(filteredAggregatedData).forEach(([emotion, dataPoints]) => {
      let totalValue = 0;
      dataPoints.forEach(point => {
        totalValue += point.value;
      });
      if (totalValue > 0) {
        emotionTotals[emotion] = totalValue;
      }
    });
    const sortedEmotions = Object.entries(emotionTotals)
      .sort((a, b) => b[1] - a[1]);
    return sortedEmotions.length > 0 ? sortedEmotions[0][0] : '';
  }, [filteredAggregatedData]);
  
  useEffect(() => {
    if (dominantEmotion && chartType === 'line' && visibleEmotions.length === 0) {
      setVisibleEmotions([dominantEmotion]);
    }
  }, [dominantEmotion, chartType, visibleEmotions.length]);

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
      if (prev.length === 1 && prev[0] === emotion) {
        return prev;
      }
      
      if (prev.includes(emotion)) {
        return prev.filter(e => e !== emotion);
      } 
      else {
        return [...prev, emotion];
      }
    });
  };

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

  const CustomTooltip = (props: any) => {
    const { active, payload, label }: any = props;
    
    if (active && payload && payload.length) {
      const emotionName = payload[0].dataKey.charAt(0).toUpperCase() + payload[0].dataKey.slice(1);
      const value = payload[0].value;
      
      return (
        <div className="bg-card/95 backdrop-blur-sm p-2 rounded-lg border shadow-md">
          <p className="text-sm font-medium">{label}</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].stroke }}></div>
            <p className="text-sm">
              <TranslatableText 
                text={emotionName} 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="compact"
              />: {value?.toFixed(1) || 'N/A'}
            </p>
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Always show period label and navigation header, even with no data
  const ChevronHeader = () => (
    <div className="flex items-center justify-between mb-2">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={goToPrevious}
        disabled={isNavigating}
        className="text-muted-foreground hover:text-foreground"
        title="Previous period"
      >
        {isNavigating ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
      </Button>
      <div className="text-center font-medium text-base">
        <TranslatableText 
          text={getPeriodLabel()}
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="compact"
        />
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={goToNext}
        disabled={isNavigating}
        className="text-muted-foreground hover:text-foreground"
        title="Next period"
      >
        {isNavigating ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ChevronRight className="h-5 w-5" />
        )}
      </Button>
    </div>
  );

  const renderLineChart = () => {
    if (lineData.length === 0) {
      // Always show header
      return (
        <div className="flex flex-col h-full">
          <ChevronHeader />
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">
              <TranslatableText 
                text="No data available for this timeframe" 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
              />
            </p>
          </div>
        </div>
      );
    }
    const allEmotions = Object.keys(lineData[0])
      .filter(key => key !== 'day')
      .filter(key => lineData.some(point => point[key] !== null));
    if (allEmotions.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">
            <TranslatableText 
              text="No emotional data found" 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </p>
        </div>
      );
    }
    return (
      <div className="flex flex-col h-full">
        <ChevronHeader />
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
                  <TranslatableText 
                    text={emotion.charAt(0).toUpperCase() + emotion.slice(1)} 
                    forceTranslate={true}
                    enableFontScaling={true}
                    scalingContext="compact"
                  />
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
          <TranslatableText 
            text="* Click on a legend item to focus on that emotion" 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="compact"
          />
        </div>
      </div>
    );
  };

  const renderBubbleChart = () => (
    <div className="w-full h-full flex flex-col">
      <ChevronHeader />
      {topRightPercentage && (
        <div className="absolute top-2 right-2 bg-background/90 py-1 px-3 rounded-lg shadow-lg text-primary font-medium z-20">
          <TranslatableText 
            text={topRightPercentage.emotion} 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="compact"
          />: {topRightPercentage.percentage}
        </div>
      )}
      <div className="h-[300px] w-full" key={bubbleKey}>
        <EntityStrips
          userId={user?.id}
          timeRange={timeframe}
          currentDate={activeDate}
          onEntityClick={handleEntityClick}
          className="w-full h-full"
        />
      </div>
    </div>
  );

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-wrap justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">
          <TranslatableText 
            text="TOP" 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="general"
          />
        </h3>
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
              <TranslatableText 
                text={type.label} 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="compact"
              />
            </button>
          ))}
        </div>
      </div>
      <div className="bg-card p-4 rounded-xl shadow-sm relative">
        {isNavigating && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {chartType === 'line' && renderLineChart()}
        {chartType === 'bubble' && renderBubbleChart()}
      </div>
    </div>
  );
}

export default EmotionChart;
