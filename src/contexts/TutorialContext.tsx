
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from './TranslationContext';
import { useNavigate } from 'react-router-dom';

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
  tutorialTarget: string;
  targetPosition: string;
  createSampleEntry: () => Promise<void>;
  sampleEntryCreated: boolean;
  isNavigating: boolean; // New loading state
}

const steps: TutorialStep[] = ['welcome', 'journal', 'insights', 'chat', 'settings', 'complete'];

// Define target elements for each step with precise positioning
const stepTargets: Record<TutorialStep, { target: string; position: string }> = {
  welcome: { target: 'full-screen', position: 'center' },
  journal: { target: 'microphone-button', position: 'bottom' },
  insights: { target: 'insights-button', position: 'bottom' },
  chat: { target: 'chat-button', position: 'bottom' },
  settings: { target: 'settings-button', position: 'bottom' },
  complete: { target: 'full-screen', position: 'center' }
};

export const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<TutorialStep>('welcome');
  const [isTutorialCompleted, setIsTutorialCompleted] = useState(true);
  const [sampleEntryCreated, setSampleEntryCreated] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false); // New loading state
  const { user } = useAuth();
  const { translate } = useTranslation();
  const navigate = useNavigate();
  const sampleEntryRef = useRef<number | null>(null);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get target and position for current step
  const tutorialTarget = stepTargets[currentStep]?.target || 'full-screen';
  const targetPosition = stepTargets[currentStep]?.position || 'center';

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
          
          // Once we determine the tutorial isn't completed, activate it
          setIsActive(true);
        } else {
          setIsTutorialCompleted(true);
        }
      } catch (error) {
        console.error('Error in tutorial check:', error);
      }
    };

    checkTutorialStatus();
  }, [user]);

  // Create a sample journal entry for the tutorial
  const createSampleEntry = async () => {
    if (!user) return;
    if (sampleEntryCreated) return;

    try {
      console.log('Creating sample journal entry for tutorial');
      const sampleText = "I have just started my SOULo voice journaling journey. I am extremely excited in various ways this will help me be more aware about my emotions and well-being. I wish to constantly explore all areas of my life and talk about it.";
      
      const { data, error } = await supabase
        .from('Journal Entries')
        .insert([{
          user_id: user.id,
          "refined text": sampleText,
          "transcription text": sampleText,
          content: sampleText,
          sentiment: "positive",
          emotions: { "excitement": 0.8, "happiness": 0.7, "curiosity": 0.6 },
          master_themes: ["journaling", "emotions", "well-being", "self-awareness"],
          created_at: new Date().toISOString(),
          Edit_Status: 0,
          duration: 30,
          is_tutorial_entry: true  // Flag to mark this as a special tutorial entry
        }])
        .select('id')
        .single();
      
      if (error) {
        console.error('Error creating sample journal entry:', error);
        return;
      }
      
      if (data) {
        sampleEntryRef.current = data.id;
        console.log('Created sample journal entry with ID:', data.id);
        setSampleEntryCreated(true);
      }
    } catch (error) {
      console.error('Error creating sample entry:', error);
    }
  };

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
    navigate('/app');
  };
  
  // Handle proper navigation with timing
  const navigateToStep = (step: TutorialStep) => {
    // Clear any existing timeouts
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    
    // Set navigating state to true
    setIsNavigating(true);
    
    // Prepare navigation based on the step
    let route = '/app';
    switch (step) {
      case 'journal':
        route = '/app/journal';
        break;
      case 'insights':
        route = '/app/insights';
        break;
      case 'chat':
        route = '/app/chat';
        break;
      case 'settings':
        route = '/app/settings';
        break;
      case 'welcome':
      case 'complete':
        route = '/app';
        break;
    }
    
    console.log(`Navigating to ${route} for tutorial step: ${step}`);
    
    // Introduce slight delay to ensure smooth transitions
    navigationTimeoutRef.current = setTimeout(() => {
      navigate(route);
      
      // Short delay before clearing navigation state to allow page to render
      navigationTimeoutRef.current = setTimeout(() => {
        setIsNavigating(false);
        
        // Add extra delay for journal step to ensure UI loads properly
        if (step === 'journal') {
          // Create sample entry when reaching the journal step
          createSampleEntry();
          
          // Additional time for microphone button to be visible
          navigationTimeoutRef.current = setTimeout(() => {
            console.log('Checking for microphone button presence');
            const micButton = document.querySelector('[data-tutorial="microphone-button"]');
            if (!micButton) {
              // Retry targeting
              const fallbackSelectors = [
                '.voice-recorder-button',
                '.recording-button-container button',
                '.VoiceRecorder button',
                '[aria-label="Record"]'
              ];
              
              for (const selector of fallbackSelectors) {
                const button = document.querySelector(selector);
                if (button) {
                  button.setAttribute('data-tutorial', 'microphone-button');
                  console.log('Found and tagged microphone button with fallback selector');
                  break;
                }
              }
            }
          }, 500);
        }
      }, 500);
    }, 300);
  };

  const nextStep = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      setCurrentStep(nextStep);
      updateTutorialStep(nextStep);
      
      // Navigate to the appropriate page based on the step
      navigateToStep(nextStep);
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
      
      // Navigate back to the appropriate page
      navigateToStep(prevStep);
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
  
  // Clean up navigation timeouts on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

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
        isTutorialCompleted,
        tutorialTarget,
        targetPosition,
        createSampleEntry,
        sampleEntryCreated,
        isNavigating
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
