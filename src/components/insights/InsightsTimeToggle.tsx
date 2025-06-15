
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeRange } from '@/hooks/use-insights-data';
import { EnhancedTranslatableText } from '@/components/translation/EnhancedTranslatableText';

interface InsightsTimeToggleProps {
  timeRange: TimeRange;
  onTimeRangeChange: (value: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export function InsightsTimeToggle({ 
  timeRange, 
  onTimeRangeChange, 
  refreshing, 
  onRefresh 
}: InsightsTimeToggleProps) {
  const timeRanges = [
    { value: 'today', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
  ];

  return (
    <div className="insights-time-toggle flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        <EnhancedTranslatableText 
          text="View:" 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="compact"
          usePageTranslation={true}
        />
      </span>
      <ToggleGroup 
        type="single" 
        value={timeRange}
        onValueChange={onTimeRangeChange}
        variant="outline"
        className="bg-secondary rounded-full p-1"
      >
        {timeRanges.map((range) => (
          <ToggleGroupItem
            key={range.value}
            value={range.value}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              timeRange === range.value
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground bg-transparent"
            )}
          >
            <EnhancedTranslatableText 
              text={range.label} 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="compact"
              usePageTranslation={true}
            />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        className={cn(
          "ml-2 h-8 w-8 p-0",
          refreshing && "animate-spin"
        )}
        title="Refresh data"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );
}
