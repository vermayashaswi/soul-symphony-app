
import React, { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion } from 'framer-motion';
import { useInsightsData, TimeRange } from '@/hooks/use-insights-data';
import InsightsHeader from '@/components/insights/InsightsHeader';
import InsightsTimeToggle from '@/components/insights/InsightsTimeToggle';
import InsightsStatsGrid from '@/components/insights/InsightsStatsGrid';
import { InsightsCharts } from '@/components/insights/InsightsCharts';
import InsightsLoadingState from '@/components/insights/InsightsLoadingState';
import InsightsEmptyState from '@/components/insights/InsightsEmptyState';
import { InsightsGlobalNavigation } from '@/components/insights/InsightsGlobalNavigation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { InsightsTranslationProvider } from '@/components/insights/InsightsTranslationProvider';

const Insights: React.FC = () => {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [globalDate, setGlobalDate] = useState<Date>(new Date());
  const { profile } = useUserProfile();
  
  const { data: insightsData, isLoading, error } = useInsightsData(
    timeRange,
    globalDate
  );

  // Debug logging for global date changes
  useEffect(() => {
    console.log('[Insights] Global date changed to:', globalDate);
  }, [globalDate]);

  if (isLoading) {
    return <InsightsLoadingState />;
  }

  if (error) {
    console.error('Insights error:', error);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error loading insights</h2>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!insightsData || (!insightsData.entries?.length && !isLoading)) {
    return <InsightsEmptyState />;
  }

  return (
    <InsightsTranslationProvider 
      timeRange={timeRange} 
      globalDate={globalDate}
      userId={profile?.id}
    >
      <div className={`min-h-screen ${isMobile ? 'pb-20' : ''}`}>
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <InsightsHeader />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <InsightsTimeToggle 
                timeRange={timeRange} 
                onTimeRangeChange={setTimeRange} 
              />
              <InsightsGlobalNavigation
                timeRange={timeRange}
                globalDate={globalDate}
                onDateChange={setGlobalDate}
              />
            </div>
          </motion.div>

          <InsightsStatsGrid
            timeRange={timeRange}
            insightsData={insightsData}
            isLoading={isLoading}
            globalDate={globalDate}
          />

          <InsightsCharts
            timeRange={timeRange}
            insightsData={insightsData}
            globalDate={globalDate}
            userId={profile?.id}
          />
        </div>
      </div>
    </InsightsTranslationProvider>
  );
};

export default Insights;
