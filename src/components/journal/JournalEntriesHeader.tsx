
import React from 'react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useTutorial } from '@/contexts/TutorialContext';

interface JournalEntriesHeaderProps {
  onStartRecording: () => void;
}

export const JournalEntriesHeader: React.FC<JournalEntriesHeaderProps> = ({ 
  onStartRecording 
}) => {
  const { isInStep, tutorialCompleted } = useTutorial();
  const shouldAddTutorialClass = isInStep(3) && !tutorialCompleted;
  
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-semibold">
        <TranslatableText text="Your journal entries" />
      </h2>
      <Button 
        onClick={onStartRecording}
        size="sm"
        className={`flex items-center gap-1 record-entry-button ${shouldAddTutorialClass ? 'tutorial-record-entry-button tutorial-target record-entry-tab' : ''}`}
        data-tutorial-target={shouldAddTutorialClass ? "record-entry" : undefined}
        id="new-entry-button"
      >
        <Plus className="w-4 h-4" />
        <TranslatableText text="New entry" />
      </Button>
    </div>
  );
}

export default JournalEntriesHeader;
