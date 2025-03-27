
import { useState, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { cn } from '@/lib/utils';
import { AggregatedEmotionData, TimeRange } from '@/hooks/use-insights-data';
import EmotionBubbles from './EmotionBubbles';

// Type definitions for emotion data
type EmotionData = {
  day: string;
  [key: string]: number | string;
};

type ChartType = 'line' | 'bubble';

interface EmotionChartProps {
  className?: string;
  timeframe?: TimeRange;
  aggregatedData?: AggregatedEmotionData;
}

// Enhanced color mapping for emotions with distinct colors
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
  // Additional distinct colors for more emotions
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

// Get color for an emotion, with fallback
const getEmotionColor = (emotion: string, index: number): string => {
  const normalized = emotion.toLowerCase();
  if (EMOTION_COLORS[normalized]) {
    return EMOTION_COLORS[normalized];
  }
  
  // If we don't have a predefined color, use one of these fallback colors
  const fallbackColors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#EC4899', '#6366F1', '#D946EF', '#F97316', '#0EA5E9'
  ];
  
  // Use modulo to cycle through the colors if we have more emotions than colors
  return fallbackColors[index % fallbackColors.length];
};

export function EmotionChart({ 
  className, 
  timeframe = 'week',
  aggregatedData 
}: EmotionChartProps) {
  const [chartType, setChartType] = useState<ChartType>('bubble');
  
  const chartTypes = [
    { id: 'line', label: 'Line' },
    { id: 'bubble', label: 'Emotion Bubbles' },
  ];
  
  // Process emotion data for bubble chart
  const getBubbleData = () => {
    if (!aggregatedData) return {};
    
    // Combine all emotions from aggregatedData
    const emotionScores: Record<string, number> = {};
    
    Object.entries(aggregatedData).forEach(([emotion, dataPoints]) => {
      // Sum up all values for this emotion
      const totalScore = dataPoints.reduce((sum, point) => sum + point.value, 0);
      emotionScores[emotion] = totalScore;
    });
    
    return emotionScores;
  };
  
  // Process aggregated data for line chart
  const getLineChartData = (): EmotionData[] => {
    if (!aggregatedData || Object.keys(aggregatedData).length === 0) {
      return [];
    }
    
    // Get top 5 emotions based on total score
    const emotionTotals: Record<string, number> = {};
    const dateMap: Map<string, Record<string, number>> = new Map();
    
    // Calculate totals for each emotion to find top emotions
    Object.entries(aggregatedData).forEach(([emotion, dataPoints]) => {
      emotionTotals[emotion] = dataPoints.reduce((sum, point) => sum + point.value, 0);
      
      // Populate the dateMap for creating the chart data
      dataPoints.forEach(point => {
        if (!dateMap.has(point.date)) {
          dateMap.set(point.date, {});
        }
        const dateEntry = dateMap.get(point.date)!;
        dateEntry[emotion] = point.value;
      });
    });
    
    // Get top 5 emotions by total score
    const topEmotions = Object.entries(emotionTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emotion]) => emotion);
    
    // Convert the dateMap to an array of data points for the chart
    return Array.from(dateMap.entries())
      .map(([date, emotions]) => {
        const dataPoint: EmotionData = { 
          day: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) 
        };
        
        // Add the top emotions to the data point
        topEmotions.forEach(emotion => {
          dataPoint[emotion] = emotions[emotion] || 0;
        });
        
        return dataPoint;
      })
      .sort((a, b) => {
        const dateA = new Date(a.day);
        const dateB = new Date(b.day);
        return dateA.getTime() - dateB.getTime();
      });
  };

  // Memoize chart data
  const bubbleData = useMemo(() => getBubbleData(), [aggregatedData]);
  const lineData = useMemo(() => getLineChartData(), [aggregatedData]);
  
  const renderLineChart = () => {
    if (lineData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No data available for this timeframe</p>
        </div>
      );
    }
    
    // Get the emotion names that are present in the data
    const emotions = Object.keys(lineData[0]).filter(key => key !== 'day');
    
    return (
      <div className="flex flex-col h-full">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={lineData}
            margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="day" stroke="#888" fontSize={12} tickMargin={10} />
            <YAxis stroke="#888" fontSize={12} tickMargin={10} domain={[0, 10]} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.8)', 
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', 
                border: 'none' 
              }} 
            />
            <Legend verticalAlign="bottom" height={36} />
            {emotions.map((emotion, index) => (
              <Line
                key={emotion}
                type="monotone"
                dataKey={emotion}
                stroke={getEmotionColor(emotion, index)}
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name={emotion.charAt(0).toUpperCase() + emotion.slice(1)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        
        <div className="mt-4 text-center text-xs text-muted-foreground">
          * Showing top 5 emotions by score
        </div>
      </div>
    );
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-wrap justify-between items-center mb-4">
        <h3 className="text-xl font-semibold mb-2">Soul-ubles</h3>
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
      
      <div className="bg-white p-4 rounded-xl shadow-sm">
        {chartType === 'line' && renderLineChart()}
        {chartType === 'bubble' && (
          <div className="w-full h-[350px]">
            <EmotionBubbles emotions={bubbleData} />
          </div>
        )}
      </div>
      
      {chartType === 'line' && lineData.length > 0 && (
        <div className="flex flex-wrap justify-start gap-4 mt-4 text-sm">
          {Object.keys(lineData[0])
            .filter(key => key !== 'day')
            .map((emotion, index) => (
              <div key={emotion} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: getEmotionColor(emotion, index) }}
                ></div>
                <span className="font-medium">{emotion.charAt(0).toUpperCase() + emotion.slice(1)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default EmotionChart;
