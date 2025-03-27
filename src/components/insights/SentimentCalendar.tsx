import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar } from '@/components/ui/calendar';
import { Smile, Meh, Frown } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { JournalEntry } from '@/components/journal/JournalEntryCard';
import { TimeRange } from '@/hooks/use-insights-data';

interface SentimentCalendarProps {
  entries: JournalEntry[];
  timeRange: TimeRange;
}

type SentimentData = {
  [date: string]: {
    avgScore: number;
    count: number;
  };
};

const SentimentCalendar: React.FC<SentimentCalendarProps> = ({ entries, timeRange }) => {
  // Process journal entries to get sentiment by date
  const sentimentByDate = useMemo(() => {
    const data: SentimentData = {};
    
    entries.forEach(entry => {
      if (entry.sentiment) {
        const dateStr = format(new Date(entry.created_at), 'yyyy-MM-dd');
        
        if (!data[dateStr]) {
          data[dateStr] = { avgScore: 0, count: 0 };
        }
        
        const score = parseFloat(entry.sentiment);
        data[dateStr].avgScore = (data[dateStr].avgScore * data[dateStr].count + score) / (data[dateStr].count + 1);
        data[dateStr].count += 1;
      }
    });
    
    return data;
  }, [entries]);

  // Helper function to get sentiment color
  const getSentimentColor = (score: number) => {
    if (score > 0.25) return "bg-green-500";
    if (score < -0.25) return "bg-red-500";
    return "bg-amber-500";
  };

  // Helper function to get sentiment emoji
  const getSentimentEmoji = (score: number) => {
    if (score > 0.25) return <Smile className="h-5 w-5 text-white" />;
    if (score < -0.25) return <Frown className="h-5 w-5 text-white" />;
    return <Meh className="h-5 w-5 text-white" />;
  };

  // Helper function to get sentiment label
  const getSentimentLabel = (score: number) => {
    if (score > 0.5) return "Very Positive";
    if (score > 0.25) return "Positive";
    if (score < -0.5) return "Very Negative";
    if (score < -0.25) return "Negative";
    return "Neutral";
  };

  // Render today's sentiment for "today" timeRange
  const renderTodaySentiment = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayData = sentimentByDate[today];
    
    if (!todayData) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center">
            <Meh className="h-8 w-8 text-gray-500" />
          </div>
          <p className="mt-4 text-lg font-medium">No entries for today</p>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className={`h-20 w-20 ${getSentimentColor(todayData.avgScore)} rounded-full flex items-center justify-center`}>
          {getSentimentEmoji(todayData.avgScore)}
        </div>
        <p className="mt-4 text-lg font-medium">{getSentimentLabel(todayData.avgScore)}</p>
        <p className="text-sm text-muted-foreground">Score: {todayData.avgScore.toFixed(2)}</p>
        <p className="text-sm text-muted-foreground">Based on {todayData.count} entries</p>
      </div>
    );
  };

  // Render week view
  const renderWeekSentiment = () => {
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - date.getDay() + i);
      return format(date, 'yyyy-MM-dd');
    });
    
    return (
      <div className="grid grid-cols-7 gap-2 p-4">
        {weekDays.map((dateStr, i) => {
          const dayData = sentimentByDate[dateStr];
          const dayName = format(new Date(dateStr), 'E');
          const dayNum = format(new Date(dateStr), 'd');
          const isToday = isSameDay(new Date(dateStr), new Date());
          
          return (
            <div key={dateStr} className="flex flex-col items-center">
              <p className={cn(
                "text-xs mb-1", 
                isToday ? "font-bold" : "text-muted-foreground"
              )}>
                {dayName}
              </p>
              <p className={cn(
                "text-sm mb-2",
                isToday ? "font-bold" : ""
              )}>
                {dayNum}
              </p>
              
              {dayData ? (
                <div className={`h-10 w-10 ${getSentimentColor(dayData.avgScore)} rounded-full flex items-center justify-center`}>
                  {getSentimentEmoji(dayData.avgScore)}
                </div>
              ) : (
                <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-gray-500 text-xs">N/A</span>
                </div>
              )}
              
              {dayData && (
                <p className="text-xs mt-1 text-muted-foreground">
                  {dayData.avgScore.toFixed(1)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Custom day renderer for the calendar
  const renderDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayData = sentimentByDate[dateStr];
    
    if (!dayData) return null;
    
    const sentimentColor = getSentimentColor(dayData.avgScore);
    
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <div className={`absolute top-0 left-0 right-0 bottom-0 ${sentimentColor} opacity-70 rounded-full`}></div>
        <span className="relative text-white font-medium z-10">{format(date, 'd')}</span>
      </div>
    );
  };

  // Content based on timeRange
  const renderContent = () => {
    switch (timeRange) {
      case 'today':
        return renderTodaySentiment();
      case 'week':
        return renderWeekSentiment();
      case 'month':
      case 'year':
        return (
          <div className="px-4">
            <Calendar
              mode="single"
              onSelect={() => {}}
              className="mx-auto max-w-md"
              components={{
                Day: ({ date, ...props }) => {
                  const dayContent = renderDay(date);
                  return dayContent ? (
                    <div {...props}>
                      {dayContent}
                    </div>
                  ) : (
                    <div {...props} />
                  );
                },
              }}
            />
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm">Positive</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="text-sm">Neutral</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm">Negative</span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Soul-days</h3>
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white p-4 rounded-xl shadow-sm"
        whileHover={{ boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
      >
        {renderContent()}
      </motion.div>
    </div>
  );
};

export default SentimentCalendar;
