
import React from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { useTutorial } from '@/contexts/TutorialContext';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface StartTutorialButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

const StartTutorialButton: React.FC<StartTutorialButtonProps> = ({
  variant = 'outline',
  size = 'default',
  className = '',
}) => {
  const { startTutorial, isTutorialActive } = useTutorial();

  const handleStartTutorial = () => {
    if (!isTutorialActive) {
      startTutorial();
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleStartTutorial}
      className={className}
      disabled={isTutorialActive}
    >
      <HelpCircle className="mr-2 h-4 w-4" />
      <TranslatableText text="Start App Tutorial" />
    </Button>
  );
};

export default StartTutorialButton;
