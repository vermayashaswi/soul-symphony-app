
import { cn } from '@/lib/utils';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onStartRecording: () => void;
}

export const EmptyState = ({ onStartRecording }: EmptyStateProps) => {
  return (
    <div className={cn(
      "bg-background rounded-xl shadow-sm border w-full p-6 md:p-8",
      "flex flex-col items-center justify-center py-16"
    )}>
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
        <span className="text-2xl">🧠</span>
      </div>
      <h3 className="text-xl font-semibold mb-2">
        <TranslatableText text="No connections found" />
      </h3>
      <p className="text-muted-foreground text-center max-w-md">
        <TranslatableText text="Add more journal entries to visualize connections between entities and emotions in your journaling." />
      </p>
      
      <Button 
        onClick={onStartRecording}
        variant="default"
        className="mt-6"
      >
        <TranslatableText text="Start Recording" />
      </Button>
    </div>
  );
};
