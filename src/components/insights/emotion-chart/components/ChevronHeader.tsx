
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface ChevronHeaderProps {
  isNavigating: boolean;
  onPrevious: () => void;
  onNext: () => void;
  periodLabel: string;
}

export const ChevronHeader = ({ isNavigating, onPrevious, onNext, periodLabel }: ChevronHeaderProps) => (
  <div className="flex items-center justify-between mb-2">
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={onPrevious}
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
    <div className="text-center font-medium text-base">
      <TranslatableText 
        text={periodLabel}
        forceTranslate={true}
        enableFontScaling={true}
        scalingContext="compact"
      />
    </div>
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={onNext}
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
