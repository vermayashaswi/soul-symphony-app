
import React, { useEffect } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { TimeRange } from '@/hooks/use-insights-data';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea
} from 'recharts';

interface SentimentData {
  date: Date;
  sentiment: number;
}

interface MoodCalendarProps {
  sentimentData: SentimentData[];
  timeRange: TimeRange;
}

interface CustomDotProps {
  cx: number;
  cy: number;
  payload: any;
}

const CustomDot = (props: CustomDotProps) => {
  const { cx, cy, payload } = props;
  const sentiment = payload.sentiment;
  
  let color = '#3b82f6'; // default blue
  if (sentiment >= 0.2) {
    color = '#4ade80'; // green for positive
  } else if (sentiment <= -0.2) {
    color = '#ea384c'; // red for negative
  } else {
    color = '#facc15'; // yellow for neutral
  }
  
  return (
    <circle cx={cx} cy={cy} r={4} stroke="white" strokeWidth={1} fill={color} />
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const sentiment = payload[0].value;
    let moodText = "Neutral";
    let moodColor = "#facc15";
    
    if (sentiment >= 0.2) {
      moodText = "Positive";
      moodColor = "#4ade80";
    } else if (sentiment <= -0.2) {
      moodText = "Negative";
      moodColor = "#ea384c";
    }
    
    return (
      <div className="custom-tooltip bg-background p-2 border rounded-md shadow-md">
        <p className="date">{label}</p>
        <p className="sentiment" style={{ color: moodColor }}>
          <TranslatableText text={moodText} forceTranslate={true} />: {sentiment.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

const MoodCalendar: React.FC<MoodCalendarProps> = ({ sentimentData, timeRange }) => {
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const { currentLanguage } = useTranslation();
  
  // Format the data for the chart
  const processChartData = () => {
    if (!sentimentData || sentimentData.length === 0) return [];
    
    return sentimentData.map(item => ({
      formattedDate: formatDate(item.date, timeRange, currentLanguage),
      sentiment: item.sentiment,
      originalDate: item.date // Keep original date for proper sorting
    })).sort((a, b) => {
      // Sort by original date in ascending order for the chart
      return new Date(a.originalDate).getTime() - new Date(b.originalDate).getTime();
    });
  };
  
  const formatDate = (date: Date, range: TimeRange, language: string): string => {
    if (!date) return '';
    
    // Ensure we have a valid Date object
    const d = date instanceof Date ? date : new Date(date);
    
    // Language-aware date formatting options
    const options: Intl.DateTimeFormatOptions = {};
    
    switch (range) {
      case 'today':
        // Format as HH:MM
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.hour12 = false; // Use 24-hour format for consistency
        break;
        
      case 'week':
        // Format as day of week (e.g., Mon, Tue)
        options.weekday = 'short';
        break;
        
      case 'month':
        // Format as day of month (e.g., 1, 15)
        options.day = 'numeric';
        break;
        
      case 'year':
        // Format as short month (e.g., Jan, Feb)
        options.month = 'short';
        break;
        
      default:
        // Default to day + short month (e.g., 15 Jan)
        options.day = 'numeric';
        options.month = 'short';
    }
    
    try {
      // Format the date using the current language
      return new Intl.DateTimeFormat(language, options).format(d);
    } catch (error) {
      console.error('Error formatting date:', error);
      // Fallback to English formatting
      return new Intl.DateTimeFormat('en', options).format(d);
    }
  };

  const filteredChartData = processChartData();

  const renderLineChart = () => {
    if (filteredChartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">
            <TranslatableText text="No data available for this timeframe" forceTranslate={true} />
          </p>
        </div>
      );
    }
    
    // Prepare data for chart display
    const lineData = filteredChartData.map(item => ({
      day: item.formattedDate,
      sentiment: item.sentiment
    }));

    return (
      <div className="flex flex-col h-full">
        <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
          <LineChart
            data={lineData}
            margin={{ top: 20, right: isMobile ? 10 : 60, left: 0, bottom: 10 }}
          >
            {/* Gradient defs remain for line or dot usage if you want */}
            <defs>
              <linearGradient id="line-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.15" />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#eee'} />
            <XAxis 
              dataKey="day" 
              stroke="#888" 
              fontSize={12} 
              tickMargin={10}
              tickFormatter={(value) => value} // Use the already formatted date
            />
            <YAxis 
              stroke="#888" 
              fontSize={12} 
              tickMargin={10} 
              domain={[-1, 1]} 
              ticks={[-1, -0.5, 0, 0.5, 1]}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* ReferenceAreas for coloring the bands */}
            <ReferenceArea y1={0.2} y2={1} fill="#4ade80" fillOpacity={0.18} ifOverflow="visible" />
            <ReferenceArea y1={-0.2} y2={0.2} fill="#facc15" fillOpacity={0.20} ifOverflow="visible" />
            <ReferenceArea y1={-1} y2={-0.2} fill="#ea384c" fillOpacity={0.18} ifOverflow="visible" />

            <Line 
              type="monotone"
              dataKey="sentiment"
              stroke="#3b82f6" // blue-500 for bright line as in screenshot
              strokeWidth={2}
              dot={(props) => <CustomDot cx={props.cx} cy={props.cy} payload={props.payload} />}
              activeDot={{ r: 6 }}
            />
            <ReferenceLine y={-0.2} stroke="#facc15" strokeDasharray="4 2" ifOverflow="visible" strokeWidth={1} />
            <ReferenceLine y={0.2} stroke="#4ade80" strokeDasharray="4 2" ifOverflow="visible" strokeWidth={1} />
          </LineChart>
        </ResponsiveContainer>
        
        <div className="flex justify-center gap-4 text-xs text-muted-foreground mt-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ background: "#4ade80" }} />
            <TranslatableText text="Positive" forceTranslate={true} />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ background: "#facc15" }} />
            <TranslatableText text="Neutral" forceTranslate={true} />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ background: "#ea384c" }} />
            <TranslatableText text="Negative" forceTranslate={true} />
          </div>
        </div>
      </div>
    );
  };

  // Force rerender when language or time range changes
  useEffect(() => {
    // This will trigger a rerender when the language or time range changes
    console.log('Language or timeRange changed in MoodCalendar:', currentLanguage, timeRange);
  }, [currentLanguage, timeRange]);

  return (
    <div className="bg-background rounded-xl shadow-sm border w-full p-6 md:p-8">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold mb-1">
          <TranslatableText text="Mood Trends" forceTranslate={true} />
        </h2>
        <p className="text-sm text-muted-foreground">
          <TranslatableText text="Your sentiment changes over time" forceTranslate={true} />
        </p>
      </div>
      
      <div className="h-[300px] md:h-[350px]">
        {renderLineChart()}
      </div>
    </div>
  );
};

export default MoodCalendar;
