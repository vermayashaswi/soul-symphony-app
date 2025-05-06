
import React, { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { TimeRange } from '@/hooks/use-insights-data';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LineChart, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import MoodCalendarGrid from './MoodCalendarGrid';
import { filterDataByTimeRange, formatDateForTimeRange } from '@/utils/date-formatter';
import { addDays, addMonths, addWeeks, addYears, startOfDay, startOfMonth, startOfWeek, startOfYear, subDays, subMonths, subWeeks, subYears } from 'date-fns';

interface SentimentData {
  date: Date;
  sentiment: number;
}

interface MoodCalendarProps {
  sentimentData: SentimentData[];
  timeRange: TimeRange;
}

type ViewMode = 'chart' | 'calendar';

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
          <TranslatableText text={moodText} forceTranslate={true} />
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
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Function to navigate to previous time period
  const goToPrevious = () => {
    switch (timeRange) {
      case 'today':
        setCurrentDate(prevDate => subDays(prevDate, 1));
        break;
      case 'week':
        setCurrentDate(prevDate => subWeeks(prevDate, 1));
        break;
      case 'month':
        setCurrentDate(prevDate => subMonths(prevDate, 1));
        break;
      case 'year':
        setCurrentDate(prevDate => subYears(prevDate, 1));
        break;
    }
  };

  // Function to navigate to next time period
  const goToNext = () => {
    switch (timeRange) {
      case 'today':
        setCurrentDate(prevDate => addDays(prevDate, 1));
        break;
      case 'week':
        setCurrentDate(prevDate => addWeeks(prevDate, 1));
        break;
      case 'month':
        setCurrentDate(prevDate => addMonths(prevDate, 1));
        break;
      case 'year':
        setCurrentDate(prevDate => addYears(prevDate, 1));
        break;
    }
  };

  // Reset current date when time range changes
  useEffect(() => {
    setCurrentDate(new Date());
  }, [timeRange]);
  
  // Get the period label based on timeRange and current date
  const getPeriodLabel = () => {
    const now = currentDate;
    switch (timeRange) {
      case 'today':
        return formatDateForTimeRange(now, 'day', currentLanguage);
      case 'week': {
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);
        return `${formatDateForTimeRange(weekStart, 'short', currentLanguage)} - ${formatDateForTimeRange(weekEnd, 'short', currentLanguage)}`;
      }
      case 'month':
        return formatDateForTimeRange(now, 'month', currentLanguage);
      case 'year':
        return now.getFullYear().toString();
      default:
        return '';
    }
  };
  
  // Format the data for the chart
  const processChartData = () => {
    if (!sentimentData || sentimentData.length === 0) return [];
    
    // Get the start date for the selected time period
    let periodStart: Date;
    switch (timeRange) {
      case 'today':
        periodStart = startOfDay(currentDate);
        break;
      case 'week':
        periodStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        break;
      case 'month':
        periodStart = startOfMonth(currentDate);
        break;
      case 'year':
        periodStart = startOfYear(currentDate);
        break;
      default:
        periodStart = startOfDay(currentDate);
    }
    
    // Filter data based on the selected time period
    const filteredData = sentimentData.filter(item => {
      const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
      
      // Calculate end date based on time range
      let periodEnd: Date;
      switch (timeRange) {
        case 'today':
          periodEnd = addDays(periodStart, 1);
          break;
        case 'week':
          periodEnd = addWeeks(periodStart, 1);
          break;
        case 'month':
          periodEnd = addMonths(periodStart, 1);
          break;
        case 'year':
          periodEnd = addYears(periodStart, 1);
          break;
        default:
          periodEnd = addDays(periodStart, 1);
      }
      
      return itemDate >= periodStart && itemDate < periodEnd;
    });
    
    // Group data by formatted date to avoid duplicates
    const groupedData = new Map();
    
    filteredData.forEach(item => {
      const formattedDate = formatDateForTimeRange(item.date, timeRange, currentLanguage);
      const dateKey = formattedDate;
      
      if (!groupedData.has(dateKey)) {
        groupedData.set(dateKey, {
          formattedDate,
          originalDate: item.date,
          sentimentSum: item.sentiment,
          count: 1
        });
      } else {
        const existing = groupedData.get(dateKey);
        existing.sentimentSum += item.sentiment;
        existing.count += 1;
        
        // Keep the latest entry time for "today" view
        if (timeRange === 'today' && item.date > existing.originalDate) {
          existing.originalDate = item.date;
        }
      }
    });
    
    // Calculate averages for grouped data
    return Array.from(groupedData.values())
      .map(group => ({
        formattedDate: group.formattedDate,
        sentiment: group.sentimentSum / group.count,
        originalDate: group.originalDate
      }))
      .sort((a, b) => new Date(a.originalDate).getTime() - new Date(b.originalDate).getTime());
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
    
    // Prepare data for chart display - use a display index to ensure even spacing on x-axis
    const lineData = filteredChartData.map((item, index) => ({
      day: item.formattedDate,
      sentiment: item.sentiment,
      originalDate: item.originalDate,
      displayIndex: index // Add display index for even spacing
    }));

    return (
      <div className="flex flex-col h-full">
        <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
          <RechartsLineChart
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
              tickFormatter={(value, index) => value}
              interval={isMobile ? (lineData.length > 10 ? Math.floor(lineData.length / 6) : 0) : 0}
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
          </RechartsLineChart>
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
      <div className="text-center mb-4">
        <h2 className="text-lg font-semibold mb-1">
          <TranslatableText text="Mood Trends" forceTranslate={true} />
        </h2>
        <p className="text-sm text-muted-foreground">
          <TranslatableText text="Your sentiment changes over time" forceTranslate={true} />
        </p>
      </div>
      
      <div className="flex items-center justify-between mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={goToPrevious}
          className="text-muted-foreground hover:text-foreground"
          title="Previous period"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <div className="text-center font-medium">
          <TranslatableText text={getPeriodLabel()} forceTranslate={true} />
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={goToNext}
          className="text-muted-foreground hover:text-foreground"
          title="Next period"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="flex justify-center mb-6">
        <ToggleGroup 
          type="single" 
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as ViewMode)}
          variant="outline"
          className="border rounded-md"
        >
          <ToggleGroupItem 
            value="chart" 
            aria-label="Chart view"
            className={cn(
              "data-[state=on]:bg-muted",
              "w-10 h-10 p-2"
            )}
          >
            <LineChart className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="calendar" 
            aria-label="Calendar view"
            className={cn(
              "data-[state=on]:bg-muted",
              "w-10 h-10 p-2"
            )}
          >
            <Calendar className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      
      <div className={cn(
        "h-auto", 
        viewMode === 'chart' ? "h-[300px] md:h-[350px]" : "",
        viewMode === 'calendar' && timeRange === 'year' ? "min-h-[490px]" : "h-[300px] md:h-[350px]"
      )}>
        {viewMode === 'chart' ? (
          renderLineChart()
        ) : (
          <MoodCalendarGrid 
            sentimentData={sentimentData}
            timeRange={timeRange}
            currentDate={currentDate}
          />
        )}
      </div>
    </div>
  );
};

export default MoodCalendar;
