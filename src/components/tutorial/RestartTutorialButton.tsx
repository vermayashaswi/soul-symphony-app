
import React from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { useTutorial } from '@/contexts/TutorialContext';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface RestartTutorialButtonProps {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg';
}

const RestartTutorialButton: React.FC<RestartTutorialButtonProps> = ({ 
  variant = 'outline',
  size = 'default'
}) => {
  const { startTutorial } = useTutorial();
  
  return (
    <Button
      variant={variant}
      size={size}
      onClick={startTutorial}
      className="flex items-center gap-2"
    >
      <HelpCircle className="h-4 w-4" />
      <TranslatableText text="Restart Tutorial" />
    </Button>
  );
};

export default RestartTutorialButton;
