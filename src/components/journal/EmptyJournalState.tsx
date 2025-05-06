
import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Loader2 } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { cn } from '@/lib/utils';
// Import the SoulnetEmptyState component
import { EmptyState as SoulnetEmptyState } from '@/components/insights/soulnet/EmptyState';

interface EmptyJournalStateProps {
  onStartRecording: () => void;
  isProcessingFirstEntry?: boolean;
}

const EmptyJournalState: React.FC<EmptyJournalStateProps> = ({ 
  onStartRecording,
  isProcessingFirstEntry = false
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {isProcessingFirstEntry ? (
        <>
          <div className="mb-4 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">
            <TranslatableText text="Processing Your First Entry" />
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            <TranslatableText text="Please wait while we analyze your first journal entry..." />
          </p>
        </>
      ) : (
        <>
          <div className="mb-4 text-3xl">✏️</div>
          <h3 className="text-xl font-semibold mb-2">
            <TranslatableText text="Your Journal is Empty" />
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            <TranslatableText text="Start recording your thoughts and feelings to begin your journaling journey." />
          </p>
          <Button 
            onClick={onStartRecording} 
            className={cn("flex items-center gap-2", 
              isProcessingFirstEntry && "pointer-events-none opacity-50")}
            disabled={isProcessingFirstEntry}
          >
            <Mic className="h-4 w-4" />
            <TranslatableText text="Start Recording" />
          </Button>
        </>
      )}
    </div>
  );
};

export default EmptyJournalState;
