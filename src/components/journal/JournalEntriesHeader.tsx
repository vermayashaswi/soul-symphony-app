
import React from 'react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface JournalEntriesHeaderProps {
  onStartRecording: () => void;
}

export const JournalEntriesHeader: React.FC<JournalEntriesHeaderProps> = ({ 
  onStartRecording 
}) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-semibold">
        <TranslatableText text="Your journal entries" />
      </h2>
      <Button 
        onClick={onStartRecording}
        size="sm"
        className="flex items-center gap-1 record-entry-button tutorial-record-entry-button"
        data-tutorial-target="record-entry"
      >
        <Plus className="w-4 h-4" />
        <TranslatableText text="New entry" />
      </Button>
    </div>
  );
}

export default JournalEntriesHeader;
