import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, TrendingUp, Activity, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EnhancedTranslatableText } from '@/components/translation/EnhancedTranslatableText';

interface BaseInsightCardProps {
  title: string;
  delay: number;
  badge?: string;
  badgeColor?: string;
}

interface DominantMoodCardProps extends BaseInsightCardProps {
  type: 'mood';
  data: {
    emotion: string;
    emoji: string;
  } | null;
  timeRange: string;
}

interface BiggestChangeCardProps extends BaseInsightCardProps {
  type: 'change';
  data: {
    emotion: string;
    percentage: number;
  } | null;
  timeRange: string;
}

interface JournalActivityCardProps extends BaseInsightCardProps {
  type: 'activity';
  data: {
    entryCount: number;
    streak: number;
    maxStreak: number;
  };
  timeRange: string;
}

type InsightCardProps = DominantMoodCardProps | BiggestChangeCardProps | JournalActivityCardProps;

export const InsightCard = ({ title, delay, badge, badgeColor, ...props }: InsightCardProps) => {
  const renderContent = () => {
    switch (props.type) {
      case 'mood':
        return props.data ? (
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <span className="text-2xl">{props.data.emoji}</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold capitalize">
                <EnhancedTranslatableText 
                  text={props.data.emotion} 
                  forceTranslate={true}
                  enableFontScaling={true}
                  scalingContext="general"
                  usePageTranslation={true}
                />
              </h3>
              <p className="text-muted-foreground text-sm">
                <EnhancedTranslatableText 
                  text="Appeared in most entries" 
                  forceTranslate={true}
                  enableFontScaling={true}
                  scalingContext="compact"
                  usePageTranslation={true}
                />
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
                <EnhancedTranslatableText 
                  text="Not enough data" 
                  forceTranslate={true}
                  enableFontScaling={true}
                  scalingContext="general"
                  usePageTranslation={true}
                />
              </h3>
              <p className="text-muted-foreground text-sm">
                <EnhancedTranslatableText 
                  text="Add more journal entries" 
                  forceTranslate={true}
                  enableFontScaling={true}
                  scalingContext="compact"
                  usePageTranslation={true}
                />
              </p>
            </div>
          </div>
        );

      case 'change':
        return props.data ? (
          <div className="flex items-center gap-4">
            <div 
              className={cn(
                "h-16 w-16 rounded-full flex items-center justify-center",
                props.data.percentage >= 0 
                  ? "bg-green-100 dark:bg-green-900" 
                  : "bg-blue-100 dark:bg-blue-900"
              )}
            >
              {props.data.percentage >= 0 ? (
                <ArrowUp className="h-8 w-8 text-green-600 dark:text-green-300" />
              ) : (
                <ArrowDown className="h-8 w-8 text-blue-600 dark:text-blue-300" />
              )}
            </div>
            <div>
              <h3 className="text-2xl font-bold capitalize">
                <EnhancedTranslatableText 
                  text={props.data.emotion} 
                  forceTranslate={true}
                  enableFontScaling={true}
                  scalingContext="general"
                  usePageTranslation={true}
                />
              </h3>
              <p className="text-muted-foreground text-sm">
                <EnhancedTranslatableText 
                  text={props.data.percentage >= 0 
                    ? "Increased significantly" 
                    : "Decreased significantly"
                  } 
                  forceTranslate={true}
                  enableFontScaling={true}
                  scalingContext="compact"
                  usePageTranslation={true}
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
                <EnhancedTranslatableText 
                  text="Not enough data" 
                  forceTranslate={true}
                  enableFontScaling={true}
                  scalingContext="general"
                  usePageTranslation={true}
                />
              </h3>
              <p className="text-muted-foreground text-sm">
                <EnhancedTranslatableText 
                  text="Need more entries to compare" 
                  forceTranslate={true}
                  enableFontScaling={true}
                  scalingContext="compact"
                  usePageTranslation={true}
                />
              </p>
            </div>
          </div>
        );

      case 'activity':
        const timeRangeText = props.timeRange === 'today' ? 'Today' : `This ${props.timeRange}`;
        
        return (
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
              {props.data.streak > 0 ? (
                <Award className="h-8 w-8 text-purple-600 dark:text-purple-300" />
              ) : (
                <Activity className="h-8 w-8 text-purple-600 dark:text-purple-300" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold">
                <EnhancedTranslatableText 
                  text={`${props.data.entryCount} ${props.data.entryCount === 1 ? 'entry' : 'entries'}`} 
                  forceTranslate={true}
                  enableFontScaling={true}
                  scalingContext="general"
                  usePageTranslation={true}
                />
              </h3>
              <p className="text-muted-foreground text-sm">
                <EnhancedTranslatableText 
                  text={timeRangeText} 
                  forceTranslate={true}
                  enableFontScaling={true}
                  scalingContext="compact"
                  usePageTranslation={true}
                />
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-background p-6 rounded-xl shadow-sm border w-full"
    >
      <div className="flex justify-between items-start mb-4">
        <h2 className="font-semibold text-lg">
          <EnhancedTranslatableText 
            text={title} 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="general"
            usePageTranslation={true}
          />
        </h2>
        {badge && (
          <span className={cn("px-2 py-1 rounded-full text-xs font-medium", badgeColor)}>
            <EnhancedTranslatableText 
              text={badge} 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="compact"
              usePageTranslation={true}
            />
          </span>
        )}
      </div>
      {renderContent()}
    </motion.div>
  );
};
