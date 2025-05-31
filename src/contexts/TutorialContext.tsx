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
  SOULNET_SELECTORS,
  findAndHighlightElement,
  logPotentialTutorialElements
} from '@/utils/tutorial/tutorial-elements-finder';
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
  // Enhanced steps 6-9 with custom infographics
  {
    id: 6,
    title: 'Your Emotional Insights',
    content: 'Welcome to the Insights page! Here you\'ll find visual representations of your emotional journey and patterns over time.',
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
    content: 'This chart shows how your emotions trend over time. See which emotions appear most frequently in your journal and how they change.',
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
    content: 'The Mood Calendar visualizes your daily sentiment changes. Spot patterns in how your mood fluctuates throughout weeks and months.',
    targetElement: '[class*="MoodCalendar"]',
    alternativeSelectors: MOOD_CALENDAR_SELECTORS,
    position: 'top',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/insights',
    waitForElement: true,
    infographicType: 'mood-calendar'
  },
  {
    id: 9,
    title: 'Soul-Net Visualization',
    content: 'This neural visualization shows connections between life areas and emotions. Explore how different aspects of your life influence your emotional state.',
    targetElement: 'canvas',
    alternativeSelectors: SOULNET_SELECTORS,
    position: 'top',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/insights',
    waitForElement: true,
    infographicType: 'soul-net'
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
  const [pendingTutorialStart, setPendingTutorialStart] = useState(false);
  
  // Enhanced logging for debugging
  useEffect(() => {
    console.log('[TutorialContext] Current state:', {
      isActive,
      currentStep,
      currentStepID: steps[currentStep]?.id,
      currentPath: location.pathname,
      navigationState,
      pendingTutorialStart,
      tutorialChecked
    });
  }, [isActive, currentStep, steps, location.pathname, navigationState, pendingTutorialStart, tutorialChecked]);
  
  // Function to manually start the tutorial with proper navigation
  const startTutorial = () => {
    console.log('[TutorialContext] Starting tutorial manually');
    
    // Set the tutorial as pending start until we're on the right route
    setPendingTutorialStart(true);
    setCurrentStep(0);
    setTutorialCompleted(false);
    
    // If we're not on an app route, navigate to home first
    if (!isAppRoute(location.pathname)) {
      console.log('[TutorialContext] Not on app route, navigating to /app/home');
      setNavigationState({
        inProgress: true,
        targetRoute: '/app/home'
      });
      navigate('/app/home');
    } else {
      // We're already on an app route, activate tutorial immediately
      console.log('[TutorialContext] Already on app route, activating tutorial');
      setIsActive(true);
      setPendingTutorialStart(false);
    }
  };
  
  // Enhanced navigation completion handler
  useEffect(() => {
    if (navigationState.inProgress && navigationState.targetRoute === location.pathname) {
      console.log(`[TutorialContext] Navigation complete: arrived at ${location.pathname}`);
      setNavigationState({
        inProgress: false,
        targetRoute: null
      });
      
      // If tutorial was pending start, activate it now
      if (pendingTutorialStart) {
        console.log('[TutorialContext] Activating tutorial after navigation completion');
        setIsActive(true);
        setPendingTutorialStart(false);
      }
      
      // After navigation completes, check for elements that need to be highlighted
      const currentStepData = steps[currentStep];
      if (currentStepData && currentStepData.waitForElement) {
        console.log(`[TutorialContext] Step ${currentStepData.id} is waiting for element: ${currentStepData.targetElement}`);
        
        // Wait for the DOM to be ready after navigation
        setTimeout(() => {
          checkForTargetElement(currentStepData);
        }, 500);
      }
    }
  }, [location.pathname, navigationState.inProgress, navigationState.targetRoute, pendingTutorialStart, currentStep, steps]);
  
  // Check if tutorial should be active based on user's profile and current route
  useEffect(() => {
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
          
          // Always start tutorial, but handle navigation properly
          if (isAppRoute(location.pathname)) {
            console.log('[TutorialContext] On app route, activating tutorial immediately');
            setIsActive(true);
          } else {
            console.log('[TutorialContext] Not on app route, will navigate and then activate');
            setPendingTutorialStart(true);
            setNavigationState({
              inProgress: true,
              targetRoute: '/app/home'
            });
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
  }, [user, location.pathname, tutorialChecked, navigate]);
  
  // Helper function to check for target elements and apply highlighting
  const checkForTargetElement = (stepData: TutorialStep) => {
    const selectors = [
      stepData.targetElement,
      ...(stepData.alternativeSelectors || [])
    ].filter(Boolean) as string[];
    
    // Log potential elements in the DOM to help with debugging
    if (stepData.id >= 3) {
      logPotentialTutorialElements();
    }
    
    // Attempt to find and highlight the element
    const found = findAndHighlightElement(
      selectors, 
      stepData.id === 3 ? 'record-entry-tab' : 
      stepData.id === 4 ? 'entries-tab' :
      stepData.id === 5 ? 'chat-question-highlight' :
      stepData.id === 6 ? 'insights-header-highlight' :
      stepData.id === 7 ? 'emotion-chart-highlight' :
      stepData.id === 8 ? 'mood-calendar-highlight' :
      stepData.id === 9 ? 'soul-net-highlight' : ''
    );
    
    if (!found) {
      console.warn(`[TutorialContext] Could not find any target element for step ${stepData.id}`);
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
      
      // First, clean up any lingering tutorial classes and styling before database update
      const cleanupTutorialElements = () => {
        console.log('[TutorialContext] Running thorough tutorial cleanup');
        
        // Remove tutorial active class from body and data attribute
        document.body.classList.remove('tutorial-active');
        document.body.removeAttribute('data-current-step');
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        
        // Get all tutorial-related elements with ANY potential classes - extensive list for thorough cleanup
        const targetElements = document.querySelectorAll(
          '.tutorial-target, .tutorial-button-highlight, .record-entry-tab, ' +
          '.entries-tab, .chat-question-highlight, .tutorial-overlay, ' + 
          '.empty-chat-suggestion, .chat-suggestion-button, ' +
          '[class*="tutorial-"]'
        );
        
        console.log(`[TutorialContext] Found ${targetElements.length} tutorial elements to clean up`);
        
        // Remove all tutorial-related classes from elements
        targetElements.forEach(el => {
          el.classList.remove(
            'tutorial-target', 
            'tutorial-button-highlight', 
            'record-entry-tab', 
            'entries-tab',
            'chat-question-highlight',
            'tutorial-overlay',
            'empty-chat-suggestion'
          );
          
          // Clear any inline styles
          if (el instanceof HTMLElement) {
            el.style.boxShadow = '';
            el.style.animation = '';
            el.style.border = '';
            el.style.transform = '';
            el.style.zIndex = '';
            el.style.position = '';
            el.style.visibility = '';
            el.style.opacity = '';
            el.style.pointerEvents = '';
            el.style.display = '';
            el.style.backgroundColor = '';
            el.style.backgroundImage = '';
            el.style.borderRadius = '';
            el.style.boxShadow = '';
          }
        });
        
        // Reset any visibility styles on chat elements
        const chatElements = document.querySelectorAll(
          '[class*="chat-"], .chat-messages-container, .mobile-chat-interface, .smart-chat-container, ' +
          'form, input, textarea, .p-2.border-t.border-border, .flex.flex-col.items-center.justify-center.p-6.text-center.h-full'
        );
        
        chatElements.forEach(el => {
          if (el instanceof HTMLElement) {
            el.style.display = '';
            el.style.visibility = '';
            el.style.opacity = '';
            el.style.height = '';
            el.style.position = '';
            el.style.zIndex = '';
            el.style.transform = '';
            el.style.pointerEvents = '';
            el.style.cursor = '';
            el.style.backgroundColor = '';
            el.style.backgroundImage = '';
            el.style.borderRadius = '';
            el.style.boxShadow = '';
          }
        });
        
        // Force update the EmptyChatState component if present
        const emptyChatState = document.querySelector('.flex.flex-col.items-center.justify-center.p-6.text-center.h-full');
        if (emptyChatState) {
          console.log('[TutorialContext] Refreshing EmptyChatState visibility');
          if (emptyChatState instanceof HTMLElement) {
            emptyChatState.style.visibility = 'visible';
            emptyChatState.style.display = 'flex';
            emptyChatState.style.opacity = '1';
          }
        }
      };
      
      // Clean up DOM elements first
      cleanupTutorialElements();
      
      // Update state before database update to prevent UI flickering
      setIsActive(false);
      setPendingTutorialStart(false);
      
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
      
      // Run multiple cleanup passes to ensure everything is properly reset
      setTimeout(cleanupTutorialElements, 100);
      setTimeout(cleanupTutorialElements, 500);
      
      // Force a UI refresh after tutorial completion
      setTimeout(() => {
        console.log('[TutorialContext] Triggering UI refresh after tutorial');
        window.dispatchEvent(new Event('resize'));
        
        // Force page to re-render if needed
        const currentPath = window.location.pathname;
        if (currentPath === '/app/chat') {
          console.log('[TutorialContext] On chat page, forcing re-render');
          const event = new CustomEvent('chatRefreshNeeded');
          window.dispatchEvent(event);
        }
        
        // Navigate to home page after tutorial completion
        console.log('[TutorialContext] Tutorial complete, navigating to home page');
        navigate('/app/home', { replace: true });
      }, 200);
    } catch (error) {
      console.error('[TutorialContext] Error completing tutorial:', error);
    }
  };
  
  // Enhanced next step function with improved navigation handling
  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      const newStep = currentStep + 1;
      const nextStepData = steps[newStep];
      
      console.log(`[TutorialContext] Moving to tutorial step ${newStep} (ID: ${nextStepData.id})`);
      
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
        console.log(`[TutorialContext] Navigation needed for step ${nextStepData.id} to ${nextStepData.navigateTo}`);
        
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
      console.log('[TutorialContext] Completing tutorial - reached the end');
      completeTutorial();
    }
  };
  
  // Enhanced prev step function with improved navigation handling
  const prevStep = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      const prevStepData = steps[newStep];
      
      console.log(`[TutorialContext] Moving to previous step ${newStep} (ID: ${prevStepData.id})`);
      
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
        console.log(`[TutorialContext] Navigation needed for step ${prevStepData.id} to ${prevStepData.navigateTo}`);
        
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
      const { error } = await supabase
        .from('profiles')
        .update({ 
          tutorial_completed: 'NO',
          tutorial_step: 0
        })
        .eq('id', user.id);
        
      if (error) {
        console.error('[TutorialContext] Error resetting tutorial:', error);
        return;
      }
      
      setCurrentStep(0);
      setTutorialChecked(false);
      setTutorialCompleted(false);
      setPendingTutorialStart(false);
      setNavigationState({
        inProgress: false,
        targetRoute: null
      });
      
      // Only navigate if we're not already on the app home page
      if (location.pathname !== '/app/home') {
        // First navigate to app home - use replace to prevent back navigation
        console.log('[TutorialContext] Tutorial reset - redirecting to app home');
        
        navigate('/app/home', { replace: true });
      } else {
        // If already on /app/home, just set active tutorial
        setIsActive(true);
      }
    } catch (error) {
      console.error('[TutorialContext] Error resetting tutorial:', error);
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
    startTutorial,
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
