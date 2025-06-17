
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { TimeRange } from '@/hooks/use-insights-data';
import { getPeriodLabel } from '@/components/insights/emotion-chart/utils/dateNavigation';

interface InsightsGlobalNavigationProps {
  timeRange: TimeRange;
  currentDate: Date;
  onNavigate: (direction: 'previous' | 'next') => void;
  isNavigating?: boolean;
}

export const InsightsGlobalNavigation = ({ 
  timeRange, 
  currentDate, 
  onNavigate, 
  isNavigating = false 
}: InsightsGlobalNavigationProps) => {
  const periodLabel = getPeriodLabel(timeRange, currentDate);

  return (
    <div className="flex items-center justify-between mb-6 px-2">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => onNavigate('previous')}
        disabled={isNavigating}
        className="text-muted-foreground hover:text-foreground"
        title="Previous period"
      >
        {isNavigating ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
      </Button>
      
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-1">
          <TranslatableText 
            text="Period Navigation" 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="general"
          />
        </h2>
        <div className="text-base font-medium">
          <TranslatableText 
            text={periodLabel}
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="compact"
          />
        </div>
      </div>
      
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => onNavigate('next')}
        disabled={isNavigating}
        className="text-muted-foreground hover:text-foreground"
        title="Next period"
      >
        {isNavigating ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ChevronRight className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
};
