
import React from 'react';
import { Button } from '@/components/ui/button';
import { useTutorial } from '@/contexts/TutorialContext';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface SkipTutorialButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

const SkipTutorialButton: React.FC<SkipTutorialButtonProps> = ({ 
  variant = 'outline',
  size = 'default',
  className = '',
}) => {
  const { skipTutorial, isActive } = useTutorial();
  
  if (!isActive) {
    return null;
  }
  
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={skipTutorial}
    >
      <TranslatableText text="Skip Tutorial" forceTranslate />
    </Button>
  );
};

export default SkipTutorialButton;
