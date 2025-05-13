import React, { createContext, useContext, useState, useEffect } from 'react';

// Tutorial step definition
export interface TutorialStep {
  id: number;
  title: string;
  content: string;
  targetElement?: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  showNextButton?: boolean;
  navigateTo?: string;
}

export interface TutorialContextProps {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  steps: TutorialStep[];
  nextStep: () => void;
  prevStep: () => void;
  startTutorial: () => void;
  skipTutorial: () => void;
  resetTutorial: () => void;
}

// Create the context with a default value
export const TutorialContext = createContext<TutorialContextProps>({
  isActive: false,
  currentStep: 0,
  totalSteps: 0,
  steps: [],
  nextStep: () => {},
  prevStep: () => {},
  startTutorial: () => {},
  skipTutorial: () => {},
  resetTutorial: () => {}
});

// Create the provider component
export const TutorialProvider = ({ children }: { children: React.ReactNode }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Define tutorial steps
  const steps: TutorialStep[] = [
    {
      id: 1,
      title: "Welcome to Rūḥ!",
      content: "Let's take a quick tour to show you around.",
      targetElement: '.journal-header-container',
      position: 'bottom',
      showNextButton: true,
      navigateTo: '/app/journal'
    },
    {
      id: 2,
      title: "Explore Past Entries",
      content: "Tap the arrow to view entries from previous days.",
      targetElement: '.journal-arrow-button',
      position: 'top',
      showNextButton: true
    },
    {
      id: 3,
      title: "Record New Entry",
      content: "Click here to record a new journal entry.",
      targetElement: '[data-value="record"]',
      position: 'bottom',
      showNextButton: true
    },
    {
      id: 4,
      title: "View Past Entries",
      content: "Switch to this tab to see all your past entries.",
      targetElement: '[value="entries"]',
      position: 'bottom',
      showNextButton: true
    },
    {
      id: 5,
      title: "Try Chat",
      content: "Click on a question to ask Rūḥ about your journal.",
      targetElement: '.chat-question-suggestion',
      position: 'bottom',
      showNextButton: true,
      navigateTo: '/app/chat'
    },
    {
      id: 6,
      title: "AI Insights",
      content: "Rūḥ analyzes your entries to provide personalized insights.",
      targetElement: '.chat-ai-response',
      position: 'bottom',
      showNextButton: true
    }
  ];
  
  const totalSteps = steps.length;

  // Navigation functions
  const nextStep = () => {
    setCurrentStep((prevStep) => Math.min(prevStep + 1, totalSteps - 1));
  };

  const prevStep = () => {
    setCurrentStep((prevStep) => Math.max(prevStep - 1, 0));
  };

  const startTutorial = () => {
    setIsActive(true);
    setCurrentStep(0);
  };

  const skipTutorial = () => {
    setIsActive(false);
    setCurrentStep(0);
  };
  
  const resetTutorial = () => {
    setIsActive(true);
    setCurrentStep(0);
  };

  // Provide the context value
  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStep,
        totalSteps,
        steps,
        nextStep,
        prevStep,
        startTutorial,
        skipTutorial,
        resetTutorial
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

// Custom hook for consuming the context
export const useTutorial = () => useContext(TutorialContext);
