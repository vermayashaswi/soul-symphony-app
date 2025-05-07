
import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Loader2 } from 'lucide-react';

interface EmptyJournalStateProps {
  onStartRecording: () => void;
  isCreatingPlaceholder?: boolean;
}

const EmptyJournalState: React.FC<EmptyJournalStateProps> = ({ 
  onStartRecording,
  isCreatingPlaceholder = false
}) => {
  if (isCreatingPlaceholder) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <h3 className="text-lg font-medium">
          <TranslatableText text="Setting up your journal..." />
        </h3>
        <p className="text-muted-foreground mt-2">
          <TranslatableText text="We're creating an example entry to help you get started" />
        </p>
      </div>
    );
  }
  
  return (
    <EmptyState 
      title={<TranslatableText text="No journal entries yet" />}
      description={<TranslatableText text="Start recording your thoughts and experiences" />}
      buttonText={<TranslatableText text="Record new entry" />}
      onAction={onStartRecording}
    />
  );
};

export default EmptyJournalState;
