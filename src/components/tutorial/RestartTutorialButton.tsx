
import React from 'react';
import { Button } from '@/components/ui/button';
import { useTutorial } from '@/contexts/TutorialContext';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { RefreshCw } from 'lucide-react';

interface RestartTutorialButtonProps {
  className?: string;
}

const RestartTutorialButton: React.FC<RestartTutorialButtonProps> = ({ className = '' }) => {
  const { resetTutorial, startTutorial, isTutorialCompleted } = useTutorial();
  
  const handleRestartTutorial = () => {
    resetTutorial();
    startTutorial();
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={handleRestartTutorial}
    >
      <RefreshCw className="h-4 w-4 mr-2" />
      <TranslatableText 
        text={isTutorialCompleted ? "Restart App Tour" : "Start App Tour"} 
        forceTranslate
      />
    </Button>
  );
};

export default RestartTutorialButton;
