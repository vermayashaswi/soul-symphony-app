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
  stress: '#F97316',
  surprise: '#F59E0B',
  confusion: '#8B5CF6',
  disappointment: '#6366F1',
  pride: '#3B82F6',
  shame: '#DC2626',
  guilt: '#B45309',
  hope: '#2563EB',
  boredom: '#4B5563',
  disgust: '#65A30D',
  contentment: '#0D9488'
};

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
  
  const getBubbleData = (): EmotionBubbleData[] => {
    if (!aggregatedData) return [];
    
    const emotionScores: Record<string, number> = {};
    
    Object.entries(aggregatedData).forEach(([emotion, dataPoints]) => {
      const totalScore = dataPoints.reduce((sum, point) => sum + point.value, 0);
      emotionScores[emotion] = totalScore;
    });
    
    return Object.entries(emotionScores)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: value,
        color: getEmotionColor(name)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  };
  
  const getLineChartData = (): EmotionData[] => {
    if (!aggregatedData || Object.keys(aggregatedData).length === 0) {
      return [];
    }
    
    const emotionTotals: Record<string, number> = {};
    const dateMap: Map<string, Record<string, number>> = new Map();
    
    Object.entries(aggregatedData).forEach(([emotion, dataPoints]) => {
      emotionTotals[emotion] = dataPoints.reduce((sum, point) => sum + point.value, 0);
      
      dataPoints.forEach(point => {
        if (!dateMap.has(point.date)) {
          dateMap.set(point.date, {});
        }
        const dateEntry = dateMap.get(point.date)!;
        dateEntry[emotion] = point.value;
      });
    });
    
    const topEmotions = Object.entries(emotionTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emotion]) => emotion);
    
    return Array.from(dateMap.entries())
      .map(([date, emotions]) => {
        const dataPoint: EmotionData = { 
          day: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) 
        };
        
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
          * Only top 5 emotions are shown in line chart for readability
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
    
    const calculateBubblePositions = (bubbles: EmotionBubbleData[]) => {
      const canvasWidth = 600;
      const canvasHeight = 300;
      
      const positions: {x: number, y: number, size: number}[] = [];
      
      bubbles.forEach((bubble, index) => {
        const maxSize = 100;
        const minSize = 40;
        const maxValue = Math.max(...bubbles.map(b => b.value));
        const size = minSize + ((bubble.value / maxValue) * (maxSize - minSize));
        
        const angle = (index / bubbles.length) * 2 * Math.PI;
        const radius = 100;
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        
        const offsetRadius = radius + (index % 3 * 30);
        const x = centerX + Math.cos(angle) * offsetRadius;
        const y = centerY + Math.sin(angle) * offsetRadius;
        
        positions.push({ x, y, size });
      });
      
      return positions;
    };
    
    const bubblePositions = calculateBubblePositions(bubbleData);
    
    return (
      <div className="w-full h-[340px] flex flex-col items-center justify-center relative">
        <div className="absolute top-0 right-0 text-xs text-muted-foreground">
          * Size of bubble represents intensity
        </div>
        
        <div className="relative w-full h-[300px] border-2 border-dashed border-muted/20 rounded-lg overflow-visible">
          {bubbleData.map((item, index) => {
            const position = bubblePositions[index];
            
            return (
              <motion.div
                key={item.name}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  x: [
                    position.x - 5, 
                    position.x + 5, 
                    position.x
                  ],
                  y: [
                    position.y - 5, 
                    position.y + 5, 
                    position.y
                  ]
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
                  left: position.x - (position.size / 2),
                  top: position.y - (position.size / 2),
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: position.size > 70 ? '16px' : '14px',
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
