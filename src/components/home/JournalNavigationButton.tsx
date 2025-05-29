
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTutorial } from '@/contexts/TutorialContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { showTranslatedToast, showTutorialToast, registerComponent, unregisterComponent } from '@/services/notificationService';

const JournalNavigationButton: React.FC = () => {
  const navigate = useNavigate();
  const { isActive, currentStep, steps } = useTutorial();
  const { translate } = useTranslation();
  const buttonRef = useRef<HTMLDivElement>(null);
  const componentId = useRef(`journal-nav-${Date.now()}`);
  const isMountedRef = useRef(true);
  
  // Check if we're in tutorial step 2
  const isInArrowTutorialStep = isActive && steps[currentStep]?.id === 2;

  // Register component on mount and cleanup on unmount
  useEffect(() => {
    registerComponent(componentId.current);
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      unregisterComponent(componentId.current);
    };
  }, []);

  const navigateToJournal = async () => {
    // Safety check - don't proceed if component is unmounted
    if (!isMountedRef.current) {
      console.log('Navigation cancelled - component unmounted');
      return;
    }

    try {
      console.log('Navigating to journal page');
      navigate('/app/journal');
      
      // Show a success toast - use tutorial toast if in tutorial mode
      if (isActive) {
        showTutorialToast(
          "Journal", 
          "Opening your journal space",
          componentId.current
        );
      } else {
        // Use translated toast for regular navigation
        await showTranslatedToast(
          "navigation.journal",
          "toasts.openingJournalSpace",
          translate,
          3000,
          undefined,
          componentId.current
        );
      }
    } catch (error) {
      console.error("Navigation error:", error);
      
      // Only show error toast if component is still mounted
      if (isMountedRef.current) {
        await showTranslatedToast(
          "toasts.error",
          "toasts.navigationError",
          translate,
          5000,
          undefined,
          componentId.current
        );
      }
    }
  };

  // Enhanced handling for button in tutorial mode with proper cleanup
  useEffect(() => {
    if (!buttonRef.current || !isMountedRef.current) return;
    
    console.log('JournalNavigationButton - Tutorial state:', {
      isActive,
      currentStep,
      isInArrowTutorialStep,
      stepId: steps[currentStep]?.id
    });
    
    const buttonElement = buttonRef.current.querySelector('button');
    const glowDiv = buttonRef.current.querySelector('.bg-primary\\/30');
    
    if (isInArrowTutorialStep && isMountedRef.current) {
      // Apply tutorial styling
      if (buttonElement) {
        console.log('Applying enhanced tutorial styling to button');
        
        // Add tutorial classes
        buttonElement.classList.add('tutorial-button-highlight');
        
        // Force stronger glow effect with inline styles
        const buttonStyleEl = buttonElement as HTMLElement;
        buttonStyleEl.style.boxShadow = "0 0 35px 20px var(--color-theme)";
        buttonStyleEl.style.animation = "button-pulse 1.5s infinite alternate";
        buttonStyleEl.style.border = "2px solid white";
        buttonStyleEl.style.transform = "scale(1.05)";
      }
      
      // Apply enhanced styles to the glow div
      if (glowDiv) {
        const glowElement = glowDiv as HTMLElement;
        glowElement.style.filter = "drop-shadow(0 0 25px var(--color-theme))";
        glowElement.style.opacity = "0.95";
      }
    } else if (isMountedRef.current) {
      // IMPORTANT: Remove ALL tutorial styling when not in step 2
      if (buttonElement) {
        console.log('Removing tutorial styling from button');
        buttonElement.classList.remove('tutorial-button-highlight');
        
        const buttonStyleEl = buttonElement as HTMLElement;
        buttonStyleEl.style.boxShadow = "";
        buttonStyleEl.style.animation = "";
        buttonStyleEl.style.border = "";
        buttonStyleEl.style.transform = "";
        buttonStyleEl.style.position = "";
        buttonStyleEl.style.zIndex = "";
      }
      
      if (glowDiv) {
        const glowElement = glowDiv as HTMLElement;
        glowElement.style.filter = "";
        glowElement.style.opacity = "";
      }
      
      // CRITICAL: Reset the container positioning to ensure button stays centered
      if (buttonRef.current) {
        const containerEl = buttonRef.current as HTMLElement;
        containerEl.style.position = 'fixed';
        containerEl.style.top = '50%';
        containerEl.style.left = '50%';
        containerEl.style.transform = 'translate(-50%, -50%)';
        containerEl.style.zIndex = '40';
        containerEl.style.margin = '0';
        containerEl.style.padding = '0';
      }
    }
    
    // Cleanup function to ensure proper reset
    return () => {
      if (buttonElement && isMountedRef.current) {
        buttonElement.classList.remove('tutorial-button-highlight');
        const buttonStyleEl = buttonElement as HTMLElement;
        buttonStyleEl.style.boxShadow = "";
        buttonStyleEl.style.animation = "";
        buttonStyleEl.style.border = "";
        buttonStyleEl.style.transform = "";
        buttonStyleEl.style.position = "";
        buttonStyleEl.style.zIndex = "";
      }
      
      if (glowDiv && isMountedRef.current) {
        const glowElement = glowDiv as HTMLElement;
        glowElement.style.filter = "";
        glowElement.style.opacity = "";
      }
      
      // Reset container positioning
      if (buttonRef.current && isMountedRef.current) {
        const containerEl = buttonRef.current as HTMLElement;
        containerEl.style.position = 'fixed';
        containerEl.style.top = '50%';
        containerEl.style.left = '50%';
        containerEl.style.transform = 'translate(-50%, -50%)';
        containerEl.style.zIndex = '40';
      }
    };
  }, [isInArrowTutorialStep, isActive, currentStep, steps]);

  // Don't render if component should be unmounted
  if (!isMountedRef.current) {
    return null;
  }

  return (
    <div 
      className="journal-arrow-button"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: isInArrowTutorialStep ? 10000 : 40,
        margin: 0,
        padding: 0,
        pointerEvents: 'auto',
        visibility: 'visible',
        opacity: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: 'auto',
        height: 'auto',
      }}
      data-testid="journal-arrow-button"
      ref={buttonRef}
    >
      <motion.div
        className="absolute inset-0 rounded-full bg-primary/30 blur-md z-0"
        initial={{ scale: 1, opacity: 0.5 }}
        animate={{
          scale: isInArrowTutorialStep ? [1, 1.4, 1] : [1, 1.15, 1],
          opacity: isInArrowTutorialStep ? [0.6, 1, 0.6] : [0.5, 0.8, 0.5]
        }}
        transition={{
          repeat: Infinity,
          duration: isInArrowTutorialStep ? 1 : 2,
          ease: "easeInOut"
        }}
        style={{
          width: "calc(100% + 20px)",
          height: "calc(100% + 20px)",
          top: "-10px",
          left: "-10px",
        }}
      />
      <motion.button
        onClick={navigateToJournal}
        className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg relative z-20"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <ArrowRight className="text-primary-foreground h-8 w-8" />
      </motion.button>
    </div>
  );
};

export default JournalNavigationButton;
