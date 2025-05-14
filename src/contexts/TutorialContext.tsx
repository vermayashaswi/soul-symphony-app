import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAppRoute } from '@/routes/RouteHelpers';

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
  isNavigating: boolean; // New property to track navigation state
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
    alternativeSelectors: [
      '[data-value="record"]',
      '.record-entry-tab',
      'button[data-tutorial-target="record-entry"]',
      '#new-entry-button'
    ],
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
    alternativeSelectors: [
      '.entries-tab',
      'button[data-tutorial-target="past-entries"]',
      '#past-entries-button'
    ],
    position: 'bottom',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/journal',
    waitForElement: true
  }
  // More steps can be added here
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
  const [navigationComplete, setNavigationComplete] = useState(true);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false); // Track navigation state
  
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
        // Made the path check more general to work from any route
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
        
        setTutorialChecked(true);
      } catch (error) {
        console.error('Error in tutorial check:', error);
      }
    };
    
    checkTutorialStatus();
  }, [user, location.pathname, tutorialChecked, navigate]);
  
  // Check tutorial completion status on initial load
  useEffect(() => {
    const checkTutorialCompletionStatus = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('tutorial_completed')
          .eq('id', user.id)
          .single();
          
        if (error) {
          console.error('Error checking tutorial completion status:', error);
          return;
        }
        
        // Set the tutorial completed state based on database value
        setTutorialCompleted(data?.tutorial_completed === 'YES');
        console.log('Tutorial completion status loaded:', data?.tutorial_completed === 'YES');
      } catch (error) {
        console.error('Error checking tutorial completion status:', error);
      }
    };
    
    checkTutorialCompletionStatus();
  }, [user]);
  
  // Enhanced navigation tracking - watch for route changes to update navigation state
  useEffect(() => {
    if (isNavigating) {
      console.log('Navigation in progress, detected route change to:', location.pathname);
      const currentStepData = steps[currentStep];
      
      // Check if we've reached the intended destination
      if (currentStepData && currentStepData.navigateTo === location.pathname) {
        console.log('Reached intended destination:', location.pathname);
        setIsNavigating(false);
        setNavigationComplete(true);
      }
    }
  }, [location.pathname, isNavigating, currentStep, steps]);
  
  // Handle navigation between steps when route changes
  useEffect(() => {
    if (isActive && navigationComplete === false) {
      const currentTutorialStep = steps[currentStep];
      
      // Check if the current URL matches the required URL for the step
      if (currentTutorialStep?.navigateTo && location.pathname === currentTutorialStep.navigateTo) {
        console.log(`Navigation to ${currentTutorialStep.navigateTo} complete for step ${currentTutorialStep.id}`);
        setNavigationComplete(true);
        setIsNavigating(false);
        
        // After navigation, give time for the page to render before looking for elements
        if (currentTutorialStep.waitForElement && currentTutorialStep.targetElement) {
          const checkElement = () => {
            console.log(`Looking for element ${currentTutorialStep.targetElement} for step ${currentTutorialStep.id}`);
            
            // Try the primary selector
            let element = document.querySelector(currentTutorialStep.targetElement!);
            
            // If not found, try alternative selectors if available
            if (!element && currentTutorialStep.alternativeSelectors) {
              for (const selector of currentTutorialStep.alternativeSelectors) {
                element = document.querySelector(selector);
                if (element) {
                  console.log(`Found element using alternative selector: ${selector}`);
                  break;
                }
              }
            }
            
            if (element) {
              console.log(`Element found for step ${currentTutorialStep.id}`);
              
              // Add a special class to ensure this element is visible in step 3
              if (currentTutorialStep.id === 3) {
                element.classList.add('tutorial-target');
                element.classList.add('record-entry-tab');
                console.log('Added special classes to record entry element');
              }
            } else {
              console.warn(`Element not found for step ${currentTutorialStep.id}, retrying...`);
              setTimeout(checkElement, 500);
            }
          };
          
          // Start checking for the element with a small delay to allow rendering
          setTimeout(checkElement, 500);
        }
      }
    }
  }, [isActive, currentStep, steps, location.pathname, navigationComplete]);
  
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
        description: "You can reset it any time in settings."
      });
      console.log('Tutorial marked as completed');
    } catch (error) {
      console.error('Error completing tutorial:', error);
    }
  };
  
  // Move to the next step with enhanced logic to handle any navigation state
  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      const newStep = currentStep + 1;
      const nextTutorialStep = steps[newStep];
      
      console.log(`Moving to tutorial step ${newStep} (ID: ${nextTutorialStep.id})`);
      
      // First update the step in state BEFORE any navigation
      setCurrentStep(newStep);
      updateTutorialStep(newStep);
      
      // Handle navigation if needed
      if (nextTutorialStep.navigateTo && location.pathname !== nextTutorialStep.navigateTo) {
        console.log(`Navigation needed for step ${nextTutorialStep.id} to ${nextTutorialStep.navigateTo}`);
        setNavigationComplete(false);
        setIsNavigating(true);
        
        // Add a small delay before navigation to ensure state updates first
        setTimeout(() => {
          navigate(nextTutorialStep.navigateTo);
        }, 50);
      }
    } else {
      console.log('Completing tutorial - reached the end');
      completeTutorial();
    }
  };
  
  // Enhanced version of prevStep function with improved navigation for moving backwards
  const prevStep = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      const prevTutorialStep = steps[newStep];
      const currentTutorialStep = steps[currentStep];
      
      console.log(`Moving to previous step ${newStep} (ID: ${prevTutorialStep.id})`);
      console.log(`Current location: ${location.pathname}, Current step: ${currentStep}, Target navigation: ${prevTutorialStep.navigateTo || 'none'}`);
      
      // Update the current step in state and database
      setCurrentStep(newStep);
      updateTutorialStep(newStep);
      
      // Enhanced navigation logic for stepping back
      if (prevTutorialStep.navigateTo && location.pathname !== prevTutorialStep.navigateTo) {
        console.log(`Navigating back to ${prevTutorialStep.navigateTo} for previous step ${prevTutorialStep.id}`);
        
        // Critical: Set navigation flags before navigating
        setNavigationComplete(false);
        setIsNavigating(true);
        
        // Special handling for step 3 to step 2 backward navigation
        if (currentTutorialStep.id === 3 && prevTutorialStep.id === 2) {
          console.log('Special handling for step 3 to step 2 backward navigation');
          
          // Explicitly navigate back to home
          navigate('/app/home');
        } else {
          // Regular navigation to the target page for the previous step
          navigate(prevTutorialStep.navigateTo);
        }
      }
    }
  };
  
  // Skip the tutorial entirely
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
      toast({
        title: "Tutorial skipped",
        description: "You can always find help in the settings."
      });
      console.log('Tutorial skipped by user');
    } catch (error) {
      console.error('Error skipping tutorial:', error);
    }
  };
  
  // Function to reset the tutorial - updated to ensure proper navigation and toast timing
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
          variant: "destructive"
        });
        return;
      }
      
      setCurrentStep(0);
      setTutorialChecked(false);
      setTutorialCompleted(false);
      setNavigationComplete(true);
      setIsNavigating(false);
      
      // Only navigate if we're not already on the app home page
      if (location.pathname !== '/app/home') {
        // First navigate to app home - use replace to prevent back navigation
        console.log('Tutorial reset - redirecting to app home');
        
        // Display toast only if we're already on an app route
        // This prevents toast from appearing on website routes
        if (isAppRoute(location.pathname)) {
          toast({
            title: "Tutorial reset successfully!",
            description: "Redirecting to app home page..."
          });
        }
        
        navigate('/app/home', { replace: true });
      } else {
        // If already on /app/home, just show toast and activate tutorial
        toast({
          title: "Tutorial reset successfully!",
          description: "Restart from step 1"
        });
        setIsActive(true);
      }
    } catch (error) {
      console.error('Error resetting tutorial:', error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Provide the context value with the new isNavigating property
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
    isNavigating // Expose the navigation state
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
