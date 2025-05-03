
import { cn } from '@/lib/utils';
import { TranslatableText } from '@/components/translation/TranslatableText';

export const LoadingState = () => {
  return (
    <div className={cn(
      "bg-background rounded-xl shadow-sm border w-full p-6 md:p-8",
      "flex flex-col items-center justify-center py-16"
    )}>
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
      <p className="text-muted-foreground">
        <TranslatableText text="Loading visualization..." forceTranslate={true} />
      </p>
    </div>
  );
};

export default LoadingState;
