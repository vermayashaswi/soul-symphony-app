
import React, { useEffect, useRef } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';

interface ButtonStateManagerProps {
  buttonRef: React.RefObject<HTMLDivElement>;
  isInArrowTutorialStep: boolean;
}

const ButtonStateManager: React.FC<ButtonStateManagerProps> = ({
  buttonRef,
  isInArrowTutorialStep
}) => {
  const { isActive } = useTutorial();
  const previousStateRef = useRef<boolean>(false);

  useEffect(() => {
    if (!buttonRef.current) return;

    const buttonElement = buttonRef.current.querySelector('button');
    const glowDiv = buttonRef.current.querySelector('.bg-primary\\/30');
    const containerEl = buttonRef.current as HTMLElement;

    // Store previous state to detect changes
    const stateChanged = previousStateRef.current !== isInArrowTutorialStep;
    previousStateRef.current = isInArrowTutorialStep;

    console.log('[ButtonStateManager] State change detected:', {
      isInArrowTutorialStep,
      stateChanged,
      isActive,
      hasButtonElement: !!buttonElement,
      hasGlowDiv: !!glowDiv
    });

    if (isInArrowTutorialStep) {
      // Apply tutorial styling with accessibility improvements
      if (buttonElement) {
        console.log('[ButtonStateManager] Applying tutorial styling');
        
        buttonElement.classList.add('tutorial-button-highlight');
        const buttonStyleEl = buttonElement as HTMLElement;
        buttonStyleEl.style.boxShadow = "0 0 35px 20px var(--color-theme)";
        buttonStyleEl.style.animation = "button-pulse 1.5s infinite alternate";
        buttonStyleEl.style.border = "2px solid white";
        buttonStyleEl.style.transform = "scale(1.05)";
        buttonStyleEl.style.zIndex = "10000";
        
        // Accessibility: Ensure button has proper labeling during tutorial
        if (!buttonStyleEl.getAttribute('aria-label') && !buttonStyleEl.getAttribute('aria-labelledby')) {
          buttonStyleEl.setAttribute('aria-label', 'Voice recording button - Click to start recording your journal entry');
        }
        
        // Add focus management for tutorial
        buttonStyleEl.setAttribute('aria-describedby', 'tutorial-instruction');
        buttonStyleEl.focus();
      }
      
      if (glowDiv) {
        const glowElement = glowDiv as HTMLElement;
        glowElement.style.filter = "drop-shadow(0 0 25px var(--color-theme))";
        glowElement.style.opacity = "0.95";
      }

      // Ensure container is properly positioned for tutorial
      containerEl.style.position = 'fixed';
      containerEl.style.top = '50%';
      containerEl.style.left = '50%';
      containerEl.style.transform = 'translate(-50%, -50%)';
      containerEl.style.zIndex = '10000';
    } else {
      // Remove tutorial styling and reset to normal state
      console.log('[ButtonStateManager] Removing tutorial styling and resetting');
      
      if (buttonElement) {
        buttonElement.classList.remove('tutorial-button-highlight');
        const buttonStyleEl = buttonElement as HTMLElement;
        buttonStyleEl.style.boxShadow = "";
        buttonStyleEl.style.animation = "";
        buttonStyleEl.style.border = "";
        buttonStyleEl.style.transform = "";
        buttonStyleEl.style.zIndex = "";
        
        // Reset accessibility attributes
        if (buttonStyleEl.getAttribute('aria-label') === 'Voice recording button - Click to start recording your journal entry') {
          buttonStyleEl.removeAttribute('aria-label');
        }
        buttonStyleEl.removeAttribute('aria-describedby');
      }
      
      if (glowDiv) {
        const glowElement = glowDiv as HTMLElement;
        glowElement.style.filter = "";
        glowElement.style.opacity = "";
      }

      // Reset container to default centered positioning
      containerEl.style.position = 'fixed';
      containerEl.style.top = '50%';
      containerEl.style.left = '50%';
      containerEl.style.transform = 'translate(-50%, -50%)';
      containerEl.style.zIndex = '40';
      containerEl.style.margin = '0';
      containerEl.style.padding = '0';
    }

    // Cleanup function for when component unmounts or state changes
    return () => {
      if (buttonElement) {
        buttonElement.classList.remove('tutorial-button-highlight');
        const buttonStyleEl = buttonElement as HTMLElement;
        buttonStyleEl.style.boxShadow = "";
        buttonStyleEl.style.animation = "";
        buttonStyleEl.style.border = "";
        buttonStyleEl.style.transform = "";
        buttonStyleEl.style.zIndex = "";
        
        // Clean up accessibility attributes
        if (buttonStyleEl.getAttribute('aria-label') === 'Voice recording button - Click to start recording your journal entry') {
          buttonStyleEl.removeAttribute('aria-label');
        }
        buttonStyleEl.removeAttribute('aria-describedby');
      }
      
      if (glowDiv) {
        const glowElement = glowDiv as HTMLElement;
        glowElement.style.filter = "";
        glowElement.style.opacity = "";
      }
    };
  }, [isInArrowTutorialStep, isActive]);

  return null; // This is a state management component, no UI
};

export default ButtonStateManager;
