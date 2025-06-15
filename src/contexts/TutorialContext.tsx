import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useLocation, useNavigate } from 'react-router-dom';
const isAppRoute = (pathname: string) => pathname.startsWith('/app');
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
import { performComprehensiveCleanup, performStaggeredCleanup, performNavigationCleanup } from '@/utils/tutorial/tutorial-cleanup-enhanced';
import { navigationManager } from '@/utils/tutorial/navigation-state-manager';
import { highlightingManager } from '@/utils/tutorial/tutorial-highlighting-manager';
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
  isInitialized: boolean;
}

// Create the context with a default undefined value
const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

// Define the initial tutorial steps
const initialTutorialSteps: TutorialStep[] = [
  {
    id: 1,
    title: 'Welcome to SOuLO',
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
    content: 'Press this central arrow button to start recording a journal entry instantly. This is your daily oxygen to build your emotional repository.',
    targetElement: '.journal-arrow-button',
    position: 'top',
    showNextButton: true,
    showSkipButton: true,
    navigateTo: '/app/home',
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
    navigateTo: '/app/journal',
    waitForElement: true
  },
  {
    id: 4,
    title: 'Your Journal History',
    content: 'View and explore all your past journal entries here. You can search, filter, and reflect on your emotional journey over time.',
    targetElement: '[value="entries"]',
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
  {
    id: 9,
    title: 'Soul-Net Visualization',
    content: 'Explore neural connections between life areas and emotions to see how different aspects of your life influence your emotional state.',
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
  const [steps] = useState<TutorialStep[]>(initialTutorialSteps);
  const [tutorialChecked, setTutorialChecked] = useState(false);
  const [navigationState, setNavigationState] = useState({
    inProgress: false,
    targetRoute: null as string | null
  });
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [pendingTutorialStart, setPendingTutorialStart] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Initialize the tutorial system
  useEffect(() => {
    console.log('[TutorialContext] Initializing tutorial system');
    
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
  
  // Memoized function to update tutorial step in the database
  const updateTutorialStep = useCallback(async (step: number) => {
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
  }, [user]);
  
  // Function to manually start the tutorial
  const startTutorial = useCallback(() => {
    console.log('[TutorialContext] Starting tutorial manually');
    
    highlightingManager.reset();
    setPendingTutorialStart(true);
    setCurrentStep(0);
    setTutorialCompleted(false);
    
    if (!isAppRoute(location.pathname)) {
      console.log('[TutorialContext] Not on app route, navigating to /app/home');
      navigationManager.startNavigation('/app/home', 0);
      navigate('/app/home');
    } else {
      console.log('[TutorialContext] Already on app route, activating tutorial');
      setIsActive(true);
      setPendingTutorialStart(false);
    }
  }, [location.pathname, navigate]);

  // Check if tutorial should be active based on user's profile and current route
  useEffect(() => {
    if (!isInitialized || !user || tutorialChecked) return;
    
    const checkTutorialStatus = async () => {
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
          highlightingManager.reset();
          
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

  // Enhanced navigation completion handler with timeout protection
  useEffect(() => {
    if (!isInitialized) return;
    
    const navManagerState = navigationManager.getState();
    
    if (navManagerState.isNavigating && navManagerState.targetRoute === location.pathname) {
      console.log(`[TutorialContext] Navigation complete: arrived at ${location.pathname}`);
      navigationManager.completeNavigation();
      
      if (pendingTutorialStart) {
        console.log('[TutorialContext] Activating tutorial after navigation completion');
        setIsActive(true);
        setPendingTutorialStart(false);
      }
    }
  }, [location.pathname, pendingTutorialStart, isInitialized]);

  // Enhanced function to mark tutorial as completed
  const completeTutorial = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('[TutorialContext] Starting tutorial completion cleanup process');
      
      setIsActive(false);
      setPendingTutorialStart(false);
      navigationManager.forceReset();
      highlightingManager.reset();
      
      performStaggeredCleanup();
      
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
      
      setTutorialCompleted(true);
      
      console.log('[TutorialContext] Tutorial marked as completed');
      
      setTimeout(() => {
        console.log('[TutorialContext] Triggering UI refresh after tutorial');
        window.dispatchEvent(new Event('resize'));
        console.log('[TutorialContext] Tutorial complete, navigating to home page');
        navigate('/app/home', { replace: true });
      }, 200);
    } catch (error) {
      console.error('[TutorialContext] Error completing tutorial:', error);
    }
  }, [user, steps.length, navigate]);

  // Enhanced next step function
  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      const newStep = currentStep + 1;
      const nextStepData = steps[newStep];
      
      console.log(`[TutorialContext] Moving to tutorial step ${newStep} (ID: ${nextStepData.id})`);
      
      navigationManager.startStepTransition(nextStepData.id);
      performNavigationCleanup(nextStepData.id);
      
      setCurrentStep(newStep);
      updateTutorialStep(newStep);
      
      if (nextStepData.navigateTo && location.pathname !== nextStepData.navigateTo) {
        console.log(`[TutorialContext] Navigation needed for step ${nextStepData.id} to ${nextStepData.navigateTo}`);
        navigationManager.startNavigation(nextStepData.navigateTo, newStep);
        navigate(nextStepData.navigateTo);
      }
    } else {
      console.log('[TutorialContext] Completing tutorial - reached the end');
      completeTutorial();
    }
  }, [currentStep, steps, location.pathname, navigate, updateTutorialStep, completeTutorial]);

  // Enhanced prev step function
  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      const prevStepData = steps[newStep];
      
      console.log(`[TutorialContext] Moving to previous step ${newStep} (ID: ${prevStepData.id})`);
      
      navigationManager.startStepTransition(prevStepData.id);
      performNavigationCleanup(prevStepData.id);
      
      setCurrentStep(newStep);
      updateTutorialStep(newStep);
      
      if (prevStepData.navigateTo && location.pathname !== prevStepData.navigateTo) {
        console.log(`[TutorialContext] Navigation needed for step ${prevStepData.id} to ${prevStepData.navigateTo}`);
        navigationManager.startNavigation(prevStepData.navigateTo, newStep);
        navigate(prevStepData.navigateTo);
      }
    }
  }, [currentStep, steps, location.pathname, navigate, updateTutorialStep]);

  // Enhanced skip tutorial function
  const skipTutorial = useCallback(async () => {
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
      
      performStaggeredCleanup();
      
      console.log('[TutorialContext] Tutorial skipped by user, navigating to home');
      navigate('/app/home', { replace: true });
    } catch (error) {
      console.error('[TutorialContext] Error skipping tutorial:', error);
    }
  }, [user, navigate]);

  // Enhanced reset tutorial function
  const resetTutorial = useCallback(async () => {
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
      navigationManager.forceReset();
      highlightingManager.reset();
      
      if (location.pathname !== '/app/home') {
        console.log('[TutorialContext] Tutorial reset - redirecting to app home');
        navigate('/app/home', { replace: true });
      } else {
        setIsActive(true);
      }
    } catch (error) {
      console.error('[TutorialContext] Error resetting tutorial:', error);
    }
  }, [user, location.pathname, navigate]);

  // Helper function to check if currently in a specific step
  const isInStep = useCallback((stepId: number) => {
    return isActive && steps[currentStep]?.id === stepId;
  }, [isActive, steps, currentStep]);

  // Provide the context value
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
    isInStep,
    navigationState,
    isInitialized
  };
  
  return (
    <TutorialContext.Provider value={contextValue}>
      {children}
    </TutorialContext.Provider>
  );
};

// Enhanced custom hook to use the tutorial context
export const useTutorial = () => {
  const context = useContext(TutorialContext);
  
  if (context === undefined) {
    console.warn('[useTutorial] Hook called before TutorialProvider is ready, returning safe defaults');
    
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
