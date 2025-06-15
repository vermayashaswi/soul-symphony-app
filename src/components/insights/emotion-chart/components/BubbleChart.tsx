
import { TranslatableText } from '@/components/translation/TranslatableText';
import EntityStrips from '@/components/insights/EntityStrips';
import { TimeRange } from '@/hooks/use-insights-data';
import { useAuth } from '@/contexts/AuthContext';

interface BubbleChartProps {
  timeframe: TimeRange;
  activeDate: Date;
  onEntityClick: (entity: string, sentiment: number) => void;
  topRightPercentage: { emotion: string; percentage: number } | null;
  bubbleKey: number;
}

export const BubbleChart = ({ 
  timeframe, 
  activeDate, 
  onEntityClick, 
  topRightPercentage, 
  bubbleKey 
}: BubbleChartProps) => {
  const { user } = useAuth();

  return (
    <div className="w-full h-full flex flex-col">
      {topRightPercentage && (
        <div className="absolute top-2 right-2 bg-background/90 py-1 px-3 rounded-lg shadow-lg text-primary font-medium z-20">
          <TranslatableText 
            text={topRightPercentage.emotion} 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="compact"
          />: {topRightPercentage.percentage}
        </div>
      )}
      <div className="h-[300px] w-full" key={bubbleKey}>
        <EntityStrips
          userId={user?.id}
          timeRange={timeframe}
          currentDate={activeDate}
          onEntityClick={onEntityClick}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};
