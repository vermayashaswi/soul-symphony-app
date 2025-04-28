
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface JournalEntriesHeaderProps {
  onStartRecording: () => void;
}

export const JournalEntriesHeader: React.FC<JournalEntriesHeaderProps> = ({ onStartRecording }) => {
  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold"><TranslatableText text="Your Journal Entries" /></h2>
        <Button onClick={onStartRecording} size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          <TranslatableText text="New Entry" />
        </Button>
      </div>
    </div>
  );
};
