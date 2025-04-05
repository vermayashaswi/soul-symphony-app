
import React, { useState } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { DayProps } from "react-day-picker";
import { subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear, format, isSameDay, isSameMonth, isSameWeek, addDays, getMonth } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { CalendarDays, Filter, TrendingUp, ArrowUp, ArrowDown, Activity } from "lucide-react";
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

function getEmoji(sentiment: number): string {
  if (sentiment >= 0.2) return "🙂";      // Happy (green)
  if (sentiment >= -0.2) return "😐";     // Neutral (yellow)
  return "🙁";                           // Sad (red)
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

type ViewMode = 'calendar' | 'graph';

export default function SentimentCalendar({ sentimentData, timeRange }: SentimentCalendarProps) {
  const isMobile = useIsMobile();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const today = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const { theme } = useTheme();
  
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
      emoji: string;
      colorClass: string;
      moodText: string;
    }>();
    
    dailySentiment.forEach((avgSentiment, dateKey) => {
      infoMap.set(dateKey, {
        sentiment: avgSentiment,
        emoji: getEmoji(avgSentiment),
        colorClass: getEmojiColor(avgSentiment),
        moodText: getMoodText(avgSentiment)
      });
    });
    
    return infoMap;
  }, [dailySentiment]);
  
  const handleDayClick = (day: Date) => {
    if (selectedDay && isSameDay(day, selectedDay)) {
      setSelectedDay(null);
    } else {
      setSelectedDay(day);
    }
  };

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
      const startOfWeekDate = startOfWeek(today, { weekStartsOn: 1 });
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
      const startOfMonthDate = startOfMonth(today);
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      
      return Array.from({ length: daysInMonth }, (_, i) => {
        const date = new Date(today.getFullYear(), today.getMonth(), i + 1);
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
        const date = new Date(today.getFullYear(), month, 1);
        const data = monthlyData.get(month);
        return {
          time: format(date, 'MMM'),
          fullDate: format(date, 'yyyy-MM-dd'),
          sentiment: data ? data.total / data.count : null
        } as ChartDataPointWithDate;
      });
    }
    
    return [];
  }, [filteredData, timeRange, dailySentiment, today]);

  const renderTodayView = () => {
    const todayKey = format(today, 'yyyy-MM-dd');
    const todaySentiment = sentimentInfo.get(todayKey);
    
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <div className="text-2xl font-semibold mb-4">Today's Mood</div>
        
        {todaySentiment ? (
          <motion.div 
            className="rounded-full p-12 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          >
            <span className={cn("text-6xl", todaySentiment.colorClass)}>{todaySentiment.emoji}</span>
          </motion.div>
        ) : (
          <motion.div 
            className="rounded-full bg-muted p-12 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          >
            <span className="text-6xl">🤔</span>
          </motion.div>
        )}
        
        <div className="mt-6 text-lg">
          {todaySentiment ? (
            <div className="text-center">
              <div className="font-medium">{format(today, 'MMMM d, yyyy')}</div>
              <div className="text-muted-foreground mt-1">
                Average mood: {todaySentiment.sentiment.toFixed(2)}
              </div>
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

  const renderWeekView = () => {
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });
    
    return (
      <div className="py-4">
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const daySentiment = sentimentInfo.get(dateKey);
            const isToday = isSameDay(day, today);
            
            return (
              <motion.div 
                key={dateKey}
                className={cn(
                  "aspect-square rounded-md flex flex-col items-center justify-center p-1 cursor-pointer",
                  isToday && "ring-2 ring-primary",
                  selectedDay && isSameDay(day, selectedDay) && "bg-muted"
                )}
                whileHover={{ scale: 1.05 }}
                onClick={() => handleDayClick(day)}
              >
                <div className="text-xs font-medium mb-1">
                  {format(day, 'd')}
                </div>
                {daySentiment ? (
                  <div className={cn(
                    "text-2xl",
                    daySentiment.colorClass
                  )}>
                    {daySentiment.emoji}
                  </div>
                ) : (
                  <div className="text-2xl text-muted-foreground">😶</div>
                )}
              </motion.div>
            );
          })}
        </div>
        
        <AnimatePresence>
          {selectedDay && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 p-3 bg-background rounded-lg shadow border"
            >
              <div className="text-center mb-1 font-medium">
                {format(selectedDay, 'MMMM d, yyyy')}
              </div>
              
              {(() => {
                const dateKey = format(selectedDay, 'yyyy-MM-dd');
                const daySentiment = sentimentInfo.get(dateKey);
                
                if (daySentiment) {
                  return (
                    <div className="flex justify-center items-center space-x-2">
                      <span className={cn("text-2xl", daySentiment.colorClass)}>{daySentiment.emoji}</span>
                      <span className="text-sm">
                        Mood: {daySentiment.moodText} ({daySentiment.sentiment.toFixed(2)})
                      </span>
                    </div>
                  );
                } else {
                  return (
                    <div className="text-sm text-muted-foreground text-center">
                      No mood data recorded for this day
                    </div>
                  );
                }
              })()}
            </motion.div>
          )}
        </AnimatePresence>
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
          className="p-0 rounded-xl w-full"
          defaultMonth={filteredData.length > 0 ? filteredData[0].date : undefined}
          classNames={{
            day_today: "bg-primary/5 text-primary font-medium",
            day_selected: "!bg-transparent !text-foreground",
            day_disabled: "text-muted-foreground opacity-50",
            day_outside: "text-muted-foreground opacity-50",
            day_range_middle: "aria-selected:bg-transparent",
            day_hidden: "invisible",
            caption: "px-6 py-4 text-lg font-semibold",
            month: "space-y-1",
            months: "flex flex-col space-y-4",
            table: "w-full border-collapse",
            head_row: "flex w-full justify-between",
            head_cell: "text-muted-foreground rounded-md w-9 md:w-14 font-medium text-[0.9rem] text-center",
            row: "flex w-full mt-2 justify-between",
            cell: cn(
              "relative p-0 h-12 w-12 md:h-14 md:w-14",
              "focus-within:relative focus-within:z-20"
            ),
            day: cn(
              "h-12 w-12 md:h-14 md:w-14 p-0 font-normal aria-selected:opacity-100 hover:bg-primary/10 transition-all duration-200"
            ),
            nav_button: "hover:bg-primary/10 p-2 rounded-full transition-all duration-200 h-10 w-10",
            caption_label: "text-lg",
          }}
          components={{
            Day: (props: DayProps) => {
              const { date } = props;
              const formattedDate = format(date, 'yyyy-MM-dd');
              const info = sentimentInfo.get(formattedDate);
              
              const isSelected = filteredData.some(
                d => isSameDay(d.date, date)
              );
              
              const isClickedDay = selectedDay && isSameDay(date, selectedDay);
              
              return (
                <div
                  className={cn(
                    "relative h-12 w-12 md:h-14 md:w-14 flex items-center justify-center hover:bg-primary/10 rounded-md transition-all duration-200",
                    isSelected && "font-medium",
                    isClickedDay && "ring-2 ring-primary bg-muted"
                  )}
                  onClick={() => handleDayClick(date)}
                  {...props}
                >
                  <div className="flex flex-col items-center justify-center h-full w-full z-10">
                    <span className="text-sm md:text-base font-medium">
                      {date.getDate()}
                    </span>
                    
                    {info ? (
                      <motion.span 
                        className={cn(
                          "text-base md:text-lg",
                          info.colorClass
                        )}
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, duration: 0.2 }}
                      >
                        {info.emoji}
                      </motion.span>
                    ) : isSelected ? (
                      <span className="text-base md:text-lg text-muted-foreground">😶</span>
                    ) : null}
                  </div>
                  
                  <AnimatePresence>
                    {isClickedDay && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-popover shadow-lg rounded-lg p-3 z-50 w-48"
                      >
                        <div className="text-center mb-1 font-medium">
                          {format(date, 'MMMM d, yyyy')}
                        </div>
                        
                        {info ? (
                          <div className="flex justify-center items-center space-x-2">
                            <span className={cn("text-2xl", info.colorClass)}>{info.emoji}</span>
                            <span className="text-sm">
                              Mood: {info.moodText} ({info.sentiment.toFixed(2)})
                            </span>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground text-center">
                            No mood data for this day
                          </div>
                        )}
                        
                        <div className="text-xs text-center mt-2 text-muted-foreground">
                          Click again to close
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            },
          }}
        />
      </div>
    );
  };

  const renderYearView = () => {
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

    return (
      <div className="py-4">
        <div className="grid grid-cols-6 gap-1 text-center mb-2">
          {months.slice(0, 6).map((month) => (
            <div key={month} className="text-xs font-medium text-muted-foreground">
              {month}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-6 gap-1 mb-4">
          {months.slice(0, 6).map((month, index) => {
            const monthSentiment = monthlyAverages.get(index);
            const date = new Date(today.getFullYear(), index, 1);
            const colorClass = monthSentiment !== undefined ? getEmojiColor(monthSentiment) : "";
            
            return (
              <motion.div 
                key={month}
                className={cn(
                  "aspect-square rounded-md flex flex-col items-center justify-center p-1 cursor-pointer",
                  selectedDay && 
                    selectedDay.getMonth() === index && 
                    selectedDay.getFullYear() === today.getFullYear() && 
                    "bg-muted ring-2 ring-primary"
                )}
                whileHover={{ scale: 1.05 }}
                onClick={() => handleDayClick(date)}
              >
                <div className="text-xs font-medium mb-1">
                  {month}
                </div>
                {monthSentiment !== undefined ? (
                  <div className={cn(
                    "text-2xl",
                    colorClass
                  )}>
                    {getEmoji(monthSentiment)}
                  </div>
                ) : (
                  <div className="text-2xl text-muted-foreground">😶</div>
                )}
              </motion.div>
            );
          })}
        </div>
        
        <div className="grid grid-cols-6 gap-1 text-center mb-2">
          {months.slice(6, 12).map((month) => (
            <div key={month} className="text-xs font-medium text-muted-foreground">
              {month}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-6 gap-1">
          {months.slice(6, 12).map((month, index) => {
            const actualIndex = index + 6;
            const monthSentiment = monthlyAverages.get(actualIndex);
            const date = new Date(today.getFullYear(), actualIndex, 1);
            const colorClass = monthSentiment !== undefined ? getEmojiColor(monthSentiment) : "";
            
            return (
              <motion.div 
                key={month}
                className={cn(
                  "aspect-square rounded-md flex flex-col items-center justify-center p-1 cursor-pointer",
                  selectedDay && 
                    selectedDay.getMonth() === actualIndex && 
                    selectedDay.getFullYear() === today.getFullYear() && 
                    "bg-muted ring-2 ring-primary"
                )}
                whileHover={{ scale: 1.05 }}
                onClick={() => handleDayClick(date)}
              >
                <div className="text-xs font-medium mb-1">
                  {month}
                </div>
                {monthSentiment !== undefined ? (
                  <div className={cn(
                    "text-2xl",
                    colorClass
                  )}>
                    {getEmoji(monthSentiment)}
                  </div>
                ) : (
                  <div className="text-2xl text-muted-foreground">😶</div>
                )}
              </motion.div>
            );
          })}
        </div>
        
        <AnimatePresence>
          {selectedDay && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 p-3 bg-background rounded-lg shadow border"
            >
              <div className="text-center mb-1 font-medium">
                {format(selectedDay, 'MMMM yyyy')}
              </div>
              
              {(() => {
                const month = selectedDay.getMonth();
                const monthSentiment = monthlyAverages.get(month);
                
                if (monthSentiment !== undefined) {
                  const colorClass = getEmojiColor(monthSentiment);
                  const emoji = getEmoji(monthSentiment);
                  const moodText = getMoodText(monthSentiment);
                  
                  return (
                    <div className="flex justify-center items-center space-x-2">
                      <span className={cn("text-2xl", colorClass)}>{emoji}</span>
                      <span className="text-sm">
                        Mood: {moodText} ({monthSentiment.toFixed(2)})
                      </span>
                    </div>
                  );
                } else {
                  return (
                    <div className="text-sm text-muted-foreground text-center">
                      No mood data recorded for this month
                    </div>
                  );
                }
              })()}
            </motion.div>
          )}
        </AnimatePresence>
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
              fontSize={12}
              tickMargin={10}
            />
            <YAxis 
              domain={[-1, 1]} 
              ticks={[-1, -0.5, 0, 0.5, 1]}
              stroke={theme === 'dark' ? '#888' : '#666'} 
              fontSize={12}
              tickMargin={10}
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
            <span className="text-sm">Positive (0.2 to 1)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-sm">Neutral (-0.2 to 0.2)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm">Negative (-1 to -0.2)</span>
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
