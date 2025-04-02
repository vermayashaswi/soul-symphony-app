
import React from 'react';
import { Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isWithinInterval } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { JournalInsight, TimeRange } from '@/hooks/use-insights-data';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type SentimentCalendarProps = {
  entries: JournalInsight[];
  timeRange: TimeRange;
};

const timeRangeToInterval = (timeRange: TimeRange): { start: Date, end: Date } => {
  const now = new Date();
  switch (timeRange) {
    case 'today':
      return { start: now, end: now };
    case 'week':
      return { start: startOfWeek(now), end: endOfWeek(now) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'year':
      return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) };
    default:
      return { start: new Date(2020, 0, 1), end: new Date() };
  }
};

const getSentimentScore = (entry: JournalInsight): number => {
  if (typeof entry.sentiment === 'number') {
    return entry.sentiment;
  } else if (typeof entry.sentiment === 'string') {
    return parseFloat(entry.sentiment) || 0;
  } else if (entry.sentiment && typeof entry.sentiment === 'object' && 'score' in entry.sentiment) {
    return typeof entry.sentiment.score === 'number' ? entry.sentiment.score : 0;
  }
  return 0;
};

const SentimentCalendar: React.FC<SentimentCalendarProps> = ({ entries, timeRange }) => {
  const now = new Date();
  const { start, end } = timeRangeToInterval(timeRange);
  const currentMonth = startOfMonth(now);
  const firstDayOfMonth = startOfWeek(startOfMonth(start));
  const lastDayOfMonth = endOfWeek(endOfMonth(start));
  let currentDay = firstDayOfMonth;

  const calendar = [];
  while (currentDay <= lastDayOfMonth) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(currentDay);
      currentDay = addDays(currentDay, 1);
    }
    calendar.push(week);
  }

  return (
    <Card className="border">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Sentiment Calendar</h2>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
            <div key={index} className="text-center text-xs text-muted-foreground">
              {day}
            </div>
          ))}
        </div>
        {calendar.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1">
            {week.map((day, dayIndex) => {
              const dayEntries = entries.filter(entry => {
                const entryDate = new Date(entry.created_at);
                return isSameDay(entryDate, day) && isWithinInterval(entryDate, { start, end });
              });
              const sentimentScore = dayEntries.reduce((sum, entry) => sum + getSentimentScore(entry), 0);
              const averageSentiment = dayEntries.length > 0 ? sentimentScore / dayEntries.length : 0;

              let sentimentColor = 'bg-muted';
              if (averageSentiment > 0.2) {
                sentimentColor = 'bg-green-200';
              } else if (averageSentiment < -0.2) {
                sentimentColor = 'bg-red-200';
              } else if (averageSentiment !== 0) {
                sentimentColor = 'bg-yellow-200';
              }

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors hover:bg-secondary/50 focus:outline-none",
                    isSameDay(day, now) && "font-medium text-primary",
                    !isWithinInterval(day, { start: startOfMonth(start), end: endOfMonth(start) }) && "text-muted-foreground opacity-50",
                    dayEntries.length > 0 && "font-semibold",
                    sentimentColor
                  )}
                >
                  {format(day, 'd', { locale: enUS })}
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default SentimentCalendar;
