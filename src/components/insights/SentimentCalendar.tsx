import React, { useState } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { DayProps } from "react-day-picker";
import { 
  subDays, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  format, 
  isSameDay, 
  isSameMonth, 
  isSameWeek, 
  addDays, 
  getMonth,
  addWeeks,
  subWeeks,
  parseISO,
  addYears,
  subYears,
  addMonths,
  subMonths
} from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { CalendarDays, Filter, TrendingUp, ArrowUp, ArrowDown, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Line,
  LineChart as RechartsLineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { useTheme } from '@/hooks/use-theme';

interface ChartDataPointWithDate {
  time: string;
  sentiment: number | null;
  fullDate?: string;
}

interface SentimentCalendarProps {
  sentimentData: {
    date: Date;
    sentiment: number;
  }[];
  timeRange: 'today' | 'week' | 'month' | 'year';
}

function getSentimentColor(sentiment: number): string {
  if (sentiment <= -0.8) return "bg-red-900";
  if (sentiment <= -0.6) return "bg-red-800";
  if (sentiment <= -0.4) return "bg-red-700";
  if (sentiment <= -0.2) return "bg-red-600";
  if (sentiment <= -0.1) return "bg-amber-500";
  if (sentiment < 0.1) return "bg-amber-400";
  if (sentiment < 0.2) return "bg-amber-600";
  if (sentiment < 0.4) return "bg-green-600";
  if (sentiment < 0.6) return "bg-green-700";
  if (sentiment < 0.8) return "bg-green-800";
  return "bg-green-900";
}

const EmptyBox = () => (
  <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600">
    <span className="sr-only">No data</span>
  </div>
);

type ViewMode = 'calendar' | 'graph';

export default function SentimentCalendar({ sentimentData, timeRange }: SentimentCalendarProps) {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const { theme } = useTheme();
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [currentYear, setCurrentYear] = useState<Date>(new Date());
  
  const getSentimentData = () => {
    const data = sentimentData || [];
    if (data.length === 0) return [];
    
    return data.map(item => ({
      date: new Date(item.date),
      sentiment: parseFloat(item.sentiment || 0)
    }));
  };

  const filteredData = React.useMemo(() => {
    const now = new Date();
    let fromDate: Date;
    let toDate: Date = endOfDay(now);
    
    switch (timeRange) {
      case 'today':
        fromDate = startOfDay(now);
        break;
      case 'week':
        fromDate = startOfWeek(now, { weekStartsOn: 1 });
        toDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        if (isSameMonth(currentMonth, now)) {
          fromDate = startOfMonth(now);
          toDate = endOfMonth(now);
        } else {
          fromDate = startOfMonth(currentMonth);
          toDate = endOfMonth(currentMonth);
        }
        break;
      case 'year':
        if (isSameYear(currentYear, now)) {
          fromDate = startOfYear(now);
          toDate = endOfYear(now);
        } else {
          fromDate = startOfYear(currentYear);
          toDate = endOfYear(currentYear);
        }
        break;
      default:
        fromDate = subDays(now, 30);
    }
    
    return getSentimentData().filter(item => item.date >= fromDate && item.date <= toDate);
  }, [sentimentData, timeRange, currentYear, currentMonth]);

  const allSentimentData = React.useMemo(() => {
    return getSentimentData();
  }, [sentimentData]);

  const dailySentiment = React.useMemo(() => {
    const sentimentMap = new Map<string, { total: number, count: number }>();
    
    const dataToProcess = allSentimentData;
    
    dataToProcess.forEach(item => {
      const dateKey = format(item.date, 'yyyy-MM-dd');
      if (!sentimentMap.has(dateKey)) {
        sentimentMap.set(dateKey, { total: 0, count: 0 });
      }
      const current = sentimentMap.get(dateKey)!;
      current.total += item.sentiment || 0;
      current.count += 1;
    });
    
    const result = new Map<string, number>();
    sentimentMap.forEach((value, key) => {
      result.set(key, value.total / value.count);
    });
    
    return result;
  }, [allSentimentData]);

  const sentimentInfo = React.useMemo(() => {
    const infoMap = new Map<string, {
      sentiment: number;
      colorClass: string;
    }>();
    
    dailySentiment.forEach((avgSentiment, dateKey) => {
      infoMap.set(dateKey, {
        sentiment: avgSentiment,
        colorClass: getSentimentColor(avgSentiment)
      });
    });
    
    return infoMap;
  }, [dailySentiment]);

  const lineChartData = React.useMemo(() => {
    if (filteredData.length === 0) {
      return [];
    }

    if (timeRange === 'today') {
      const hourlyData = new Map<number, { total: number, count: number }>();
      
      filteredData.forEach(item => {
        const hour = item.date.getHours();
        if (!hourlyData.has(hour)) {
          hourlyData.set(hour, { total: 0, count: 0 });
        }
        const current = hourlyData.get(hour)!;
        current.total += item.sentiment;
        current.count += 1;
      });
      
      return Array.from({ length: 24 }, (_, hour) => {
        const data = hourlyData.get(hour);
        return {
          time: `${hour}:00`,
          sentiment: data ? data.total / data.count : null
        } as ChartDataPointWithDate;
      }).filter(item => item.sentiment !== null);
    } 
    
    if (timeRange === 'week') {
      const startOfWeekDate = startOfWeek(new Date(), { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => {
        const date = addDays(startOfWeekDate, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        return {
          time: format(date, 'EEE'),
          fullDate: dateStr,
          sentiment: dailySentiment.get(dateStr) || null
        } as ChartDataPointWithDate;
      });
    } 
    
    if (timeRange === 'month') {
      const startOfMonthDate = startOfMonth(new Date());
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      
      return Array.from({ length: daysInMonth }, (_, i) => {
        const date = new Date(new Date().getFullYear(), new Date().getMonth(), i + 1);
        const dateStr = format(date, 'yyyy-MM-dd');
        return {
          time: format(date, 'd'),
          fullDate: dateStr,
          sentiment: dailySentiment.get(dateStr) || null
        } as ChartDataPointWithDate;
      });
    }
    
    if (timeRange === 'year') {
      const monthlyData = new Map<number, { total: number, count: number }>();
      
      filteredData.forEach(item => {
        const month = item.date.getMonth();
        if (!monthlyData.has(month)) {
          monthlyData.set(month, { total: 0, count: 0 });
        }
        const current = monthlyData.get(month)!;
        current.total += item.sentiment;
        current.count += 1;
      });
      
      return Array.from({ length: 12 }, (_, month) => {
        const date = new Date(currentYear.getFullYear(), month, 1);
        const data = monthlyData.get(month);
        return {
          time: format(date, 'MMM'),
          fullDate: format(date, 'yyyy-MM-dd'),
          sentiment: data ? data.total / data.count : null
        } as ChartDataPointWithDate;
      });
    }
    
    return [];
  }, [filteredData, timeRange, dailySentiment, currentYear]);

  const renderTodayView = () => {
    const today = new Date();
    const todayKey = format(today, 'yyyy-MM-dd');
    const todaySentiment = sentimentInfo.get(todayKey);
    
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <div className="text-2xl font-semibold mb-4">Today's Mood</div>
        
        {todaySentiment ? (
          <motion.div 
            className={cn(
              "rounded-full w-28 h-28 flex items-center justify-center",
              todaySentiment.colorClass
            )}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          />
        ) : (
          <motion.div 
            className="rounded-full w-28 h-28 border-4 border-gray-300 dark:border-gray-600"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          />
        )}
        
        <div className="mt-6 text-lg">
          {todaySentiment ? (
            <div className="text-center">
              <div className="font-medium">{format(today, 'MMMM d, yyyy')}</div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              No mood data recorded for today
            </div>
          )}
        </div>
      </div>
    );
  };

  const navigateToPreviousWeek = () => {
    setCurrentWeekStart(prevWeekStart => subWeeks(prevWeekStart, 1));
  };

  const navigateToNextWeek = () => {
    const nextWeekStart = addWeeks(currentWeekStart, 1);
    if (nextWeekStart <= startOfWeek(new Date(), { weekStartsOn: 1 })) {
      setCurrentWeekStart(nextWeekStart);
    }
  };

  const navigateToPreviousMonth = () => {
    setCurrentMonth(prevMonth => subMonths(prevMonth, 1));
  };

  const navigateToNextMonth = () => {
    const nextMonth = addMonths(currentMonth, 1);
    if (nextMonth <= new Date()) {
      setCurrentMonth(nextMonth);
    }
  };

  const navigateToPreviousYear = () => {
    setCurrentYear(prevYear => subYears(prevYear, 1));
  };

  const navigateToNextYear = () => {
    const nextYear = addYears(currentYear, 1);
    if (nextYear.getFullYear() <= new Date().getFullYear()) {
      setCurrentYear(nextYear);
    }
  };

  const isCurrentWeek = (date: Date) => {
    const currentWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
    return format(date, 'yyyy-MM-dd') === format(currentWeek, 'yyyy-MM-dd');
  };

  const isCurrentMonth = (date: Date) => {
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };

  const isCurrentYear = (date: Date) => {
    return date.getFullYear() === new Date().getFullYear();
  };

  function isSameYear(dateLeft: Date, dateRight: Date): boolean {
    return dateLeft.getFullYear() === dateRight.getFullYear();
  }

  const renderWeekView = () => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      return date;
    });
    
    const today = new Date();
    
    return (
      <div className="py-4">
        <div className="flex justify-between items-center mb-4">
          <button 
            onClick={navigateToPreviousWeek}
            className="p-1 rounded-full hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <div className="text-sm font-medium">
            {format(currentWeekStart, 'MMMM d')} - {format(addDays(currentWeekStart, 6), 'MMMM d, yyyy')}
            {isCurrentWeek(currentWeekStart) && (
              <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                Current Week
              </span>
            )}
          </div>
          
          <button 
            onClick={navigateToNextWeek}
            disabled={isCurrentWeek(currentWeekStart)}
            className={cn(
              "p-1 rounded-full transition-colors",
              isCurrentWeek(currentWeekStart) 
                ? "text-muted-foreground cursor-not-allowed" 
                : "hover:bg-muted"
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-0 text-center mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-0">
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const daySentiment = sentimentInfo.get(dateKey);
            const isToday = isSameDay(day, today);
            
            return (
              <div 
                key={dateKey}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center p-1",
                  isToday && "ring-2 ring-primary hover:ring-primary rounded-full"
                )}
              >
                <div className="text-xs font-medium mb-1">
                  {format(day, 'd')}
                </div>
                {daySentiment ? (
                  <div className={cn(
                    "w-6 h-6 rounded-full", 
                    daySentiment.colorClass
                  )}/>
                ) : (
                  <EmptyBox />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonthYearView = () => {
    if (timeRange === 'year') {
      return renderYearView();
    }
    
    return (
      <div className="max-w-full overflow-visible pb-4">
        <div className="flex justify-between items-center mb-4">
          <button 
            onClick={navigateToPreviousMonth}
            className="p-1 rounded-full hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <div className="text-lg font-medium">
            {format(currentMonth, 'MMMM yyyy')}
            {isCurrentMonth(currentMonth) && (
              <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                Current Month
              </span>
            )}
          </div>
          
          <button 
            onClick={navigateToNextMonth}
            disabled={isCurrentMonth(currentMonth)}
            className={cn(
              "p-1 rounded-full transition-colors",
              isCurrentMonth(currentMonth) 
                ? "text-muted-foreground cursor-not-allowed" 
                : "hover:bg-muted"
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-0 text-center mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-0">
          {getDaysInMonth(currentMonth).map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="aspect-square"></div>;
            }
            
            const dateKey = format(day, 'yyyy-MM-dd');
            const daySentiment = sentimentInfo.get(dateKey);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div 
                key={dateKey}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center p-1",
                  isToday && "ring-2 ring-primary rounded-full"
                )}
              >
                <div className="text-xs font-medium mb-1">
                  {format(day, 'd')}
                </div>
                {daySentiment ? (
                  <div className={cn(
                    "w-6 h-6 rounded-full", 
                    daySentiment.colorClass
                  )}/>
                ) : (
                  <EmptyBox />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  function getDaysInMonth(date: Date) {
    const month = date.getMonth();
    const year = date.getFullYear();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    
    const firstDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
    
    const days: (Date | null)[] = Array(firstDayOfWeek).fill(null);
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    const totalCells = Math.ceil(days.length / 7) * 7;
    while (days.length < totalCells) {
      days.push(null);
    }
    
    return days;
  }

  const renderYearView = () => {
    const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    const daysCount = 31;
    
    return (
      <div className="py-4">
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={navigateToPreviousYear}
            className="p-1 rounded-full hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <div className="text-lg font-semibold">
            {currentYear.getFullYear()}
            {isCurrentYear(currentYear) && (
              <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                Current Year
              </span>
            )}
          </div>
          
          <button 
            onClick={navigateToNextYear}
            disabled={isCurrentYear(currentYear)}
            className={cn(
              "p-1 rounded-full transition-colors",
              isCurrentYear(currentYear) 
                ? "text-muted-foreground cursor-not-allowed" 
                : "hover:bg-muted"
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        
        <div className="w-full">
          <div className="grid grid-cols-[2rem_repeat(12,1fr)] mb-2">
            <div></div>
            {months.map(month => (
              <div key={month} className="text-center text-muted-foreground text-xs font-medium">
                {month}
              </div>
            ))}
          </div>
          
          {Array.from({ length: daysCount }, (_, i) => {
            const day = i + 1;
            
            return (
              <div key={`day-${day}`} className="grid grid-cols-[2rem_repeat(12,1fr)] mb-0.5 items-center">
                <div className="text-center text-muted-foreground text-xs">
                  {day}
                </div>
                
                {months.map((_, monthIndex) => {
                  const date = new Date(currentYear.getFullYear(), monthIndex, day);
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const isValidDate = !isNaN(date.getTime());
                  
                  if (!isValidDate) {
                    return <div key={`empty-${monthIndex}-${day}`}></div>;
                  }
                  
                  const sentiment = dailySentiment.get(dateStr);
                  const colorClass = sentiment !== undefined ? getSentimentColor(sentiment) : null;
                  
                  const isToday = isSameDay(date, new Date());
                  
                  return (
                    <div 
                      key={`cell-${monthIndex}-${day}`} 
                      className="flex items-center justify-center"
                    >
                      {colorClass ? (
                        <div 
                          className={cn(
                            "w-4 h-4 rounded-full", 
                            colorClass,
                            isToday && "ring-1 ring-primary"
                          )} 
                        />
                      ) : (
                        <div 
                          className={cn(
                            "w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600",
                            isToday && "ring-1 ring-primary"
                          )} 
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderGraphView = () => {
    if (lineChartData.length === 0) {
      return (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          No sentiment data available for this time period
        </div>
      );
    }

    return (
      <div className="w-full mt-4 py-6">
        <ResponsiveContainer width="100%" height={300}>
          <RechartsLineChart
            data={lineChartData.filter(item => item.sentiment !== null)}
            margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#eee'} />
            
            <ReferenceArea 
              y1={0.2} 
              y2={1} 
              fill="#22c55e" 
              fillOpacity={theme === 'dark' ? 0.5 : 0.4} 
              strokeOpacity={0}
            />
            <ReferenceArea 
              y1={-0.2} 
              y2={0.2} 
              fill="#f59e0b" 
              fillOpacity={theme === 'dark' ? 0.5 : 0.4} 
              strokeOpacity={0}
            />
            <ReferenceArea 
              y1={-1} 
              y2={-0.2} 
              fill="#ef4444" 
              fillOpacity={theme === 'dark' ? 0.5 : 0.4} 
              strokeOpacity={0}
            />
            
            <XAxis 
              dataKey="time" 
              stroke={theme === 'dark' ? '#888' : '#666'} 
              fontSize={isMobile ? 10 : 12}
              tickMargin={10}
            />
            <YAxis 
              domain={[-1, 1]} 
              ticks={[-1, -0.5, 0, 0.5, 1]}
              stroke={theme === 'dark' ? '#888' : '#666'} 
              fontSize={isMobile ? 10 : 12}
              tickMargin={isMobile ? 5 : 10}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme === 'dark' ? 'hsl(var(--card))' : 'rgba(255, 255, 255, 0.8)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                border: '1px solid hsl(var(--border))',
                color: theme === 'dark' ? 'hsl(var(--card-foreground))' : 'inherit'
              }}
              formatter={(value: any) => [`${parseFloat(value).toFixed(2)}`, 'Sentiment']}
              labelFormatter={(label) => {
                const item = lineChartData.find(d => d.time === label);
                if (timeRange === 'month' || timeRange === 'week') {
                  return item?.fullDate ? format(new Date(item.fullDate), 'MMM d, yyyy') : label;
                }
                return label;
              }}
            />
            <Line
              type="monotone"
              dataKey="sentiment"
              stroke="#4299E1"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: theme === 'dark' ? '#1e293b' : 'white' }}
              activeDot={{ r: 6, stroke: theme === 'dark' ? '#fff' : '#000', strokeWidth: 1 }}
            />
          </RechartsLineChart>
        </ResponsiveContainer>

        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-700"></div>
            <span className="text-sm">Positive</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-sm">Neutral</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-700"></div>
            <span className="text-sm">Negative</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl border shadow-sm bg-card overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Mood</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('calendar')}
            className={cn(
              "px-3 py-1 rounded-full text-sm",
              viewMode === 'calendar'
                ? "bg-primary text-white"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            Calendar
          </button>
          <button
            onClick={() => setViewMode('graph')}
            className={cn(
              "px-3 py-1 rounded-full text-sm",
              viewMode === 'graph'
                ? "bg-primary text-white"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            Graph
          </button>
        </div>
      </div>
      
      <div className="p-4">
        {viewMode === 'calendar' && (
          <>
            {timeRange === 'today' && renderTodayView()}
            {timeRange === 'week' && renderWeekView()}
            {timeRange === 'month' && renderMonthYearView()}
            {timeRange === 'year' && renderYearView()}
          </>
        )}
        {viewMode === 'graph' && renderGraphView()}
      </div>
    </motion.div>
  );
}
