
import React from 'react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useTutorialSafe } from '@/hooks/useTutorialSafe';

interface JournalEntriesHeaderProps {
  onStartRecording: () => void;
}

export const JournalEntriesHeader: React.FC<JournalEntriesHeaderProps> = ({ 
  onStartRecording 
}) => {
  const tutorialData = useTutorialSafe();
  const shouldAddTutorialClass = tutorialData?.isInStep?.(3) && !tutorialData?.tutorialCompleted;
  
  console.log('JournalEntriesHeader: Tutorial state:', {
    isInStep3: tutorialData?.isInStep?.(3),
    tutorialCompleted: tutorialData?.tutorialCompleted,
    shouldAddTutorialClass
  });
  
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-semibold">
        <TranslatableText text="Your journal entries" />
      </h2>
      <Button 
        onClick={onStartRecording}
        size="sm"
        className={`flex items-center gap-1 record-entry-button ${shouldAddTutorialClass ? 'tutorial-record-entry-button' : ''}`}
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
