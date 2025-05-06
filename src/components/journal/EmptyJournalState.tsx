
import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface EmptyJournalStateProps {
  onStartRecording: () => void;
}

const EmptyJournalState: React.FC<EmptyJournalStateProps> = ({ onStartRecording }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 text-3xl">✏️</div>
      <h3 className="text-xl font-semibold mb-2">
        <TranslatableText text="Your Journal is Empty" />
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        <TranslatableText text="Start recording your thoughts and feelings to begin your journaling journey." />
      </p>
      <Button onClick={onStartRecording} className="flex items-center gap-2">
        <Mic className="h-4 w-4" />
        <TranslatableText text="Start Recording" />
      </Button>
    </div>
  );
};

export default EmptyJournalState;
