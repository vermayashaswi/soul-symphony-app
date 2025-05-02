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
  }, [aggregatedData, visibleEmotions, chartType]);

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

  const renderLineChart = () => {
    if (lineData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">
            <TranslatableText text="No data available for this timeframe" forceTranslate={true} />
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
            <TranslatableText text="No emotional data found" forceTranslate={true} />
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

  const renderBubbleLegend = () => {
    return null;
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-wrap justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">
          <TranslatableText text="TOP" forceTranslate={true} />
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
              <TranslatableText text={type.label} forceTranslate={true} />
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
                <TranslatableText text={topRightPercentage.emotion} forceTranslate={true} />: {topRightPercentage.percentage}
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
