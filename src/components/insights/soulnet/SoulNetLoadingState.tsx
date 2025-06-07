
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface SoulNetLoadingStateProps {
  translationProgress?: number;
  showTranslationProgress?: boolean;
  currentLanguage?: string;
}

export const SoulNetLoadingState: React.FC<SoulNetLoadingStateProps> = ({
  translationProgress = 0,
  showTranslationProgress = false,
  currentLanguage = 'en'
}) => {
  return (
    <div className="bg-background rounded-xl shadow-sm border w-full p-6">
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <h3 className="text-lg font-medium mb-2">
            <TranslatableText 
              text="Loading Soul-Net Visualization" 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </h3>
          <p className="text-muted-foreground">
            <TranslatableText 
              text="Preparing your emotional network..." 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </p>
        </div>
      </div>
      
      {showTranslationProgress && currentLanguage !== 'en' && translationProgress > 0 && translationProgress < 100 && (
        <div className="mt-6 border-t pt-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm text-muted-foreground">
              <TranslatableText 
                text="Loading translations..." 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
              />
            </span>
            <span className="text-sm font-medium">{Math.round(translationProgress)}%</span>
          </div>
          <Progress value={translationProgress} className="w-full h-2" />
        </div>
      )}
    </div>
  );
};
