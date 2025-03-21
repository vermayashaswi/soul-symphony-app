
import { useState } from 'react';
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

// Sample data - in a real app this would come from user entries
const emotionData = [
  { day: 'Mon', joy: 7, anxiety: 4, energy: 6 },
  { day: 'Tue', joy: 5, anxiety: 6, energy: 4 },
  { day: 'Wed', joy: 6, anxiety: 3, energy: 7 },
  { day: 'Thu', joy: 8, anxiety: 2, energy: 8 },
  { day: 'Fri', joy: 7, anxiety: 5, energy: 6 },
  { day: 'Sat', joy: 9, anxiety: 1, energy: 9 },
  { day: 'Sun', joy: 8, anxiety: 2, energy: 7 },
];

const bubbleData = [
  { name: 'Joy', value: 35, color: '#4299E1' },
  { name: 'Gratitude', value: 20, color: '#48BB78' },
  { name: 'Calm', value: 15, color: '#9F7AEA' },
  { name: 'Anxiety', value: 10, color: '#F56565' },
  { name: 'Sadness', value: 8, color: '#718096' },
  { name: 'Anger', value: 7, color: '#ED8936' },
  { name: 'Excitement', value: 5, color: '#ECC94B' },
];

type ChartType = 'line' | 'area' | 'bubble';

interface EmotionChartProps {
  className?: string;
  timeframe?: 'week' | 'month' | 'year';
}

export function EmotionChart({ className, timeframe = 'week' }: EmotionChartProps) {
  const [chartType, setChartType] = useState<ChartType>('line');

  const chartTypes = [
    { id: 'line', label: 'Line' },
    { id: 'area', label: 'Area' },
    { id: 'bubble', label: 'Emotion Bubbles' },
  ];

  const renderLineChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={emotionData}
        margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="day" stroke="#888" fontSize={12} tickMargin={10} />
        <YAxis stroke="#888" fontSize={12} tickMargin={10} />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.8)', 
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', 
            border: 'none' 
          }} 
        />
        <Line
          type="monotone"
          dataKey="joy"
          stroke="#4299E1"
          strokeWidth={3}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="anxiety"
          stroke="#F56565"
          strokeWidth={3}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="energy"
          stroke="#48BB78"
          strokeWidth={3}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );

  const renderAreaChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={emotionData}
        margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="day" stroke="#888" fontSize={12} tickMargin={10} />
        <YAxis stroke="#888" fontSize={12} tickMargin={10} />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.8)', 
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', 
            border: 'none' 
          }} 
        />
        <Area
          type="monotone"
          dataKey="joy"
          stroke="#4299E1"
          fill="#4299E1"
          fillOpacity={0.2}
        />
        <Area
          type="monotone"
          dataKey="anxiety"
          stroke="#F56565"
          fill="#F56565"
          fillOpacity={0.2}
        />
        <Area
          type="monotone"
          dataKey="energy"
          stroke="#48BB78"
          fill="#48BB78"
          fillOpacity={0.2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );

  const renderBubbleChart = () => (
    <div className="w-full h-[300px] flex items-center justify-center relative">
      {bubbleData.map((item, index) => {
        // Calculate position based on index
        const angle = (index / bubbleData.length) * Math.PI * 2;
        const radius = 100;
        const x = Math.cos(angle) * radius + 150; // center x
        const y = Math.sin(angle) * radius + 120; // center y
        
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
              width: `${item.value * 1.5}px`,
              height: `${item.value * 1.5}px`,
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

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-wrap justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">Emotion Trends</h3>
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
        {chartType === 'area' && renderAreaChart()}
        {chartType === 'bubble' && renderBubbleChart()}
      </div>
      
      <div className="flex justify-between mt-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-400"></div>
          <span>Joy</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400"></div>
          <span>Anxiety</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400"></div>
          <span>Energy</span>
        </div>
      </div>
    </div>
  );
}

export default EmotionChart;
