import React from 'react';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from '@/contexts/TranslationContext';
import { cn } from '@/lib/utils';

interface GenericTranslationProgressProps {
  isTranslating: boolean;
  progress: number;
  className?: string;
}

export const GenericTranslationProgress: React.FC<GenericTranslationProgressProps> = ({ 
  isTranslating,
  progress,
  className 
}) => {
  const { currentLanguage } = useTranslation();

  // Don't show for English
  if (currentLanguage === 'en' || !isTranslating) {
    return null;
  }

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b",
      className
    )}>
      <div className="px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground flex-shrink-0">
            Translating page...
          </span>
          <Progress 
            value={progress} 
            className="flex-1 h-1.5" 
          />
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </div>
  );
};