
import { Button } from '@/components/ui/button';
import { EnhancedTranslatableText } from '@/components/translation/EnhancedTranslatableText';

export function InsightsEmptyState() {
  return (
    <div className="bg-background rounded-xl p-8 text-center border mx-2">
      <h2 className="text-xl font-semibold mb-4">
        <EnhancedTranslatableText 
          text="No journal data available" 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="general"
          usePageTranslation={true}
        />
      </h2>
      <p className="text-muted-foreground mb-6">
        <EnhancedTranslatableText 
          text="Start recording journal entries to see your emotional insights." 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="general"
          usePageTranslation={true}
        />
      </p>
      <Button onClick={() => window.location.href = '/journal'}>
        <EnhancedTranslatableText 
          text="Go to Journal" 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="compact"
          usePageTranslation={true}
        />
      </Button>
    </div>
  );
}
