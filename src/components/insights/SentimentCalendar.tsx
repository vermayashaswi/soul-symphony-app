
import React, { useState } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { DayProps } from "react-day-picker";
import { subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear, format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { CalendarDays } from "lucide-react";

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
  
  // Filter data based on timeRange
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

  // Create a map for easier lookup
  const sentimentMap = new Map(
    filteredData.map(item => [
      item.date.toISOString().split('T')[0],
      { 
        sentiment: item.sentiment, 
        emoji: getEmoji(item.sentiment),
        colorClass: getEmojiColor(item.sentiment),
        textColorClass: getEmojiTextColor(item.sentiment)
      }
    ])
  );

  // Determine if we need a more compact view for mobile
  const calendarMode = isMobile ? (timeRange === 'year' ? 'year' : 'month') : 'month';
  
  const handleDayClick = (day: Date) => {
    if (selectedDay && day.toDateString() === selectedDay.toDateString()) {
      setSelectedDay(null);
    } else {
      setSelectedDay(day);
    }
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
              // Extract the ISO date string for comparison
              const formattedDate = date.toISOString().split('T')[0];
              const sentimentInfo = sentimentMap.get(formattedDate);
              
              // Check if this date is in our selected dates
              const isSelected = filteredData.some(
                d => d.date.toISOString().split('T')[0] === formattedDate
              );
              
              const isClickedDay = selectedDay && date.toDateString() === selectedDay.toDateString();
              
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
                  {sentimentInfo && (
                    <motion.div 
                      className={cn(
                        "absolute inset-1 rounded-md opacity-80",
                        sentimentInfo.colorClass
                      )}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 0.8 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                  
                  {/* Date content */}
                  <div className={cn(
                    "flex flex-col items-center justify-center h-full w-full z-10",
                    sentimentInfo && sentimentInfo.textColorClass
                  )}>
                    {/* Date number */}
                    <span className={cn(
                      "text-sm md:text-base font-medium",
                      sentimentInfo && sentimentInfo.textColorClass
                    )}>
                      {date.getDate()}
                    </span>
                    
                    {/* Emoji display */}
                    {sentimentInfo && (
                      <motion.span 
                        className="text-base md:text-lg"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, duration: 0.2 }}
                      >
                        {sentimentInfo.emoji}
                      </motion.span>
                    )}
                  </div>
                  
                  {/* Day details popup */}
                  <AnimatePresence>
                    {isClickedDay && sentimentInfo && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-popover shadow-lg rounded-lg p-3 z-50 w-48"
                      >
                        <div className="text-center mb-1 font-medium">
                          {format(date, 'MMMM d, yyyy')}
                        </div>
                        <div className="flex justify-center items-center space-x-2">
                          <span className="text-2xl">{sentimentInfo.emoji}</span>
                          <span className="text-sm">
                            Mood: {sentimentInfo.sentiment >= 0.3 ? 'Happy' : 
                                   sentimentInfo.sentiment >= -0.3 ? 'Neutral' : 'Sad'}
                          </span>
                        </div>
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
    </motion.div>
  );
}
