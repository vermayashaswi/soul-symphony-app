import React from 'react';
import { format, isSameDay, isToday, parseISO, startOfDay, startOfMonth, startOfWeek, startOfYear, addDays, addMonths, addWeeks, addYears } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import { TimeRange } from '@/hooks/use-insights-data';
import { useIsMobile } from '@/hooks/use-mobile';
import { EnhancedTranslatableText } from '@/components/translation/EnhancedTranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { formatDateForTimeRange } from '@/utils/date-formatter';

interface MoodData {
  date: Date;
  sentiment: number;
}

interface MoodCalendarGridProps {
  sentimentData: MoodData[];
  timeRange: TimeRange;
  currentDate: Date;
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

const MoodCalendarGrid: React.FC<MoodCalendarGridProps> = ({ sentimentData, timeRange, currentDate }) => {
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const { currentLanguage } = useTranslation();
  
  if (!sentimentData || sentimentData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          <EnhancedTranslatableText 
            text="No data available for this timeframe" 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="general"
            usePageTranslation={true}
          />
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
  
  // Generate dates based on time range and current date
  const getDates = () => {
    let dates: Date[] = [];
    
    switch (timeRange) {
      case 'today': {
        // For today, use hours instead of days
        const selectedDay = startOfDay(currentDate);
        dates = Array.from({ length: 12 }, (_, i) => {
          const date = new Date(selectedDay);
          date.setHours(9 + i); // Start from 9 AM to 8 PM
          date.setMinutes(0);
          date.setSeconds(0);
          return date;
        });
        break;
      }
      case 'week': {
        // Get the start of the week for the current date
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        dates = Array.from({ length: 7 }, (_, i) => {
          return addDays(weekStart, i);
        });
        break;
      }
      case 'month': {
        // Get the first day of the month
        const monthStart = startOfMonth(currentDate);
        // Get days in the current month
        const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
        dates = Array.from({ length: daysInMonth }, (_, i) => {
          return new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1);
        });
        break;
      }
      case 'year': {
        // We'll handle the year view differently - see renderYearGrid
        const yearStart = startOfYear(currentDate);
        dates = Array.from({ length: 12 }, (_, i) => {
          return new Date(yearStart.getFullYear(), i, 1);
        });
        break;
      }
      default:
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        dates = Array.from({ length: 7 }, (_, i) => {
          return addDays(weekStart, i);
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
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  hasMood 
                    ? getSentimentColor(sentiment)
                    : "bg-muted",
                  isToday(date) && "ring-2 ring-primary ring-offset-2"
                )}
              />
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
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  hasMood 
                    ? getSentimentColor(sentiment)
                    : "bg-muted"
                )}
              />
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
            <EnhancedTranslatableText 
              text={day} 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="compact"
              usePageTranslation={true}
            />
          </div>
        ))}
        
        {/* Empty cells for days before the first of the month */}
        {Array.from({ length: dates[0].getDay() }).map((_, i) => (
          <div key={`empty-${i}`} className="h-8" />
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
                  "w-8 h-8 rounded-full flex flex-col items-center justify-center transition-all",
                  hasMood 
                    ? getSentimentColor(sentiment)
                    : "bg-muted/30",
                  isToday(date) && "ring-1 ring-primary ring-offset-1"
                )}
              >
                <span className={cn(
                  "text-xs font-medium",
                  hasMood ? "text-white" : "text-foreground"
                )}>
                  {format(date, 'd')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  const renderYearGrid = () => {
    const currentYear = currentDate.getFullYear();
    // Use single letter abbreviations for months instead of three letters
    const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    
    // Generate all days for the entire year (1-31)
    const allYearDates = Array.from({ length: 31 }, (_, i) => i + 1);
    
    return (
      <div className="w-full overflow-x-hidden">
        <div className="compact-year-view overflow-x-auto">
          <table className={cn(
            "w-full border-collapse table-fixed",
            isMobile ? "compact-table-mobile" : ""
          )}>
            <thead>
              <tr>
                <th className={cn(
                  "text-xs text-muted-foreground sticky top-0 bg-background z-10",
                  isMobile ? "w-6 px-1" : "w-8 px-1"
                )}></th>
                {months.map((month, index) => (
                  <th key={month} className={cn(
                    "text-xs text-center text-muted-foreground sticky top-0 bg-background z-10",
                    isMobile ? "px-1 py-1" : "px-1 py-1"
                  )}>
                    <EnhancedTranslatableText 
                      text={month} 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="compact"
                      usePageTranslation={true}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-xs">
              {allYearDates.map(day => (
                <tr key={`day-${day}`} className={day % 2 === 0 ? "bg-muted/5" : ""}>
                  <td className={cn(
                    "text-xs text-center text-muted-foreground sticky left-0 bg-background",
                    isMobile ? "px-1" : "px-1"
                  )}>{day}</td>
                  {months.map((_, monthIndex) => {
                    // Check if this day exists in this month (e.g., no Feb 30th)
                    const daysInMonth = new Date(currentYear, monthIndex + 1, 0).getDate();
                    
                    if (day > daysInMonth) {
                      return <td key={`empty-${monthIndex}-${day}`} className="p-0"></td>;
                    }
                    
                    const date = new Date(currentYear, monthIndex, day);
                    const dateKey = format(date, 'yyyy-MM-dd');
                    const hasMood = sentimentByDate.has(dateKey);
                    const sentiment = sentimentByDate.get(dateKey) || 0;
                    
                    return (
                      <td key={dateKey} className={cn(
                        "text-center align-middle",
                        isMobile ? "p-0" : "p-0"
                      )}>
                        <div 
                          className={cn(
                            isMobile ? "w-3 h-3" : "w-4 h-4",
                            "rounded-full mx-auto",
                            hasMood 
                              ? getSentimentColor(sentiment)
                              : "bg-muted/30",
                            isToday(date) && "ring-1 ring-primary ring-offset-1"
                          )}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full py-4">
      {renderGrid()}
      
      <div className="flex justify-center gap-4 text-xs text-muted-foreground mt-4">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <EnhancedTranslatableText 
            text="Positive" 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="compact"
            usePageTranslation={true}
          />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <EnhancedTranslatableText 
            text="Neutral" 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="compact"
            usePageTranslation={true}
          />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <EnhancedTranslatableText 
            text="Negative" 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="compact"
            usePageTranslation={true}
          />
        </div>
      </div>
    </div>
  );
};

export default MoodCalendarGrid;
