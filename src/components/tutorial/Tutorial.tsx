
import React from 'react';
import { createPortal } from 'react-dom';
import { TutorialStep } from './TutorialStep';
import { useTutorial } from '@/contexts/TutorialContext';
import { TutorialOverlay } from './TutorialOverlay';

export const Tutorial: React.FC = () => {
  const {
    isTutorialActive,
    currentStep,
    totalSteps,
    nextStep,
    previousStep,
    completeTutorial,
    skipTutorial
  } = useTutorial();
  
  if (!isTutorialActive) {
    return null;
  }
  
  return (
    <>
      {createPortal(
        <TutorialOverlay />,
        document.body
      )}
      
      {createPortal(
        <TutorialStep
          step={currentStep}
          totalSteps={totalSteps}
          onNext={nextStep}
          onPrevious={previousStep}
          onComplete={completeTutorial}
          onSkip={skipTutorial}
        />,
        document.body
      )}
    </>
  );
};
