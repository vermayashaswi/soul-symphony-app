
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TimeRange } from '@/hooks/use-insights-data';
import { 
  format, parseISO, isValid, 
  startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks,
  addDays, subDays, getYear, getMonth, getDaysInMonth,
  isWithinInterval, startOfYear, endOfYear, startOfDay, endOfDay
} from 'date-fns';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  Tooltip, ReferenceLine, Area, CartesianGrid 
} from 'recharts';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/hooks/use-theme';
import { MoodDataPoint } from '@/types/journal';

interface MoodCalendarProps {
  sentimentData: MoodDataPoint[];
  timeRange: TimeRange;
}

const MoodCalendar = ({ sentimentData, timeRange }: MoodCalendarProps) => {
  const [selectedView, setSelectedView] = useState<'calendar' | 'chart'>('calendar');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  
  useEffect(() => {
    setCurrentDate(new Date());
  }, [timeRange]);
  
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
    
    return Array.from(dateMap.entries()).map(([date, data]) => {
      const avgSentiment = data.total / data.count;
      return {
        date,
        formattedDate: format(parseISO(date), 'MMM d'),
        sentiment: avgSentiment,
        category: avgSentiment >= 0.3 
          ? 'positive' 
          : avgSentiment >= -0.1 
            ? 'neutral' 
            : 'negative'
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [sentimentData]);

  // Filter data based on the current time range
  const filteredChartData = React.useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    
    switch (timeRange) {
      case 'today':
        startDate = startOfDay(currentDate);
        endDate = endOfDay(currentDate);
        break;
      case 'week':
        startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
        endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
        break;
      case 'month':
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
        break;
      case 'year':
        startDate = startOfYear(currentDate);
        endDate = endOfYear(currentDate);
        break;
      default:
        startDate = startOfDay(now);
        endDate = endOfDay(now);
    }
    
    return processedData.filter(dataPoint => {
      const date = parseISO(dataPoint.date);
      return isWithinInterval(date, { start: startDate, end: endDate });
    });
  }, [processedData, timeRange, currentDate]);

  const getSentimentColor = (category: string): string => {
    switch (category) {
      case 'positive': return '#4ade80';
      case 'neutral': return '#facc15';
      case 'negative': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  const calendarDays = React.useMemo(() => {
    if (timeRange === 'today') {
      return [currentDate];
    } else if (timeRange === 'week') {
      const startDay = startOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: startDay, end: endOfWeek(currentDate, { weekStartsOn: 1 }) });
    } else if (timeRange === 'month') {
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);
      return eachDayOfInterval({ start: startDate, end: endDate });
    } else if (timeRange === 'year') {
      return [];
    }
    return [];
  }, [currentDate, timeRange]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border p-2 rounded-md shadow-md">
          <p className="font-medium">{data.formattedDate}</p>
          <p className="text-sm text-muted-foreground">
            {data.sentiment >= 0.3 
              ? 'Positive' 
              : data.sentiment >= -0.1 
                ? 'Neutral' 
                : 'Negative'
            }
          </p>
        </div>
      );
    }
    return null;
  };

  const goToPrevious = () => {
    if (timeRange === 'today') {
      setCurrentDate(prev => subDays(prev, 1));
    } else if (timeRange === 'week') {
      setCurrentDate(prev => subWeeks(prev, 1));
    } else if (timeRange === 'month') {
      setCurrentDate(prev => subMonths(prev, 1));
    } else if (timeRange === 'year') {
      setCurrentDate(prev => new Date(prev.getFullYear() - 1, 0, 1));
    }
  };

  const goToNext = () => {
    if (timeRange === 'today') {
      setCurrentDate(prev => addDays(prev, 1));
    } else if (timeRange === 'week') {
      setCurrentDate(prev => addWeeks(prev, 1));
    } else if (timeRange === 'month') {
      setCurrentDate(prev => addMonths(prev, 1));
    } else if (timeRange === 'year') {
      setCurrentDate(prev => new Date(prev.getFullYear() + 1, 0, 1));
    }
  };

  const getSentimentForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return processedData.find(d => d.date === dateString);
  };

  const renderYearView = () => {
    const year = getYear(currentDate);
    const months = Array.from({ length: 12 }, (_, i) => i);
    
    return (
      <div className="w-full overflow-auto">
        <div className="min-w-full">
          <div className="grid grid-cols-12 text-center mb-1">
            {months.map(month => (
              <div key={month} className="text-xs text-muted-foreground">
                {format(new Date(year, month, 1), 'MMM')}
              </div>
            ))}
          </div>
          
          <div className="flex">
            <div className="flex flex-col mr-1">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <div key={day} className="h-[10px] text-[9px] text-muted-foreground flex items-center">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-12 gap-[2px] flex-1">
              {months.map(month => {
                const daysInMonth = getDaysInMonth(new Date(year, month));
                
                return (
                  <div key={month} className="flex flex-col gap-[2px]">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                      if (day > daysInMonth) {
                        return <div key={day} className="h-[10px]"></div>;
                      }
                      
                      const date = new Date(year, month, day);
                      const sentimentData = getSentimentForDate(date);
                      
                      return (
                        <div 
                          key={day}
                          className={cn(
                            "h-[10px] w-[10px] rounded-full",
                            !sentimentData && "bg-gray-100 dark:bg-gray-800 opacity-20"
                          )}
                          style={{
                            backgroundColor: sentimentData 
                              ? getSentimentColor(sentimentData.category) 
                              : undefined
                          }}
                          title={sentimentData 
                            ? `${format(date, 'MMM d')}: ${sentimentData.sentiment.toFixed(2)}` 
                            : `${format(date, 'MMM d')}: No data`
                          }
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const sentimentData = getSentimentForDate(currentDate);
    
    return (
      <div className="flex justify-center py-10">
        <div 
          className={cn(
            "h-16 w-16 rounded-full flex items-center justify-center",
            !sentimentData && "bg-gray-100 dark:bg-gray-800"
          )}
          style={{
            backgroundColor: sentimentData 
              ? getSentimentColor(sentimentData.category) + '40'
              : undefined
          }}
        />
      </div>
    );
  };

  const renderWeekView = () => {
    return (
      <div className="py-4">
        <div className="grid grid-cols-7 gap-2 text-center">
          {calendarDays.map(day => (
            <div key={day.toString()} className="flex flex-col items-center">
              <div className="text-xs text-muted-foreground mb-2">
                {format(day, 'EEE')}
              </div>
              <div className="text-xs mb-2">
                {format(day, 'd')}
              </div>
              
              {renderDayMood(day)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDayMood = (day: Date) => {
    const sentimentData = getSentimentForDate(day);
    
    return (
      <div 
        className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center",
          !sentimentData && "bg-gray-100 dark:bg-gray-800"
        )}
        style={{
          backgroundColor: sentimentData 
            ? getSentimentColor(sentimentData.category) + '40'
            : undefined
        }}
        title={sentimentData 
          ? `Sentiment: ${sentimentData.sentiment.toFixed(2)}` 
          : 'No data'
        }
      />
    );
  };

  const renderMonthView = () => {
    const firstDayOfMonth = startOfMonth(currentDate);
    const firstDayWeekday = firstDayOfMonth.getDay();
    const startOffset = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
            <div key={day} className="py-1">{day}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-start-${i}`} className="aspect-square" />
          ))}
          
          {calendarDays.map((day) => {
            const sentimentData = getSentimentForDate(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div 
                key={day.toString()} 
                className={cn(
                  "relative aspect-square flex items-center justify-center",
                  isToday && "ring-2 ring-primary ring-offset-1"
                )}
              >
                <div 
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-sm",
                    !sentimentData && "bg-gray-100 dark:bg-gray-800 opacity-30"
                  )}
                  style={{
                    backgroundColor: sentimentData 
                      ? getSentimentColor(sentimentData.category) + '40'
                      : undefined
                  }}
                  title={sentimentData 
                    ? `Sentiment: ${sentimentData.sentiment.toFixed(2)}` 
                    : 'No data'
                  }
                >
                  {format(day, 'd')}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
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
    if (filteredChartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No data available for this timeframe</p>
        </div>
      );
    }
    
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
            <defs>
              <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="neutralGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#facc15" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#eee'} />
            <XAxis dataKey="day" stroke="#888" fontSize={12} tickMargin={10} />
            <YAxis 
              stroke="#888" 
              fontSize={12} 
              tickMargin={10} 
              domain={[-1, 1]} 
              ticks={[-1, -0.5, 0, 0.5, 1]}
            />
            <Tooltip content={<CustomTooltip />} />
            
            <Area
              yAxisId={0}
              dataKey="sentiment"
              stroke="none"
              fill="url(#positiveGradient)"
              baseValue={0.3}
              isAnimationActive={false}
            />
            <Area
              yAxisId={0}
              dataKey="sentiment"
              stroke="none"
              fill="url(#neutralGradient)"
              baseValue={-0.1}
              isAnimationActive={false}
            />
            <Area
              yAxisId={0}
              dataKey="sentiment"
              stroke="none"
              fill="url(#negativeGradient)"
              baseValue={-1}
              isAnimationActive={false}
            />
            
            <Line 
              type="monotone"
              dataKey="sentiment"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
        
        <div className="flex justify-center gap-4 text-xs text-muted-foreground mt-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-400/40" />
            <span>Positive</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-400/40" />
            <span>Neutral</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500/40" />
            <span>Negative</span>
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
                onClick={goToPrevious}
                className="p-1 rounded-full hover:bg-secondary"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <h3 className="font-medium">
                {timeRange === 'today' && format(currentDate, 'MMMM d, yyyy')}
                {timeRange === 'week' && `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`}
                {timeRange === 'month' && format(currentDate, 'MMMM yyyy')}
                {timeRange === 'year' && format(currentDate, 'yyyy')}
              </h3>
              
              <button 
                onClick={goToNext}
                className="p-1 rounded-full hover:bg-secondary"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            
            {timeRange === 'today' && renderDayView()}
            {timeRange === 'week' && renderWeekView()}
            {timeRange === 'month' && renderMonthView()}
            {timeRange === 'year' && renderYearView()}
            
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
          renderLineChart()
        )}
      </CardContent>
    </Card>
  );
};

export default MoodCalendar;
