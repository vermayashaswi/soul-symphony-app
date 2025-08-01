import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAppRoute } from '@/routes/RouteHelpers';
import { 
  RECORD_ENTRY_SELECTORS, 
  ENTRIES_TAB_SELECTORS,
  CHAT_QUESTION_SELECTORS,
  INSIGHTS_HEADER_SELECTORS,
  EMOTION_CHART_SELECTORS,
  MOOD_CALENDAR_SELECTORS,
  findAndHighlightElement,
  logPotentialTutorialElements
} from '@/utils/tutorial/tutorial-elements-finder';
import { performComprehensiveCleanup, performStaggeredCleanup, performNavigationCleanup } from '@/utils/tutorial/tutorial-cleanup-enhanced';
import { navigationManager } from '@/utils/tutorial/navigation-state-manager';
import { highlightingManager } from '@/utils/tutorial/tutorial-highlighting-manager';
import { InfographicType } from '@/components/tutorial/TutorialInfographic';

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
  infographicType?: InfographicType; // Type of infographic to show in tutorial step
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
  isInitialized: boolean; // NEW: Track initialization state
}

// Create the context with a default undefined value
const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

// Define the initial tutorial steps with enhanced robustness and custom infographics
const initialTutorialSteps: TutorialStep[] = [
  {
    id: 1,
    title: 'Welcome to SOuLO',
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
    content: 'Speak in any language you feel comfortable with. Our AI understands and transcribes your entries, no matter which language you speak!',
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
  },
  {
    id: 5,
    title: 'Chat with Your Journal',
    content: 'Ask questions about your journal entries and track your wellbeing across all areas of life. Our AI can analyze patterns and provide insights from your emotional journey.',
    targetElement: '.chat-suggestion-button',
    alternativeSelectors: CHAT_QUESTION_SELECTORS,
    position: 'top',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/chat',
    waitForElement: true
  },
  // Enhanced steps 6-9 with refined content and custom infographics
  {
    id: 6,
    title: 'Your Emotional Insights',
    content: 'Here you\'ll find visual representations of your emotional journey and patterns over time.',
    targetElement: '.insights-container h1',
    alternativeSelectors: INSIGHTS_HEADER_SELECTORS,
    position: 'bottom',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/insights',
    waitForElement: true,
    infographicType: 'insights-overview'
  },
  {
    id: 7,
    title: 'Emotion Trends',
    content: 'See which emotions appear most frequently in your journal and how they change over time.',
    targetElement: '.recharts-responsive-container',
    alternativeSelectors: EMOTION_CHART_SELECTORS,
    position: 'top',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/insights',
    waitForElement: true,
    infographicType: 'emotion-trends'
  },
  {
    id: 8,
    title: 'Mood Calendar',
    content: 'Visualize your daily sentiment changes and spot patterns in how your mood fluctuates throughout weeks and months.',
    targetElement: '[class*="MoodCalendar"]',
    alternativeSelectors: MOOD_CALENDAR_SELECTORS,
    position: 'top',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/insights',
    waitForElement: true,
    infographicType: 'mood-calendar'
  },
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
  const [pendingTutorialStart, setPendingTutorialStart] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false); // NEW: Track initialization
  
  // Enhanced logging for debugging
  useEffect(() => {
    console.log('[TutorialContext] Current state:', {
      isActive,
      currentStep,
      currentStepID: steps[currentStep]?.id,
      currentPath: location.pathname,
      navigationState,
      pendingTutorialStart,
      tutorialChecked,
      isInitialized, // NEW: Log initialization state
      navigationManagerState: navigationManager.getState(),
      highlightingManagerState: highlightingManager.getState()
    });
  }, [isActive, currentStep, steps, location.pathname, navigationState, pendingTutorialStart, tutorialChecked, isInitialized]);
  
  // NEW: Initialize the tutorial system
  useEffect(() => {
    console.log('[TutorialContext] Initializing tutorial system');
    
    // Mark as initialized after a brief delay to ensure all dependencies are ready
    const initTimeout = setTimeout(() => {
      setIsInitialized(true);
      console.log('[TutorialContext] Tutorial system initialized');
    }, 100);
    
    return () => {
      clearTimeout(initTimeout);
    };
  }, []);
  
  // Subscribe to navigation manager state changes
  useEffect(() => {
    const unsubscribe = navigationManager.subscribe((navState) => {
      setNavigationState({
        inProgress: navState.isNavigating,
        targetRoute: navState.targetRoute
      });
    });
    
    return unsubscribe;
  }, []);
  
  // Function to manually start the tutorial with proper navigation
  const startTutorial = () => {
    console.log('[TutorialContext] Starting tutorial manually');
    
    // Reset highlighting manager
    highlightingManager.reset();
    
    // Set the tutorial as pending start until we're on the right route
    setPendingTutorialStart(true);
    setCurrentStep(0);
    setTutorialCompleted(false);
    
    // If we're not on an app route, navigate to home first
    if (!isAppRoute(location.pathname)) {
      console.log('[TutorialContext] Not on app route, navigating to /app/home');
      navigationManager.startNavigation('/app/home', 0);
      navigate('/app/home');
    } else {
      // We're already on an app route, activate tutorial immediately
      console.log('[TutorialContext] Already on app route, activating tutorial');
      setIsActive(true);
      setPendingTutorialStart(false);
    }
  };
  
  // Enhanced navigation completion handler with timeout protection
  useEffect(() => {
    if (!isInitialized) return; // NEW: Don't process navigation until initialized
    
    const navManagerState = navigationManager.getState();
    
    if (navManagerState.isNavigating && navManagerState.targetRoute === location.pathname) {
      console.log(`[TutorialContext] Navigation complete: arrived at ${location.pathname}`);
      navigationManager.completeNavigation();
      
      // If tutorial was pending start, activate it now
      if (pendingTutorialStart) {
        console.log('[TutorialContext] Activating tutorial after navigation completion');
        setIsActive(true);
        setPendingTutorialStart(false);
      }
      
      // After navigation completes, check for elements that need to be highlighted using new system
      const currentStepData = steps[currentStep];
      if (currentStepData && currentStepData.waitForElement) {
        console.log(`[TutorialContext] Step ${currentStepData.id} is waiting for element: ${currentStepData.targetElement}`);
        
        // Wait for the DOM to be ready after navigation, then use highlighting manager
        setTimeout(() => {
          checkForTargetElementEnhanced(currentStepData);
        }, 500);
      }
    }
  }, [location.pathname, pendingTutorialStart, currentStep, steps, isInitialized]);
  
  // Check if tutorial should be active based on user's profile and current route
  useEffect(() => {
    if (!isInitialized) return; // NEW: Don't check tutorial until initialized
    
    const checkTutorialStatus = async () => {
      if (!user || tutorialChecked) return;
      
      try {
        console.log('[TutorialContext] Checking tutorial status for user:', user.id);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('tutorial_completed, tutorial_step')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('[TutorialContext] Error fetching tutorial status:', error);
          setTutorialChecked(true);
          return;
        }
        
        const shouldActivate = data?.tutorial_completed === 'NO';
        const startingStep = data?.tutorial_step || 0;
        
        console.log('[TutorialContext] Tutorial status check result:', {
          shouldActivate,
          startingStep,
          tutorialCompleted: data?.tutorial_completed,
          currentPath: location.pathname,
          isAppRoute: isAppRoute(location.pathname)
        });
        
        if (shouldActivate) {
          console.log('[TutorialContext] Tutorial should be activated at step:', startingStep);
          setCurrentStep(startingStep);
          
          // Reset highlighting manager for fresh start
          highlightingManager.reset();
          
          // Always start tutorial, but handle navigation properly
          if (isAppRoute(location.pathname)) {
            console.log('[TutorialContext] On app route, activating tutorial immediately');
            setIsActive(true);
          } else {
            console.log('[TutorialContext] Not on app route, will navigate and then activate');
            setPendingTutorialStart(true);
            navigationManager.startNavigation('/app/home', startingStep);
            navigate('/app/home');
          }
        }
        
        setTutorialCompleted(data?.tutorial_completed === 'YES');
        setTutorialChecked(true);
      } catch (error) {
        console.error('[TutorialContext] Error in tutorial check:', error);
        setTutorialChecked(true);
      }
    };
    
    checkTutorialStatus();
  }, [user, location.pathname, tutorialChecked, navigate, isInitialized]);
  
  // ENHANCED: Helper function to check for target elements using new highlighting system
  const checkForTargetElementEnhanced = (stepData: TutorialStep) => {
    const selectors = [
      stepData.targetElement,
      ...(stepData.alternativeSelectors || [])
    ].filter(Boolean) as string[];
    
    // Log potential elements in the DOM to help with debugging
    if (stepData.id >= 3) {
      logPotentialTutorialElements();
    }
    
    // Use the new highlighting manager for enhanced highlighting
    if (stepData.id === 3) {
      highlightingManager.applyStaggeredHighlighting(
        selectors,
        ['tutorial-target', 'record-entry-tab', 'tutorial-record-entry-button'],
        3
      );
    } else if (stepData.id === 4) {
      highlightingManager.applyStaggeredHighlighting(
        selectors,
        ['tutorial-target', 'entries-tab'],
        4
      );
    } else {
      // For other steps, use the existing system
      const found = findAndHighlightElement(
        selectors, 
        stepData.id === 5 ? 'chat-question-highlight' :
        stepData.id === 6 ? 'insights-header-highlight' :
        stepData.id === 7 ? 'emotion-chart-highlight' :
        stepData.id === 8 ? 'mood-calendar-highlight' :
        ''
      );
      
      if (!found) {
        console.warn(`[TutorialContext] Could not find any target element for step ${stepData.id}`);
      }
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
        console.error('[TutorialContext] Error updating tutorial step:', error);
      } else {
        console.log('[TutorialContext] Tutorial step updated in database:', step);
      }
    } catch (error) {
      console.error('[TutorialContext] Error updating tutorial step:', error);
    }
  };
  
  // Enhanced function to mark tutorial as completed with better cleanup
  const completeTutorial = async () => {
    if (!user) return;
    
    try {
      console.log('[TutorialContext] Starting tutorial completion cleanup process');
      
      // Update state before database update to prevent UI flickering
      setIsActive(false);
      setPendingTutorialStart(false);
      navigationManager.forceReset();
      highlightingManager.reset();
      
      // Comprehensive cleanup
      performStaggeredCleanup();
      
      // Then update database
      const { error } = await supabase
        .from('profiles')
        .update({ 
          tutorial_completed: 'YES',
          tutorial_step: steps.length
        })
        .eq('id', user.id);
        
      if (error) {
        console.error('[TutorialContext] Error completing tutorial:', error);
        return;
      }
      
      // Update state after database update
      setTutorialCompleted(true);
      
      console.log('[TutorialContext] Tutorial marked as completed');
      
      // Force a UI refresh after tutorial completion
      setTimeout(() => {
        console.log('[TutorialContext] Triggering UI refresh after tutorial');
        window.dispatchEvent(new Event('resize'));
        
        // Navigate to home page after tutorial completion
        console.log('[TutorialContext] Tutorial complete, navigating to home page');
        navigate('/app/home', { replace: true });
      }, 200);
    } catch (error) {
      console.error('[TutorialContext] Error completing tutorial:', error);
    }
  };
  
  // ENHANCED: Next step function with improved navigation handling and enhanced highlighting
  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      const newStep = currentStep + 1;
      const nextStepData = steps[newStep];
      
      console.log(`[TutorialContext] Moving to tutorial step ${newStep} (ID: ${nextStepData.id})`);
      
      // Start step transition protection immediately with extended duration
      navigationManager.startStepTransition(nextStepData.id);
      
      // Perform selective cleanup that preserves the target step
      performNavigationCleanup(nextStepData.id);
      
      // First update the current step in state and database
      setCurrentStep(newStep);
      updateTutorialStep(newStep);
      
      // Handle navigation if needed
      if (nextStepData.navigateTo && location.pathname !== nextStepData.navigateTo) {
        console.log(`[TutorialContext] Navigation needed for step ${nextStepData.id} to ${nextStepData.navigateTo}`);
        
        navigationManager.startNavigation(nextStepData.navigateTo, newStep);
        
        // Navigate to the target page
        navigate(nextStepData.navigateTo);
      } else {
        // If we're already on the right page, immediately check for elements to highlight
        if (nextStepData.waitForElement) {
          setTimeout(() => {
            checkForTargetElementEnhanced(nextStepData);
            // Don't clear transition protection immediately, let it timeout for better persistence
          }, 300); // Increased delay for better DOM readiness
        }
      }
    } else {
      // Last step, complete the tutorial
      console.log('[TutorialContext] Completing tutorial - reached the end');
      completeTutorial();
    }
  };
  
  // ENHANCED: Prev step function with improved navigation handling and enhanced highlighting
  const prevStep = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      const prevStepData = steps[newStep];
      
      console.log(`[TutorialContext] Moving to previous step ${newStep} (ID: ${prevStepData.id})`);
      
      // Start step transition protection immediately with extended duration
      navigationManager.startStepTransition(prevStepData.id);
      
      // Perform selective cleanup that preserves the target step
      performNavigationCleanup(prevStepData.id);
      
      // First update the current step in state and database
      setCurrentStep(newStep);
      updateTutorialStep(newStep);
      
      // Handle navigation if needed
      if (prevStepData.navigateTo && location.pathname !== prevStepData.navigateTo) {
        console.log(`[TutorialContext] Navigation needed for step ${prevStepData.id} to ${prevStepData.navigateTo}`);
        
        navigationManager.startNavigation(prevStepData.navigateTo, newStep);
        
        // Navigate to the target page
        navigate(prevStepData.navigateTo);
      } else {
        // If we're already on the right page, immediately check for elements to highlight
        if (prevStepData.waitForElement) {
          setTimeout(() => {
            checkForTargetElementEnhanced(prevStepData);
            // Don't clear transition protection immediately, let it timeout for better persistence
          }, 300); // Increased delay for better DOM readiness
        }
      }
    }
  };
  
  // Enhanced skip tutorial function with navigation to home
  const skipTutorial = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ tutorial_completed: 'YES' })
        .eq('id', user.id);
        
      if (error) {
        console.error('[TutorialContext] Error skipping tutorial:', error);
        return;
      }
      
      setIsActive(false);
      setPendingTutorialStart(false);
      setTutorialCompleted(true);
      navigationManager.forceReset();
      highlightingManager.reset();
      
      // Clean up any lingering tutorial classes
      performStaggeredCleanup();
      
      console.log('[TutorialContext] Tutorial skipped by user, navigating to home');
      // Navigate to home page after skipping the tutorial
      navigate('/app/home', { replace: true });
    } catch (error) {
      console.error('[TutorialContext] Error skipping tutorial:', error);
    }
  };
  
  // Enhanced reset tutorial function
  const resetTutorial = async () => {
    if (!user) return;
    
    try {
      console.log('[TutorialContext] Resetting tutorial for user:', user.id);
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          tutorial_completed: 'NO',
          tutorial_step: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
        
      if (error) {
        console.error('[TutorialContext] Error resetting tutorial:', error);
        return;
      }
      
      console.log('[TutorialContext] Tutorial reset in database, updating state');
      
      // Reset all tutorial state
      setCurrentStep(0);
      setTutorialChecked(false);
      setTutorialCompleted(false);
      setPendingTutorialStart(false);
      setIsActive(false);
      
      // Clean up managers
      navigationManager.forceReset();
      highlightingManager.reset();
      
      // Force navigation to app home to restart tutorial
      console.log('[TutorialContext] Navigating to app home to restart tutorial');
      
      // Use setTimeout to ensure state is updated before navigation
      setTimeout(() => {
        navigate('/app/home', { replace: true });
        
        // After navigation, start the tutorial
        setTimeout(() => {
          console.log('[TutorialContext] Starting tutorial after reset');
          startTutorial();
        }, 200);
      }, 100);
      
    } catch (error) {
      console.error('[TutorialContext] Error resetting tutorial:', error);
    }
  };
  
  // Provide the context value with the updated navigationState property and initialization state
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
    startTutorial,
    tutorialCompleted,
    isInStep: (stepId: number) => isActive && steps[currentStep]?.id === stepId,
    navigationState,
    isInitialized // NEW: Include initialization state
  };
  
  return (
    <TutorialContext.Provider value={contextValue}>
      {children}
    </TutorialContext.Provider>
  );
};

// ENHANCED: Custom hook to use the tutorial context with resilience
export const useTutorial = () => {
  const context = useContext(TutorialContext);
  
  // NEW: Handle undefined context gracefully during initialization
  if (context === undefined) {
    console.warn('[useTutorial] Hook called before TutorialProvider is ready, returning safe defaults');
    
    // Return safe default values when context is not yet available
    return {
      isActive: false,
      currentStep: 0,
      totalSteps: 0,
      steps: [],
      nextStep: () => console.warn('[useTutorial] nextStep called before provider ready'),
      prevStep: () => console.warn('[useTutorial] prevStep called before provider ready'),
      skipTutorial: () => console.warn('[useTutorial] skipTutorial called before provider ready'),
      completeTutorial: () => console.warn('[useTutorial] completeTutorial called before provider ready'),
      resetTutorial: () => console.warn('[useTutorial] resetTutorial called before provider ready'),
      startTutorial: () => console.warn('[useTutorial] startTutorial called before provider ready'),
      tutorialCompleted: false,
      isInStep: () => false,
      navigationState: { inProgress: false, targetRoute: null },
      isInitialized: false
    };
  }
  
  return context;
};
