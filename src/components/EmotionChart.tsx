
import { useState, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AggregatedEmotionData, TimeRange } from '@/hooks/use-insights-data';

// Type definitions for emotion data
type EmotionData = {
  day: string;
  [key: string]: number | string;
};

type EmotionBubbleData = {
  name: string;
  value: number;
  color: string;
};

type ChartType = 'line' | 'bubble';

interface EmotionChartProps {
  className?: string;
  timeframe?: TimeRange;
  aggregatedData?: AggregatedEmotionData;
}

// Vibrant color mapping for emotions
const EMOTION_COLORS: Record<string, string> = {
  joy: '#4299E1',           // Bright Blue
  happiness: '#48BB78',     // Bright Green
  gratitude: '#0EA5E9',     // Ocean Blue
  calm: '#8B5CF6',          // Vivid Purple
  anxiety: '#F56565',       // Bright Red
  sadness: '#3B82F6',       // Bright Blue
  anger: '#F97316',         // Bright Orange
  fear: '#EF4444',          // Bright Red
  excitement: '#FBBF24',    // Vibrant Yellow
  love: '#EC4899',          // Magenta Pink
  stress: '#F97316',        // Bright Orange
  surprise: '#F59E0B',      // Amber
  confusion: '#8B5CF6',     // Vivid Purple
  disappointment: '#6366F1', // Indigo
  pride: '#3B82F6',         // Blue
  shame: '#DC2626',         // Red
  guilt: '#B45309',         // Amber
  hope: '#2563EB',          // Blue
  boredom: '#4B5563',       // Gray
  disgust: '#65A30D',       // Lime
  contentment: '#0D9488'    // Teal
};

// Get color for an emotion, with fallback
const getEmotionColor = (emotion: string): string => {
  const normalized = emotion.toLowerCase();
  return EMOTION_COLORS[normalized] || '#A3A3A3';
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
  const getBubbleData = (): EmotionBubbleData[] => {
    if (!aggregatedData) return [];
    
    // Combine all emotions from aggregatedData
    const emotionScores: Record<string, number> = {};
    
    Object.entries(aggregatedData).forEach(([emotion, dataPoints]) => {
      // Sum up all values for this emotion
      const totalScore = dataPoints.reduce((sum, point) => sum + point.value, 0);
      emotionScores[emotion] = totalScore;
    });
    
    return Object.entries(emotionScores)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: value,
        color: getEmotionColor(name)
      }))
      .sort((a, b) => b.value - a.value);
  };
  
  // Process aggregated data for line chart
  const getLineChartData = (): EmotionData[] => {
    if (!aggregatedData || Object.keys(aggregatedData).length === 0) {
      return [];
    }
    
    // Get top 3 emotions based on frequency and average score
    const emotionTotals: Record<string, number> = {};
    const dateMap: Map<string, Record<string, number>> = new Map();
    
    // Calculate totals for each emotion to find top emotions
    Object.entries(aggregatedData).forEach(([emotion, dataPoints]) => {
      emotionTotals[emotion] = dataPoints.reduce((sum, point) => sum + point.value, 0);
      
      // Also populate the dateMap for creating the chart data
      dataPoints.forEach(point => {
        if (!dateMap.has(point.date)) {
          dateMap.set(point.date, {});
        }
        const dateEntry = dateMap.get(point.date)!;
        dateEntry[emotion] = point.value;
      });
    });
    
    // Get top 3 emotions by total score
    const topEmotions = Object.entries(emotionTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
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
            {emotions.map((emotion, index) => (
              <Line
                key={emotion}
                type="monotone"
                dataKey={emotion}
                stroke={getEmotionColor(emotion)}
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name={emotion.charAt(0).toUpperCase() + emotion.slice(1)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        
        <div className="mt-4 text-center text-xs text-muted-foreground">
          * Only primary emotions are shown
        </div>
      </div>
    );
  };

  const renderBubbleChart = () => {
    if (bubbleData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No emotion data available</p>
        </div>
      );
    }
    
    // Calculate bubble positions to avoid overlap
    const calculateBubblePositions = (bubbles: EmotionBubbleData[]) => {
      // Canvas dimensions
      const canvasWidth = 400;
      const canvasHeight = 300;
      const minDistance = 80; // Minimum distance between bubble centers
      
      // Calculate initial positions in a circular layout
      const positions: {x: number, y: number, size: number}[] = [];
      
      bubbles.forEach((bubble, index) => {
        // Scale bubble size proportionally to value - now more directly proportional
        const maxSize = 120;
        const minSize = 40;
        const maxValue = Math.max(...bubbles.map(b => b.value));
        const size = minSize + ((bubble.value / maxValue) * (maxSize - minSize));
        
        // Initial position in a circle
        const angle = (index / bubbles.length) * 2 * Math.PI;
        const radius = Math.min(canvasWidth, canvasHeight) * 0.35;
        const x = (canvasWidth / 2) + Math.cos(angle) * radius;
        const y = (canvasHeight / 2) + Math.sin(angle) * radius;
        
        positions.push({ x, y, size });
      });
      
      return positions;
    };
    
    const bubblePositions = calculateBubblePositions(bubbleData);
    
    return (
      <div className="w-full h-[300px] flex flex-col items-center justify-center relative">
        <div className="absolute top-0 right-0 text-xs text-muted-foreground">
          * Size of bubble represents intensity
        </div>
        
        {/* Container with boundary constraints */}
        <div className="relative w-[320px] h-[250px] border-2 border-dashed border-muted/20 rounded-lg overflow-hidden">
          {bubbleData.map((item, index) => {
            const position = bubblePositions[index];
            // Calculate constrained positions
            const constrainedX = Math.max(position.size/2, Math.min(320 - position.size/2, position.x));
            const constrainedY = Math.max(position.size/2, Math.min(250 - position.size/2, position.y));
            
            return (
              <motion.div
                key={item.name}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  x: [
                    constrainedX - 5, 
                    constrainedX + 5, 
                    constrainedX
                  ].map(x => Math.max(position.size/2, Math.min(320 - position.size/2, x))),
                  y: [
                    constrainedY - 5, 
                    constrainedY + 5, 
                    constrainedY
                  ].map(y => Math.max(position.size/2, Math.min(250 - position.size/2, y)))
                }}
                transition={{ 
                  duration: 0.5, 
                  delay: index * 0.1,
                  x: { repeat: Infinity, duration: 3 + index, repeatType: "reverse" },
                  y: { repeat: Infinity, duration: 4 + index, repeatType: "reverse" }
                }}
                style={{
                  width: `${position.size}px`,
                  height: `${position.size}px`,
                  backgroundColor: item.color,
                  position: 'absolute',
                  left: constrainedX - (position.size / 2),
                  top: constrainedY - (position.size / 2),
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: position.size > 70 ? '14px' : '12px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  zIndex: Math.floor(item.value)
                }}
              >
                {item.name}
              </motion.div>
            );
          })}
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
        {chartType === 'bubble' && renderBubbleChart()}
      </div>
      
      {chartType === 'line' && lineData.length > 0 && (
        <div className="flex flex-wrap justify-start gap-4 mt-4 text-sm">
          {Object.keys(lineData[0])
            .filter(key => key !== 'day')
            .map(emotion => (
              <div key={emotion} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: getEmotionColor(emotion) }}
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
