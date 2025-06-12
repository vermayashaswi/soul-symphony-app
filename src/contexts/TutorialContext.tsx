import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/SimplifiedAuthContext';

export interface TutorialStep {
  id: number;
  target: string;
  content: string;
  placement: string;
  title: string;
  infographicType?: string;
  showNextButton: boolean;
}

export interface TutorialNavigationState {
  inProgress: boolean;
  currentStepId?: number;
}

interface TutorialContextType {
  isTutorialActive: boolean;
  currentStep: number;
  totalSteps: number;
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  resetTutorial: () => void;
  completeTutorial: () => void;
  tutorialConfig: any;
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  
  // Additional properties that components expect
  isActive: boolean;
  isInitialized: boolean;
  isInStep: (stepId: number) => boolean;
  tutorialCompleted: boolean;
  steps: TutorialStep[];
  navigationState: TutorialNavigationState;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [navigationState, setNavigationState] = useState<TutorialNavigationState>({
    inProgress: false
  });
  
  const totalSteps = 5; // Adjust based on your tutorial steps
  
  // Tutorial steps configuration
  const steps: TutorialStep[] = [
    {
      id: 1,
      target: '[data-tutorial="voice-button"]',
      content: 'Start by tapping this button to record your voice journal',
      placement: 'top',
      title: 'Record Your Voice',
      showNextButton: true
    },
    {
      id: 2,
      target: '[data-tutorial="journal-entries"]',
      content: 'View all your journal entries here',
      placement: 'right',
      title: 'View Journal Entries',
      showNextButton: true
    },
    {
      id: 3,
      target: '[data-tutorial="insights"]',
      content: 'Discover insights about your emotional patterns',
      placement: 'bottom',
      title: 'Explore Insights',
      showNextButton: true
    },
    {
      id: 4,
      target: '[data-tutorial="chat"]',
      content: 'Chat with AI about your journal entries',
      placement: 'left',
      title: 'Chat with AI',
      showNextButton: true
    },
    {
      id: 5,
      target: '[data-tutorial="settings"]',
      content: 'Customize your experience in settings',
      placement: 'top',
      title: 'Customize Settings',
      showNextButton: true
    }
  ];
  
  // Tutorial configuration
  const tutorialConfig = {
    steps: steps.map(step => ({
      target: step.target,
      content: step.content,
      placement: step.placement
    }))
  };

  // Check if user should see tutorial
  useEffect(() => {
    if (user) {
      const hasSeenTutorial = localStorage.getItem(`tutorial-completed-${user.id}`);
      setTutorialCompleted(!!hasSeenTutorial);
      setIsInitialized(true);
      
      if (!hasSeenTutorial) {
        // Small delay to ensure UI is loaded
        setTimeout(() => {
          setIsTutorialActive(true);
          setIsVisible(true);
        }, 1000);
      }
    } else {
      setIsInitialized(true);
    }
  }, [user]);

  const isInStep = (stepId: number): boolean => {
    return isTutorialActive && steps[currentStep]?.id === stepId;
  };

  const startTutorial = () => {
    setCurrentStep(0);
    setIsTutorialActive(true);
    setIsVisible(true);
    setNavigationState({ inProgress: true, currentStepId: steps[0]?.id });
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      setNavigationState({ inProgress: true, currentStepId: steps[newStep]?.id });
    } else {
      completeTutorial();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      setNavigationState({ inProgress: true, currentStepId: steps[newStep]?.id });
    }
  };

  const skipTutorial = () => {
    setIsTutorialActive(false);
    setIsVisible(false);
    setNavigationState({ inProgress: false });
    if (user) {
      localStorage.setItem(`tutorial-completed-${user.id}`, 'true');
      setTutorialCompleted(true);
    }
  };

  const resetTutorial = () => {
    setCurrentStep(0);
    setIsTutorialActive(false);
    setIsVisible(false);
    setNavigationState({ inProgress: false });
    if (user) {
      localStorage.removeItem(`tutorial-completed-${user.id}`);
      setTutorialCompleted(false);
    }
  };

  const completeTutorial = () => {
    setIsTutorialActive(false);
    setIsVisible(false);
    setNavigationState({ inProgress: false });
    if (user) {
      localStorage.setItem(`tutorial-completed-${user.id}`, 'true');
      setTutorialCompleted(true);
    }
  };

  const value = {
    isTutorialActive,
    currentStep,
    totalSteps,
    startTutorial,
    nextStep,
    prevStep,
    skipTutorial,
    resetTutorial,
    completeTutorial,
    tutorialConfig,
    isVisible,
    setIsVisible,
    
    // Additional properties
    isActive: isTutorialActive,
    isInitialized,
    isInStep,
    tutorialCompleted,
    steps,
    navigationState
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = (): TutorialContextType => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};
