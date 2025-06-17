
import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import EmotionChart from '@/components/EmotionChart';
import MoodCalendar from '@/components/insights/MoodCalendar';
import SoulNet from '@/components/insights/SoulNet';
import { TimeRange } from '@/hooks/use-insights-data';
import { useIsMobile } from '@/hooks/use-mobile';

interface InsightsChartsProps {
  timeRange: TimeRange;
  insightsData: {
    entries: any[];
    allEntries: any[];
    aggregatedEmotionData: any;
  };
  globalDate: Date;
  userId?: string;
}

export function InsightsCharts({
  timeRange,
  insightsData,
  globalDate,
  userId
}: InsightsChartsProps) {
  const isMobile = useIsMobile();

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

  return (
    <>
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
          currentDate={globalDate}
          hideNavigation={true}
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
          currentDate={globalDate}
          hideNavigation={true}
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
          userId={userId}
          timeRange={timeRange}
          globalDate={globalDate}
        />
      </motion.div>
    </>
  );
}
