
import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
import { useTutorialState } from '@/hooks/useTutorialState';
import { useTutorialNavigation } from '@/hooks/useTutorialNavigation';
import { InfographicType } from '@/components/tutorial/TutorialInfographic';

// Define the interface for a tutorial step
export interface TutorialStep {
  id: number;
  title: string;
  content: string;
  targetElement?: string;
  alternativeSelectors?: string[];
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  showNextButton?: boolean;
  showSkipButton?: boolean;
  navigateTo?: string;
  waitForElement?: boolean;
  infographicType?: InfographicType;
}

// Define the interface for the tutorial context
interface TutorialContextType {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  steps: TutorialStep[];
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  resetTutorial: () => void;
  startTutorial: () => void;
  tutorialCompleted: boolean;
  isInStep: (stepId: number) => boolean;
  navigationState: {
    inProgress: boolean;
    targetRoute: string | null;
  };
}

// Create the context
const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

// Define tutorial steps
const initialTutorialSteps: TutorialStep[] = [
  {
    id: 1,
    title: 'Welcome to Soul Symphony',
    content: 'Let\'s take a quick tour to help you get started with your journaling journey.',
    targetElement: '.journal-header-container',
    position: 'center',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/home',
  },
  {
    id: 2,
    title: 'Your Journal',
    content: 'Press this central arrow button to start recording a journal entry instantly.',
    targetElement: '.journal-arrow-button',
    position: 'top',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/home',
  },
  {
    id: 3,
    title: 'Multilingual Recording',
    content: 'The New Entry button lets you speak in any language.',
    targetElement: '.tutorial-record-entry-button',
    position: 'bottom',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/journal',
    waitForElement: true
  }
];

// Provider component
export const TutorialProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const tutorialState = useTutorialState();
  const tutorialNavigation = useTutorialNavigation();

  const updateTutorialStep = async (step: number) => {
    if (!user) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ tutorial_step: step })
        .eq('id', user.id);
    } catch (error) {
      console.error('[TutorialContext] Error updating tutorial step:', error);
    }
  };

  const startTutorial = () => {
    console.log('[TutorialContext] Starting tutorial manually');
    tutorialState.setCurrentStep(0);
    tutorialState.setTutorialCompleted(false);
    tutorialState.setIsActive(true);
    tutorialNavigation.navigateToRoute('/app/home');
  };

  const nextStep = () => {
    if (tutorialState.currentStep < initialTutorialSteps.length - 1) {
      const newStep = tutorialState.currentStep + 1;
      const nextStepData = initialTutorialSteps[newStep];
      
      tutorialState.setCurrentStep(newStep);
      updateTutorialStep(newStep);
      
      if (nextStepData.navigateTo && location.pathname !== nextStepData.navigateTo) {
        tutorialNavigation.navigateToRoute(nextStepData.navigateTo);
      }
    } else {
      completeTutorial();
    }
  };

  const prevStep = () => {
    if (tutorialState.currentStep > 0) {
      const newStep = tutorialState.currentStep - 1;
      const prevStepData = initialTutorialSteps[newStep];
      
      tutorialState.setCurrentStep(newStep);
      updateTutorialStep(newStep);
      
      if (prevStepData.navigateTo && location.pathname !== prevStepData.navigateTo) {
        tutorialNavigation.navigateToRoute(prevStepData.navigateTo);
      }
    }
  };

  const skipTutorial = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ tutorial_completed: 'YES' })
        .eq('id', user.id);
        
      tutorialState.setIsActive(false);
      tutorialState.setTutorialCompleted(true);
      tutorialNavigation.navigateToRoute('/app/home');
    } catch (error) {
      console.error('[TutorialContext] Error skipping tutorial:', error);
    }
  };

  const completeTutorial = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ 
          tutorial_completed: 'YES',
          tutorial_step: initialTutorialSteps.length
        })
        .eq('id', user.id);
        
      tutorialState.setIsActive(false);
      tutorialState.setTutorialCompleted(true);
      tutorialNavigation.navigateToRoute('/app/home');
    } catch (error) {
      console.error('[TutorialContext] Error completing tutorial:', error);
    }
  };

  const resetTutorial = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ 
          tutorial_completed: 'NO',
          tutorial_step: 0
        })
        .eq('id', user.id);
        
      tutorialState.setCurrentStep(0);
      tutorialState.setTutorialChecked(false);
      tutorialState.setTutorialCompleted(false);
      tutorialNavigation.clearNavigation();
      tutorialNavigation.navigateToRoute('/app/home');
    } catch (error) {
      console.error('[TutorialContext] Error resetting tutorial:', error);
    }
  };

  // Handle navigation completion
  useEffect(() => {
    if (tutorialNavigation.navigationState.inProgress && 
        tutorialNavigation.navigationState.targetRoute === location.pathname) {
      console.log(`[TutorialContext] Navigation complete: arrived at ${location.pathname}`);
      tutorialNavigation.clearNavigation();
    }
  }, [location.pathname, tutorialNavigation.navigationState]);
  
  const contextValue: TutorialContextType = {
    isActive: tutorialState.isActive,
    currentStep: tutorialState.currentStep,
    totalSteps: initialTutorialSteps.length,
    steps: initialTutorialSteps,
    nextStep,
    prevStep,
    skipTutorial,
    completeTutorial,
    resetTutorial,
    startTutorial,
    tutorialCompleted: tutorialState.tutorialCompleted,
    isInStep: (stepId: number) => tutorialState.isActive && initialTutorialSteps[tutorialState.currentStep]?.id === stepId,
    navigationState: tutorialNavigation.navigationState
  };
  
  return (
    <TutorialContext.Provider value={contextValue}>
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
