import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Filter, TrendingUp, ArrowUp, ArrowDown, Activity, Award } from 'lucide-react';
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

function InsightsContent() {
  const { user } = useAuth();
  const { prefetchTranslationsForRoute, prefetchAllSoulNetTimeRanges, currentLanguage } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [isSticky, setIsSticky] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [soulNetPreloaded, setSoulNetPreloaded] = useState(false);
  const timeToggleRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const isMobile = useIsMobile();
  
  const { insightsData, loading } = useInsightsData(user?.id, timeRange);
  
  const timeRanges = [
    { value: 'today', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
  ];

  useEffect(() => {
    console.log("Insights page mounted");
    
    // Prefetch translations for the insights route
    if (prefetchTranslationsForRoute) {
      prefetchTranslationsForRoute('/insights').catch(console.error);
    }
    
    return () => {
      console.log("Insights page unmounted");
    };
  }, [prefetchTranslationsForRoute]);

  // ENHANCED: Preload all SoulNet time ranges when language changes or user loads
  useEffect(() => {
    if (user?.id && prefetchAllSoulNetTimeRanges && currentLanguage !== 'en' && !soulNetPreloaded) {
      console.log(`[Insights] ENHANCED: Preloading all SoulNet time ranges for language ${currentLanguage}`);
      
      prefetchAllSoulNetTimeRanges(user.id)
        .then(() => {
          console.log('[Insights] ENHANCED: SoulNet preloading completed');
          setSoulNetPreloaded(true);
        })
        .catch(error => {
          console.error('[Insights] ENHANCED: Error preloading SoulNet:', error);
          setSoulNetPreloaded(true); // Continue even if preload fails
        });
    } else if (currentLanguage === 'en') {
      setSoulNetPreloaded(true);
    }
  }, [user?.id, prefetchAllSoulNetTimeRanges, currentLanguage, soulNetPreloaded]);

  // Reset preload state when language changes
  useEffect(() => {
    setSoulNetPreloaded(false);
  }, [currentLanguage]);

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
      
      setTimeRange(value as TimeRange);
      
      setTimeout(() => {
        window.scrollTo({ top: currentScrollPosition });
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
        ) : insightsData.entries.length === 0 ? (
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
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-background p-6 rounded-xl shadow-sm border w-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-semibold text-lg">
                    <EnhancedTranslatableText 
                      text="Dominant Mood" 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="general"
                      usePageTranslation={true}
                    />
                  </h2>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded-full">
                    <EnhancedTranslatableText 
                      text={timeRange} 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="compact"
                      usePageTranslation={true}
                    />
                  </span>
                </div>
                <div className="text-center">
                  <div className="text-3xl mb-2">
                    {insightsData.dominantMood?.emoji || '😊'}
                  </div>
                  <div className="text-lg font-medium mb-1">
                    <EnhancedTranslatableText 
                      text={insightsData.dominantMood?.name || 'Peaceful'} 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="general"
                      usePageTranslation={true}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {insightsData.dominantMood?.percentage || 0}% <EnhancedTranslatableText 
                      text="of entries" 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="compact"
                      usePageTranslation={true}
                    />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="bg-background p-6 rounded-xl shadow-sm border w-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-semibold text-lg">
                    <EnhancedTranslatableText 
                      text="Average Sentiment" 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="general"
                      usePageTranslation={true}
                    />
                  </h2>
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium rounded-full flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <EnhancedTranslatableText 
                      text="Positive" 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="compact"
                      usePageTranslation={true}
                    />
                  </span>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2 text-green-600">
                    {((insightsData.avgSentiment || 0) * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <EnhancedTranslatableText 
                      text="Overall positivity score" 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="compact"
                      usePageTranslation={true}
                    />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="bg-background p-6 rounded-xl shadow-sm border w-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-semibold text-lg">
                    <EnhancedTranslatableText 
                      text="Journal Entries" 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="general"
                      usePageTranslation={true}
                    />
                  </h2>
                  <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs font-medium rounded-full flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <EnhancedTranslatableText 
                      text="Active" 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="compact"
                      usePageTranslation={true}
                    />
                  </span>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2 text-purple-600">
                    {insightsData.entries.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <EnhancedTranslatableText 
                      text="Total entries recorded" 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="compact"
                      usePageTranslation={true}
                    />
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 px-2 md:px-0">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <ErrorBoundary>
                  <EmotionChart 
                    data={insightsData.emotions} 
                    onEmotionClick={handleEmotionClick}
                    selectedEmotion={selectedEmotion}
                  />
                </ErrorBoundary>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                <ErrorBoundary>
                  <MoodCalendar 
                    data={getSentimentData()}
                    timeRange={timeRange}
                  />
                </ErrorBoundary>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className={cn(
                "px-2 md:px-0"
              )}
            >
              <ErrorBoundary>
                <PremiumFeatureGuard 
                  feature="soulnet"
                  fallback={
                    <div className="bg-background rounded-xl p-8 text-center border">
                      <h2 className="text-xl font-semibold mb-4">
                        <EnhancedTranslatableText 
                          text="Soul-Net Visualization" 
                          forceTranslate={true}
                          enableFontScaling={true}
                          scalingContext="general"
                          usePageTranslation={true}
                        />
                      </h2>
                      <p className="text-muted-foreground mb-6">
                        <EnhancedTranslatableText 
                          text="Upgrade to Premium to see the 3D Soul-Net visualization of your emotional patterns." 
                          forceTranslate={true}
                          enableFontScaling={true}
                          scalingContext="general"
                          usePageTranslation={true}
                        />
                      </p>
                      <Button onClick={() => window.location.href = '/app/subscription'}>
                        <Award className="w-4 h-4 mr-2" />
                        <EnhancedTranslatableText 
                          text="Upgrade to Premium" 
                          forceTranslate={true}
                          enableFontScaling={true}
                          scalingContext="compact"
                          usePageTranslation={true}
                        />
                      </Button>
                    </div>
                  }
                >
                  <SoulNet 
                    userId={user?.id} 
                    timeRange={timeRange}
                  />
                </PremiumFeatureGuard>
              </ErrorBoundary>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Insights() {
  return (
    <InsightsTranslationProvider>
      <InsightsContent />
    </InsightsTranslationProvider>
  );
}
