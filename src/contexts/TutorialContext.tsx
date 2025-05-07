
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface TutorialContextProps {
  isTutorialActive: boolean;
  currentStep: number;
  totalSteps: number;
  completeTutorial: () => Promise<void>;
  skipTutorial: () => Promise<void>;
  nextStep: () => Promise<void>;
  previousStep: () => Promise<void>;
  goToStep: (step: number) => Promise<void>;
  resetTutorial: () => Promise<void>;
}

const TutorialContext = createContext<TutorialContextProps | undefined>(undefined);

export const tutorialSteps = [
  {
    target: "[data-tutorial='home-journal-button']",
    title: "Your Journal",
    content: "This is your personal journal. Tap here to start adding entries or view your existing ones.",
    placement: "bottom"
  },
  {
    target: "[data-tutorial='main-navigation']",
    title: "Navigation",
    content: "Use these icons to navigate through different sections of your Soul Symphony experience.",
    placement: "top"
  },
  {
    target: "[data-tutorial='journal-button']",
    title: "Journal",
    content: "Record your thoughts, feelings, and daily experiences here.",
    placement: "top"
  },
  {
    target: "[data-tutorial='chat-button']",
    title: "Smart Chat",
    content: "Have meaningful conversations with Ruh, your AI companion who understands your journal.",
    placement: "top"
  },
  {
    target: "[data-tutorial='insights-button']",
    title: "Insights",
    content: "Discover patterns in your emotions and experiences through visualizations.",
    placement: "top"
  },
  {
    target: "[data-tutorial='settings-button']",
    title: "Settings",
    content: "Customize your experience and manage your account settings.",
    placement: "top"
  },
  {
    target: "[data-tutorial='quote-section']",
    title: "Daily Inspiration",
    content: "Find a new inspirational quote here every day to motivate and inspire you.",
    placement: "top"
  }
];

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = tutorialSteps.length;
  const [isInitialized, setIsInitialized] = useState(false);

  // Load tutorial state from the database when the component mounts
  useEffect(() => {
    if (!user) return;
    
    const loadTutorialState = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('tutorial_completed, tutorial_step')
          .eq('id', user.id)
          .single();
          
        if (error) throw error;
        
        if (data) {
          const shouldActivateTutorial = data.tutorial_completed === 'NO';
          setCurrentStep(data.tutorial_step || 0);
          
          // Only auto-start tutorial if we're on the home page
          if (shouldActivateTutorial && window.location.pathname === '/app/home' && !isInitialized) {
            console.log('Auto-starting tutorial for new user');
            setIsTutorialActive(true);
            
            // Show welcome toast
            toast.info('Welcome to Soul Symphony! Let\'s take a quick tour.', {
              duration: 4000,
            });
          }
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Error loading tutorial state:', error);
      }
    };
    
    loadTutorialState();
  }, [user, isInitialized]);

  // Update tutorial state in the database
  const updateTutorialState = async (completed: string, step: number) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          tutorial_completed: completed,
          tutorial_step: step
        })
        .eq('id', user.id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error updating tutorial state:', error);
    }
  };

  const nextStep = async () => {
    if (currentStep < totalSteps - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      await updateTutorialState('NO', newStep);
    } else {
      await completeTutorial();
    }
  };

  const previousStep = async () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      await updateTutorialState('NO', newStep);
    }
  };

  const goToStep = async (step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
      await updateTutorialState('NO', step);
    }
  };

  const completeTutorial = async () => {
    setIsTutorialActive(false);
    await updateTutorialState('YES', currentStep);
    toast.success('Tutorial completed! Enjoy Soul Symphony.', {
      duration: 3000,
    });
  };

  const skipTutorial = async () => {
    setIsTutorialActive(false);
    await updateTutorialState('SKIPPED', currentStep);
    toast.info('Tutorial skipped. You can restart it from Settings anytime.', {
      duration: 3000,
    });
  };

  const resetTutorial = async () => {
    setCurrentStep(0);
    setIsTutorialActive(true);
    await updateTutorialState('NO', 0);
    toast.info('Tutorial restarted!', {
      duration: 2000,
    });
  };

  return (
    <TutorialContext.Provider
      value={{
        isTutorialActive,
        currentStep,
        totalSteps,
        completeTutorial,
        skipTutorial,
        nextStep,
        previousStep,
        goToStep,
        resetTutorial
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
