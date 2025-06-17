
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
import { useAuth } from '@/contexts/AuthContext';
import { InsightsTranslationProvider } from '@/components/insights/InsightsTranslationProvider';
import { addDays, addWeeks, addMonths, addYears, subDays, subWeeks, subMonths, subYears } from 'date-fns';
import InsightsDebugPanel from '@/components/insights/InsightsDebugPanel';

const Insights: React.FC = () => {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [globalDate, setGlobalDate] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(true); // Enable debug panel
  const userProfile = useUserProfile();
  const { user } = useAuth();
  
  const { insightsData, loading, error } = useInsightsData(
    user?.id,
    timeRange,
    globalDate
  );

  // Debug logging for auth and data state
  useEffect(() => {
    console.log('[Insights] Component state:', {
      userFromAuth: user?.id,
      userFromProfile: userProfile?.full_name,
      loading,
      error,
      hasInsightsData: !!insightsData,
      entriesCount: insightsData?.entries?.length || 0,
      allEntriesCount: insightsData?.allEntries?.length || 0
    });
  }, [user, userProfile, loading, error, insightsData]);

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

  // Handle time range change with proper typing
  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value as TimeRange);
  };

  // Transform insights data to match expected interface
  const transformedInsightsData = {
    moodFrequency: insightsData?.dominantMood || null,
    totalEntries: insightsData?.entries?.length || 0,
    avgSentiment: insightsData?.entries?.reduce((sum, entry) => {
      const sentiment = parseFloat(entry.sentiment || '0');
      return sum + sentiment;
    }, 0) / (insightsData?.entries?.length || 1) || 0,
    topEmotion: insightsData?.dominantMood?.emotion || '',
    emotionDistribution: insightsData?.aggregatedEmotionData || {}
  };

  if (loading) {
    return <InsightsLoadingState />;
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

          {/* Debug Panel - Remove this once issue is resolved */}
          {showDebugPanel && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
            >
              <InsightsDebugPanel />
              <button
                onClick={() => setShowDebugPanel(false)}
                className="mb-4 text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Hide Debug Panel
              </button>
            </motion.div>
          )}

          {/* Show error state if there's an error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
                  Data Access Error
                </h3>
                <p className="text-red-700 dark:text-red-400 mb-4">
                  {error}
                </p>
                <div className="text-sm text-red-600 dark:text-red-400 space-y-2">
                  <p><strong>Debug Info:</strong></p>
                  <p>• Authenticated User: {user?.id || 'None'}</p>
                  <p>• User Email: {user?.email || 'None'}</p>
                  <p>• Profile User: {userProfile?.full_name || 'None'}</p>
                  <p>• Time Range: {timeRange}</p>
                  <p>• Date: {globalDate.toISOString()}</p>
                </div>
                <button 
                  onClick={handleRefresh}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            </motion.div>
          )}

          {/* Show no data state */}
          {!error && (!insightsData || (!insightsData.entries?.length && !loading)) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                  No Data for Selected Period
                </h3>
                <p className="text-yellow-700 dark:text-yellow-400 mb-4">
                  No journal entries found for the selected time period.
                </p>
                <div className="text-sm text-yellow-600 dark:text-yellow-400 space-y-2">
                  <p><strong>Debug Info:</strong></p>
                  <p>• Total entries in database: {insightsData?.allEntries?.length || 0}</p>
                  <p>• Entries in selected period: {insightsData?.entries?.length || 0}</p>
                  <p>• Time Range: {timeRange}</p>
                  <p>• Date: {globalDate.toISOString()}</p>
                </div>
                <div className="mt-4 space-x-2">
                  <button 
                    onClick={() => setTimeRange('year')}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                  >
                    View Full Year
                  </button>
                  <button 
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Show normal content if we have data */}
          {!error && insightsData && insightsData.entries?.length > 0 && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="mb-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <InsightsTimeToggle 
                    timeRange={timeRange} 
                    onTimeRangeChange={handleTimeRangeChange}
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
                insightsData={transformedInsightsData}
                isLoading={loading}
                globalDate={globalDate}
              />

              <InsightsCharts
                timeRange={timeRange}
                insightsData={insightsData}
                globalDate={globalDate}
                userId={user?.id}
              />
            </>
          )}
        </div>
      </div>
    </InsightsTranslationProvider>
  );
};

export default Insights;
