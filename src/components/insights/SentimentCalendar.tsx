
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
  parseISO 
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

// Get color based on sentiment value
function getSentimentColor(sentiment: number): string {
  if (sentiment >= 0.6) return "bg-green-500"; // Very Positive
  if (sentiment >= 0.2) return "bg-emerald-400"; // Positive
  if (sentiment >= 0) return "bg-blue-400"; // Slightly Positive
  if (sentiment >= -0.2) return "bg-yellow-400"; // Neutral
  if (sentiment >= -0.6) return "bg-orange-400"; // Negative
  return "bg-red-500"; // Very Negative
}

// Empty placeholder for days without data
const EmptyBox = () => (
  <div className="w-6 h-6 rounded-md border-2 border-gray-300 dark:border-gray-600">
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
  
  const filteredData = React.useMemo(() => {
    const now = new Date();
    let fromDate: Date;
    let toDate: Date = endOfDay(now);
    
    switch (timeRange) {
      case 'today':
        fromDate = startOfDay(now);
        break;
      case 'week':
        fromDate = startOfWeek(now, { weekStartsOn: 1 }); // Week starts on Monday
        toDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        fromDate = startOfMonth(now);
        toDate = endOfMonth(now);
        break;
      case 'year':
        fromDate = startOfYear(now);
        toDate = endOfYear(now);
        break;
      default:
        fromDate = subDays(now, 30); // Default to last 30 days
    }
    
    return sentimentData.filter(item => item.date >= fromDate && item.date <= toDate);
  }, [sentimentData, timeRange]);

  // For the month view, we need ALL entries to show in the calendar
  const allSentimentData = React.useMemo(() => {
    return sentimentData;
  }, [sentimentData]);

  const dailySentiment = React.useMemo(() => {
    const sentimentMap = new Map<string, { total: number, count: number }>();
    
    // Use the appropriate dataset based on the timeRange and view
    const dataToProcess = (timeRange === 'month' && viewMode === 'calendar') 
      ? allSentimentData 
      : filteredData;
    
    dataToProcess.forEach(item => {
      const dateKey = format(item.date, 'yyyy-MM-dd');
      if (!sentimentMap.has(dateKey)) {
        sentimentMap.set(dateKey, { total: 0, count: 0 });
      }
      const current = sentimentMap.get(dateKey)!;
      current.total += item.sentiment;
      current.count += 1;
    });
    
    const result = new Map<string, number>();
    sentimentMap.forEach((value, key) => {
      result.set(key, value.total / value.count);
    });
    
    return result;
  }, [filteredData, allSentimentData, timeRange, viewMode]);

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
        const date = new Date(new Date().getFullYear(), month, 1);
        const data = monthlyData.get(month);
        return {
          time: format(date, 'MMM'),
          fullDate: format(date, 'yyyy-MM-dd'),
          sentiment: data ? data.total / data.count : null
        } as ChartDataPointWithDate;
      });
    }
    
    return [];
  }, [filteredData, timeRange, dailySentiment]);

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
              "rounded-md w-28 h-28 flex items-center justify-center",
              todaySentiment.colorClass
            )}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          />
        ) : (
          <motion.div 
            className="rounded-md w-28 h-28 border-4 border-gray-300 dark:border-gray-600"
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
    // Only allow navigating up to the current week
    if (nextWeekStart <= startOfWeek(new Date(), { weekStartsOn: 1 })) {
      setCurrentWeekStart(nextWeekStart);
    }
  };

  const isCurrentWeek = (date: Date) => {
    const currentWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
    return format(date, 'yyyy-MM-dd') === format(currentWeek, 'yyyy-MM-dd');
  };

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
                  "aspect-square rounded-md flex flex-col items-center justify-center p-1",
                  isToday && "ring-2 ring-theme hover:ring-theme"
                )}
              >
                <div className="text-xs font-medium mb-1">
                  {format(day, 'd')}
                </div>
                {daySentiment ? (
                  <div className={cn(
                    "w-7 h-7 rounded-md", 
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
        <Calendar
          mode="multiple"
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          selected={filteredData.map(d => d.date)}
          className="rounded-xl w-full"
          defaultMonth={filteredData.length > 0 ? filteredData[0].date : undefined}
          classNames={{
            day_today: "bg-primary/5 text-primary font-medium",
            day_selected: "!bg-transparent !text-foreground",
            day_disabled: "text-muted-foreground opacity-50",
            day_outside: "text-muted-foreground opacity-50",
            day_range_middle: "aria-selected:bg-transparent",
            day_hidden: "invisible",
            caption: "px-4 py-3 text-lg font-semibold",
            month: "space-y-1",
            months: "flex flex-col space-y-2",
            table: isMobile ? "w-full border-collapse space-y-1 table-fixed" : "w-full border-collapse space-y-1",
            head_row: "flex w-full justify-between",
            head_cell: "text-muted-foreground text-xs font-medium w-9 sm:w-10 md:w-10 text-center",
            row: "flex w-full justify-between",
            cell: cn(
              "relative p-0 text-center",
              "focus-within:relative focus-within:z-20"
            ),
            day: cn(
              "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-primary/10 transition-all duration-200"
            ),
            nav_button: "hover:bg-primary/10 p-1 rounded-full transition-all duration-200 h-8 w-8",
            caption_label: "text-base font-medium",
          }}
          components={{
            Day: (props: DayProps) => {
              const { date } = props;
              const formattedDate = format(date, 'yyyy-MM-dd');
              const info = sentimentInfo.get(formattedDate);
              
              const isSelected = allSentimentData.some(
                d => isSameDay(d.date, date)
              );
              
              const isToday = isSameDay(date, new Date());
              const isSameMonthValue = isSameMonth(date, currentMonth);
              
              return (
                <div
                  className={cn(
                    "relative flex items-center justify-center hover:bg-primary/10 rounded-md transition-all duration-200",
                    isSelected && "font-medium",
                    isToday && "font-bold ring-2 ring-theme"
                  )}
                  {...props}
                >
                  <div className="flex flex-col items-center justify-center h-9 w-9 z-10">
                    <span className="text-xs font-medium mb-0.5">
                      {date.getDate()}
                    </span>
                    
                    {info ? (
                      <motion.div 
                        className={cn(
                          "w-6 h-6 rounded-md",
                          info.colorClass
                        )}
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, duration: 0.2 }}
                      />
                    ) : isSameMonthValue ? (
                      <EmptyBox />
                    ) : null}
                  </div>
                </div>
              );
            },
          }}
        />
      </div>
    );
  };

  const renderYearView = () => {
    const today = new Date();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    // Get all days in the year and organize them by month
    const yearData = Array.from({ length: 12 }, (_, month) => {
      const daysInMonth = new Date(new Date().getFullYear(), month + 1, 0).getDate();
      
      // Create array of days for this month
      return Array.from({ length: daysInMonth }, (_, day) => {
        const date = new Date(new Date().getFullYear(), month, day + 1);
        const dateStr = format(date, 'yyyy-MM-dd');
        const sentiment = dailySentiment.get(dateStr);
        
        return {
          date,
          dateStr,
          day: day + 1,
          sentiment,
          colorClass: sentiment !== undefined ? getSentimentColor(sentiment) : null
        };
      });
    });
    
    const maxDaysInMonth = Math.max(...yearData.map(month => month.length));
    
    return (
      <div className="py-4 px-2">
        <div className="text-center text-lg font-semibold mb-4">
          Year in Pixels - {new Date().getFullYear()}
        </div>
        
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Month headers */}
            <div className="grid grid-cols-12 gap-1 mb-2">
              <div className="w-6"></div> {/* Empty corner for day numbers */}
              {months.map(month => (
                <div key={month} className="text-xs font-medium text-center text-muted-foreground">
                  {month}
                </div>
              ))}
            </div>
            
            {/* Days grid */}
            {Array.from({ length: maxDaysInMonth }, (_, dayIndex) => (
              <div key={dayIndex} className="grid grid-cols-13 gap-1 mb-1">
                {/* Day number on left */}
                <div className="text-xs text-right pr-1 text-muted-foreground font-medium">
                  {dayIndex + 1}
                </div>
                
                {/* Month columns */}
                {yearData.map((month, monthIndex) => {
                  // Check if this day exists in this month
                  const dayData = month[dayIndex];
                  if (!dayData) return <div key={monthIndex} className="w-5 h-5"></div>;
                  
                  const isToday = isSameDay(dayData.date, today);
                  
                  return (
                    <div 
                      key={monthIndex} 
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center",
                        isToday && "ring-1 ring-primary"
                      )}
                    >
                      {dayData.colorClass ? (
                        <div className={cn("w-5 h-5 rounded-full", dayData.colorClass)} />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-xs">Very Positive</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-400"></div>
            <span className="text-xs">Positive</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-400"></div>
            <span className="text-xs">Slightly Positive</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
            <span className="text-xs">Neutral</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-400"></div>
            <span className="text-xs">Negative</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-xs">Very Negative</span>
          </div>
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
              fill="#4ade80" 
              fillOpacity={theme === 'dark' ? 0.5 : 0.4} 
              strokeOpacity={0}
            />
            <ReferenceArea 
              y1={-0.2} 
              y2={0.2} 
              fill="#facc15" 
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
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm">Positive</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <span className="text-sm">Neutral</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
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
