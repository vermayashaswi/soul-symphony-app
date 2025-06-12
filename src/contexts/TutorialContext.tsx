
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/SimplifiedAuthContext';

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
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const totalSteps = 5; // Adjust based on your tutorial steps
  
  // Tutorial configuration
  const tutorialConfig = {
    steps: [
      {
        target: '[data-tutorial="voice-button"]',
        content: 'Start by tapping this button to record your voice journal',
        placement: 'top'
      },
      {
        target: '[data-tutorial="journal-entries"]',
        content: 'View all your journal entries here',
        placement: 'right'
      },
      {
        target: '[data-tutorial="insights"]',
        content: 'Discover insights about your emotional patterns',
        placement: 'bottom'
      },
      {
        target: '[data-tutorial="chat"]',
        content: 'Chat with AI about your journal entries',
        placement: 'left'
      },
      {
        target: '[data-tutorial="settings"]',
        content: 'Customize your experience in settings',
        placement: 'top'
      }
    ]
  };

  // Check if user should see tutorial
  useEffect(() => {
    if (user) {
      const hasSeenTutorial = localStorage.getItem(`tutorial-completed-${user.id}`);
      if (!hasSeenTutorial) {
        // Small delay to ensure UI is loaded
        setTimeout(() => {
          setIsTutorialActive(true);
          setIsVisible(true);
        }, 1000);
      }
    }
  }, [user]);

  const startTutorial = () => {
    setCurrentStep(0);
    setIsTutorialActive(true);
    setIsVisible(true);
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTutorial();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTutorial = () => {
    setIsTutorialActive(false);
    setIsVisible(false);
    if (user) {
      localStorage.setItem(`tutorial-completed-${user.id}`, 'true');
    }
  };

  const resetTutorial = () => {
    setCurrentStep(0);
    setIsTutorialActive(false);
    setIsVisible(false);
    if (user) {
      localStorage.removeItem(`tutorial-completed-${user.id}`);
    }
  };

  const completeTutorial = () => {
    setIsTutorialActive(false);
    setIsVisible(false);
    if (user) {
      localStorage.setItem(`tutorial-completed-${user.id}`, 'true');
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
    setIsVisible
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
