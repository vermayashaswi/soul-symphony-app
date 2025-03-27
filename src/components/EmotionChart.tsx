import { useState, useMemo, useRef, useEffect } from 'react';
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
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AggregatedEmotionData, TimeRange } from '@/hooks/use-insights-data';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 320, height: 250 });
  const isMobile = useIsMobile();

  // Update container dimensions on resize
  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setContainerSize({ 
          width: Math.max(width, 280), // Ensure minimum width
          height: Math.max(height, 220) // Ensure minimum height
        });
      }
    };

    // Initial update
    updateContainerSize();
    
    // Add resize listener
    window.addEventListener('resize', updateContainerSize);
    
    // Cleanup
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  const chartTypes = [
    { id: 'line', label: 'Line' },
    { id: 'bubble', label: 'Emotion Bubbles' },
  ];
  
  // Process emotion data for bubble chart - show all emotions
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
  
  // Process aggregated data for line chart - show all emotions
  const getLineChartData = (): EmotionData[] => {
    if (!aggregatedData || Object.keys(aggregatedData).length === 0) {
      return [];
    }
    
    // Get top 5 emotions based on total score (increased from 3)
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
      .slice(0, 5)  // Increased to show more emotions
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
          * Showing top 5 emotions by score
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
    
    // Calculate the maximum value for proper sizing
    const maxValue = Math.max(...bubbleData.map(b => b.value));
    
    // Calculate max bubble size based on container dimensions and number of bubbles
    // Smaller container or more bubbles = smaller max size
    const bubbleCount = bubbleData.length;
    const containerArea = containerSize.width * containerSize.height;
    const maxSize = Math.min(
      Math.sqrt(containerArea / (bubbleCount * Math.PI)) * 2.2, // Based on area
      isMobile ? 90 : 120, // Maximum size cap, smaller on mobile
      containerSize.width * 0.3, // No more than 30% of container width
      containerSize.height * 0.3 // No more than 30% of container height
    );
    
    const minSize = Math.max(30, maxSize * 0.3); // At least 30px or 30% of maxSize
    
    return (
      <div className="w-full h-[300px] flex flex-col items-center justify-center relative">
        <div className="absolute top-0 right-0 text-xs text-muted-foreground">
          * Size represents intensity, drag to move
        </div>
        
        {/* Container with boundary constraints - use ref to get actual dimensions */}
        <div 
          ref={containerRef}
          className="relative w-full h-[250px] border-2 border-dashed border-muted/20 rounded-lg overflow-hidden"
        >
          {bubbleData.map((item, index) => {
            // Calculate size based on value relative to max
            const size = minSize + ((item.value / maxValue) * (maxSize - minSize));
            
            // Calculate initial position ensuring bubbles are fully visible
            // Give some buffer around edges equal to 1/4 of the bubble size
            const buffer = size / 4;
            const xRange = containerSize.width - size - buffer * 2;
            const yRange = containerSize.height - size - buffer * 2;
            
            const x = buffer + (index % 3 * (xRange / 3)) + (Math.random() * (xRange / 4));
            const y = buffer + (Math.floor(index / 3) % 3 * (yRange / 3)) + (Math.random() * (yRange / 4));

            return (
              <motion.div
                key={item.name}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.9 }}
                transition={{ 
                  duration: 0.5, 
                  delay: index * 0.1
                }}
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: item.color,
                  position: 'absolute',
                  left: x,
                  top: y,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: size > 70 ? '14px' : '12px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  zIndex: Math.floor(item.value)
                }}
                drag
                // Strict drag constraints to keep bubbles fully visible
                dragConstraints={{
                  left: 0,
                  right: containerSize.width - size,
                  top: 0,
                  bottom: containerSize.height - size
                }}
                // Less elasticity for more controlled movement
                dragElastic={0.05}
                whileDrag={{ scale: 1.02 }}
                dragTransition={{ 
                  bounceStiffness: 500, 
                  bounceDamping: 20
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
