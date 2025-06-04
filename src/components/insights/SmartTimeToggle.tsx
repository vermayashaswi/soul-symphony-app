
import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EnhancedTranslatableText } from '@/components/translation/EnhancedTranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { TimeRange } from '@/hooks/use-insights-data';

interface SmartTimeToggleProps {
  timeRange: TimeRange;
  onTimeRangeChange: (value: string) => void;
  className?: string;
}

const timeRanges = [
  { value: 'today', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

// Language-specific scaling configurations for the time toggle
const getLanguageToggleConfig = (languageCode: string) => {
  const configs: Record<string, { scale: number; minWidth: string; padding: string; fontSize: string }> = {
    // Default English configuration
    'en': { scale: 1.0, minWidth: 'min-w-[60px]', padding: 'px-4 py-1.5', fontSize: 'text-sm' },
    
    // Languages that tend to be longer
    'de': { scale: 0.85, minWidth: 'min-w-[50px]', padding: 'px-3 py-1.5', fontSize: 'text-xs' },
    'fr': { scale: 0.90, minWidth: 'min-w-[55px]', padding: 'px-3 py-1.5', fontSize: 'text-xs' },
    'es': { scale: 0.92, minWidth: 'min-w-[55px]', padding: 'px-3 py-1.5', fontSize: 'text-xs' },
    'it': { scale: 0.90, minWidth: 'min-w-[55px]', padding: 'px-3 py-1.5', fontSize: 'text-xs' },
    'pt': { scale: 0.90, minWidth: 'min-w-[55px]', padding: 'px-3 py-1.5', fontSize: 'text-xs' },
    'ru': { scale: 0.88, minWidth: 'min-w-[50px]', padding: 'px-2 py-1.5', fontSize: 'text-xs' },
    
    // Asian languages
    'zh': { scale: 0.95, minWidth: 'min-w-[50px]', padding: 'px-3 py-1.5', fontSize: 'text-sm' },
    'ja': { scale: 0.92, minWidth: 'min-w-[50px]', padding: 'px-3 py-1.5', fontSize: 'text-sm' },
    'ko': { scale: 0.93, minWidth: 'min-w-[50px]', padding: 'px-3 py-1.5', fontSize: 'text-sm' },
    
    // Indian languages that may need more aggressive scaling
    'hi': { scale: 0.85, minWidth: 'min-w-[45px]', padding: 'px-2 py-1.5', fontSize: 'text-xs' },
    'bn': { scale: 0.82, minWidth: 'min-w-[45px]', padding: 'px-2 py-1.5', fontSize: 'text-xs' },
    'ta': { scale: 0.80, minWidth: 'min-w-[40px]', padding: 'px-2 py-1', fontSize: 'text-xs' },
    'te': { scale: 0.82, minWidth: 'min-w-[45px]', padding: 'px-2 py-1.5', fontSize: 'text-xs' },
    'kn': { scale: 0.83, minWidth: 'min-w-[45px]', padding: 'px-2 py-1.5', fontSize: 'text-xs' },
    'ml': { scale: 0.78, minWidth: 'min-w-[40px]', padding: 'px-2 py-1', fontSize: 'text-xs' },
    'gu': { scale: 0.85, minWidth: 'min-w-[45px]', padding: 'px-2 py-1.5', fontSize: 'text-xs' },
    'mr': { scale: 0.84, minWidth: 'min-w-[45px]', padding: 'px-2 py-1.5', fontSize: 'text-xs' },
    'pa': { scale: 0.85, minWidth: 'min-w-[45px]', padding: 'px-2 py-1.5', fontSize: 'text-xs' },
    'or': { scale: 0.83, minWidth: 'min-w-[45px]', padding: 'px-2 py-1.5', fontSize: 'text-xs' },
    
    // Arabic
    'ar': { scale: 0.88, minWidth: 'min-w-[50px]', padding: 'px-3 py-1.5', fontSize: 'text-xs' },
    
    // Indonesian (reported issue)
    'id': { scale: 0.85, minWidth: 'min-w-[45px]', padding: 'px-2 py-1.5', fontSize: 'text-xs' },
  };
  
  return configs[languageCode] || configs['en'];
};

export const SmartTimeToggle: React.FC<SmartTimeToggleProps> = ({
  timeRange,
  onTimeRangeChange,
  className
}) => {
  const { currentLanguage } = useTranslation();
  const isMobile = useIsMobile();
  
  const languageConfig = getLanguageToggleConfig(currentLanguage);
  
  // Additional mobile adjustments
  const mobileAdjustments = isMobile ? {
    scale: Math.min(languageConfig.scale, 0.9), // Cap scaling on mobile
    padding: 'px-2 py-1',
    fontSize: 'text-xs',
    minWidth: 'min-w-[35px]'
  } : languageConfig;
  
  const finalConfig = isMobile ? mobileAdjustments : languageConfig;

  return (
    <div className={cn(
      "insights-time-toggle flex items-center gap-2",
      isMobile ? "gap-1" : "gap-3",
      className
    )}>
      <span className={cn(
        "text-muted-foreground flex-shrink-0",
        isMobile ? "text-xs" : "text-sm"
      )}>
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
        className={cn(
          "bg-secondary rounded-full",
          isMobile ? "p-0.5" : "p-1",
          "flex-shrink-0"
        )}
      >
        {timeRanges.map((range) => (
          <ToggleGroupItem
            key={range.value}
            value={range.value}
            className={cn(
              "rounded-full font-medium transition-all whitespace-nowrap",
              finalConfig.padding,
              finalConfig.fontSize,
              finalConfig.minWidth,
              timeRange === range.value
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground bg-transparent",
              // Language-specific scaling
              currentLanguage !== 'en' && `scale-[${finalConfig.scale}] origin-center`,
              // Mobile-specific adjustments
              isMobile && "leading-tight",
              // Overflow handling
              "overflow-hidden text-ellipsis"
            )}
            style={{
              transform: currentLanguage !== 'en' ? `scale(${finalConfig.scale})` : undefined,
              transformOrigin: 'center',
            }}
          >
            <EnhancedTranslatableText 
              text={range.label} 
              forceTranslate={true}
              enableFontScaling={false} // We're handling scaling manually
              scalingContext="compact"
              usePageTranslation={true}
            />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
};

export default SmartTimeToggle;
