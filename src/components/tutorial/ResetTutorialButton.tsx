
import React from 'react';
import { Button } from '@/components/ui/button';
import { useTutorial } from '@/contexts/TutorialContext';

export const ResetTutorialButton: React.FC = () => {
  const { resetTutorial } = useTutorial();
  
  return (
    <Button 
      variant="outline" 
      onClick={resetTutorial}
      className="w-full mt-2"
    >
      Restart App Tutorial
    </Button>
  );
};
