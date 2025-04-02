import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Smile, Meh, Frown, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isSameDay, isSameMonth, startOfYear, endOfYear, eachMonthOfInterval, getMonth } from 'date-fns';
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
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const sentimentByDate = useMemo(() => {
    const data: SentimentData = {};
    
    entries.forEach(entry => {
      if (entry.sentiment) {
        const dateStr = format(new Date(entry.created_at), 'yyyy-MM-dd');
        
        if (!data[dateStr]) {
          data[dateStr] = { avgScore: 0, count: 0 };
        }
        
        const sentimentScore = typeof entry.sentiment === 'string' 
          ? parseFloat(entry.sentiment) 
          : entry.sentiment.score;
        
        data[dateStr].avgScore = (data[dateStr].avgScore * data[dateStr].count + sentimentScore) / (data[dateStr].count + 1);
        data[dateStr].count += 1;
      }
    });
    
    return data;
  }, [entries]);

  const getSentimentColor = (score: number) => {
    if (score > 0.25) return "bg-green-500";
    if (score < -0.25) return "bg-red-500";
    return "bg-amber-500";
  };

  const getSentimentEmoji = (score: number) => {
    if (score > 0.25) return <Smile className="h-5 w-5 text-white" />;
    if (score < -0.25) return <Frown className="h-5 w-5 text-white" />;
    return <Meh className="h-5 w-5 text-white" />;
  };

  const getSentimentLabel = (score: number) => {
    if (score > 0.25) return "Positive";
    if (score < -0.25) return "Negative";
    return "Neutral";
  };

  const renderLegends = () => (
    <div className="flex justify-center gap-6 mt-4">
      <div className="flex items-center gap-2">
        <motion.div 
          className="w-3 h-3 rounded-full bg-green-500"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="text-sm">Positive</span>
      </div>
      <div className="flex items-center gap-2">
        <motion.div 
          className="w-3 h-3 rounded-full bg-amber-500"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
        />
        <span className="text-sm">Neutral</span>
      </div>
      <div className="flex items-center gap-2">
        <motion.div 
          className="w-3 h-3 rounded-full bg-red-500"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
        />
        <span className="text-sm">Negative</span>
      </div>
    </div>
  );

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
          {renderLegends()}
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <motion.div 
          className={`h-20 w-20 ${getSentimentColor(todayData.avgScore)} rounded-full flex items-center justify-center`}
          animate={{ 
            scale: [1, 1.05, 1],
            y: [0, -5, 0]
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        >
          {getSentimentEmoji(todayData.avgScore)}
        </motion.div>
        <p className="mt-4 text-lg font-medium">{getSentimentLabel(todayData.avgScore)}</p>
        <p className="text-sm text-muted-foreground">Based on {todayData.count} entries</p>
        {renderLegends()}
      </div>
    );
  };

  const renderWeekSentiment = () => {
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - date.getDay() + i);
      return format(date, 'yyyy-MM-dd');
    });
    
    return (
      <div className="space-y-4">
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
                  <motion.div 
                    className={`h-10 w-10 ${getSentimentColor(dayData.avgScore)} rounded-full flex items-center justify-center`}
                    animate={{ 
                      scale: [1, 1.05, 1],
                      rotate: [0, i % 2 === 0 ? 5 : -5, 0]
                    }}
                    transition={{ 
                      duration: 2 + (i * 0.3),
                      repeat: Infinity,
                      repeatType: "reverse"
                    }}
                  >
                    {getSentimentEmoji(dayData.avgScore)}
                  </motion.div>
                ) : (
                  <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-gray-500 text-xs">N/A</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {renderLegends()}
      </div>
    );
  };

  const prevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  function getDaysInMonth(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const firstDayToDisplay = new Date(firstDayOfMonth);
    const dayOfWeek = firstDayOfMonth.getDay();
    firstDayToDisplay.setDate(firstDayToDisplay.getDate() - dayOfWeek);
    
    const days: Date[] = [];
    const totalDaysToShow = 42;
    
    for (let i = 0; i < totalDaysToShow; i++) {
      const day = new Date(firstDayToDisplay);
      day.setDate(day.getDate() + i);
      days.push(day);
      
      if (day > lastDayOfMonth && day.getDay() === 6) {
        break;
      }
    }
    
    return days;
  }

  const renderMonthCalendar = () => {
    const monthStr = format(currentDate, 'MMMM yyyy');

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={prevMonth}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="text-lg font-medium">{monthStr}</h3>
          <button 
            onClick={nextMonth}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-center py-2 text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
          
          {getDaysInMonth(currentDate).map((date, i) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayData = sentimentByDate[dateStr];
            const isCurrentMonth = isSameMonth(date, currentDate);
            
            return (
              <div 
                key={i} 
                className={cn(
                  "aspect-square border border-gray-100",
                  !isCurrentMonth && "opacity-30"
                )}
              >
                <div className="relative w-full h-full flex items-center justify-center p-2">
                  <div className="text-center">
                    <span className={cn(
                      "text-sm",
                      isCurrentMonth ? "font-medium" : "text-muted-foreground"
                    )}>
                      {format(date, 'd')}
                    </span>
                    
                    {dayData ? (
                      <motion.div 
                        className={`mt-1 mx-auto h-8 w-8 ${getSentimentColor(dayData.avgScore)} rounded-full flex items-center justify-center`}
                        animate={{
                          scale: [1, 1.05, 1]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          repeatType: "reverse"
                        }}
                      >
                        {getSentimentEmoji(dayData.avgScore)}
                      </motion.div>
                    ) : isCurrentMonth ? (
                      <div className="mt-1 mx-auto h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-gray-500 text-xs">N/A</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {renderLegends()}
      </div>
    );
  };

  const renderYearView = () => {
    const currentYear = new Date().getFullYear();
    const yearStart = startOfYear(new Date(currentYear, 0, 1));
    const yearEnd = endOfYear(new Date(currentYear, 0, 1));
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

    const getMonthSentiment = (month: Date) => {
      const monthNumber = getMonth(month);
      const entriesInMonth = entries.filter(entry => {
        const entryDate = new Date(entry.created_at);
        return getMonth(entryDate) === monthNumber && entryDate.getFullYear() === currentYear;
      });
      
      if (entriesInMonth.length === 0) return null;
      
      let totalSentiment = 0;
      let validEntries = 0;

      entriesInMonth.forEach(entry => {
        if (entry.sentiment) {
          const score = typeof entry.sentiment === 'string' 
            ? parseFloat(entry.sentiment) 
            : entry.sentiment.score;
          
          if (!isNaN(score)) {
            totalSentiment += score;
            validEntries++;
          }
        }
      });
      
      return validEntries > 0 ? totalSentiment / validEntries : null;
    };

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-center">{currentYear}</h3>
        
        <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
          {months.map((month, i) => {
            const sentiment = getMonthSentiment(month);
            const monthName = format(month, 'MMM');
            
            return (
              <div key={i} className="flex flex-col items-center">
                <p className="mb-2 font-medium">{monthName}</p>
                
                {sentiment !== null ? (
                  <motion.div 
                    className={`h-16 w-16 ${getSentimentColor(sentiment)} rounded-full flex items-center justify-center`}
                    animate={{ 
                      scale: [1, 1.05, 1],
                      rotate: [0, i % 2 === 0 ? 5 : -5, 0]
                    }}
                    transition={{ 
                      duration: 2 + (i * 0.2),
                      repeat: Infinity,
                      repeatType: "reverse"
                    }}
                  >
                    {getSentimentEmoji(sentiment)}
                  </motion.div>
                ) : (
                  <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-gray-500 text-xs">N/A</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {renderLegends()}
      </div>
    );
  };

  const renderContent = () => {
    switch (timeRange) {
      case 'today':
        return renderTodaySentiment();
      case 'week':
        return renderWeekSentiment();
      case 'month':
        return renderMonthCalendar();
      case 'year':
        return renderYearView();
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Mood Calendar</h3>
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
