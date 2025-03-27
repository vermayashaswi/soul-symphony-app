
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Filter, TrendingUp, ArrowUp, ArrowDown, Activity } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import Navbar from '@/components/Navbar';
import EmotionChart from '@/components/EmotionChart';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useInsightsData, TimeRange } from '@/hooks/use-insights-data';
import { useAuth } from '@/contexts/AuthContext';

export default function Insights() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  
  const { insightsData, loading } = useInsightsData(user?.id, timeRange);
  
  const timeRanges = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
  ];

  return (
    <div className="min-h-screen pb-20">
      <Navbar />
      
      <div className="max-w-5xl mx-auto px-4 pt-28">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Insights</h1>
            <p className="text-muted-foreground">Discover patterns in your emotional journey</p>
          </div>
          
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <span className="text-sm text-muted-foreground">View:</span>
            <ToggleGroup 
              type="single" 
              value={timeRange}
              onValueChange={(value) => value && setTimeRange(value as TimeRange)}
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
                      ? "bg-white text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground bg-transparent"
                  )}
                >
                  {range.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : insightsData.entries.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
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
                className="bg-white p-6 rounded-xl shadow-sm"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-semibold text-lg">Dominant Mood</h2>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    This {timeRange}
                  </span>
                </div>
                {insightsData.dominantMood ? (
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">{insightsData.dominantMood.emoji}</span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold capitalize">{insightsData.dominantMood.emotion}</h3>
                      <p className="text-muted-foreground text-sm">Appeared in most entries</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
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
                className="bg-white p-6 rounded-xl shadow-sm"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-semibold text-lg">Biggest Improvement</h2>
                  {insightsData.biggestImprovement && (
                    <span 
                      className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        insightsData.biggestImprovement.percentage >= 0 
                          ? "bg-green-100 text-green-700" 
                          : "bg-red-100 text-red-700"
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
                          ? "bg-green-100" 
                          : "bg-blue-100"
                      )}
                    >
                      {insightsData.biggestImprovement.percentage >= 0 ? (
                        <ArrowUp className="h-8 w-8 text-green-600" />
                      ) : (
                        <ArrowDown className="h-8 w-8 text-blue-600" />
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
                    <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-8 w-8 text-gray-500" />
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
                className="bg-white p-6 rounded-xl shadow-sm"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-semibold text-lg">Journal Activity</h2>
                  {insightsData.journalActivity.streak > 0 && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                      {insightsData.journalActivity.streak} day streak
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 bg-purple-100 rounded-full flex items-center justify-center">
                    <Activity className="h-8 w-8 text-purple-600" />
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
              className="bg-white p-6 md:p-8 rounded-xl shadow-sm mb-8"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <h2 className="text-xl font-semibold">Emotional Trends</h2>
                <div className="flex items-center mt-2 sm:mt-0">
                  <Button variant="outline" size="sm" className="text-xs flex items-center gap-1.5 rounded-full">
                    <Filter className="h-3 w-3" />
                    <span>Customize</span>
                  </Button>
                </div>
              </div>
              
              <EmotionChart 
                timeframe={timeRange}
                aggregatedData={insightsData.aggregatedEmotionData}
              />
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
