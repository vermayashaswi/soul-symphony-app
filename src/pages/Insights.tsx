import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import EmotionChart from '@/components/EmotionChart';
import MoodCalendar from '@/components/insights/MoodCalendar';
import SoulNet from '@/components/insights/SoulNet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useInsightsData, TimeRange } from '@/hooks/use-insights-data';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import ErrorBoundary from '@/components/insights/ErrorBoundary';
import { EnhancedTranslatableText } from '@/components/translation/EnhancedTranslatableText';
import { InsightsTranslationProvider } from '@/components/insights/InsightsTranslationProvider';
import { TranslationProgressIndicator } from '@/components/insights/TranslationProgressIndicator';
import { useTranslation } from '@/contexts/TranslationContext';
import { PremiumFeatureGuard } from '@/components/subscription/PremiumFeatureGuard';
import { InsightCard } from '@/components/insights/InsightCard';

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

  // FETCH INSIGHTS DATA: Now includes emotionChartDate for emotion chart data
  const { insightsData, loading } = useInsightsData(user?.id, timeRange, emotionChartDate);
  
  const timeRanges = [
    { value: 'today', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
  ];

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

  const renderTimeToggle = () => (
    <div className="insights-time-toggle flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        <EnhancedTranslatableText 
          text="View:" 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="compact"
          usePageTranslation={true}
        />
      </span>
      <ToggleGroup 
        type="single" 
        value={timeRange}
        onValueChange={handleTimeRangeChange}
        variant="outline"
        className="bg-secondary rounded-full p-1"
      >
        {timeRanges.map((range) => (
          <ToggleGroupItem
            key={range.value}
            value={range.value}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              timeRange === range.value
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground bg-transparent"
            )}
          >
            <EnhancedTranslatableText 
              text={range.label} 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="compact"
              usePageTranslation={true}
            />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );

  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        window.scrollTo({ top: scrollPositionRef.current });
      }, 100);
    }
  }, [loading, insightsData]);

  // Filter sentimentData for MoodCalendar
  const getSentimentData = () => {
    const entries = insightsData.allEntries || [];
    if (entries.length === 0) return [];
    
    return entries
      .filter(entry => entry.created_at && entry.sentiment !== undefined && entry.sentiment !== null)
      .map(entry => ({
        date: new Date(entry.created_at),
        sentiment: parseFloat(entry.sentiment || 0) || 0
      }))
      .filter(item => !isNaN(item.sentiment) && !isNaN(item.date.getTime()));
  };

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
            {renderTimeToggle()}
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
          <div>
            <h1 className="text-3xl font-bold mb-2">
              <EnhancedTranslatableText 
                text="Insights" 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
                usePageTranslation={true}
              />
            </h1>
            <p className="text-muted-foreground">
              <EnhancedTranslatableText 
                text="Discover patterns in your emotional journey" 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
                usePageTranslation={true}
              />
            </p>
          </div>
          
          <div className={cn(
            "mt-4 md:mt-0",
            isSticky ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
          )} ref={timeToggleRef}>
            {renderTimeToggle()}
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : !hasAnyEntries ? (
          <div className="bg-background rounded-xl p-8 text-center border mx-2">
            <h2 className="text-xl font-semibold mb-4">
              <EnhancedTranslatableText 
                text="No journal data available" 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
                usePageTranslation={true}
              />
            </h2>
            <p className="text-muted-foreground mb-6">
              <EnhancedTranslatableText 
                text="Start recording journal entries to see your emotional insights." 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
                usePageTranslation={true}
              />
            </p>
            <Button onClick={() => window.location.href = '/journal'}>
              <EnhancedTranslatableText 
                text="Go to Journal" 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="compact"
                usePageTranslation={true}
              />
            </Button>
          </div>
        ) : (
          <>
            <div className={cn(
              "grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 px-2 md:px-0"
            )}>
              <InsightCard
                type="mood"
                title="Dominant Mood"
                delay={0}
                badge={`This ${timeRange}`}
                badgeColor="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200"
                data={insightsData.dominantMood}
                timeRange={timeRange}
              />
              
              <InsightCard
                type="change"
                title="Biggest Change"
                delay={0.1}
                badge={insightsData.biggestImprovement ? 
                  `${insightsData.biggestImprovement.percentage >= 0 ? '+' : ''}${insightsData.biggestImprovement.percentage}%` : 
                  undefined
                }
                badgeColor={insightsData.biggestImprovement ? 
                  cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    insightsData.biggestImprovement.percentage >= 0 
                      ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200" 
                      : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200"
                  ) : undefined
                }
                data={insightsData.biggestImprovement}
                timeRange={timeRange}
              />
              
              <InsightCard
                type="activity"
                title="Journal Activity"
                delay={0.2}
                badge={insightsData.journalActivity.maxStreak > 0 ? 
                  `Max streak: ${insightsData.journalActivity.maxStreak} ${timeRange === 'today' ? 'entries' : 'days'}` : 
                  undefined
                }
                badgeColor="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200"
                data={insightsData.journalActivity}
                timeRange={timeRange}
              />
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className={cn(
                "bg-background rounded-xl shadow-sm mb-8 border w-full mx-auto",
                isMobile ? "p-4 md:p-8" : "p-6 md:p-8"
              )}
              whileHover={{ boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
            >
              <EmotionChart 
                timeframe={timeRange}
                aggregatedData={insightsData.aggregatedEmotionData}
                currentDate={emotionChartDate}
                onTimeRangeNavigate={handleEmotionChartNavigate}
              />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className={cn(
                "mb-8",
                isMobile ? "px-2" : "px-0"
              )}
            >
              <MoodCalendar 
                sentimentData={getSentimentData()}
                timeRange={timeRange}
                currentDate={moodCalendarDate}
                onTimeRangeNavigate={handleMoodCalendarNavigate}
              />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className={cn(
                "mb-8",
                isMobile ? "px-2" : "px-0"
              )}
            >
              <SoulNet
                userId={user?.id}
                timeRange={timeRange}
              />
            </motion.div>
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
