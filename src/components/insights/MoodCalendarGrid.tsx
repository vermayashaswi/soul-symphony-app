
import React from 'react';
import { format, isSameDay, isToday, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import { TimeRange } from '@/hooks/use-insights-data';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { formatDateForTimeRange } from '@/utils/date-formatter';
import { Calendar } from 'lucide-react';

interface MoodData {
  date: Date;
  sentiment: number;
}

interface MoodCalendarGridProps {
  sentimentData: MoodData[];
  timeRange: TimeRange;
}

// Helper function to determine the color based on sentiment
const getSentimentColor = (sentiment: number): string => {
  if (sentiment >= 0.2) return 'bg-green-500'; // Positive
  if (sentiment <= -0.2) return 'bg-red-500'; // Negative
  return 'bg-yellow-400'; // Neutral
};

const getSentimentLabel = (sentiment: number): string => {
  if (sentiment >= 0.2) return 'Positive';
  if (sentiment <= -0.2) return 'Negative';
  return 'Neutral';
};

const MoodCalendarGrid: React.FC<MoodCalendarGridProps> = ({ sentimentData, timeRange }) => {
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const { currentLanguage } = useTranslation();
  
  if (!sentimentData || sentimentData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          <TranslatableText text="No data available for this timeframe" forceTranslate={true} />
        </p>
      </div>
    );
  }
  
  // Group the data by date
  const sentimentByDate = new Map<string, number>();
  const originalDateMap = new Map<string, Date>();
  
  sentimentData.forEach(item => {
    const dateKey = format(item.date, 'yyyy-MM-dd');
    
    if (!sentimentByDate.has(dateKey)) {
      sentimentByDate.set(dateKey, item.sentiment);
      originalDateMap.set(dateKey, item.date);
    } else {
      // Average the sentiment if multiple entries on the same day
      const currentSum = sentimentByDate.get(dateKey) || 0;
      const currentCount = sentimentByDate.has(dateKey) ? 1 : 0;
      const newAverage = (currentSum * currentCount + item.sentiment) / (currentCount + 1);
      sentimentByDate.set(dateKey, newAverage);
    }
  });
  
  // Generate dates based on time range
  const getDates = () => {
    const now = new Date();
    let dates: Date[] = [];
    
    switch (timeRange) {
      case 'today':
        // For today, use hours instead of days
        dates = Array.from({ length: 12 }, (_, i) => {
          const date = new Date(now);
          date.setHours(9 + i); // Start from 9 AM to 8 PM
          date.setMinutes(0);
          date.setSeconds(0);
          return date;
        });
        break;
      case 'week':
        // 7 days of the week
        dates = Array.from({ length: 7 }, (_, i) => {
          const date = new Date(now);
          date.setDate(date.getDate() - date.getDay() + i);
          return date;
        });
        break;
      case 'month':
        // Get days in the current month
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        dates = Array.from({ length: daysInMonth }, (_, i) => {
          const date = new Date(now.getFullYear(), now.getMonth(), i + 1);
          return date;
        });
        break;
      case 'year':
        // 12 months of the year
        dates = Array.from({ length: 12 }, (_, i) => {
          const date = new Date(now.getFullYear(), i, 1);
          return date;
        });
        break;
      default:
        dates = Array.from({ length: 7 }, (_, i) => {
          const date = new Date(now);
          date.setDate(date.getDate() - date.getDay() + i);
          return date;
        });
    }
    
    return dates;
  };
  
  const dates = getDates();
  
  const renderGrid = () => {
    switch (timeRange) {
      case 'today':
        return renderHourlyGrid();
      case 'month':
        return renderMonthGrid();
      case 'year':
        return renderYearGrid();
      case 'week':
      default:
        return renderWeekGrid();
    }
  };
  
  const renderWeekGrid = () => {
    return (
      <div className="grid grid-cols-7 gap-2 mt-4">
        {dates.map(date => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const hasMood = sentimentByDate.has(dateKey);
          const sentiment = sentimentByDate.get(dateKey) || 0;
          
          return (
            <div key={dateKey} className="flex flex-col items-center">
              <div className="text-xs text-muted-foreground mb-1">
                {format(date, 'EEE')}
              </div>
              <div className="text-sm mb-2">
                {format(date, 'd')}
              </div>
              <div 
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                  hasMood 
                    ? getSentimentColor(sentiment)
                    : "bg-muted",
                  isToday(date) && "ring-2 ring-primary ring-offset-2"
                )}
                title={hasMood ? `${getSentimentLabel(sentiment)}: ${sentiment.toFixed(2)}` : "No data"}
              >
                {hasMood && (
                  <span className="text-white font-medium">
                    {sentiment >= 0 ? "+" : ""}{Math.round(sentiment * 10) / 10}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  const renderHourlyGrid = () => {
    return (
      <div className="grid grid-cols-6 gap-2 mt-4">
        {dates.map(date => {
          const dateKey = format(date, 'yyyy-MM-dd-HH');
          // Find sentiment data from the closest hour
          const closestData = sentimentData.find(item => {
            const itemHour = item.date.getHours();
            return isSameDay(item.date, date) && Math.abs(itemHour - date.getHours()) <= 1;
          });
          
          const hasMood = !!closestData;
          const sentiment = closestData?.sentiment || 0;
          
          return (
            <div key={dateKey} className="flex flex-col items-center">
              <div className="text-sm mb-2">
                {format(date, 'h a')}
              </div>
              <div 
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  hasMood 
                    ? getSentimentColor(sentiment)
                    : "bg-muted"
                )}
                title={hasMood ? `${getSentimentLabel(sentiment)}: ${sentiment.toFixed(2)}` : "No data"}
              >
                {hasMood && (
                  <span className="text-white text-xs font-medium">
                    {sentiment >= 0 ? "+" : ""}{Math.round(sentiment * 10) / 10}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  const renderMonthGrid = () => {
    return (
      <div className="grid grid-cols-7 gap-1 mt-4">
        {/* Weekday headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-xs text-center text-muted-foreground">
            <TranslatableText text={day} forceTranslate={true} />
          </div>
        ))}
        
        {/* Empty cells for days before the first of the month */}
        {Array.from({ length: dates[0].getDay() }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10" />
        ))}
        
        {/* Month days */}
        {dates.map(date => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const hasMood = sentimentByDate.has(dateKey);
          const sentiment = sentimentByDate.get(dateKey) || 0;
          
          return (
            <div key={dateKey} className="flex flex-col items-center">
              <div 
                className={cn(
                  "w-10 h-10 rounded-full flex flex-col items-center justify-center transition-all",
                  hasMood 
                    ? getSentimentColor(sentiment)
                    : "bg-muted/30",
                  isToday(date) && "ring-2 ring-primary ring-offset-1"
                )}
                title={hasMood ? `${getSentimentLabel(sentiment)}: ${sentiment.toFixed(2)}` : "No data"}
              >
                <span className={cn(
                  "text-xs font-medium",
                  hasMood ? "text-white" : "text-foreground"
                )}>
                  {format(date, 'd')}
                </span>
                {hasMood && (
                  <span className="text-white text-[8px]">
                    {sentiment >= 0 ? "+" : ""}{Math.round(sentiment * 10) / 10}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  const renderYearGrid = () => {
    return (
      <div className="grid grid-cols-4 gap-4 mt-4">
        {dates.map(date => {
          const monthKey = format(date, 'yyyy-MM');
          // Find sentiment data for this month
          const monthData = Array.from(sentimentByDate.entries())
            .filter(([key]) => key.startsWith(monthKey))
            .map(([_, value]) => value);
          
          const hasMood = monthData.length > 0;
          // Average sentiment for the month
          const averageSentiment = hasMood 
            ? monthData.reduce((sum, val) => sum + val, 0) / monthData.length
            : 0;
          
          return (
            <div key={monthKey} className="flex flex-col items-center">
              <div className="text-sm mb-2">
                {format(date, 'MMM')}
              </div>
              <div 
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center transition-all",
                  hasMood 
                    ? getSentimentColor(averageSentiment)
                    : "bg-muted"
                )}
                title={hasMood ? `${getSentimentLabel(averageSentiment)}: ${averageSentiment.toFixed(2)}` : "No data"}
              >
                {hasMood && (
                  <div className="text-center">
                    <span className="text-white text-sm font-medium">
                      {averageSentiment >= 0 ? "+" : ""}{Math.round(averageSentiment * 10) / 10}
                    </span>
                    <div className="text-white text-xs">
                      ({monthData.length})
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full py-4">
      {renderGrid()}
      
      <div className="flex justify-center gap-4 text-xs text-muted-foreground mt-8">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <TranslatableText text="Positive" forceTranslate={true} />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <TranslatableText text="Neutral" forceTranslate={true} />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <TranslatableText text="Negative" forceTranslate={true} />
        </div>
      </div>
    </div>
  );
};

export default MoodCalendarGrid;
