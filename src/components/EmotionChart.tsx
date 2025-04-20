import { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { cn } from '@/lib/utils';
import { AggregatedEmotionData, TimeRange } from '@/hooks/use-insights-data';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import TopEntitiesList from './insights/TopEntitiesList';
import EmotionLegend from './insights/EmotionLegend';
import { useTopEmotionsLineData } from '@/hooks/useTopEmotionsLineData';

type ChartType = 'line' | 'entities';

interface EmotionChartProps {
  className?: string;
  timeframe?: TimeRange;
  aggregatedData?: AggregatedEmotionData;
  entries?: Array<any>;
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
  stress: '#9333EA',
  surprise: '#F59E0B',
  confusion: '#6366F1',
  disappointment: '#2563EB',
  pride: '#06B6D4',
  shame: '#DC2626',
  guilt: '#B45309',
  hope: '#2DD4BF',
  boredom: '#4B5563',
  disgust: '#65A30D',
  contentment: '#0D9488',
  trust: '#A78BFA',
  anticipation: '#FB923C',
  pensiveness: '#93C5FD',
  serenity: '#A5F3FC',
  annoyance: '#FCD34D',
  vigilance: '#FCA5A5',
  interest: '#86EFAC',
  apprehension: '#FDA4AF',
  distraction: '#D8B4FE',
  admiration: '#C4B5FD'
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

const extractEntityNames = (entities: any): string[] => {
  if (!entities) return [];
  
  if (Array.isArray(entities)) {
    return entities.map(entity => {
      if (typeof entity === 'string') {
        return entity;
      } else if (entity && typeof entity === 'object' && entity.name) {
        return entity.name;
      } else if (entity && typeof entity === 'object' && entity.text) {
        return entity.text;
      }
      return '';
    }).filter(Boolean);
  }
  
  if (typeof entities === 'string') {
    try {
      const parsed = JSON.parse(entities);
      if (Array.isArray(parsed)) {
        return extractEntityNames(parsed);
      }
      return [];
    } catch (e) {
      return entities.split(',').map(e => e.trim()).filter(Boolean);
    }
  }
  
  if (typeof entities === 'object' && entities !== null && !Array.isArray(entities)) {
    return Object.keys(entities);
  }
  
  return [];
};

export function EmotionChart({
  className, timeframe = 'week', aggregatedData, entries = []
}: EmotionChartProps) {
  const [chartType, setChartType] = useState<ChartType>('line');
  const [visibleEmotions, setVisibleEmotions] = useState<string[]>([]);
  const { theme } = useTheme();
  const isMobile = useIsMobile();

  const chartTypes = [
    { id: 'line', label: 'Emotions' },
    { id: 'entities', label: 'Entities' },
  ];

  const { lineData, topEmotions } = useTopEmotionsLineData({
    aggregatedData,
    topN: 10
  });

  if ((visibleEmotions.length === 0 || !visibleEmotions.some(e => topEmotions.includes(e))) && topEmotions.length > 0) {
    setVisibleEmotions(topEmotions);
  }

  const entityCounts = (() => {
    let allEntities: string[] = [];
    
    if (aggregatedData && Object.values(aggregatedData).length > 0) {
      console.log("Processing entities from aggregatedData");
      Object.values(aggregatedData).forEach((arr: any) => {
        arr.forEach((point: any) => {
          if (point.entities) {
            const extractedNames = extractEntityNames(point.entities);
            allEntities.push(...extractedNames);
          }
        });
      });
    }
    
    if (allEntities.length === 0 && Array.isArray(entries) && entries.length > 0) {
      console.log("Processing entities from entries array, count:", entries.length);
      entries.forEach((entry: any) => {
        if (entry.entities) {
          console.log("Entry has entities:", typeof entry.entities, Array.isArray(entry.entities) ? 'array' : 'not array');
          const extractedNames = extractEntityNames(entry.entities);
          allEntities.push(...extractedNames);
        }
      });
    }

    console.log("Total entities extracted:", allEntities.length);
    
    const counts: Record<string, number> = {};
    allEntities.forEach(entity => {
      if (!entity || typeof entity !== 'string') return;
      
      const cleaned = entity.trim();
      if (cleaned) {
        counts[cleaned] = (counts[cleaned] || 0) + 1;
      }
    });
    
    console.log("Entity counts:", Object.entries(counts).length);
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  })();

  console.log("Final entity counts for display:", entityCounts);

  const handleLegendClick = (emotion: string) => {
    setVisibleEmotions(prev => {
      if (prev.length === 1 && prev[0] === emotion) return prev;
      if (prev.includes(emotion)) return prev.filter(e => e !== emotion);
      else return [...prev, emotion];
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
          <p className="text-muted-foreground">No data available for this timeframe</p>
        </div>
      );
    }
    const allEmotions = Object.keys(lineData[0])
      .filter(key => key !== 'day')
      .filter(key => lineData.some(point => point[key] !== null));
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
              tickFormatter={(value) => (typeof value === "number" ? value.toFixed(1) : value)}
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
                hide={!visibleEmotions.includes(emotion)}
                connectNulls={true}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <EmotionLegend
          allEmotions={allEmotions}
          visibleEmotions={visibleEmotions}
          getEmotionColor={getEmotionColor}
          onClick={handleLegendClick}
        />
        <div className="flex justify-center flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
          <span>* Click on a legend item to focus on that emotion</span>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-wrap justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">TOP</h3>
        <div className="flex gap-2">
          {chartTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setChartType(type.id as ChartType)}
              className={cn(
                "px-3 py-1 rounded-full text-sm capitalize",
                chartType === type.id
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
              style={{
                minWidth: 90
              }}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-card p-4 rounded-xl shadow-sm relative min-h-[300px]">
        {chartType === 'line' && renderLineChart()}
        {chartType === 'entities' && (
          <>
            <TopEntitiesList
              entityCounts={entityCounts}
              baseColor="#8b5cf6"
            />
            {entityCounts.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-muted-foreground">No entities found for this timeframe</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default EmotionChart;
