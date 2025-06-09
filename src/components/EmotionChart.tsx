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
import { cn } from '@/lib/utils';
import { AggregatedEmotionData, TimeRange } from '@/hooks/use-insights-data';
import EmotionBubbles from './EmotionBubbles';
import EntityStrips from './insights/EntityStrips';
import { Sparkles, CircleDot } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { format, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isValid } from 'date-fns';

type EmotionData = {
  day: string;
  [key: string]: number | string | null;
};

type ChartType = 'line' | 'bubble';

interface EmotionChartProps {
  className?: string;
  timeframe?: TimeRange;
  aggregatedData?: AggregatedEmotionData;
}

const EMOTION_COLORS: Record<string, string> = {
  joy: '#FF6B6B',           // Coral Red
  happiness: '#4ECDC4',     // Teal
  gratitude: '#45B7D1',     // Sky Blue
  calm: '#96CEB4',          // Mint Green
  anxiety: '#FFEAA7',       // Light Yellow
  sadness: '#DDA0DD',       // Plum
  anger: '#FF7675',         // Light Red
  fear: '#FD79A8',          // Pink
  excitement: '#FDCB6E',    // Orange
  love: '#E84393',          // Magenta
  stress: '#A29BFE',        // Lavender
  surprise: '#F39C12',      // Orange
  confusion: '#6C5CE7',     // Purple
  disappointment: '#74B9FF', // Light Blue
  pride: '#00B894',         // Emerald
  shame: '#E17055',         // Salmon
  guilt: '#D63031',         // Dark Red
  hope: '#00CEC9',          // Turquoise
  boredom: '#636E72',       // Gray
  disgust: '#A4B0BE',       // Light Gray
  contentment: '#55A3FF',   // Bright Blue
  trust: '#81ECEC',         // Cyan
  anticipation: '#FAB1A0',  // Peach
  pensiveness: '#00B894',   // Green
  serenity: '#74B9FF',      // Periwinkle
  annoyance: '#FDCB6E',     // Gold
  vigilance: '#E84393',     // Hot Pink
  interest: '#6C5CE7',      // Violet
  apprehension: '#FD79A8',  // Rose
  distraction: '#A29BFE',   // Lilac
  admiration: '#FDCB6E'     // Amber
};

const getEmotionColor = (emotion: string, index: number): string => {
  const normalized = emotion.toLowerCase();
  if (EMOTION_COLORS[normalized]) {
    return EMOTION_COLORS[normalized];
  }
  
  // More diverse fallback colors - completely different hues
  const fallbackColors = [
    '#FF6B6B', // Coral Red
    '#4ECDC4', // Teal
    '#45B7D1', // Sky Blue
    '#96CEB4', // Mint Green
    '#FFEAA7', // Light Yellow
    '#DDA0DD', // Plum
    '#FF7675', // Light Red
    '#FD79A8', // Pink
    '#FDCB6E', // Orange
    '#E84393', // Magenta
    '#A29BFE', // Lavender
    '#00B894', // Emerald
    '#6C5CE7', // Purple
    '#74B9FF', // Light Blue
    '#E17055', // Salmon
    '#00CEC9', // Turquoise
    '#81ECEC', // Cyan
    '#FAB1A0', // Peach
    '#636E72', // Gray
    '#55A3FF'  // Bright Blue
  ];
  
  return fallbackColors[index % fallbackColors.length];
};

const getDateRangeForTimeframe = (timeframe: TimeRange) => {
  const now = new Date();
  
  switch (timeframe) {
    case 'today':
      return { start: now, end: now };
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }), // Start on Monday
        end: endOfWeek(now, { weekStartsOn: 1 })
      };
    case 'month':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now)
      };
    case 'year':
      return {
        start: startOfYear(now),
        end: endOfYear(now)
      };
    default:
      return { start: now, end: now };
  }
};

const formatDateForDisplay = (date: Date, timeframe: TimeRange): string => {
  switch (timeframe) {
    case 'today':
      return format(date, 'HH:mm');
    case 'week':
      return format(date, 'EEE dd');
    case 'month':
      return format(date, 'MMM dd');
    case 'year':
      return format(date, 'MMM');
    default:
      return format(date, 'MMM dd');
  }
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
  const [topRightPercentage, setTopRightPercentage] = useState<{
    emotion: string;
    percentage: number;
  } | null>(null);
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const initialRenderRef = useRef(true);
  const { user } = useAuth();
  
  const chartTypes = [
    { id: 'line', label: 'Emotions' },
    { id: 'bubble', label: 'Life Areas' },
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
    
    console.log(`[EmotionChart] Bubble data updated for timeframe: ${timeframe}`, {
      emotionCount: Object.keys(emotionScores).length,
      firstFewEmotions: Object.entries(emotionScores).slice(0, 3)
    });
    
    return emotionScores;
  }, [aggregatedData, timeframe]);
  
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
  
  const lineData = useMemo(() => {
    if (!aggregatedData || Object.keys(aggregatedData).length === 0) {
      return [];
    }
    
    console.log('[EmotionChart] Processing line data for timeframe:', timeframe);
    
    // Calculate emotion totals to determine top emotions
    const emotionTotals: Record<string, number> = {};
    Object.entries(aggregatedData).forEach(([emotion, dataPoints]) => {
      let totalValue = 0;
      dataPoints.forEach(point => {
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
    
    if (topEmotions.length === 0) {
      return [];
    }
    
    // Set default visible emotion if none selected
    const mostDominantEmotion = topEmotions[0];
    if (chartType === 'line' && visibleEmotions.length === 0 && mostDominantEmotion) {
      setVisibleEmotions([mostDominantEmotion]);
    }
    
    // Get the date range for the timeframe
    const { start: rangeStart, end: rangeEnd } = getDateRangeForTimeframe(timeframe);
    
    // For 'today', we don't generate a date range since it's hourly data
    if (timeframe === 'today') {
      // Process existing logic for today view
      const dateMap = new Map<string, Map<string, {total: number, count: number}>>();
      
      Object.entries(aggregatedData).forEach(([emotion, dataPoints]) => {
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
        });
      });
      
      return Array.from(dateMap.entries())
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
    }
    
    // Generate complete date range for week, month, and year
    const allDates = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    
    // Create a map of dates to emotion data from aggregatedData
    const dataByDate = new Map<string, Map<string, {total: number, count: number}>>();
    const journalDates = new Set<string>(); // Track which dates have journal entries
    
    Object.entries(aggregatedData).forEach(([emotion, dataPoints]) => {
      dataPoints.forEach(point => {
        const dateStr = point.date;
        journalDates.add(dateStr);
        
        if (!dataByDate.has(dateStr)) {
          dataByDate.set(dateStr, new Map());
        }
        
        const dateEntry = dataByDate.get(dateStr)!;
        if (!dateEntry.has(emotion)) {
          dateEntry.set(emotion, { total: 0, count: 0 });
        }
        
        const emotionEntry = dateEntry.get(emotion)!;
        emotionEntry.total += point.value;
        emotionEntry.count += 1;
      });
    });
    
    // Generate the complete dataset
    const result = allDates.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const hasJournalEntry = journalDates.has(dateStr);
      
      const dataPoint: EmotionData = {
        day: formatDateForDisplay(date, timeframe)
      };
      
      topEmotions.forEach(emotion => {
        const emotionData = dataByDate.get(dateStr)?.get(emotion);
        
        if (emotionData && emotionData.count > 0) {
          // Day has this emotion data - show actual value
          let avgValue = emotionData.total / emotionData.count;
          if (avgValue > 1.0) avgValue = 1.0;
          dataPoint[emotion] = parseFloat(avgValue.toFixed(2));
        } else if (hasJournalEntry) {
          // Day has journal entries but not this specific emotion - show 0
          dataPoint[emotion] = 0;
        } else {
          // Day has no journal entries at all - use null to hide from chart
          dataPoint[emotion] = null;
        }
      });
      
      return dataPoint;
    });
    
    console.log('[EmotionChart] Generated line data:', {
      timeframe,
      totalDays: result.length,
      topEmotions,
      sampleData: result.slice(0, 3)
    });
    
    return result;
  }, [aggregatedData, visibleEmotions, chartType, timeframe]);

  const dominantEmotion = useMemo(() => {
    if (!aggregatedData || Object.keys(aggregatedData).length === 0) {
      return '';
    }
    
    const emotionTotals: Record<string, number> = {};
    
    Object.entries(aggregatedData).forEach(([emotion, dataPoints]) => {
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
  }, [aggregatedData]);
  
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

  const renderLineChart = () => {
    if (lineData.length === 0) {
      return (
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
              interval={timeframe === 'month' ? 4 : timeframe === 'year' ? 0 : 'preserveStartEnd'}
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

  const renderBubbleLegend = () => {
    return null;
  };

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
        {chartType === 'line' && renderLineChart()}
        {chartType === 'bubble' && (
          <div className="w-full">
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
            
            <div className="h-[300px]" key={bubbleKey}>
              {chartType === 'bubble' && (
                <EntityStrips
                  userId={user?.id}
                  timeRange={timeframe}
                  onEntityClick={handleEntityClick}
                  className="w-full h-full"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmotionChart;
