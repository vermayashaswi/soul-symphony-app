
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useInsightsCacheData } from '@/hooks/use-insights-cache-data';
import { TimeRange } from '@/hooks/use-insights-data';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/contexts/TranslationContext';
import ErrorBoundary from '@/components/insights/ErrorBoundary';
import { InsightsTranslationProvider } from '@/components/insights/InsightsTranslationProvider';
import { TranslationProgressIndicator } from '@/components/insights/TranslationProgressIndicator';
import { PremiumFeatureGuard } from '@/components/subscription/PremiumFeatureGuard';
import { InsightsHeader } from '@/components/insights/InsightsHeader';
import { InsightsTimeToggle } from '@/components/insights/InsightsTimeToggle';
import { InsightsStatsGrid } from '@/components/insights/InsightsStatsGrid';
import { InsightsCharts } from '@/components/insights/InsightsCharts';
import { InsightsEmptyState } from '@/components/insights/InsightsEmptyState';
import { InsightsLoadingState } from '@/components/insights/InsightsLoadingState';

function InsightsContent() {
  const { user } = useAuth();
  const { prefetchTranslationsForRoute } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [emotionChartDate, setEmotionChartDate] = useState<Date>(new Date());
  const [moodCalendarDate, setMoodCalendarDate] = useState<Date>(new Date());
  const [isSticky, setIsSticky] = useState(false);
  const timeToggleRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const isMobile = useIsMobile();

  // FETCH INSIGHTS DATA: Now uses separated data for stats vs charts
  const { 
    statsInsightsData, 
    chartInsightsData,
    loading, 
    refreshing, 
    refreshCache, 
    isCacheHit 
  } = useInsightsCacheData(user?.id, timeRange, emotionChartDate);

  useEffect(() => {
    // Prefetch translations for the insights route
    if (prefetchTranslationsForRoute) {
      prefetchTranslationsForRoute('/insights').catch(console.error);
    }
  }, [prefetchTranslationsForRoute]);

  useEffect(() => {
    const handleScroll = () => {
      scrollPositionRef.current = window.scrollY;
      
      const scrollThreshold = isMobile ? 40 : 90;
      const nextIsSticky = window.scrollY > scrollThreshold;
      
      if (isSticky !== nextIsSticky) {
        setIsSticky(nextIsSticky);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile, isSticky]); 

  // When timeRange changes, reset both independently-scoped dates to today
  useEffect(() => {
    setEmotionChartDate(new Date());
    setMoodCalendarDate(new Date());
  }, [timeRange]);

  // Handlers to navigate up/down the timeframe
  const handleEmotionChartNavigate = (nextDate: Date) => {
    setEmotionChartDate(nextDate);
  };
  const handleMoodCalendarNavigate = (nextDate: Date) => {
    setMoodCalendarDate(nextDate);
  };

  const handleTimeRangeChange = (value: string) => {
    if (value) {
      scrollPositionRef.current = window.scrollY;
      setTimeRange(value as TimeRange);
      setEmotionChartDate(new Date());
      setMoodCalendarDate(new Date());
      setTimeout(() => {
        window.scrollTo({ top: scrollPositionRef.current });
      }, 10);
    }
  };

  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        window.scrollTo({ top: scrollPositionRef.current });
      }, 100);
    }
  }, [loading, statsInsightsData]);

  const hasAnyEntries = statsInsightsData.entries.length > 0 || statsInsightsData.allEntries.length > 0;

  return (
    <div 
      className="min-h-screen pb-20 insights-container"
      style={{
        position: 'fixed',
        top: '3px',
        left: 0,
        right: 0,
        bottom: 0,
        overflowY: 'auto',
        width: '100%',
        height: 'calc(100% - 3px)'
      }}
    >
      
      
      {isSticky && (
        <div className="fixed top-0 left-0 right-0 z-50 py-3 px-4 bg-background border-b shadow-sm flex justify-center insights-sticky-header">
          <div className={cn(
            "w-full flex justify-end",
            isMobile ? "max-w-full px-1" : "max-w-5xl"
          )}>
            <InsightsTimeToggle
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
              refreshing={refreshing}
              onRefresh={refreshCache}
            />
          </div>
        </div>
      )}
      
      <div className={cn(
        isMobile ? "w-full px-0" : "max-w-5xl mx-auto px-4",
        "pt-4 md:pt-8 insights-page-content",
        isMobile ? "mt-2" : "mt-4",
        isSticky && isMobile ? "pt-16" : ""
      )}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 px-2">
          <InsightsHeader />
          
          <div className={cn(
            "mt-4 md:mt-0",
            isSticky ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
          )} ref={timeToggleRef}>
            <InsightsTimeToggle
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
              refreshing={refreshing}
              onRefresh={refreshCache}
            />
          </div>
        </div>
        
        {loading ? (
          <InsightsLoadingState />
        ) : !hasAnyEntries ? (
          <InsightsEmptyState />
        ) : (
          <>
            <InsightsStatsGrid 
              timeRange={timeRange}
              insightsData={statsInsightsData}
            />
            
            <InsightsCharts
              timeRange={timeRange}
              chartInsightsData={chartInsightsData}
              emotionChartDate={emotionChartDate}
              moodCalendarDate={moodCalendarDate}
              onEmotionChartNavigate={handleEmotionChartNavigate}
              onMoodCalendarNavigate={handleMoodCalendarNavigate}
              onTimeRangeChange={(newTimeRange) => handleTimeRangeChange(newTimeRange)}
              userId={user?.id}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function Insights() {
  return (
    <PremiumFeatureGuard feature="insights">
      <ErrorBoundary>
        <InsightsTranslationProvider>
          <InsightsContent />
        </InsightsTranslationProvider>
      </ErrorBoundary>
    </PremiumFeatureGuard>
  );
}
