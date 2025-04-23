
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

export default function Insights() {
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
    const handleScroll = () => {
      scrollPositionRef.current = window.scrollY;
      
      const scrollThreshold = 90;
      setIsSticky(window.scrollY > scrollThreshold);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">View:</span>
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
            {range.label}
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
    <div className="min-h-screen pb-20">
      {/* Navbar removed from here */}
      
      {isSticky && (
        <div className="fixed top-0 left-0 right-0 z-40 py-3 px-4 bg-background border-b shadow-sm flex justify-center">
          <div className="max-w-5xl w-full flex justify-end">
            {renderTimeToggle()}
          </div>
        </div>
      )}
      
      <div className={cn(
        "max-w-5xl mx-auto px-4 pt-4 md:pt-8",
        isMobile ? "mt-2" : "mt-4"
      )}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Insights</h1>
            <p className="text-muted-foreground">Discover patterns in your emotional journey</p>
          </div>
          
          <div className="mt-4 md:mt-0" ref={timeToggleRef}>
            {renderTimeToggle()}
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : insightsData.entries.length === 0 ? (
          <div className="bg-background rounded-xl p-8 text-center border">
            <h2 className="text-xl font-semibold mb-4">No journal data available</h2>
            <p className="text-muted-foreground mb-6">
              Start recording journal entries to see your emotional insights.
            </p>
            <Button onClick={() => window.location.href = '/journal'}>
              Go to Journal
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-background p-6 rounded-xl shadow-sm border"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-semibold text-lg">Dominant Mood</h2>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full text-xs font-medium">
                    This {timeRange}
                  </span>
                </div>
                {insightsData.dominantMood ? (
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <span className="text-2xl">{insightsData.dominantMood.emoji}</span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold capitalize">{insightsData.dominantMood.emotion}</h3>
                      <p className="text-muted-foreground text-sm">Appeared in most entries</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🤔</span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">Not enough data</h3>
                      <p className="text-muted-foreground text-sm">Add more journal entries</p>
                    </div>
                  </div>
                )}
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="bg-background p-6 rounded-xl shadow-sm border"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-semibold text-lg">Biggest Change</h2>
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
                      <h3 className="text-2xl font-bold capitalize">{insightsData.biggestImprovement.emotion}</h3>
                      <p className="text-muted-foreground text-sm">
                        {insightsData.biggestImprovement.percentage >= 0 
                          ? "Increased significantly" 
                          : "Decreased significantly"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">Not enough data</h3>
                      <p className="text-muted-foreground text-sm">Need more entries to compare</p>
                    </div>
                  </div>
                )}
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="bg-background p-6 rounded-xl shadow-sm border"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-semibold text-lg">Journal Activity</h2>
                  {insightsData.journalActivity.maxStreak > 0 && (
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 rounded-full text-xs font-medium">
                      Max streak: {insightsData.journalActivity.maxStreak} {timeRange === 'today' ? 'entries' : 'days'}
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
                    <h3 className="text-2xl font-bold">{insightsData.journalActivity.entryCount} entries</h3>
                    <p className="text-muted-foreground text-sm capitalize">This {timeRange}</p>
                  </div>
                </div>
              </motion.div>
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-background p-6 md:p-8 rounded-xl shadow-sm mb-8 border"
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
              className="mb-8"
            >
              <MoodCalendar 
                sentimentData={getSentimentData()}
                timeRange={timeRange}
              />
            </motion.div>
            
            {/* Soul-Net visualization - renamed from SoulMesh */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="mb-8"
            >
              <div className="bg-background p-6 md:p-8 rounded-xl shadow-sm border">
                <h2 className="text-xl font-semibold mb-4">Soul-Net</h2>
                <p className="text-muted-foreground mb-4">
                  Explore connections between life aspects and emotions in your journal.
                </p>
                <SoulNet userId={user?.id} timeRange={timeRange} />
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
