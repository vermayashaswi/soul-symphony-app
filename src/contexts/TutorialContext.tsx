
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type TutorialStep = {
  id: number;
  title: string;
  description: string;
  targetPath: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
};

interface TutorialContextType {
  isActive: boolean;
  currentStep: number;
  tutorialSteps: TutorialStep[];
  startTutorial: () => void;
  nextStep: () => void;
  previousStep: () => void;
  completeTutorial: () => void;
  skipTutorial: () => void;
  isTutorialChecked: boolean;
  isLoadingTutorial: boolean;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 1,
    title: "Welcome to Soul Symphony",
    description: "Let's take a quick tour of the app to help you understand how it can support your emotional journey. We'll explore key features to get you started.",
    targetPath: "/app/home",
    position: "center"
  },
  {
    id: 2,
    title: "Your Journal",
    description: "Record your thoughts and feelings by speaking or typing. We'll analyze them to provide insights about your emotional patterns and themes.",
    targetPath: "/app/journal",
    targetSelector: ".recording-button-container",
    position: "bottom"
  },
  {
    id: 3,
    title: "Insights Overview",
    description: "Your Insights page shows patterns in your emotional journey. Let's explore how it helps you understand your feelings better.",
    targetPath: "/app/insights",
    targetSelector: ".insights-page-content",
    position: "top"
  },
  {
    id: 4,
    title: "Time Range Selection",
    description: "Change the time range to see your emotional patterns over different periods - day, week, month, or year.",
    targetPath: "/app/insights",
    targetSelector: ".insights-time-toggle",
    position: "bottom"
  },
  {
    id: 5,
    title: "Emotional Summary Cards",
    description: "These cards show your dominant mood, biggest emotional changes, and journal activity for the selected time period.",
    targetPath: "/app/insights",
    targetSelector: ".grid-cols-1",
    position: "right"
  },
  {
    id: 6,
    title: "Emotion Chart",
    description: "This chart visualizes your emotional patterns over time. Click on any emotion to see when and how often it appears in your journal.",
    targetPath: "/app/insights",
    targetSelector: ".recharts-responsive-container",
    position: "top"
  },
  {
    id: 7,
    title: "Mood Calendar",
    description: "The calendar shows your overall mood for each day, helping you identify patterns and trends in your emotional wellbeing.",
    targetPath: "/app/insights",
    targetSelector: ".mood-calendar-container",
    position: "top"
  },
  {
    id: 8,
    title: "Smart Chat",
    description: "Chat with Ruh, your AI companion who can help you understand your emotions and journal entries. Ask questions about your mood patterns or journal content.",
    targetPath: "/app/smart-chat",
    targetSelector: ".smart-chat-container",
    position: "bottom"
  },
  {
    id: 9,
    title: "All Set!",
    description: "You're all set to start your journey with Soul Symphony. Record your first journal entry to begin tracking your emotional wellbeing.",
    targetPath: "/app/home",
    position: "center"
  }
];

const TutorialContext = createContext<TutorialContextType>({
  isActive: false,
  currentStep: 0,
  tutorialSteps,
  startTutorial: () => {},
  nextStep: () => {},
  previousStep: () => {},
  completeTutorial: () => {},
  skipTutorial: () => {},
  isTutorialChecked: false,
  isLoadingTutorial: true
});

export const useTutorial = () => useContext(TutorialContext);

export const TutorialProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isTutorialChecked, setIsTutorialChecked] = useState(false);
  const [isLoadingTutorial, setIsLoadingTutorial] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if the tutorial should be shown when component mounts
  useEffect(() => {
    const checkTutorialStatus = async () => {
      if (!user) {
        setIsLoadingTutorial(false);
        return;
      }

      try {
        setIsLoadingTutorial(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('tutorial_completed, tutorial_step')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error checking tutorial status:', error);
          setIsLoadingTutorial(false);
          return;
        }

        const shouldShowTutorial = data.tutorial_completed === 'NO';
        let startingStep = data.tutorial_step || 0;
        
        // Don't show tutorial during onboarding
        const isOnboardingRoute = location.pathname === '/app' || location.pathname === '/app/onboarding';
        
        if (isOnboardingRoute) {
          setIsActive(false);
          setIsLoadingTutorial(false);
          return;
        }
        
        // If we have a step saved but tutorial is marked as completed, reset to step 0
        if (!shouldShowTutorial && startingStep > 0) {
          startingStep = 0;
          
          // Update the stored step to 0
          await supabase
            .from('profiles')
            .update({ tutorial_step: 0 })
            .eq('id', user.id);
        }
        
        setCurrentStep(startingStep);
        
        // Only auto-start if tutorial is not completed
        if (shouldShowTutorial) {
          setIsActive(true);
          
          // If we have a saved step, navigate to the correct path
          if (startingStep > 0 && startingStep <= tutorialSteps.length) {
            const targetPath = tutorialSteps[startingStep - 1].targetPath;
            if (location.pathname !== targetPath) {
              navigate(targetPath);
            }
          }
        }
        
        setIsTutorialChecked(true);
      } catch (err) {
        console.error('Error in tutorial check:', err);
      } finally {
        setIsLoadingTutorial(false);
      }
    };

    checkTutorialStatus();
  }, [user, navigate, location.pathname]);

  // Update the database when the current step changes
  useEffect(() => {
    const updateTutorialStep = async () => {
      if (!user || !isActive) return;
      
      try {
        await supabase
          .from('profiles')
          .update({ tutorial_step: currentStep })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error updating tutorial step:', error);
      }
    };

    updateTutorialStep();
  }, [currentStep, isActive, user]);

  // Start the tutorial
  const startTutorial = () => {
    setIsActive(true);
    setCurrentStep(1);
    
    // Navigate to the first step's target path
    const firstStepPath = tutorialSteps[0].targetPath;
    if (location.pathname !== firstStepPath) {
      navigate(firstStepPath);
    }
  };

  // Move to the next step
  const nextStep = () => {
    if (currentStep < tutorialSteps.length) {
      const nextStepIndex = currentStep + 1;
      setCurrentStep(nextStepIndex);
      
      // Navigate to the next step's path if it's different
      const nextPath = tutorialSteps[nextStepIndex - 1].targetPath;
      if (location.pathname !== nextPath) {
        navigate(nextPath);
      }
    } else {
      completeTutorial();
    }
  };

  // Move to the previous step
  const previousStep = () => {
    if (currentStep > 1) {
      const prevStepIndex = currentStep - 1;
      setCurrentStep(prevStepIndex);
      
      // Navigate to the previous step's path if it's different
      const prevPath = tutorialSteps[prevStepIndex - 1].targetPath;
      if (location.pathname !== prevPath) {
        navigate(prevPath);
      }
    }
  };

  // Complete the tutorial
  const completeTutorial = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ 
          tutorial_completed: 'YES',
          tutorial_step: 0
        })
        .eq('id', user.id);
      
      setIsActive(false);
      setCurrentStep(0);
      toast.success("Tutorial completed! Welcome to Soul Symphony.");
    } catch (error) {
      console.error('Error completing tutorial:', error);
    }
  };

  // Skip the tutorial
  const skipTutorial = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ 
          tutorial_completed: 'YES',
          tutorial_step: 0
        })
        .eq('id', user.id);
      
      setIsActive(false);
      setCurrentStep(0);
      toast.info("Tutorial skipped. You can restart it from Settings anytime.");
    } catch (error) {
      console.error('Error skipping tutorial:', error);
    }
  };

  return (
    <TutorialContext.Provider 
      value={{ 
        isActive, 
        currentStep, 
        tutorialSteps, 
        startTutorial,
        nextStep,
        previousStep,
        completeTutorial,
        skipTutorial,
        isTutorialChecked,
        isLoadingTutorial
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

export default TutorialContext;
