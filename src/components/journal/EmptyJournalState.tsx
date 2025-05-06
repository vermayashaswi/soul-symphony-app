
import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface EmptyJournalStateProps {
  onStartRecording: () => void;
}

const EmptyJournalState: React.FC<EmptyJournalStateProps> = ({ onStartRecording }) => {
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
