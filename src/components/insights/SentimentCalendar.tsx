
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TimeRange } from '@/hooks/use-insights-data';
import { format, parseISO, isValid, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface SentimentDataPoint {
  date: Date;
  sentiment: number;
}

interface SentimentCalendarProps {
  sentimentData: SentimentDataPoint[];
  timeRange: TimeRange;
}

const SentimentCalendar = ({ sentimentData, timeRange }: SentimentCalendarProps) => {
  const [selectedView, setSelectedView] = useState<'calendar' | 'chart'>('calendar');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const isMobile = useIsMobile();
  
  // Process the data for both views
  const processedData = React.useMemo(() => {
    if (!sentimentData || sentimentData.length === 0) return [];

    // Group by date and average sentiment for each day
    const dateMap = new Map<string, { total: number; count: number }>();
    
    sentimentData.forEach(point => {
      // Validate the date
      if (!point.date || !isValid(new Date(point.date))) {
        console.warn('Invalid date in sentiment data:', point);
        return;
      }

      // Validate the sentiment
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
    
    // Convert to array of data points
    return Array.from(dateMap.entries()).map(([date, data]) => ({
      date,
      formattedDate: format(parseISO(date), 'MMM d'),
      sentiment: data.total / data.count,
      // Categorize the sentiment
      category: (data.total / data.count) >= 0.3 
        ? 'positive' 
        : (data.total / data.count) >= -0.1 
          ? 'neutral' 
          : 'negative'
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [sentimentData]);

  // Get color based on sentiment category
  const getSentimentColor = (category: string): string => {
    switch (category) {
      case 'positive': return '#4ade80'; // green-400
      case 'neutral': return '#facc15';  // yellow-400
      case 'negative': return '#ef4444'; // red-500
      default: return '#94a3b8';         // slate-400
    }
  };

  // Generate days for the current month calendar view
  const calendarDays = React.useMemo(() => {
    const startDate = startOfMonth(currentMonth);
    const endDate = endOfMonth(currentMonth);
    
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  // Custom Tooltip for charts
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

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      return newDate;
    });
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      return newDate;
    });
  };

  // Get sentiment for a specific date
  const getSentimentForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return processedData.find(d => d.date === dateString);
  };

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg md:text-xl font-bold">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              <span>Sentiment Calendar</span>
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
            <p className="text-muted-foreground">No sentiment data available for this period</p>
          </div>
        ) : selectedView === 'calendar' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button 
                onClick={goToPreviousMonth}
                className="p-1 rounded-full hover:bg-secondary"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <h3 className="font-medium">
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              
              <button 
                onClick={goToNextMonth}
                className="p-1 rounded-full hover:bg-secondary"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} className="py-1">{day}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              
              {calendarDays.map((day) => {
                const sentimentData = getSentimentForDate(day);
                const isToday = isSameDay(day, new Date());
                
                return (
                  <div 
                    key={day.toString()} 
                    className={cn(
                      "relative aspect-square flex items-center justify-center rounded-full text-xs font-medium",
                      isToday && "ring-2 ring-primary ring-offset-2",
                      !sentimentData && "hover:bg-secondary/50 cursor-pointer"
                    )}
                    style={{
                      backgroundColor: sentimentData ? getSentimentColor(sentimentData.category) + '40' : undefined,
                      color: sentimentData ? getSentimentColor(sentimentData.category) : undefined
                    }}
                    title={sentimentData ? `Sentiment: ${sentimentData.sentiment.toFixed(2)}` : 'No data'}
                  >
                    {day.getDate()}
                    {sentimentData && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full bg-current" />
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-center items-center gap-4 text-xs text-muted-foreground pt-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500/40" />
                <span>Negative</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-yellow-400/40" />
                <span>Neutral</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-400/40" />
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

export default SentimentCalendar;
