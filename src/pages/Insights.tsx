
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
import { TranslatableText } from '@/components/translation/TranslatableText';

export default function Insights() {
  console.log("Rendering Insights page");
  
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [isSticky, setIsSticky] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
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
    return () => {
      console.log("Insights page unmounted");
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      scrollPositionRef.current = window.scrollY;
      
      const scrollThreshold = isMobile ? 40 : 90; // Lower threshold for mobile
      const nextIsSticky = window.scrollY > scrollThreshold;
      
      if (isSticky !== nextIsSticky) {
        setIsSticky(nextIsSticky);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initialize state based on current scroll position
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile, isSticky]); 

  const handleEmotionClick = (emotion: string) => {
    setSelectedEmotion(emotion);
    // Additional handling can be added here
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
        <TranslatableText text="View:" />
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
            <TranslatableText text={range.label} />
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
    
    return entries.map(entry => ({
      date: new Date(entry.created_at),
      sentiment: parseFloat(entry.sentiment || 0)
    }));
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen pb-20 insights-container">
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
                <TranslatableText text="Insights" />
              </h1>
              <p className="text-muted-foreground">
                <TranslatableText text="Discover patterns in your emotional journey" />
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
                <TranslatableText text="No journal data available" />
              </h2>
              <p className="text-muted-foreground mb-6">
                <TranslatableText text="Start recording journal entries to see your emotional insights." />
              </p>
              <Button onClick={() => window.location.href = '/journal'}>
                <TranslatableText text="Go to Journal" />
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
                      <TranslatableText text="Dominant Mood" />
                    </h2>
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full text-xs font-medium">
                      <TranslatableText text={`This ${timeRange}`} />
                    </span>
                  </div>
                  {insightsData.dominantMood ? (
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <span className="text-2xl">{insightsData.dominantMood.emoji}</span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold capitalize">
                          <TranslatableText text={insightsData.dominantMood.emotion} />
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          <TranslatableText text="Appeared in most entries" />
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
                          <TranslatableText text="Not enough data" />
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          <TranslatableText text="Add more journal entries" />
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
                      <TranslatableText text="Biggest Change" />
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
                          <TranslatableText text={insightsData.biggestImprovement.emotion} />
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          <TranslatableText 
                            text={insightsData.biggestImprovement.percentage >= 0 
                              ? "Increased significantly" 
                              : "Decreased significantly"
                            } 
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
                          <TranslatableText text="Not enough data" />
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          <TranslatableText text="Need more entries to compare" />
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
                      <TranslatableText text="Journal Activity" />
                    </h2>
                    {insightsData.journalActivity.maxStreak > 0 && (
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 rounded-full text-xs font-medium">
                        <TranslatableText 
                          text={`Max streak: ${insightsData.journalActivity.maxStreak} ${timeRange === 'today' ? 'entries' : 'days'}`} 
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
                        <TranslatableText text={`${insightsData.journalActivity.entryCount} entries`} />
                      </h3>
                      <p className="text-muted-foreground text-sm capitalize">
                        <TranslatableText text={`This ${timeRange}`} />
                      </p>
                    </div>
                  </div>
                </motion.div>
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
                />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="mb-8 w-full px-2 md:px-0"
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
                className="mb-8 w-full px-0 md:px-2"
              >
                <ErrorBoundary>
                  <SoulNet userId={user?.id} timeRange={timeRange} />
                </ErrorBoundary>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
