
import { useState } from 'react';
import { motion } from 'framer-motion';
import { format, subDays } from 'date-fns';
import { Calendar, ArrowRight, Filter, TrendingUp, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import Navbar from '@/components/Navbar';
import EmotionChart from '@/components/EmotionChart';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TimeRange = 'week' | 'month' | 'year';

// Sample insights data
const insights = [
  {
    id: 1,
    title: "You've been feeling more energetic",
    description: "Your energy levels have increased by 20% compared to last week.",
    date: subDays(new Date(), 2),
    trend: "up",
    category: "energy",
  },
  {
    id: 2,
    title: "Anxiety levels are decreasing",
    description: "Your anxiety has decreased by 15% over the past month.",
    date: subDays(new Date(), 4),
    trend: "down",
    category: "anxiety",
  },
  {
    id: 3,
    title: "Social connection pattern detected",
    description: "You tend to feel happier on days when you socialize.",
    date: subDays(new Date(), 7),
    trend: "up",
    category: "social",
  },
  {
    id: 4,
    title: "Sleep quality affecting mood",
    description: "Days with better sleep show improved mood in your entries.",
    date: subDays(new Date(), 12),
    trend: "neutral",
    category: "sleep",
  },
];

// Mood summary data
const moodSummary = {
  dominant: "Joy",
  improvement: "Anxiety",
  entries: 12,
  streak: 8,
};

export default function Insights() {
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  
  const timeRanges = [
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
            <div className="flex p-1 bg-secondary rounded-full">
              {timeRanges.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setTimeRange(range.value as TimeRange)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                    timeRange === range.value
                      ? "bg-white text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        
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
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">😊</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold">{moodSummary.dominant}</h3>
                <p className="text-muted-foreground text-sm">Appeared in most entries</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-white p-6 rounded-xl shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="font-semibold text-lg">Biggest Improvement</h2>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                -15%
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                <ArrowDownRight className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">{moodSummary.improvement}</h3>
                <p className="text-muted-foreground text-sm">Decreased significantly</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-white p-6 rounded-xl shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="font-semibold text-lg">Journal Activity</h2>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                {moodSummary.streak} day streak
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-purple-100 rounded-full flex items-center justify-center">
                <Activity className="h-8 w-8 text-purple-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">{moodSummary.entries} entries</h3>
                <p className="text-muted-foreground text-sm">This {timeRange}</p>
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
          
          <EmotionChart timeframe={timeRange} />
        </motion.div>
        
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">AI-Generated Insights</h2>
            <Button variant="outline" size="sm" className="text-xs flex items-center gap-1.5 rounded-full">
              <Calendar className="h-3 w-3" />
              <span>Date Range</span>
            </Button>
          </div>
          
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * index }}
                className="bg-white p-6 rounded-xl shadow-sm flex items-start gap-4"
              >
                <div 
                  className={cn(
                    "h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0",
                    insight.trend === "up" 
                      ? "bg-green-100" 
                      : insight.trend === "down" 
                        ? "bg-blue-100" 
                        : "bg-amber-100"
                  )}
                >
                  {insight.trend === "up" ? (
                    <ArrowUpRight className="h-6 w-6 text-green-600" />
                  ) : insight.trend === "down" ? (
                    <ArrowDownRight className="h-6 w-6 text-blue-600" />
                  ) : (
                    <TrendingUp className="h-6 w-6 text-amber-600" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <h3 className="font-semibold">{insight.title}</h3>
                    <span className="text-xs text-muted-foreground">
                      {format(insight.date, 'MMM d')}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm mt-1">{insight.description}</p>
                  <div className="mt-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-7 px-2 text-primary flex items-center gap-1"
                    >
                      View details
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
