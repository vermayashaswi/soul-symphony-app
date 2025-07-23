
import React, { useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, BarChart3, Network, Activity } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { TimeRange } from '@/hooks/use-insights-data';
import { InsightsData } from '@/hooks/use-insights-cache-data';
import LazySoulNet from './soulnet/LazySoulNet';
import { EmotionChart } from './EmotionChart';
import { MoodCalendar } from './MoodCalendar';

interface InsightsChartsProps {
  timeRange: TimeRange;
  chartInsightsData: InsightsData;
  emotionChartDate: Date;
  moodCalendarDate: Date;
  onEmotionChartNavigate: (date: Date) => void;
  onMoodCalendarNavigate: (date: Date) => void;
  userId: string | undefined;
}

export const InsightsCharts: React.FC<InsightsChartsProps> = ({
  timeRange,
  chartInsightsData,
  emotionChartDate,
  moodCalendarDate,
  onEmotionChartNavigate,
  onMoodCalendarNavigate,
  userId
}) => {
  const isMobile = useIsMobile();
  const [currentChartIndex, setCurrentChartIndex] = useState(0);

  // Chart definitions
  const charts = useMemo(() => [
    {
      id: 'emotion-chart',
      title: 'Emotion Trends',
      icon: TrendingUp,
      component: (
        <EmotionChart
          data={chartInsightsData.entries}
          timeRange={timeRange}
          selectedDate={emotionChartDate}
          onNavigate={onEmotionChartNavigate}
        />
      )
    },
    {
      id: 'mood-calendar',
      title: 'Mood Calendar',
      icon: Calendar,
      component: (
        <MoodCalendar
          data={chartInsightsData.entries}
          timeRange={timeRange}
          selectedDate={moodCalendarDate}
          onNavigate={onMoodCalendarNavigate}
        />
      )
    },
    {
      id: 'soul-net',
      title: 'Soul-Net',
      icon: Network,
      component: (
        <LazySoulNet
          userId={userId}
          timeRange={timeRange}
        />
      )
    }
  ], [
    chartInsightsData.entries,
    timeRange,
    emotionChartDate,
    moodCalendarDate,
    onEmotionChartNavigate,
    onMoodCalendarNavigate,
    userId
  ]);

  const handlePrevChart = useCallback(() => {
    setCurrentChartIndex(prev => prev === 0 ? charts.length - 1 : prev - 1);
  }, [charts.length]);

  const handleNextChart = useCallback(() => {
    setCurrentChartIndex(prev => prev === charts.length - 1 ? 0 : prev + 1);
  }, [charts.length]);

  const getDateRangeLabel = (date: Date, range: TimeRange): string => {
    switch (range) {
      case 'today':
        return format(date, 'MMMM d, yyyy');
      case 'week':
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'month':
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        return `${format(monthStart, 'MMM d')} - ${format(monthEnd, 'MMM d, yyyy')}`;
      case 'year':
        const yearStart = startOfYear(date);
        const yearEnd = endOfYear(date);
        return `${format(yearStart, 'MMM d, yyyy')} - ${format(yearEnd, 'MMM d, yyyy')}`;
      default:
        return format(date, 'MMMM d, yyyy');
    }
  };

  const currentChart = charts[currentChartIndex];

  if (isMobile) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <currentChart.icon className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">
              <TranslatableText 
                text={currentChart.title} 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
              />
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevChart}
              className="w-8 h-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentChartIndex + 1} / {charts.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextChart}
              className="w-8 h-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="px-4">
          {currentChart.component}
        </div>

        <div className="flex justify-center space-x-2 px-4">
          {charts.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentChartIndex(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                index === currentChartIndex ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {charts.map((chart) => (
        <Card key={chart.id} className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <chart.icon className="w-5 h-5 text-primary" />
              <span>
                <TranslatableText 
                  text={chart.title} 
                  forceTranslate={true}
                  enableFontScaling={true}
                  scalingContext="general"
                />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {chart.component}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
