
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
import { InsightsGlobalNavigation } from '@/components/insights/InsightsGlobalNavigation';
import { getNextDate, getPreviousDate } from '@/components/insights/emotion-chart/utils/dateNavigation';

function InsightsContent() {
  const { user } = useAuth();
  const { prefetchTranslationsForRoute } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [globalDate, setGlobalDate] = useState<Date>(new Date());
  const [isSticky, setIsSticky] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const timeToggleRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const isMobile = useIsMobile();

  // FETCH INSIGHTS DATA: Now uses cached data for instant navigation
  const { 
    insightsData, 
    loading, 
    refreshing, 
    refreshCache, 
    isCacheHit 
  } = useInsightsCacheData(user?.id, timeRange, globalDate);

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

  // When timeRange changes, reset global date to today
  useEffect(() => {
    setGlobalDate(new Date());
  }, [timeRange]);

  // Global navigation handler
  const handleGlobalNavigate = (direction: 'previous' | 'next') => {
    setIsNavigating(true);
    const nextDate = direction === 'previous' 
      ? getPreviousDate(timeRange, globalDate)
      : getNextDate(timeRange, globalDate);
    
    scrollPositionRef.current = window.scrollY;
    setGlobalDate(nextDate);
    
    // Shorter timeout since navigation should be instant with cached data
    setTimeout(() => {
      setIsNavigating(false);
      window.scrollTo({ top: scrollPositionRef.current });
    }, 100);
  };

  const handleTimeRangeChange = (value: string) => {
    if (value) {
      scrollPositionRef.current = window.scrollY;
      setTimeRange(value as TimeRange);
      setGlobalDate(new Date());
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
  }, [loading, insightsData]);

  const hasAnyEntries = insightsData.entries.length > 0 || insightsData.allEntries.length > 0;

  return (
    <div className="min-h-screen pb-20 insights-container">
      <TranslationProgressIndicator />
      
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
            {/* Global Navigation Component */}
            <InsightsGlobalNavigation
              timeRange={timeRange}
              currentDate={globalDate}
              onNavigate={handleGlobalNavigate}
              isNavigating={isNavigating}
            />

            <InsightsStatsGrid 
              timeRange={timeRange}
              insightsData={insightsData}
            />
            
            <InsightsCharts
              timeRange={timeRange}
              insightsData={insightsData}
              globalDate={globalDate}
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
