import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Calendar, TrendingUp, ArrowUp, ArrowDown, Activity, Award } from 'lucide-react';
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
import { StableTranslatableText } from '@/components/translation/StableTranslatableText';
import { InsightsTranslationProvider } from '@/components/insights/InsightsTranslationProvider';
import { TranslationProgressIndicator } from '@/components/insights/TranslationProgressIndicator';
import { useTranslation } from '@/contexts/TranslationContext';
import { PremiumFeatureGuard } from '@/components/subscription/PremiumFeatureGuard';
import { translationStabilityService } from '@/services/translationStabilityService';

function InsightsContent() {
  const { user } = useAuth();
  const { prefetchTranslationsForRoute, currentLanguage } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [isSticky, setIsSticky] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const timeToggleRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const isMobile = useIsMobile();
  const currentLanguageRef = useRef<string>(currentLanguage);
  
  const { insightsData, loading } = useInsightsData(user?.id, timeRange);
  
  const timeRanges = [
    { value: 'today', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
  ];

  useEffect(() => {
    console.log("Insights page mounted");
    
    // Check if language changed since last mount
    if (currentLanguageRef.current !== currentLanguage) {
      console.log(`[Insights] Language changed from ${currentLanguageRef.current} to ${currentLanguage}, clearing stability locks`);
      translationStabilityService.unlockAllTranslations();
      currentLanguageRef.current = currentLanguage;
    }
    
    // Prefetch translations for the insights route
    if (prefetchTranslationsForRoute) {
      prefetchTranslationsForRoute('/insights').catch(console.error);
    }
    
    return () => {
      console.log("Insights page unmounted");
    };
  }, [prefetchTranslationsForRoute, currentLanguage]);

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

  const handleEmotionClick = (emotion: string) => {
    setSelectedEmotion(emotion);
  };

  const handleTimeRangeChange = (value: string) => {
    if (value) {
      const currentScrollPosition = window.scrollY;
      scrollPositionRef.current = currentScrollPosition;
      
      console.log(`[Insights] Time range changing from ${timeRange} to ${value}, language: ${currentLanguage}`);
      setTimeRange(value as TimeRange);
      
      setTimeout(() => {
        window.scrollTo({ top: currentScrollPosition });
      }, 10);
    }
  };

  const renderTimeToggle = () => (
    <div className="insights-time-toggle flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        <StableTranslatableText 
          text="View:" 
          forceTranslate={true}
          timeRange={timeRange}
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
            <StableTranslatableText 
              text={range.label} 
              forceTranslate={true}
              timeRange={timeRange}
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
              <StableTranslatableText 
                text="Insights" 
                forceTranslate={true}
                timeRange={timeRange}
              />
            </h1>
            <p className="text-muted-foreground">
              <StableTranslatableText 
                text="Discover patterns in your emotional journey" 
                forceTranslate={true}
                timeRange={timeRange}
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
        ) : insightsData.entries.length === 0 ? (
          <div className="bg-background rounded-xl p-8 text-center border mx-2">
            <h2 className="text-xl font-semibold mb-4">
              <StableTranslatableText 
                text="No journal data available" 
                forceTranslate={true}
                timeRange={timeRange}
              />
            </h2>
            <p className="text-muted-foreground mb-6">
              <StableTranslatableText 
                text="Start recording journal entries to see your emotional insights." 
                forceTranslate={true}
                timeRange={timeRange}
              />
            </p>
            <Button onClick={() => window.location.href = '/journal'}>
              <StableTranslatableText 
                text="Go to Journal" 
                forceTranslate={true}
                timeRange={timeRange}
              />
            </Button>
          </div>
        ) : (
          <>
            <div className={cn(
              "grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 px-2 md:px-0"
            )}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-background p-6 rounded-xl shadow-sm border w-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-semibold text-lg">
                    <StableTranslatableText 
                      text="Dominant Mood" 
                      forceTranslate={true}
                      timeRange={timeRange}
                    />
                  </h2>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full text-xs font-medium">
                    <StableTranslatableText 
                      text={`This ${timeRange}`} 
                      forceTranslate={true}
                      timeRange={timeRange}
                    />
                  </span>
                </div>
                {insightsData.dominantMood ? (
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <span className="text-2xl">{insightsData.dominantMood.emoji}</span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold capitalize">
                        <StableTranslatableText 
                          text={insightsData.dominantMood.emotion} 
                          forceTranslate={true}
                          timeRange={timeRange}
                        />
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        <StableTranslatableText 
                          text="Appeared in most entries" 
                          forceTranslate={true}
                          timeRange={timeRange}
                        />
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🤔</span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">
                        <StableTranslatableText 
                          text="Not enough data" 
                          forceTranslate={true}
                          timeRange={timeRange}
                        />
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        <StableTranslatableText 
                          text="Add more journal entries" 
                          forceTranslate={true}
                          timeRange={timeRange}
                        />
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="bg-background p-6 rounded-xl shadow-sm border w-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-semibold text-lg">
                    <StableTranslatableText 
                      text="Biggest Change" 
                      forceTranslate={true}
                      timeRange={timeRange}
                    />
                  </h2>
                  {insightsData.biggestImprovement && (
                    <span 
                      className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        insightsData.biggestImprovement.percentage >= 0 
                          ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200" 
                          : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200"
                      )}
                    >
                      {insightsData.biggestImprovement.percentage >= 0 ? '+' : ''}
                      {insightsData.biggestImprovement.percentage}%
                    </span>
                  )}
                </div>
                {insightsData.biggestImprovement ? (
                  <div className="flex items-center gap-4">
                    <div 
                      className={cn(
                        "h-16 w-16 rounded-full flex items-center justify-center",
                        insightsData.biggestImprovement.percentage >= 0 
                          ? "bg-green-100 dark:bg-green-900" 
                          : "bg-blue-100 dark:bg-blue-900"
                      )}
                    >
                      {insightsData.biggestImprovement.percentage >= 0 ? (
                        <ArrowUp className={cn(
                          "h-8 w-8",
                          insightsData.biggestImprovement.percentage >= 0 
                            ? "text-green-600 dark:text-green-300" 
                            : "text-blue-600 dark:text-blue-300"
                        )} />
                      ) : (
                        <ArrowDown className="h-8 w-8 text-blue-600 dark:text-blue-300" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold capitalize">
                        <StableTranslatableText 
                          text={insightsData.biggestImprovement.emotion} 
                          forceTranslate={true}
                          timeRange={timeRange}
                        />
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        <StableTranslatableText 
                          text={insightsData.biggestImprovement.percentage >= 0 
                            ? "Increased significantly" 
                            : "Decreased significantly"
                          } 
                          forceTranslate={true}
                          timeRange={timeRange}
                        />
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">
                        <StableTranslatableText 
                          text="Not enough data" 
                          forceTranslate={true}
                          timeRange={timeRange}
                        />
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        <StableTranslatableText 
                          text="Need more entries to compare" 
                          forceTranslate={true}
                          timeRange={timeRange}
                        />
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="bg-background p-6 rounded-xl shadow-sm border w-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-semibold text-lg">
                    <StableTranslatableText 
                      text="Journal Activity" 
                      forceTranslate={true}
                      timeRange={timeRange}
                    />
                  </h2>
                  {insightsData.journalActivity.maxStreak > 0 && (
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 rounded-full text-xs font-medium">
                      <StableTranslatableText 
                        text={`Max streak: ${insightsData.journalActivity.maxStreak} ${timeRange === 'today' ? 'entries' : 'days'}`}
                        forceTranslate={true}
                        timeRange={timeRange}
                      />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                    {insightsData.journalActivity.streak > 0 ? (
                      <Award className="h-8 w-8 text-purple-600 dark:text-purple-300" />
                    ) : (
                      <Activity className="h-8 w-8 text-purple-600 dark:text-purple-300" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">
                      <StableTranslatableText 
                        text={`${insightsData.journalActivity.streak} ${timeRange === 'today' ? 'entries' : 'days'}`}
                        forceTranslate={true}
                        timeRange={timeRange}
                      />
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      <StableTranslatableText 
                        text={insightsData.journalActivity.streak > 0 ? "Current streak" : "Start your streak"} 
                        forceTranslate={true}
                        timeRange={timeRange}
                      />
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="mb-8 px-2 md:px-0"
            >
              <div className="bg-background rounded-xl shadow-sm border">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">
                      <StableTranslatableText 
                        text="Emotions & Life Areas" 
                        forceTranslate={true}
                        timeRange={timeRange}
                      />
                    </h2>
                  </div>
                  <EmotionChart 
                    timeframe={timeRange}
                    aggregatedData={insightsData.aggregatedEmotionData}
                  />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="mb-8 px-2 md:px-0"
            >
              <MoodCalendar 
                sentimentData={getSentimentData()} 
                timeRange={timeRange}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="mb-8 px-2 md:px-0"
            >
              <PremiumFeatureGuard 
                feature="insights"
                fallbackTitle="Soul-Net Visualization"
                fallbackDescription="Unlock the Soul-Net to see your emotional connections in a beautiful 3D visualization."
              >
                <div className="bg-background rounded-xl shadow-sm border overflow-hidden">
                  <div className="p-6 border-b">
                    <h2 className="text-xl font-semibold">
                      <StableTranslatableText 
                        text="Soul-Net Visualization" 
                        forceTranslate={true}
                        timeRange={timeRange}
                      />
                    </h2>
                    <p className="text-muted-foreground mt-2">
                      <StableTranslatableText 
                        text="Explore your emotional journey through interconnected experiences" 
                        forceTranslate={true}
                        timeRange={timeRange}
                      />
                    </p>
                  </div>
                  <div className="h-96">
                    <SoulNet 
                      userId={user?.id}
                      timeRange={timeRange}
                    />
                  </div>
                </div>
              </PremiumFeatureGuard>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

function Insights() {
  return (
    <ErrorBoundary>
      <InsightsTranslationProvider>
        <InsightsContent />
      </InsightsTranslationProvider>
    </ErrorBoundary>
  );
}

export default Insights;
