
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTutorial } from '@/contexts/TutorialContext';

/**
 * A hook to handle navigation for tutorial steps
 * Ensures the user is on the correct page for each tutorial step
 */
export function useTutorialNavigation() {
  const { isActive, currentStep, steps } = useTutorial();
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Only handle navigation if tutorial is active
    if (!isActive || !steps[currentStep]) return;
    
    const currentPath = location.pathname;
    const targetStep = steps[currentStep];
    
    // If this step has a specific page it should display on
    if (targetStep.navigateTo && currentPath !== targetStep.navigateTo) {
      console.log(`Tutorial navigation: Moving to ${targetStep.navigateTo} for step ${currentStep + 1}`);
      navigate(targetStep.navigateTo);
    }
  }, [isActive, currentStep, steps, navigate, location.pathname]);
  
  return null;
}
