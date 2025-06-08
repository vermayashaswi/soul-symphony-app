
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { useSoulNetTranslation } from './SoulNetTranslationTracker';
import { useTranslation } from '@/contexts/TranslationContext';
import { cn } from '@/lib/utils';

interface SoulNetTranslationProgressProps {
  className?: string;
  showProgress?: boolean;
}

export const SoulNetTranslationProgress: React.FC<SoulNetTranslationProgressProps> = ({ 
  className,
  showProgress = true
}) => {
  const { isAllTranslated, translationProgress } = useSoulNetTranslation();
  const { currentLanguage } = useTranslation();

  // Don't show for English or when all translations are complete
  if (currentLanguage === 'en' || isAllTranslated || !showProgress) {
    return null;
  }

  return (
    <div className={cn(
      "absolute top-2 left-2 right-2 z-10 bg-background/90 backdrop-blur-sm rounded-lg border p-2",
      className
    )}>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground flex-shrink-0">
          Translating nodes...
        </span>
        <Progress 
          value={translationProgress} 
          className="flex-1 h-1.5" 
        />
        <span className="text-muted-foreground flex-shrink-0">
          {translationProgress}%
        </span>
      </div>
    </div>
  );
};
