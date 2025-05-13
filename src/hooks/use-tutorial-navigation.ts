
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTutorial } from '@/contexts/TutorialContext';
import { toast } from '@/hooks/use-toast';

/**
 * A hook to handle navigation for tutorial steps
 * Ensures the user is on the correct page for each tutorial step
 * while preventing navigation deadlocks
 */
export function useTutorialNavigation() {
  const { isActive, currentStep, steps, isTutorialActive } = useTutorial();
  const navigate = useNavigate();
  const location = useLocation();
  const lastNavigationRef = useRef<string | null>(null);
  const navigationAttempts = useRef<number>(0);
  const [userInitiatedNavigation, setUserInitiatedNavigation] = useState<boolean>(false);
  const lastPathRef = useRef<string>(location.pathname);
  
  // Track whether a tutorial reset is in progress
  const isResettingRef = useRef<boolean>(false);
  
  // Store a timestamp of the most recent tutorial activation
  const activationTimeRef = useRef<number>(0);

  // Track whether the user has manually navigated away from the tutorial path
  useEffect(() => {
    if (lastPathRef.current !== location.pathname) {
      // If the path has changed and it wasn't due to our automatic navigation
      if (!lastNavigationRef.current || !lastNavigationRef.current.includes(location.pathname)) {
        setUserInitiatedNavigation(true);
        console.log('User initiated navigation detected to', location.pathname);
      }
      lastPathRef.current = location.pathname;
    }
  }, [location.pathname]);

  // Reset navigation state when the tutorial is activated or step changes
  useEffect(() => {
    // Record activation time when tutorial becomes active
    if (isActive && !isTutorialActive) {
      activationTimeRef.current = Date.now();
      console.log('Tutorial activated at:', activationTimeRef.current);
    }
    
    // Reset navigation attempts when step changes or tutorial activates/deactivates
    if (currentStep !== undefined) {
      navigationAttempts.current = 0;
      
      // Only reset userInitiatedNavigation when not in reset mode
      if (!isResettingRef.current) {
        setUserInitiatedNavigation(false);
      }
    }
  }, [currentStep, isActive, isTutorialActive]);
  
  // Special handler for tutorial reset
  useEffect(() => {
    // When tutorial is active and we detect a recent reset
    if (isActive && isResettingRef.current) {
      // Check if we've waited long enough after reset (200ms)
      const timeSinceReset = Date.now() - activationTimeRef.current;
      
      // If we're past the wait period, complete the reset process
      if (timeSinceReset > 200) {
        console.log('Completing tutorial reset, navigating to first step');
        
        // Get the first step's navigation target
        const firstStep = steps[0];
        if (firstStep?.navigateTo && location.pathname !== firstStep.navigateTo) {
          // Navigate to the first step's target
          navigate(firstStep.navigateTo);
          console.log('Navigated to first tutorial step:', firstStep.navigateTo);
        }
        
        // Mark reset as complete
        isResettingRef.current = false;
      }
    }
  }, [isActive, steps, navigate, location.pathname]);
  
  // Handle the main tutorial navigation logic
  useEffect(() => {
    // Only handle navigation if tutorial is active
    if (!isActive || !steps[currentStep]) return;
    
    const currentPath = location.pathname;
    const targetStep = steps[currentStep];
    
    // Handle tutorial reset special case
    if (isResettingRef.current) {
      console.log('Tutorial reset in progress, deferring navigation');
      return;
    }
    
    // If the user has explicitly navigated away, don't force them back
    if (userInitiatedNavigation) {
      console.log('Allowing user to stay at', currentPath, 'despite tutorial target', targetStep.navigateTo);
      return;
    }
    
    // If this isn't a navigation step or we're already on the right path, do nothing
    if (!targetStep.navigateTo || currentPath === targetStep.navigateTo) {
      return;
    }
    
    // Prevent navigation loops - if we've recently navigated to this path for this step,
    // or if we've attempted to navigate too many times, don't force navigation
    if (lastNavigationRef.current === `${currentStep}-${targetStep.navigateTo}`) {
      return;
    }
    
    // If we've tried to navigate too many times for this step, don't force any more navigations
    // This prevents deadlocks where the app keeps trying to navigate to a path
    if (navigationAttempts.current > 3) {
      console.warn('Too many navigation attempts for tutorial step', currentStep, 'giving up');
      toast({
        title: "Navigation issue detected",
        description: "Please try using the exit tutorial button if you're stuck.",
        variant: "warning"
      });
      return;
    }
    
    // Navigate to the target path
    console.log(`Tutorial navigation: Moving to ${targetStep.navigateTo} for step ${currentStep + 1}`);
    
    // Track this navigation attempt
    lastNavigationRef.current = `${currentStep}-${targetStep.navigateTo}`;
    navigationAttempts.current += 1;
    
    // Navigate to the target path
    navigate(targetStep.navigateTo);
    
    // Reset the tracking after a delay to allow for possible manual navigation
    setTimeout(() => {
      lastNavigationRef.current = null;
    }, 2000);
  }, [isActive, currentStep, steps, navigate, location.pathname, userInitiatedNavigation]);
  
  // Public method to prepare for a tutorial reset
  const prepareForReset = () => {
    console.log('Preparing tutorial navigation for reset');
    isResettingRef.current = true;
    activationTimeRef.current = Date.now();
    setUserInitiatedNavigation(false);
    navigationAttempts.current = 0;
  };
  
  return { prepareForReset };
}
