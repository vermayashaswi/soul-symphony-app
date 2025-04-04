
import React from 'react';
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { DayProps } from "react-day-picker";
import { subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

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
  if (sentiment >= 0.1) return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"; // Happy colors
  if (sentiment >= -0.1) return "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"; // Neutral colors
  return "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"; // Sad colors
}

export default function SentimentCalendar({ sentimentData, timeRange }: SentimentCalendarProps) {
  const isMobile = useIsMobile();
  
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
        colorClass: getEmojiColor(item.sentiment)
      }
    ])
  );

  // Determine if we need a more compact view for mobile
  const calendarMode = isMobile ? (timeRange === 'year' ? 'year' : 'month') : 'month';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl border shadow-sm bg-card overflow-hidden"
    >
      <div className={cn(
        "max-w-full overflow-x-auto pb-2",
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
            caption: "px-4 py-2",
            month: "space-y-1",
            months: isMobile ? "flex flex-col space-y-4" : "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            cell: cn(
              "relative p-0 h-9 w-9",
              "focus-within:relative focus-within:z-20"
            ),
            day: cn(
              "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-primary/10"
            ),
            nav_button: "hover:bg-primary/10",
            table: "mt-2",
            row: "flex-1",
            head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
            head_row: "flex",
            caption_label: "text-base",
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
              
              return (
                <div
                  className={cn(
                    "h-9 w-9 relative flex items-center justify-center hover:bg-primary/10 rounded-md transition-colors",
                    isSelected && "font-medium text-primary"
                  )}
                  {...props}
                >
                  {/* Fixed layout with proper spacing */}
                  <div className="flex flex-col items-center justify-center h-full w-full">
                    {/* Date number at the top */}
                    <span className="text-xs">
                      {date.getDate()}
                    </span>
                    
                    {/* Emoji below with color coding */}
                    {sentimentInfo && (
                      <span className={cn(
                        "text-xs rounded-full p-0.5 mt-0.5",
                        sentimentInfo.colorClass
                      )}>
                        {sentimentInfo.emoji}
                      </span>
                    )}
                  </div>
                </div>
              );
            },
          }}
        />
      </div>
    </motion.div>
  );
}
