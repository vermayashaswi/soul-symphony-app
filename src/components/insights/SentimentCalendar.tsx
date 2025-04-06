
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
  startOfMonth, 
  startOfYear, 
  format, 
  isSameDay, 
  isSameMonth, 
  isSameWeek, 
  addDays, 
  getMonth,
  addWeeks,
  subWeeks 
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

function getEmoji(sentiment: number): JSX.Element {
  if (sentiment >= 0.2) {
    return <span role="img" aria-label="happy" className="text-primary">🙂</span>;
  }
  if (sentiment >= -0.2) {
    return <span role="img" aria-label="neutral" className="text-primary">😐</span>;
  }
  return <span role="img" aria-label="sad" className="text-primary">🙁</span>;
}

function getEmojiColor(sentiment: number): string {
  if (sentiment >= 0.2) return "text-green-500"; 
  if (sentiment >= -0.2) return "text-yellow-500"; 
  return "text-red-500";
}

function getMoodText(sentiment: number): string {
  if (sentiment >= 0.2) return "Happy";
  if (sentiment >= -0.2) return "Neutral";
  return "Sad";
}

function getEmojiChar(sentiment: number): string {
  if (sentiment >= 0.2) return "🙂";
  if (sentiment >= -0.2) return "😐";
  return "🙁";
}

function getContainerBgColor(sentiment: number): string {
  if (sentiment >= 0.2) return "bg-green-500/75 dark:bg-green-700"; 
  if (sentiment >= -0.2) return "bg-yellow-500/75 dark:bg-yellow-700"; 
  return "bg-red-500/75 dark:bg-red-700";
}

const EmptyCircle = () => (
  <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center">
    <span className="sr-only">No data</span>
  </div>
);

type ViewMode = 'calendar' | 'graph';

export default function SentimentCalendar({ sentimentData, timeRange }: SentimentCalendarProps) {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const { theme, colorTheme, customColor } = useTheme();
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  const filteredData = React.useMemo(() => {
    const now = new Date();
    let fromDate: Date;
    
    switch (timeRange) {
      case 'today':
        fromDate = startOfDay(now);
        break;
      case 'week':
        fromDate = startOfWeek(now, { weekStartsOn: 1 }); // Week starts on Monday
        break;
      case 'month':
        fromDate = startOfMonth(now);
        break;
      case 'year':
        fromDate = startOfYear(now);
        break;
      default:
        fromDate = subDays(now, 30); // Default to last 30 days
    }
    
    return sentimentData.filter(item => item.date >= fromDate && item.date <= endOfDay(now));
  }, [sentimentData, timeRange]);

  const dailySentiment = React.useMemo(() => {
    const sentimentMap = new Map<string, { total: number, count: number }>();
    
    filteredData.forEach(item => {
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
  }, [filteredData]);

  const sentimentInfo = React.useMemo(() => {
    const infoMap = new Map<string, {
      sentiment: number;
      emoji: JSX.Element;
      colorClass: string;
      moodText: string;
      emojiChar: string;
    }>();
    
    dailySentiment.forEach((avgSentiment, dateKey) => {
      infoMap.set(dateKey, {
        sentiment: avgSentiment,
        emoji: getEmoji(avgSentiment),
        colorClass: getEmojiColor(avgSentiment),
        moodText: getMoodText(avgSentiment),
        emojiChar: getEmojiChar(avgSentiment)
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
              "rounded-full p-12 flex items-center justify-center",
              getContainerBgColor(todaySentiment.sentiment)
            )}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          >
            <span className="text-6xl text-white">{todaySentiment.emojiChar}</span>
          </motion.div>
        ) : (
          <motion.div 
            className="rounded-full p-12 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          >
            <div className="w-24 h-24 rounded-full border-4 border-gray-300 dark:border-gray-600"></div>
          </motion.div>
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
                    "text-2xl flex items-center justify-center rounded-full w-full h-7",
                    getContainerBgColor(daySentiment.sentiment)
                  )}>
                    <span className="text-white">{daySentiment.emojiChar}</span>
                  </div>
                ) : (
                  <EmptyCircle />
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
              
              const isSelected = filteredData.some(
                d => isSameDay(d.date, date)
              );
              
              const isToday = isSameDay(date, new Date());
              const isSameMonthValue = isSameMonth(date, new Date());
              
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
                      <motion.span 
                        className={cn(
                          "text-base w-6 h-6 flex items-center justify-center rounded-full",
                          getContainerBgColor(info.sentiment)
                        )}
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, duration: 0.2 }}
                      >
                        <span className="text-white">{info.emojiChar}</span>
                      </motion.span>
                    ) : isSameMonthValue ? (
                      <EmptyCircle />
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
    
    const monthlySentiment = new Map<number, { total: number, count: number }>();
    
    filteredData.forEach(item => {
      const month = item.date.getMonth();
      if (!monthlySentiment.has(month)) {
        monthlySentiment.set(month, { total: 0, count: 0 });
      }
      const current = monthlySentiment.get(month)!;
      current.total += item.sentiment;
      current.count += 1;
    });
    
    const monthlyAverages = new Map<number, number>();
    monthlySentiment.forEach((value, month) => {
      monthlyAverages.set(month, value.total / value.count);
    });

    const currentMonth = today.getMonth();

    return (
      <div className="py-4">
        <div className="grid grid-cols-6 gap-0 text-center mb-2">
          {months.slice(0, 6).map((month) => (
            <div key={month} className="text-xs font-medium text-muted-foreground">
              {month}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-6 gap-0 mb-4">
          {months.slice(0, 6).map((month, index) => {
            const monthSentiment = monthlyAverages.get(index);
            const isCurrentMonth = index === currentMonth;
            
            return (
              <div 
                key={month}
                className={cn(
                  "aspect-square rounded-md flex flex-col items-center justify-center p-1",
                  isCurrentMonth && "ring-2 ring-theme hover:ring-theme"
                )}
              >
                <div className="text-xs font-medium mb-1">
                  {month}
                </div>
                {monthSentiment !== undefined ? (
                  <div className={cn(
                    "text-2xl w-full h-7 flex items-center justify-center rounded-full",
                    getContainerBgColor(monthSentiment)
                  )}>
                    <span className="text-white">{getEmojiChar(monthSentiment)}</span>
                  </div>
                ) : (
                  <EmptyCircle />
                )}
              </div>
            );
          })}
        </div>
        
        <div className="grid grid-cols-6 gap-0 text-center mb-2">
          {months.slice(6, 12).map((month) => (
            <div key={month} className="text-xs font-medium text-muted-foreground">
              {month}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-6 gap-0">
          {months.slice(6, 12).map((month, index) => {
            const actualIndex = index + 6;
            const monthSentiment = monthlyAverages.get(actualIndex);
            const isCurrentMonth = actualIndex === currentMonth;
            
            return (
              <div 
                key={month}
                className={cn(
                  "aspect-square rounded-md flex flex-col items-center justify-center p-1",
                  isCurrentMonth && "ring-2 ring-theme hover:ring-theme"
                )}
              >
                <div className="text-xs font-medium mb-1">
                  {month}
                </div>
                {monthSentiment !== undefined ? (
                  <div className={cn(
                    "text-2xl w-full h-7 flex items-center justify-center rounded-full",
                    getContainerBgColor(monthSentiment)
                  )}>
                    <span className="text-white">{getEmojiChar(monthSentiment)}</span>
                  </div>
                ) : (
                  <EmptyCircle />
                )}
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
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
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
