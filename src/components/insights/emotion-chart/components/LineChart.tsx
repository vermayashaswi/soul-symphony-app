
import { 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { getEmotionColor } from '../constants';

type EmotionData = {
  day: string;
  [key: string]: number | string | null;
};

interface LineChartProps {
  data: EmotionData[];
  visibleEmotions: string[];
  onLegendClick: (emotion: string) => void;
}

const CustomDot = (props: any) => {
  const { cx, cy, stroke, strokeWidth, r, value } = props;
  
  // Defensive theme access
  let theme = 'light';
  try {
    const themeData = useTheme();
    theme = themeData.theme;
  } catch (error) {
    console.warn('Theme provider not available, using default theme');
  }
  
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

const EmotionLineLabel = (props: any) => {
  const { x, y, stroke, index, data, dataKey } = props;
  
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

export const LineChart = ({ data, visibleEmotions, onLegendClick }: LineChartProps) => {
  // Defensive theme access
  let theme = 'light';
  try {
    const themeData = useTheme();
    theme = themeData.theme;
  } catch (error) {
    console.warn('Theme provider not available, using default theme');
  }
  
  const isMobile = useIsMobile();

  const allEmotions = Object.keys(data[0] || {})
    .filter(key => key !== 'day')
    .filter(key => data.some(point => point[key] !== null));

  return (
    <>
      <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
        <RechartsLineChart
          data={data}
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
        </RechartsLineChart>
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
              onClick={() => onLegendClick(emotion)}
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
    </>
  );
};
