
import React, { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion } from 'framer-motion';
import { useInsightsData, TimeRange } from '@/hooks/use-insights-data';
import { InsightsHeader } from '@/components/insights/InsightsHeader';
import { InsightsTimeToggle } from '@/components/insights/InsightsTimeToggle';
import InsightsStatsGrid from '@/components/insights/InsightsStatsGrid';
import { InsightsCharts } from '@/components/insights/InsightsCharts';
import { InsightsLoadingState } from '@/components/insights/InsightsLoadingState';
import { InsightsEmptyState } from '@/components/insights/InsightsEmptyState';
import { InsightsGlobalNavigation } from '@/components/insights/InsightsGlobalNavigation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { InsightsTranslationProvider } from '@/components/insights/InsightsTranslationProvider';
import { addDays, addWeeks, addMonths, addYears, subDays, subWeeks, subMonths, subYears } from 'date-fns';

const Insights: React.FC = () => {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [globalDate, setGlobalDate] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const userProfile = useUserProfile();
  
  const { insightsData, loading } = useInsightsData(
    timeRange,
    globalDate
  );

  // Debug logging for global date changes
  useEffect(() => {
    console.log('[Insights] Global date changed to:', globalDate);
  }, [globalDate]);

  // Handle navigation between time periods
  const handleNavigation = (direction: 'previous' | 'next') => {
    setGlobalDate(currentDate => {
      switch (timeRange) {
        case 'today':
          return direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1);
        case 'week':
          return direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1);
        case 'month':
          return direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
        case 'year':
          return direction === 'next' ? addYears(currentDate, 1) : subYears(currentDate, 1);
        default:
          return currentDate;
      }
    });
  };

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    // Reset global date to current date
    setGlobalDate(new Date());
    // Add a small delay to show the refresh animation
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  };

  if (loading) {
    return <InsightsLoadingState />;
  }

  if (!insightsData || (!insightsData.entries?.length && !loading)) {
    return <InsightsEmptyState />;
  }

  return (
    <InsightsTranslationProvider>
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
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
              <InsightsGlobalNavigation
                timeRange={timeRange}
                currentDate={globalDate}
                onNavigate={handleNavigation}
                isNavigating={refreshing}
              />
            </div>
          </motion.div>

          <InsightsStatsGrid
            timeRange={timeRange}
            insightsData={insightsData}
            isLoading={loading}
            globalDate={globalDate}
          />

          <InsightsCharts
            timeRange={timeRange}
            insightsData={insightsData}
            globalDate={globalDate}
            userId={userProfile?.id}
          />
        </div>
      </div>
    </InsightsTranslationProvider>
  );
};

export default Insights;
