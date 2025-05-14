import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAppRoute } from '@/routes/RouteHelpers';
import { 
  RECORD_ENTRY_SELECTORS, 
  ENTRIES_TAB_SELECTORS,
  findAndHighlightElement,
  logPotentialTutorialElements
} from '@/utils/tutorial/tutorial-elements-finder';

// Define the interface for a tutorial step
export interface TutorialStep {
  id: number;
  title: string;
  content: string;
  targetElement?: string; // Optional CSS selector for the element to highlight
  alternativeSelectors?: string[]; // List of alternative selectors to try if primary fails
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  showNextButton?: boolean;
  showSkipButton?: boolean;
  navigateTo?: string; // Property for navigation
  waitForElement?: boolean; // Whether to wait for the element to be present before proceeding
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
  tutorialCompleted: boolean;
  isInStep: (stepId: number) => boolean;
  navigationState: {
    inProgress: boolean;
    targetRoute: string | null;
  };
}

// Create the context with a default undefined value
const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

// Define the initial tutorial steps with enhanced robustness
const initialTutorialSteps: TutorialStep[] = [
  {
    id: 1,
    title: 'Welcome to Soul Symphony',
    content: 'Let\'s take a quick tour to help you get started with your journaling journey.',
    targetElement: '.journal-header-container', // Target the journal header
    position: 'center',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/home', // Explicit navigation for step 1
  },
  {
    id: 2,
    title: 'Your Journal',
    content: 'Press this central arrow button to start recording a journal entry instantly. This is your daily oxygen to build your emotional repository.',
    targetElement: '.journal-arrow-button',
    position: 'top',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/home', // Explicit navigation for step 2
  },
  {
    id: 3,
    title: 'Multilingual Recording',
    content: 'The New Entry button lets you speak in any language. Our AI understands and transcribes your entries, no matter which language you speak!',
    targetElement: '.tutorial-record-entry-button',
    alternativeSelectors: RECORD_ENTRY_SELECTORS,
    position: 'bottom',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/journal', // Navigate to journal page for this step
    waitForElement: true // Wait for the element to be present before proceeding
  },
  {
    id: 4,
    title: 'Your Journal History',
    content: 'View and explore all your past journal entries here. You can search, filter, and reflect on your emotional journey over time.',
    targetElement: '[value="entries"]', // Target the Past Entries tab
    alternativeSelectors: ENTRIES_TAB_SELECTORS,
    position: 'bottom',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/journal',
    waitForElement: true
  }
];

// Provider component that wraps the app
export const TutorialProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TutorialStep[]>(initialTutorialSteps);
  const [tutorialChecked, setTutorialChecked] = useState(false);
  const [navigationState, setNavigationState] = useState({
    inProgress: false,
    targetRoute: null as string | null
  });
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  
  // Enhanced logging for debugging
  useEffect(() => {
    console.log('TutorialProvider - Current state:', {
      isActive,
      currentStep,
      currentStepID: steps[currentStep]?.id,
      currentPath: location.pathname,
      navigationState
    });
  }, [isActive, currentStep, steps, location.pathname, navigationState]);
  
  // Check if tutorial should be active based on user's profile and current route
  useEffect(() => {
    const checkTutorialStatus = async () => {
      if (!user || tutorialChecked) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('tutorial_completed, tutorial_step')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching tutorial status:', error);
          return;
        }
        
        // Only activate tutorial if tutorial is not completed
        const shouldActivate = data?.tutorial_completed === 'NO';
        
        // Set the current tutorial step (default to 0 if null)
        const startingStep = data?.tutorial_step || 0;
        
        if (shouldActivate) {
          console.log('Activating tutorial at step:', startingStep);
          setCurrentStep(startingStep);
          setIsActive(true);
          
          // If we're not on an app route, navigate to the app home
          if (!isAppRoute(location.pathname)) {
            console.log('Not on app route, will navigate to /app/home');
            navigate('/app/home');
          }
        }
        
        setTutorialCompleted(data?.tutorial_completed === 'YES');
        setTutorialChecked(true);
      } catch (error) {
        console.error('Error in tutorial check:', error);
      }
    };
    
    checkTutorialStatus();
  }, [user, location.pathname, tutorialChecked, navigate]);
  
  // Enhanced route change detection for navigation between steps
  useEffect(() => {
    if (navigationState.inProgress && navigationState.targetRoute === location.pathname) {
      console.log(`Navigation complete: arrived at ${location.pathname}`);
      setNavigationState({
        inProgress: false,
        targetRoute: null
      });
      
      // After navigation completes, check for elements that need to be highlighted
      const currentStepData = steps[currentStep];
      if (currentStepData && currentStepData.waitForElement) {
        console.log(`Step ${currentStepData.id} is waiting for element: ${currentStepData.targetElement}`);
        
        // Wait for the DOM to be ready after navigation
        setTimeout(() => {
          checkForTargetElement(currentStepData);
        }, 500);
      }
    }
  }, [location.pathname, navigationState.inProgress, navigationState.targetRoute]);
  
  // Helper function to check for target elements and apply highlighting
  const checkForTargetElement = (stepData: TutorialStep) => {
    const selectors = [
      stepData.targetElement,
      ...(stepData.alternativeSelectors || [])
    ].filter(Boolean) as string[];
    
    // Log potential elements in the DOM to help with debugging
    if (stepData.id === 3 || stepData.id === 4) {
      logPotentialTutorialElements();
    }
    
    // Attempt to find and highlight the element
    const found = findAndHighlightElement(
      selectors, 
      stepData.id === 3 ? 'record-entry-tab' : 
      stepData.id === 4 ? 'entries-tab' : ''
    );
    
    if (!found) {
      console.warn(`Could not find any target element for step ${stepData.id}`);
    }
  };
  
  // Function to update the tutorial step in the database
  const updateTutorialStep = async (step: number) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ tutorial_step: step })
        .eq('id', user.id);
        
      if (error) {
        console.error('Error updating tutorial step:', error);
      } else {
        console.log('Tutorial step updated in database:', step);
      }
    } catch (error) {
      console.error('Error updating tutorial step:', error);
    }
  };
  
  // Function to mark tutorial as completed
  const completeTutorial = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          tutorial_completed: 'YES',
          tutorial_step: steps.length
        })
        .eq('id', user.id);
        
      if (error) {
        console.error('Error completing tutorial:', error);
        return;
      }
      
      setIsActive(false);
      setTutorialCompleted(true);
      toast({
        title: "Tutorial completed!",
        description: "You can reset it any time in settings.",
        duration: 500 // Changed from default to 500ms (0.5 seconds)
      });
      console.log('Tutorial marked as completed');
      
      // Clean up any lingering tutorial classes
      document.body.classList.remove('tutorial-active');
      const targetElements = document.querySelectorAll('.tutorial-target, .tutorial-button-highlight, .record-entry-tab, .entries-tab');
      targetElements.forEach(el => {
        el.classList.remove('tutorial-target', 'tutorial-button-highlight', 'record-entry-tab', 'entries-tab');
        
        // Also clear any inline styles
        if (el instanceof HTMLElement) {
          el.style.boxShadow = '';
          el.style.animation = '';
          el.style.border = '';
          el.style.transform = '';
          el.style.zIndex = '';
        }
      });
    } catch (error) {
      console.error('Error completing tutorial:', error);
    }
  };
  
  // Enhanced next step function with improved navigation handling
  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      const newStep = currentStep + 1;
      const nextStepData = steps[newStep];
      
      console.log(`Moving to tutorial step ${newStep} (ID: ${nextStepData.id})`);
      
      // First update the current step in state and database
      setCurrentStep(newStep);
      updateTutorialStep(newStep);
      
      // Clean up any existing highlight classes
      const targetElements = document.querySelectorAll('.tutorial-target, .tutorial-button-highlight, .record-entry-tab, .entries-tab');
      targetElements.forEach(el => {
        el.classList.remove('tutorial-target', 'tutorial-button-highlight', 'record-entry-tab', 'entries-tab');
        
        // Also clear any inline styles
        if (el instanceof HTMLElement) {
          el.style.boxShadow = '';
          el.style.animation = '';
          el.style.border = '';
          el.style.transform = '';
          el.style.zIndex = '';
        }
      });
      
      // Handle navigation if needed
      if (nextStepData.navigateTo && location.pathname !== nextStepData.navigateTo) {
        console.log(`Navigation needed for step ${nextStepData.id} to ${nextStepData.navigateTo}`);
        
        setNavigationState({
          inProgress: true,
          targetRoute: nextStepData.navigateTo
        });
        
        // Navigate to the target page
        navigate(nextStepData.navigateTo);
      } else {
        // If we're already on the right page, immediately check for elements to highlight
        if (nextStepData.waitForElement) {
          setTimeout(() => {
            checkForTargetElement(nextStepData);
          }, 200);
        }
      }
    } else {
      // Last step, complete the tutorial
      console.log('Completing tutorial - reached the end');
      completeTutorial();
    }
  };
  
  // Enhanced prev step function with improved navigation handling
  const prevStep = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      const prevStepData = steps[newStep];
      
      console.log(`Moving to previous step ${newStep} (ID: ${prevStepData.id})`);
      
      // First update the current step in state and database
      setCurrentStep(newStep);
      updateTutorialStep(newStep);
      
      // Clean up any existing highlight classes
      const targetElements = document.querySelectorAll('.tutorial-target, .tutorial-button-highlight, .record-entry-tab, .entries-tab');
      targetElements.forEach(el => {
        el.classList.remove('tutorial-target', 'tutorial-button-highlight', 'record-entry-tab', 'entries-tab');
        
        // Also clear any inline styles
        if (el instanceof HTMLElement) {
          el.style.boxShadow = '';
          el.style.animation = '';
          el.style.border = '';
          el.style.transform = '';
          el.style.zIndex = '';
        }
      });
      
      // Handle navigation if needed
      if (prevStepData.navigateTo && location.pathname !== prevStepData.navigateTo) {
        console.log(`Navigation needed for step ${prevStepData.id} to ${prevStepData.navigateTo}`);
        
        setNavigationState({
          inProgress: true,
          targetRoute: prevStepData.navigateTo
        });
        
        // Navigate to the target page
        navigate(prevStepData.navigateTo);
      } else {
        // If we're already on the right page, immediately check for elements to highlight
        if (prevStepData.waitForElement) {
          setTimeout(() => {
            checkForTargetElement(prevStepData);
          }, 200);
        }
      }
    }
  };
  
  // Enhanced skip tutorial function
  const skipTutorial = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ tutorial_completed: 'YES' })
        .eq('id', user.id);
        
      if (error) {
        console.error('Error skipping tutorial:', error);
        return;
      }
      
      setIsActive(false);
      setTutorialCompleted(true);
      toast({
        title: "Tutorial skipped",
        description: "You can always find help in the settings.",
        duration: 500 // Changed from default to 500ms (0.5 seconds)
      });
      
      // Clean up any lingering tutorial classes
      document.body.classList.remove('tutorial-active');
      const targetElements = document.querySelectorAll('.tutorial-target, .tutorial-button-highlight, .record-entry-tab, .entries-tab');
      targetElements.forEach(el => {
        el.classList.remove('tutorial-target', 'tutorial-button-highlight', 'record-entry-tab', 'entries-tab');
        
        // Also clear any inline styles
        if (el instanceof HTMLElement) {
          el.style.boxShadow = '';
          el.style.animation = '';
          el.style.border = '';
          el.style.transform = '';
          el.style.zIndex = '';
        }
      });
      
      console.log('Tutorial skipped by user');
    } catch (error) {
      console.error('Error skipping tutorial:', error);
    }
  };
  
  // Enhanced reset tutorial function
  const resetTutorial = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          tutorial_completed: 'NO',
          tutorial_step: 0
        })
        .eq('id', user.id);
        
      if (error) {
        console.error('Error resetting tutorial:', error);
        toast({
          title: "Error",
          description: "Failed to reset tutorial. Please try again.",
          variant: "destructive",
          duration: 500 // Changed from default to 500ms (0.5 seconds)
        });
        return;
      }
      
      setCurrentStep(0);
      setTutorialChecked(false);
      setTutorialCompleted(false);
      setNavigationState({
        inProgress: false,
        targetRoute: null
      });
      
      // Only navigate if we're not already on the app home page
      if (location.pathname !== '/app/home') {
        // First navigate to app home - use replace to prevent back navigation
        console.log('Tutorial reset - redirecting to app home');
        
        // Display toast only if we're already on an app route
        // This prevents toast from appearing on website routes
        if (isAppRoute(location.pathname)) {
          toast({
            title: "Tutorial reset successfully!",
            description: "Redirecting to app home page...",
            duration: 500 // Changed from default to 500ms (0.5 seconds)
          });
        }
        
        navigate('/app/home', { replace: true });
      } else {
        // If already on /app/home, just show toast and activate tutorial
        toast({
          title: "Tutorial reset successfully!",
          description: "Restart from step 1",
          duration: 500 // Changed from default to 500ms (0.5 seconds)
        });
        setIsActive(true);
      }
    } catch (error) {
      console.error('Error resetting tutorial:', error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
        duration: 500 // Changed from default to 500ms (0.5 seconds)
      });
    }
  };
  
  // Provide the context value with the updated navigationState property
  const contextValue: TutorialContextType = {
    isActive,
    currentStep,
    totalSteps: steps.length,
    steps,
    nextStep,
    prevStep,
    skipTutorial,
    completeTutorial,
    resetTutorial,
    tutorialCompleted,
    isInStep: (stepId: number) => isActive && steps[currentStep]?.id === stepId,
    navigationState
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
