
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useOnboarding } from '@/hooks/use-onboarding';

export type TutorialStep = {
  id: string;
  title: string;
  content: string;
  targetElementId?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  nextButtonText?: string;
  route?: string;
  isRouteExact?: boolean;
};

type TutorialContextType = {
  currentStepIndex: number;
  steps: TutorialStep[];
  isTutorialActive: boolean;
  startTutorial: () => void;
  endTutorial: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  currentStep: TutorialStep | null;
  setTutorialCompleted: (stepId: string) => void;
  completedSteps: Record<string, boolean>;
};

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

// Define all tutorial steps here
const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Soul Symphony!',
    content: 'This quick tour will help you learn how to use the app and make the most of your experience.',
    position: 'bottom',
    nextButtonText: 'Get Started',
  },
  {
    id: 'journal',
    title: 'Your Journal',
    content: 'This is your personal journal. Tap the arrow to start a new journal entry and express your thoughts.',
    targetElementId: 'home-journal-arrow',
    position: 'bottom',
    route: '/app/home',
  },
  {
    id: 'journal-entry',
    title: 'Voice Journaling',
    content: 'Tap and hold this button to record your thoughts using voice. Release to save your entry.',
    targetElementId: 'voice-record-button',
    position: 'top',
    route: '/app/journal',
  },
  {
    id: 'smart-chat',
    title: 'Chat with Ruh',
    content: 'Meet Ruh, your AI companion. Ask questions about your emotional well-being or get insights about your journal entries.',
    targetElementId: 'chat-nav-button',
    position: 'top',
    route: '/app/chat',
  },
  {
    id: 'insights',
    title: 'Insights & Analytics',
    content: 'Explore your emotional patterns and gain deeper understanding of your mental well-being.',
    targetElementId: 'insights-nav-button',
    position: 'top',
    route: '/app/insights',
  },
  {
    id: 'language',
    title: 'Language Selection',
    content: 'Soul Symphony supports 21 languages. Change your language anytime from this menu.',
    targetElementId: 'language-selector',
    position: 'bottom',
    route: '/app/home',
  },
  {
    id: 'tutorial-complete',
    title: 'You\'re All Set!',
    content: 'You\'ve completed the tutorial. You can access it again anytime from the Settings menu.',
    position: 'bottom',
    nextButtonText: 'Finish',
  }
];

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isTutorialActive, setIsTutorialActive] = useState<boolean>(false);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const { onboardingComplete, completeOnboarding } = useOnboarding();

  // Check if we should show tutorial on initial load
  useEffect(() => {
    const tutorialShown = localStorage.getItem('tutorialShown') === 'true';

    if (onboardingComplete === false && !tutorialShown) {
      // Only show tutorial automatically on first app usage
      setIsTutorialActive(true);
      localStorage.setItem('tutorialShown', 'true');
    }
  }, [onboardingComplete]);

  // Navigate to the correct route when the tutorial step changes
  useEffect(() => {
    if (isTutorialActive && currentStepIndex < tutorialSteps.length) {
      const step = tutorialSteps[currentStepIndex];
      // Handle route navigation for the tutorial
      // This will be implemented through the TutorialOverlay component
    }
  }, [currentStepIndex, isTutorialActive, location.pathname]);

  const startTutorial = () => {
    setCurrentStepIndex(0);
    setIsTutorialActive(true);
  };

  const endTutorial = () => {
    setIsTutorialActive(false);
    completeOnboarding();
  };

  const nextStep = () => {
    if (currentStepIndex < tutorialSteps.length - 1) {
      const currentStep = tutorialSteps[currentStepIndex];
      setCompletedSteps(prev => ({ ...prev, [currentStep.id]: true }));
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      endTutorial();
    }
  };

  const previousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const skipTutorial = () => {
    endTutorial();
  };

  const setTutorialCompleted = (stepId: string) => {
    setCompletedSteps(prev => ({ ...prev, [stepId]: true }));
  };

  const currentStep = isTutorialActive && currentStepIndex < tutorialSteps.length 
    ? tutorialSteps[currentStepIndex] 
    : null;

  return (
    <TutorialContext.Provider
      value={{
        currentStepIndex,
        steps: tutorialSteps,
        isTutorialActive,
        startTutorial,
        endTutorial,
        nextStep,
        previousStep,
        skipTutorial,
        currentStep,
        setTutorialCompleted,
        completedSteps,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};
