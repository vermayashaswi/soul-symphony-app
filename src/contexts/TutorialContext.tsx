
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAppRoute } from '@/routes/RouteHelpers';
import { useAuth } from '@/contexts/AuthContext';

// Define the tutorial steps
export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  targetId: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  route?: string; // The route this step should be shown on
  action?: 'navigate' | null; // Action to take when showing this step
  actionTarget?: string; // Target for the action (e.g., route to navigate to)
}

// Define all tutorial steps
export const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to SOULo',
    content: 'Welcome to SOULo! Let\'s take a quick tour to help you get the most out of your journaling experience.',
    targetId: 'tutorial-welcome',
    position: 'center',
    route: '/app',
  },
  {
    id: 'navbar',
    title: 'Navigation',
    content: 'Use this navigation bar to move between different sections of the app.',
    targetId: 'mobile-navigation',
    position: 'top',
    route: '/app',
  },
  {
    id: 'home',
    title: 'Home Tab',
    content: 'The Home tab shows your daily summary and inspirational content to motivate your journaling journey.',
    targetId: 'nav-home',
    position: 'top',
    route: '/app',
  },
  {
    id: 'journal-tab',
    title: 'Journal',
    content: 'The Journal tab is where you record and review your thoughts and feelings.',
    targetId: 'nav-journal',
    position: 'top',
    route: '/app',
    action: 'navigate',
    actionTarget: '/app/journal',
  },
  {
    id: 'journal-entries',
    title: 'Journal Entries',
    content: 'Your journal entries appear here. Tap any entry to expand and read the full content.',
    targetId: 'journal-entries-list',
    position: 'bottom',
    route: '/app/journal',
  },
  {
    id: 'sentiment-analysis',
    title: 'Sentiment Analysis',
    content: 'SOULo analyzes your entries to detect emotions and themes, helping you understand your patterns.',
    targetId: 'sentiment-indicator',
    position: 'right',
    route: '/app/journal',
  },
  {
    id: 'chat-tab',
    title: 'Smart Chat',
    content: 'The Chat tab lets you have conversations with AI about your journal entries and emotional patterns.',
    targetId: 'nav-chat',
    position: 'top',
    route: '/app/journal',
    action: 'navigate',
    actionTarget: '/app/smart-chat',
  },
  {
    id: 'chat-conversation',
    title: 'Starting a Conversation',
    content: 'Ask questions about your journal entries, emotions, or get advice. Try something like "How was my mood last week?"',
    targetId: 'chat-input',
    position: 'top',
    route: '/app/smart-chat',
  },
  {
    id: 'insights-tab',
    title: 'Insights',
    content: 'The Insights tab shows visualizations of your emotional patterns and themes over time.',
    targetId: 'nav-insights',
    position: 'top',
    route: '/app/smart-chat',
    action: 'navigate',
    actionTarget: '/app/insights',
  },
  {
    id: 'insights-chart',
    title: 'Emotion Chart',
    content: 'This chart shows the frequency of different emotions in your journal entries.',
    targetId: 'emotion-chart',
    position: 'bottom',
    route: '/app/insights',
  },
  {
    id: 'settings-tab',
    title: 'Settings',
    content: 'The Settings tab lets you customize your experience and manage your account.',
    targetId: 'nav-settings',
    position: 'top',
    route: '/app/insights',
    action: 'navigate',
    actionTarget: '/app/settings',
  },
  {
    id: 'language-settings',
    title: 'Language Selection',
    content: 'Change the app language to your preference from over 20 supported languages.',
    targetId: 'language-selector',
    position: 'right',
    route: '/app/settings',
  },
  {
    id: 'tutorial-complete',
    title: 'All Set!',
    content: 'Congratulations! You\'re all set to start your journaling journey. Remember, you can revisit this tutorial anytime from the Settings page.',
    targetId: 'tutorial-complete',
    position: 'center',
    route: '/app/settings',
  },
];

// Define the context type
interface TutorialContextType {
  currentStep: number;
  isActive: boolean;
  isTutorialCompleted: boolean;
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  resetTutorial: () => void;
  currentStepDetails: TutorialStep | null;
  totalSteps: number;
}

// Create the context
const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

// Storage keys
const TUTORIAL_COMPLETED_KEY = 'soulo_tutorial_completed';
const TUTORIAL_CURRENT_STEP_KEY = 'soulo_tutorial_current_step';

// Provider component
export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isTutorialCompleted, setIsTutorialCompleted] = useState<boolean>(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Load tutorial state from localStorage on mount
  useEffect(() => {
    const completedStatus = localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true';
    setIsTutorialCompleted(completedStatus);
    
    const savedStep = localStorage.getItem(TUTORIAL_CURRENT_STEP_KEY);
    if (savedStep) {
      setCurrentStep(parseInt(savedStep, 10));
    }
  }, []);

  // Save tutorial state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(TUTORIAL_COMPLETED_KEY, isTutorialCompleted.toString());
  }, [isTutorialCompleted]);

  useEffect(() => {
    localStorage.setItem(TUTORIAL_CURRENT_STEP_KEY, currentStep.toString());
    
    // If active and current step has an action to navigate
    if (isActive && currentStepDetails?.action === 'navigate') {
      navigate(currentStepDetails.actionTarget || '/app');
    }
  }, [currentStep, isActive]);

  // Check if we should auto-start the tutorial
  useEffect(() => {
    if (
      user && // User must be logged in
      isAppRoute(location.pathname) && // Must be on an app route
      !isTutorialCompleted && // Tutorial not completed
      !isActive && // Tutorial not already active
      location.pathname === '/app' // We're on the main app route
    ) {
      // Auto-start only if this is the first visit after login
      const hasVisitedBefore = localStorage.getItem('soulo_visited_app_before') === 'true';
      if (!hasVisitedBefore) {
        localStorage.setItem('soulo_visited_app_before', 'true');
        // Slight delay to ensure the UI is ready
        setTimeout(() => {
          setIsActive(true);
        }, 1000);
      }
    }
  }, [user, location.pathname, isTutorialCompleted, isActive]);

  // Get details for current step
  const currentStepDetails = isActive && currentStep < tutorialSteps.length 
    ? tutorialSteps[currentStep] 
    : null;

  // Helper to check if the current route matches the required route for a step
  const isOnCorrectRoute = (step: TutorialStep): boolean => {
    if (!step.route) return true;
    return location.pathname === step.route;
  };

  // Auto-advance to a step that matches current route if needed
  useEffect(() => {
    if (isActive && currentStepDetails && !isOnCorrectRoute(currentStepDetails)) {
      // Find the next step that matches the current route
      const nextValidStepIndex = tutorialSteps.findIndex(
        (step, index) => index >= currentStep && isOnCorrectRoute(step)
      );
      
      if (nextValidStepIndex !== -1) {
        setCurrentStep(nextValidStepIndex);
      }
    }
  }, [location.pathname, isActive]);

  // Start the tutorial
  const startTutorial = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  // Move to next step
  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTutorial();
    }
  };

  // Move to previous step
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Skip the tutorial
  const skipTutorial = () => {
    setIsActive(false);
    setIsTutorialCompleted(true);
  };

  // Complete the tutorial
  const completeTutorial = () => {
    setIsActive(false);
    setIsTutorialCompleted(true);
  };

  // Reset the tutorial
  const resetTutorial = () => {
    setCurrentStep(0);
    setIsTutorialCompleted(false);
  };

  return (
    <TutorialContext.Provider
      value={{
        currentStep,
        isActive,
        isTutorialCompleted,
        startTutorial,
        nextStep,
        prevStep,
        skipTutorial,
        completeTutorial,
        resetTutorial,
        currentStepDetails,
        totalSteps: tutorialSteps.length,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

// Custom hook to use the tutorial context
export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};

export default TutorialContext;
