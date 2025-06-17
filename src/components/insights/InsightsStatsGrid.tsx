
import React from 'react';
import { motion } from 'framer-motion';
import InsightCard from '@/components/insights/InsightCard';
import { TimeRange } from '@/hooks/use-insights-data';
import { useTranslation } from '@/contexts/TranslationContext';
import { getTimeRangeLabel } from '@/utils/dateRangeUtils';

interface InsightsStatsGridProps {
  timeRange: TimeRange;
  insightsData: {
    moodFrequency: any;
    totalEntries: number;
    avgSentiment: number;
    topEmotion: string;
    emotionDistribution: any;
  };
  isLoading: boolean;
  globalDate: Date;
}

const InsightsStatsGrid: React.FC<InsightsStatsGridProps> = ({
  timeRange,
  insightsData,
  isLoading,
  globalDate
}) => {
  const { currentLanguage } = useTranslation();

  // Calculate dynamic labels using the utility function
  const timeRangeLabel = getTimeRangeLabel(timeRange, globalDate, currentLanguage);

  const getMoodIcon = (emotion: string) => {
    const moodMap: { [key: string]: string } = {
      joy: '😊',
      happiness: '😊',
      sadness: '😢',
      anger: '😠',
      fear: '😨',
      surprise: '😲',
      disgust: '🤢',
      anticipation: '🤔',
      trust: '🤝',
      love: '❤️',
      calm: '😌',
      excited: '🤩',
      grateful: '🙏',
      confident: '💪',
      peaceful: '☮️',
      hopeful: '🌟',
    };
    return moodMap[emotion?.toLowerCase()] || '😊';
  };

  const formatSentiment = (sentiment: number) => {
    if (sentiment > 0.6) return 'Very Positive';
    if (sentiment > 0.2) return 'Positive';
    if (sentiment > -0.2) return 'Neutral';
    if (sentiment > -0.6) return 'Negative';
    return 'Very Negative';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <InsightCard
          title="Dominant Mood"
          value={isLoading ? '...' : (insightsData.topEmotion ? `${getMoodIcon(insightsData.topEmotion)} ${insightsData.topEmotion}` : 'No data')}
          description={`Most frequent emotion for ${timeRangeLabel}`}
          icon="😊"
          globalDate={globalDate}
          timeRange={timeRange}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <InsightCard
          title="Journal Activity"
          value={isLoading ? '...' : `${insightsData.totalEntries} entries`}
          description={`Total journal entries for ${timeRangeLabel}`}
          icon="📝"
          globalDate={globalDate}
          timeRange={timeRange}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <InsightCard
          title="Overall Sentiment"
          value={isLoading ? '...' : formatSentiment(insightsData.avgSentiment)}
          description={`Average emotional tone for ${timeRangeLabel}`}
          icon="💭"
          globalDate={globalDate}
          timeRange={timeRange}
        />
      </motion.div>
    </div>
  );
};

export default InsightsStatsGrid;
