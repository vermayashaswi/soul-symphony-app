
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { InsightCard } from '@/components/insights/InsightCard';
import { TimeRange } from '@/hooks/use-insights-data';
import { useIsMobile } from '@/hooks/use-mobile';

interface InsightsStatsGridProps {
  timeRange: TimeRange;
  insightsData: {
    dominantMood: any;
    biggestImprovement: any;
    journalActivity: any;
  };
}

export function InsightsStatsGrid({ timeRange, insightsData }: InsightsStatsGridProps) {
  const isMobile = useIsMobile();

  return (
    <div className={cn(
      "grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 px-2 md:px-0"
    )}>
      <InsightCard
        type="mood"
        title="Dominant Mood"
        delay={0}
        badge={`This ${timeRange}`}
        badgeColor="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200"
        data={insightsData.dominantMood}
        timeRange={timeRange}
      />
      
      <InsightCard
        type="change"
        title="Biggest Change"
        delay={0.1}
        badge={insightsData.biggestImprovement ? 
          `${insightsData.biggestImprovement.percentage >= 0 ? '+' : ''}${insightsData.biggestImprovement.percentage}%` : 
          undefined
        }
        badgeColor={insightsData.biggestImprovement ? 
          cn(
            "px-2 py-1 rounded-full text-xs font-medium",
            insightsData.biggestImprovement.percentage >= 0 
              ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200" 
              : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200"
          ) : undefined
        }
        data={insightsData.biggestImprovement}
        timeRange={timeRange}
      />
      
      <InsightCard
        type="activity"
        title="Journal Activity"
        delay={0.2}
        badge={insightsData.journalActivity.maxStreak > 0 ? 
          `Max streak: ${insightsData.journalActivity.maxStreak} ${timeRange === 'today' ? 'entries' : 'days'}` : 
          undefined
        }
        badgeColor="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200"
        data={insightsData.journalActivity}
        timeRange={timeRange}
      />
    </div>
  );
}
