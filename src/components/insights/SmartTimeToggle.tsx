
import React, { useMemo } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EnhancedTranslatableText } from '@/components/translation/EnhancedTranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { getLanguageFontConfig } from '@/utils/languageFontScaling';

interface TimeRange {
  value: string;
  label: string;
}

interface SmartTimeToggleProps {
  value: string;
  onValueChange: (value: string) => void;
  timeRanges: TimeRange[];
  className?: string;
}

export function SmartTimeToggle({ 
  value, 
  onValueChange, 
  timeRanges,
  className 
}: SmartTimeToggleProps) {
  const { currentLanguage } = useTranslation();
  const isMobile = useIsMobile();
  const fontConfig = getLanguageFontConfig(currentLanguage);

  // Calculate text characteristics for dynamic spacing
  const textMetrics = useMemo(() => {
    const totalLength = timeRanges.reduce((sum, range) => sum + range.label.length, 0);
    const avgLength = totalLength / timeRanges.length;
    const maxLength = Math.max(...timeRanges.map(range => range.label.length));
    
    // Detect if we have long text that needs compression
    const hasLongText = maxLength > 6 || avgLength > 4;
    const needsCompactLayout = hasLongText || fontConfig.scale < 0.92;
    
    return {
      totalLength,
      avgLength,
      maxLength,
      hasLongText,
      needsCompactLayout
    };
  }, [timeRanges, fontConfig.scale]);

  // Dynamic spacing calculations
  const spacing = useMemo(() => {
    const baseSpacing = isMobile ? 1 : 2;
    const basePadding = isMobile ? 8 : 12;
    
    // Reduce spacing for languages that need more room
    const spacingMultiplier = textMetrics.needsCompactLayout ? 0.6 : 1;
    const paddingMultiplier = textMetrics.needsCompactLayout ? 0.7 : 1;
    
    // Additional mobile adjustments
    const mobileAdjustment = isMobile && textMetrics.hasLongText ? 0.8 : 1;
    
    return {
      gap: Math.max(1, Math.round(baseSpacing * spacingMultiplier * mobileAdjustment)),
      padding: Math.max(6, Math.round(basePadding * paddingMultiplier * mobileAdjustment)),
      containerPadding: Math.max(2, Math.round(4 * spacingMultiplier))
    };
  }, [isMobile, textMetrics]);

  // Text size adjustments
  const textClasses = useMemo(() => {
    const baseClasses = 'font-medium transition-all';
    
    if (textMetrics.needsCompactLayout) {
      return isMobile ? 'text-xs' : 'text-sm';
    }
    
    return isMobile ? 'text-sm' : 'text-sm';
  }, [textMetrics.needsCompactLayout, isMobile]);

  // Container width management
  const containerClasses = useMemo(() => {
    const baseClasses = 'bg-secondary rounded-full transition-all duration-200';
    
    // For mobile with long text, allow more flexibility
    if (isMobile && textMetrics.hasLongText) {
      return `${baseClasses} min-w-0 max-w-full`;
    }
    
    // For desktop or short text, maintain compact width
    return `${baseClasses} w-auto`;
  }, [isMobile, textMetrics.hasLongText]);

  return (
    <div className={cn("insights-time-toggle flex items-center", className)}>
      <span className={cn(
        "text-muted-foreground flex-shrink-0",
        isMobile ? "text-xs mr-2" : "text-sm mr-3"
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
        value={value}
        onValueChange={onValueChange}
        variant="outline"
        className={containerClasses}
        style={{ 
          padding: `${spacing.containerPadding}px`,
          gap: `${spacing.gap}px`
        }}
      >
        {timeRanges.map((range) => (
          <ToggleGroupItem
            key={range.value}
            value={range.value}
            className={cn(
              "rounded-full transition-all duration-200 flex-shrink-0",
              textClasses,
              value === range.value
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground bg-transparent",
              // Ensure minimum touch target on mobile
              isMobile ? "min-h-[36px] min-w-[36px]" : "min-h-[32px]"
            )}
            style={{
              paddingLeft: `${spacing.padding}px`,
              paddingRight: `${spacing.padding}px`,
              paddingTop: `${Math.max(4, spacing.padding * 0.4)}px`,
              paddingBottom: `${Math.max(4, spacing.padding * 0.4)}px`,
            }}
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
    </div>
  );
}
