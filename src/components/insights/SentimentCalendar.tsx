
import React from 'react';
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { DayProps } from "react-day-picker";

interface SentimentCalendarProps {
  sentimentData: {
    date: Date;
    sentiment: number;
  }[];
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

export default function SentimentCalendar({ sentimentData }: SentimentCalendarProps) {
  // Create a map for easier lookup
  const sentimentMap = new Map(
    sentimentData.map(item => [
      item.date.toISOString().split('T')[0],
      { sentiment: item.sentiment, emoji: getEmoji(item.sentiment) }
    ])
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl border shadow-sm bg-card"
    >
      <Calendar
        mode="multiple"
        selected={sentimentData.map(d => d.date)}
        className="p-0 rounded-xl"
        classNames={{
          day_today: "bg-primary/5 text-primary font-medium",
          day_selected: "!bg-transparent !text-foreground",
          day_disabled: "text-muted-foreground opacity-50",
          day_outside: "text-muted-foreground opacity-50",
          day_range_middle: "aria-selected:bg-transparent",
          day_hidden: "invisible",
          caption: "px-4 py-2",
          month: "space-y-1",
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
            const isSelected = sentimentData.some(
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
                {/* Fixed layout: use absolute positioning with proper spacing */}
                <div className="flex flex-col items-center justify-center h-full w-full">
                  {/* Date number at the top */}
                  <span className="text-xs mb-1">
                    {date.getDate()}
                  </span>
                  
                  {/* Emoji below with proper spacing */}
                  {sentimentInfo && (
                    <span className="text-xs">
                      {sentimentInfo.emoji}
                    </span>
                  )}
                </div>
              </div>
            );
          },
        }}
      />
    </motion.div>
  );
}
