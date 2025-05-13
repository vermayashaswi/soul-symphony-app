import React, { createContext, useContext, useState, useEffect } from 'react';
import TutorialOverlay from '@/components/tutorial/TutorialOverlay';

interface TutorialStep {
  id: number;
  title: string;
  content: string;
  target: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  navigateTo?: string;
}

interface TutorialContextProps {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  steps: TutorialStep[];
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  startTutorial: () => void;
  setIsTutorialCompleted: (completed: boolean) => void;
}

interface TutorialProviderProps {
  children: React.ReactNode;
}

const TutorialContext = createContext<TutorialContextProps | undefined>(undefined);

const initialTutorialSteps: TutorialStep[] = [
  {
    id: 1,
    title: "Welcome to SOULo!",
    content: "SOULo helps you track your thoughts, emotions, and insights over time. Let's start by exploring the journal feature.",
    target: ".journal-header-container",
    placement: "bottom",
    navigateTo: "/app/journal"
  },
  {
    id: 2,
    title: "Start your Journey",
    content: "This is the heart of the app. Click this button to begin recording your thoughts and emotions.",
    target: ".journal-arrow-button",
    placement: "bottom",
    navigateTo: "/app/journal"
  },
  {
    id: 3,
    title: "Record New Entries",
    content: "Click here to create a new journal entry when you want to record your thoughts and feelings.",
    target: '[data-value="record"], .record-entry-tab, .tutorial-record-entry-button, button[data-tutorial-target="record-entry"], #new-entry-button',
    placement: "bottom",
    navigateTo: "/app/journal"
  },
  {
    id: 4,
    title: "View Past Entries",
    content: "Here you can browse through all your previous journal entries and revisit your thoughts.",
    target: '[data-value="entries"], .entries-tab, button[data-tutorial-target="past-entries"], #past-entries-button',
    placement: "bottom",
    navigateTo: "/app/journal"
  },
  {
    id: 5,
    title: "Ask Anything",
    content: "Chat with Rūḥ to gain insights from your journal. You can ask questions or choose from suggestions.",
    target: ".chat-question-suggestion",
    placement: "bottom",
    navigateTo: "/app/chat"
  },
  {
    id: 6,
    title: "Get Detailed Insights",
    content: "Rūḥ provides detailed analyses of your journal entries with statistics, trends, and patterns.",
    target: ".chat-ai-response",
    placement: "top",
    navigateTo: "/app/chat"
  }
];

export const TutorialProvider: React.FC<TutorialProviderProps> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isTutorialCompleted, setIsTutorialCompleted] = useState(false);

  useEffect(() => {
    const tutorialCompleted = localStorage.getItem('tutorialCompleted');
    if (tutorialCompleted === 'true') {
      setIsTutorialCompleted(true);
    }
  }, []);

  useEffect(() => {
    if (isTutorialCompleted) {
      setIsActive(false);
      setCurrentStep(0);
    }
  }, [isTutorialCompleted]);

  const startTutorial = () => {
    setIsActive(true);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentStep < initialTutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsActive(false);
      setIsTutorialCompleted(true);
      localStorage.setItem('tutorialCompleted', 'true');
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTutorial = () => {
    setIsActive(false);
    setIsTutorialCompleted(true);
    localStorage.setItem('tutorialCompleted', 'true');
  };

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStep,
        totalSteps: initialTutorialSteps.length,
        steps: initialTutorialSteps,
        nextStep,
        prevStep,
        skipTutorial,
        startTutorial,
        setIsTutorialCompleted
      }}
    >
      {children}
      {isActive && <TutorialOverlay />}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return context;
};
