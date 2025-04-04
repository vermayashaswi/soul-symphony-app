
import React, { useState } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { DayProps } from "react-day-picker";
import { subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear, format, isSameDay, isSameMonth, isSameWeek } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { CalendarDays, Calendar as CalendarIcon } from "lucide-react";

interface SentimentCalendarProps {
  sentimentData: {
    date: Date;
    sentiment: number;
  }[];
  timeRange: 'today' | 'week' | 'month' | 'year';
}

function getEmoji(sentiment: number): string {
  if (sentiment >= 0.7) return "😄";      // Very happy
  if (sentiment >= 0.3) return "🙂";      // Happy
  if (sentiment >= 0.1) return "😌";      // Slightly happy
  if (sentiment >= -0.1) return "😐";     // Neutral
  if (sentiment >= -0.3) return "😕";     // Slightly sad
  if (sentiment >= -0.7) return "😞";     // Sad
  return "😢";                           // Very sad
}

function getEmojiColor(sentiment: number): string {
  if (sentiment >= 0.7) return "bg-green-500 dark:bg-green-600"; 
  if (sentiment >= 0.3) return "bg-green-400 dark:bg-green-500"; 
  if (sentiment >= 0.1) return "bg-green-300 dark:bg-green-400"; 
  if (sentiment >= -0.1) return "bg-yellow-300 dark:bg-yellow-400"; 
  if (sentiment >= -0.3) return "bg-orange-300 dark:bg-orange-400"; 
  if (sentiment >= -0.7) return "bg-red-400 dark:bg-red-500"; 
  return "bg-red-500 dark:bg-red-600"; 
}

function getEmojiTextColor(sentiment: number): string {
  if (sentiment >= 0.1) return "text-white"; 
  if (sentiment >= -0.1) return "text-black dark:text-white"; 
  return "text-white"; 
}

export default function SentimentCalendar({ sentimentData, timeRange }: SentimentCalendarProps) {
  const isMobile = useIsMobile();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const today = new Date();
  
  // Filter data based on timeRange and create a map for quick lookup
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

  // Aggregate sentiment by day (for cases where multiple entries exist per day)
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
    
    // Convert to average sentiment
    const result = new Map<string, number>();
    sentimentMap.forEach((value, key) => {
      result.set(key, value.total / value.count);
    });
    
    return result;
  }, [filteredData]);

  // Create a map with sentiment info for each day
  const sentimentInfo = React.useMemo(() => {
    const infoMap = new Map<string, {
      sentiment: number;
      emoji: string;
      colorClass: string;
      textColorClass: string;
    }>();
    
    dailySentiment.forEach((avgSentiment, dateKey) => {
      infoMap.set(dateKey, {
        sentiment: avgSentiment,
        emoji: getEmoji(avgSentiment),
        colorClass: getEmojiColor(avgSentiment),
        textColorClass: getEmojiTextColor(avgSentiment)
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

  // Render different calendar views based on timeRange
  const renderTodayView = () => {
    const todayKey = format(today, 'yyyy-MM-dd');
    const todaySentiment = sentimentInfo.get(todayKey);
    
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <div className="text-2xl font-semibold mb-4">Today's Mood</div>
        
        {todaySentiment ? (
          <motion.div 
            className={cn(
              "rounded-full p-12 flex items-center justify-center",
              todaySentiment.colorClass
            )}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          >
            <span className="text-6xl">{todaySentiment.emoji}</span>
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
                  daySentiment ? daySentiment.colorClass : "bg-muted"
                )}
                whileHover={{ scale: 1.05 }}
                onClick={() => handleDayClick(day)}
              >
                <div className={cn(
                  "text-xs font-medium mb-1",
                  daySentiment && daySentiment.textColorClass
                )}>
                  {format(day, 'd')}
                </div>
                <div className="text-2xl">
                  {daySentiment ? daySentiment.emoji : "😶"}
                </div>
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
                      <span className="text-2xl">{daySentiment.emoji}</span>
                      <span className="text-sm">
                        Mood: {daySentiment.sentiment >= 0.3 ? 'Happy' : 
                            daySentiment.sentiment >= -0.3 ? 'Neutral' : 'Sad'}
                        ({daySentiment.sentiment.toFixed(2)})
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
    return (
      <div className={cn(
        "max-w-full overflow-x-auto pb-4",
        isMobile && "max-h-[500px]" // Ensure it doesn't overflow on mobile
      )}>
        <Calendar
          mode="multiple"
          selected={filteredData.map(d => d.date)}
          className="p-0 rounded-xl"
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
            months: isMobile ? "flex flex-col space-y-4" : "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            cell: cn(
              "relative p-0 h-12 w-12 md:h-14 md:w-14",
              "focus-within:relative focus-within:z-20"
            ),
            day: cn(
              "h-12 w-12 md:h-14 md:w-14 p-0 font-normal aria-selected:opacity-100 hover:bg-primary/10 transition-all duration-200"
            ),
            nav_button: "hover:bg-primary/10 p-2 rounded-full transition-all duration-200 h-10 w-10",
            table: "mt-4",
            row: "flex-1",
            head_cell: "text-muted-foreground rounded-md w-12 md:w-14 font-medium text-[0.9rem]",
            head_row: "flex",
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
                    isSelected && "font-medium text-primary",
                    isClickedDay && "ring-2 ring-primary"
                  )}
                  onClick={() => handleDayClick(date)}
                  {...props}
                >
                  {/* Mood background */}
                  {info && (
                    <motion.div 
                      className={cn(
                        "absolute inset-1 rounded-md opacity-80",
                        info.colorClass
                      )}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 0.8 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                  
                  {/* Date content */}
                  <div className={cn(
                    "flex flex-col items-center justify-center h-full w-full z-10",
                    info && info.textColorClass
                  )}>
                    {/* Date number */}
                    <span className={cn(
                      "text-sm md:text-base font-medium",
                      info && info.textColorClass
                    )}>
                      {date.getDate()}
                    </span>
                    
                    {/* Emoji display */}
                    {info && (
                      <motion.span 
                        className="text-base md:text-lg"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, duration: 0.2 }}
                      >
                        {info.emoji}
                      </motion.span>
                    )}
                  </div>
                  
                  {/* Day details popup */}
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
                            <span className="text-2xl">{info.emoji}</span>
                            <span className="text-sm">
                              Mood: {info.sentiment >= 0.3 ? 'Happy' : 
                                    info.sentiment >= -0.3 ? 'Neutral' : 'Sad'}
                            </span>
                          </div>
                        ) : (
                          <div className="text-sm text-center text-muted-foreground">
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
          <h2 className="text-xl font-semibold">Mood Calendar</h2>
        </div>
        <div className="text-sm font-medium text-muted-foreground">
          {timeRange === 'today' && 'Today'}
          {timeRange === 'week' && 'This Week'}
          {timeRange === 'month' && 'This Month'}
          {timeRange === 'year' && 'This Year'}
        </div>
      </div>
      
      <div className="p-4">
        {timeRange === 'today' && renderTodayView()}
        {timeRange === 'week' && renderWeekView()}
        {(timeRange === 'month' || timeRange === 'year') && renderMonthYearView()}
      </div>
    </motion.div>
  );
}
