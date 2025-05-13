import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTutorial } from '@/contexts/TutorialContext';

/**
 * A hook to handle navigation for tutorial steps
 * Ensures the user is on the correct page for each tutorial step
 * while preventing navigation deadlocks
 */
export function useTutorialNavigation() {
  const { isActive, currentStep, steps } = useTutorial();
  const navigate = useNavigate();
  const location = useLocation();
  const lastNavigationRef = useRef<string | null>(null);
  const navigationAttempts = useRef<number>(0);

  useEffect(() => {
    // Reset navigation attempts when step changes or tutorial activates/deactivates
    if (currentStep !== undefined) {
      navigationAttempts.current = 0;
    }
  }, [currentStep, isActive]);
  
  useEffect(() => {
    // Only handle navigation if tutorial is active
    if (!isActive || !steps[currentStep]) return;
    
    const currentPath = location.pathname;
    const targetStep = steps[currentStep];
    
    // Prevent navigation loops - if we've recently navigated to this path for this step,
    // or if we've attempted to navigate too many times, don't force navigation
    if (lastNavigationRef.current === `${currentStep}-${targetStep.navigateTo}`) {
      return;
    }
    
    // If we've tried to navigate too many times for this step, don't force any more navigations
    // This prevents deadlocks where the app keeps trying to navigate to a path
    if (navigationAttempts.current > 5) {
      console.warn('Too many navigation attempts for tutorial step', currentStep);
      return;
    }
    
    // If this step has a specific page it should display on
    if (targetStep.navigateTo && currentPath !== targetStep.navigateTo) {
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
    }
  }, [isActive, currentStep, steps, navigate, location.pathname]);
  
  return null;
}
