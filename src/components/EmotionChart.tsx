
import { useState, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

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
  timeframe?: 'today' | 'week' | 'month' | 'year';
  data?: { [key: string]: number }; // For single entry emotion data
  aggregatedData?: Array<{ date: string, emotions: { [key: string]: number } }>; // For multiple entries
}

// Color mapping for emotions
const EMOTION_COLORS: Record<string, string> = {
  joy: '#4299E1',
  happiness: '#48BB78',
  gratitude: '#38B2AC',
  calm: '#9F7AEA',
  anxiety: '#F56565',
  sadness: '#718096',
  anger: '#ED8936',
  fear: '#E53E3E',
  excitement: '#ECC94B',
  love: '#F687B3',
  stress: '#DD6B20',
  surprise: '#D69E2E',
  confusion: '#805AD5',
  disappointment: '#A0AEC0',
  pride: '#3182CE',
  shame: '#822727',
  guilt: '#744210',
  hope: '#2B6CB0',
  boredom: '#A0AEC0',
  disgust: '#62783E',
  contentment: '#319795'
};

// Get color for an emotion, with fallback
const getEmotionColor = (emotion: string): string => {
  const normalized = emotion.toLowerCase();
  return EMOTION_COLORS[normalized] || '#A3A3A3';
};

export function EmotionChart({ 
  className, 
  timeframe = 'week', 
  data, 
  aggregatedData 
}: EmotionChartProps) {
  const [chartType, setChartType] = useState<ChartType>('bubble');

  const chartTypes = [
    { id: 'line', label: 'Line' },
    { id: 'bubble', label: 'Emotion Bubbles' },
  ];
  
  // Process single entry emotion data for bubble chart
  const getBubbleData = (): EmotionBubbleData[] => {
    if (!data && !aggregatedData) return [];
    
    if (data) {
      // For a single entry
      return Object.entries(data)
        .map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value: value * 10, // Scale value for visualization
          color: getEmotionColor(name)
        }))
        .sort((a, b) => b.value - a.value);
    } else if (aggregatedData && aggregatedData.length > 0) {
      // For aggregated data, combine emotions across entries
      const combinedEmotions: Record<string, number> = {};
      
      aggregatedData.forEach(entry => {
        if (entry.emotions) {
          Object.entries(entry.emotions).forEach(([emotion, score]) => {
            combinedEmotions[emotion] = (combinedEmotions[emotion] || 0) + score;
          });
        }
      });
      
      return Object.entries(combinedEmotions)
        .map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value: (value / aggregatedData.length) * 10, // Average and scale
          color: getEmotionColor(name)
        }))
        .sort((a, b) => b.value - a.value);
    }
    
    return [];
  };
  
  // Process aggregated data for line chart
  const getLineChartData = (): EmotionData[] => {
    if (!aggregatedData || aggregatedData.length === 0) {
      return [];
    }
    
    // Get top 3 emotions based on frequency and average score
    const emotionCounts: Record<string, { count: number, total: number }> = {};
    
    aggregatedData.forEach(entry => {
      if (entry.emotions) {
        Object.entries(entry.emotions).forEach(([emotion, score]) => {
          if (!emotionCounts[emotion]) {
            emotionCounts[emotion] = { count: 0, total: 0 };
          }
          emotionCounts[emotion].count += 1;
          emotionCounts[emotion].total += score;
        });
      }
    });
    
    const topEmotions = Object.entries(emotionCounts)
      .map(([emotion, data]) => ({
        emotion,
        count: data.count,
        average: data.total / data.count
      }))
      .sort((a, b) => {
        // Sort by count first, then by average score
        if (b.count !== a.count) return b.count - a.count;
        return b.average - a.average;
      })
      .slice(0, 3)
      .map(item => item.emotion);
    
    // Create line chart data points
    return aggregatedData
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(entry => {
        const dataPoint: EmotionData = { day: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
        
        // Add the top emotions to the data point
        topEmotions.forEach(emotion => {
          if (entry.emotions && entry.emotions[emotion] !== undefined) {
            dataPoint[emotion] = entry.emotions[emotion];
          } else {
            dataPoint[emotion] = 0;
          }
        });
        
        return dataPoint;
      });
  };

  // Memoize chart data
  const bubbleData = useMemo(() => getBubbleData(), [data, aggregatedData]);
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
    
    // Filter to top 5 emotions for display
    const topBubbles = bubbleData.slice(0, 5);
    
    return (
      <div className="w-full h-[300px] flex items-center justify-center relative">
        {topBubbles.map((item, index) => {
          // Calculate position using a more distributed approach
          const sectionWidth = 360 / topBubbles.length;
          const sectionCenter = index * sectionWidth + (sectionWidth / 2);
          const angle = (sectionCenter / 180) * Math.PI;
          const radius = 100;
          const x = Math.cos(angle) * radius + 150;
          const y = Math.sin(angle) * radius + 120;
          
          // Scale bubble size proportionally to value
          const maxSize = 100;
          const minSize = 50;
          const maxValue = Math.max(...topBubbles.map(b => b.value));
          const size = minSize + ((item.value / maxValue) * (maxSize - minSize));
          
          return (
            <motion.div
              key={item.name}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                x: [x - 5, x + 5, x],
                y: [y - 5, y + 5, y]
              }}
              transition={{ 
                duration: 0.5, 
                delay: index * 0.1,
                x: { repeat: Infinity, duration: 3 + index, repeatType: 'reverse' },
                y: { repeat: Infinity, duration: 4 + index, repeatType: 'reverse' }
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
                fontSize: item.value > 15 ? '14px' : '12px',
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
    );
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-wrap justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">Emotions</h3>
        <div className="flex gap-2 mt-2 sm:mt-0">
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
        <div className="flex flex-wrap justify-start gap-4 mt-4 text-sm text-muted-foreground">
          {Object.keys(lineData[0])
            .filter(key => key !== 'day')
            .map(emotion => (
              <div key={emotion} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: getEmotionColor(emotion) }}
                ></div>
                <span>{emotion.charAt(0).toUpperCase() + emotion.slice(1)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default EmotionChart;
