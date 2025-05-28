
import { useContext } from 'react';

// Safe tutorial hook that won't crash if TutorialContext is not available
export const useTutorialSafe = () => {
  try {
    // Dynamically import tutorial context to avoid import errors
    const TutorialContext = require('@/contexts/TutorialContext').TutorialContext;
    const context = useContext(TutorialContext);
    
    if (context === undefined) {
      console.warn('TutorialContext not found, returning safe defaults');
      return {
        isActive: false,
        currentStep: 0,
        totalSteps: 0,
        steps: [],
        nextStep: () => {},
        prevStep: () => {},
        skipTutorial: () => {},
        completeTutorial: () => {},
        resetTutorial: () => {},
        tutorialCompleted: true,
        isInStep: () => false,
        navigationState: {
          inProgress: false,
          targetRoute: null
        }
      };
    }
    
    return context;
  } catch (error) {
    console.warn('Tutorial context import failed, returning safe defaults:', error);
    return {
      isActive: false,
      currentStep: 0,
      totalSteps: 0,
      steps: [],
      nextStep: () => {},
      prevStep: () => {},
      skipTutorial: () => {},
      completeTutorial: () => {},
      resetTutorial: () => {},
      tutorialCompleted: true,
      isInStep: () => false,
      navigationState: {
        inProgress: false,
        targetRoute: null
      }
    };
  }
};
