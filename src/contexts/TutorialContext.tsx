
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from './TranslationContext';

type TutorialStep = 'welcome' | 'journal' | 'insights' | 'chat' | 'settings' | 'complete';

interface TutorialContextType {
  isActive: boolean;
  currentStep: TutorialStep;
  setCurrentStep: (step: TutorialStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  startTutorial: () => void;
  completeTutorial: () => void;
  skipTutorial: () => void;
  tutorialProgress: number;
  isTutorialCompleted: boolean;
}

const steps: TutorialStep[] = ['welcome', 'journal', 'insights', 'chat', 'settings', 'complete'];

export const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<TutorialStep>('welcome');
  const [isTutorialCompleted, setIsTutorialCompleted] = useState(true);
  const { user } = useAuth();
  const { translate } = useTranslation();

  // Calculate progress percentage
  const tutorialProgress = ((steps.indexOf(currentStep) + 1) / steps.length) * 100;

  // Check if the user needs to see the tutorial
  useEffect(() => {
    const checkTutorialStatus = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('tutorial_completed, tutorial_step')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error checking tutorial status:', error);
          return;
        }

        if (data && data.tutorial_completed === 'NO') {
          setIsTutorialCompleted(false);
          
          // Set current step based on saved progress or default to welcome
          if (data.tutorial_step && data.tutorial_step > 0 && data.tutorial_step < steps.length) {
            setCurrentStep(steps[data.tutorial_step]);
          } else {
            setCurrentStep('welcome');
          }
        } else {
          setIsTutorialCompleted(true);
        }
      } catch (error) {
        console.error('Error in tutorial check:', error);
      }
    };

    checkTutorialStatus();
  }, [user]);

  const updateTutorialStep = async (step: TutorialStep) => {
    if (!user) return;

    try {
      const stepIndex = steps.indexOf(step);
      const { error } = await supabase
        .from('profiles')
        .update({ tutorial_step: stepIndex })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating tutorial step:', error);
      }
    } catch (error) {
      console.error('Error saving tutorial progress:', error);
    }
  };

  const markTutorialComplete = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ tutorial_completed: 'YES', tutorial_step: steps.length - 1 })
        .eq('id', user.id);

      if (error) {
        console.error('Error marking tutorial as complete:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error completing tutorial:', error);
      return false;
    }
  };

  const startTutorial = () => {
    setIsActive(true);
    setCurrentStep('welcome');
  };

  const nextStep = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      setCurrentStep(nextStep);
      updateTutorialStep(nextStep);
    } else {
      completeTutorial();
    }
  };

  const previousStep = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      const prevStep = steps[currentIndex - 1];
      setCurrentStep(prevStep);
      updateTutorialStep(prevStep);
    }
  };

  const completeTutorial = async () => {
    const success = await markTutorialComplete();
    if (success) {
      setIsActive(false);
      setIsTutorialCompleted(true);
      toast.success(await translate("Tutorial completed! You're all set."));
    }
  };

  const skipTutorial = async () => {
    const success = await markTutorialComplete();
    if (success) {
      setIsActive(false);
      setIsTutorialCompleted(true);
      toast.info(await translate("Tutorial skipped. You can restart it anytime from settings."));
    }
  };

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStep,
        setCurrentStep,
        nextStep,
        previousStep,
        startTutorial,
        completeTutorial,
        skipTutorial,
        tutorialProgress,
        isTutorialCompleted
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
