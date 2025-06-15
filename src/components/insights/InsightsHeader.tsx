
import { EnhancedTranslatableText } from '@/components/translation/EnhancedTranslatableText';

export function InsightsHeader() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">
        <EnhancedTranslatableText 
          text="Insights" 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="general"
          usePageTranslation={true}
        />
      </h1>
      <p className="text-muted-foreground">
        <EnhancedTranslatableText 
          text="Discover patterns in your emotional journey" 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="general"
          usePageTranslation={true}
        />
      </p>
    </div>
  );
}
