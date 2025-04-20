
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TimeRange } from '@/hooks/use-insights-data';
import { 
  format, parseISO, isValid, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameDay, addMonths, subMonths, addWeeks, subWeeks, eachMonthOfInterval,
  startOfYear, endOfYear, getMonth, getDate, setMonth, setDate, subYears, addYears
} from 'date-fns';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface SentimentDataPoint {
  date: Date;
  sentiment: number;
}

interface MoodCalendarProps {
  sentimentData: SentimentDataPoint[];
  timeRange: TimeRange;
}

const MoodCalendar = ({ sentimentData, timeRange }: MoodCalendarProps) => {
  const [selectedView, setSelectedView] = useState<'calendar' | 'chart'>('calendar');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const isMobile = useIsMobile();
  
  const processedData = React.useMemo(() => {
    if (!sentimentData || sentimentData.length === 0) return [];

    const dateMap = new Map<string, { total: number; count: number }>();
    
    sentimentData.forEach(point => {
      if (!point.date || !isValid(new Date(point.date))) {
        console.warn('Invalid date in sentiment data:', point);
        return;
      }

      const sentimentValue = typeof point.sentiment === 'number' 
        ? point.sentiment 
        : typeof point.sentiment === 'string' 
          ? parseFloat(point.sentiment) 
          : null;
          
      if (sentimentValue === null || isNaN(sentimentValue)) {
        console.warn('Invalid sentiment value:', point.sentiment);
        return;
      }
      
      const dateKey = format(new Date(point.date), 'yyyy-MM-dd');
      
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { total: 0, count: 0 });
      }
      
      const existing = dateMap.get(dateKey)!;
      existing.total += sentimentValue;
      existing.count += 1;
    });
    
    return Array.from(dateMap.entries()).map(([date, data]) => ({
      date,
      formattedDate: format(parseISO(date), 'MMM d'),
      sentiment: data.total / data.count,
      category: (data.total / data.count) >= 0.3 
        ? 'positive' 
        : (data.total / data.count) >= -0.1 
          ? 'neutral' 
          : 'negative'
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [sentimentData]);

  const getSentimentColor = (category: string): string => {
    switch (category) {
      case 'positive': return '#4ade80';
      case 'neutral': return '#facc15';
      case 'negative': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  const calendarDays = React.useMemo(() => {
    if (timeRange === 'month') {
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);
      return eachDayOfInterval({ start: startDate, end: endDate });
    } else if (timeRange === 'week') {
      const startDate = new Date(currentDate);
      startDate.setDate(currentDate.getDate() - currentDate.getDay());
      const days = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        days.push(day);
      }
      return days;
    } else if (timeRange === 'today') {
      return [currentDate];
    } else if (timeRange === 'year') {
      return [];
    }
    return [];
  }, [currentDate, timeRange]);

  const yearMonths = React.useMemo(() => {
    if (timeRange === 'year') {
      const startDate = startOfYear(currentDate);
      const endDate = endOfYear(currentDate);
      return eachMonthOfInterval({ start: startDate, end: endDate });
    }
    return [];
  }, [currentDate, timeRange]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border p-2 rounded-md shadow-md">
          <p className="font-medium">{data.formattedDate}</p>
          <p className="text-sm">
            Sentiment: <span style={{ color: getSentimentColor(data.category) }}>
              {data.sentiment.toFixed(2)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  const navigatePrevious = () => {
    setCurrentDate(prev => {
      switch (timeRange) {
        case 'today':
          const prevDay = new Date(prev);
          prevDay.setDate(prevDay.getDate() - 1);
          return prevDay;
        case 'week':
          return subWeeks(prev, 1);
        case 'month':
          return subMonths(prev, 1);
        case 'year':
          return subYears(prev, 1);
        default:
          return prev;
      }
    });
  };

  const navigateNext = () => {
    setCurrentDate(prev => {
      switch (timeRange) {
        case 'today':
          const nextDay = new Date(prev);
          nextDay.setDate(nextDay.getDate() + 1);
          return nextDay;
        case 'week':
          return addWeeks(prev, 1);
        case 'month':
          return addMonths(prev, 1);
        case 'year':
          return addYears(prev, 1);
        default:
          return prev;
      }
    });
  };

  const getSentimentForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return processedData.find(d => d.date === dateString);
  };

  React.useEffect(() => {
    setCurrentDate(new Date());
  }, [timeRange]);

  const renderTimeTitle = () => {
    switch (timeRange) {
      case 'today':
        return format(currentDate, 'MMMM d, yyyy');
      case 'week':
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return `${format(startOfWeek, 'MMM d')} - ${format(endOfWeek, 'MMM d, yyyy')}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'year':
        return format(currentDate, 'yyyy');
      default:
        return '';
    }
  };

  const renderYearGrid = () => {
    const year = currentDate.getFullYear();
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    
    return (
      <div className="w-full overflow-x-auto">
        <div className="min-w-full">
          <div className="grid grid-cols-[auto_repeat(12,1fr)] gap-0.5">
            <div className="p-0.5 text-right font-medium text-xs text-muted-foreground">Day</div>
            
            {yearMonths.map((month, idx) => (
              <div key={idx} className="p-0.5 text-center text-xs font-medium text-muted-foreground">
                {format(month, 'MMM')}
              </div>
            ))}
            
            {days.map(day => (
              <React.Fragment key={day}>
                <div className="p-0.5 text-right text-xs font-medium text-muted-foreground">
                  {day}
                </div>
                
                {yearMonths.map((month, monthIdx) => {
                  const date = new Date(year, monthIdx, day);
                  const isValidDate = date.getDate() === day;
                  
                  if (!isValidDate) {
                    return <div key={monthIdx} className="h-2 w-2"></div>;
                  }
                  
                  const sentimentData = getSentimentForDate(date);
                  const isToday = isSameDay(date, new Date());
                  
                  return (
                    <div 
                      key={monthIdx}
                      className={cn(
                        "h-2 w-2 flex items-center justify-center rounded-full text-[0.5rem]",
                        isToday && "ring-1 ring-primary",
                        !sentimentData && "opacity-20"
                      )}
                      style={{
                        backgroundColor: sentimentData 
                          ? getSentimentColor(sentimentData.category) + '80'
                          : '#f1f1f1'
                      }}
                      title={sentimentData 
                        ? `${format(date, 'MMM d')}: ${sentimentData.sentiment.toFixed(2)}` 
                        : `${format(date, 'MMM d')}: No data`
                      }
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg md:text-xl font-bold">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              <span>Mood Calendar</span>
            </div>
          </CardTitle>
          
          <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v as 'calendar' | 'chart')} className="ml-auto">
            <TabsList className="h-8">
              <TabsTrigger value="calendar" className="h-7 px-3 text-xs">Calendar</TabsTrigger>
              <TabsTrigger value="chart" className="h-7 px-3 text-xs">Trend</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      
      <CardContent>
        {processedData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center">
            <p className="text-muted-foreground">No mood data available for this period</p>
          </div>
        ) : selectedView === 'calendar' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button 
                onClick={navigatePrevious}
                className="p-1 rounded-full hover:bg-secondary"
                aria-label="Previous period"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <h3 className="font-medium">
                {renderTimeTitle()}
              </h3>
              
              <button 
                onClick={navigateNext}
                className="p-1 rounded-full hover:bg-secondary"
                aria-label="Next period"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            
            {timeRange === 'year' ? (
              renderYearGrid()
            ) : timeRange === 'month' ? (
              <div className="space-y-1">
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                    <div key={day} className="py-1">{day}</div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  
                  {calendarDays.map((day) => {
                    const sentimentData = getSentimentForDate(day);
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <div 
                        key={day.toString()} 
                        className={cn(
                          "aspect-square flex items-center justify-center rounded-full text-xs",
                          isToday && "ring-2 ring-primary ring-offset-1",
                        )}
                      >
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          {day.getDate()}
                        </div>
                        {sentimentData && (
                          <div 
                            className="absolute inset-0 rounded-full opacity-80"
                            style={{
                              backgroundColor: getSentimentColor(sentimentData.category),
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : timeRange === 'week' ? (
              <div className="space-y-1">
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => (
                    <div key={index} className="flex flex-col items-center">
                      <div className="text-xs text-muted-foreground mb-1">
                        {format(day, 'EEE')}
                      </div>
                      <div className="text-xs mb-1">
                        {format(day, 'd')}
                      </div>
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          isSameDay(day, new Date()) && "ring-2 ring-primary ring-offset-1",
                        )}
                        style={{
                          backgroundColor: getSentimentForDate(day) 
                            ? getSentimentColor(getSentimentForDate(day)!.category) + '80'
                            : '#f1f1f190',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="text-sm text-muted-foreground mb-2">
                  Today's Mood
                </div>
                <div
                  className={cn(
                    "w-24 h-24 rounded-full flex items-center justify-center text-lg font-medium",
                  )}
                  style={{
                    backgroundColor: getSentimentForDate(currentDate) 
                      ? getSentimentColor(getSentimentForDate(currentDate)!.category) + '80'
                      : '#f1f1f190',
                    color: getSentimentForDate(currentDate) ? '#fff' : '#666'
                  }}
                >
                  {getSentimentForDate(currentDate) ? 
                    (getSentimentForDate(currentDate)!.sentiment >= 0.3 ? '😊' : 
                     getSentimentForDate(currentDate)!.sentiment >= -0.1 ? '😐' : '😔') : 
                    'No data'}
                </div>
              </div>
            )}
            
            <div className="flex justify-center items-center gap-4 text-xs text-muted-foreground pt-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <span>Negative</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                <span>Neutral</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-400/80" />
                <span>Positive</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={processedData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis 
                  dataKey="formattedDate" 
                  scale="point" 
                  padding={{ left: 10, right: 10 }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  domain={[-1, 1]} 
                  tickCount={5} 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Line 
                  type="monotone"
                  dataKey="sentiment" 
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ stroke: '#8b5cf6', strokeWidth: 2, r: 4, fill: 'white' }}
                  activeDot={{ r: 6, fill: '#8b5cf6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MoodCalendar;
