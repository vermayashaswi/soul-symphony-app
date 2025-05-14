
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTutorial } from '@/contexts/TutorialContext';
import { showToast } from '@/utils/journal/toast-helper';

const JournalNavigationButton: React.FC = () => {
  const navigate = useNavigate();
  const { isActive, currentStep, steps } = useTutorial();
  const buttonRef = useRef<HTMLDivElement>(null);
  
  // Check if we're in tutorial step 2
  const isInArrowTutorialStep = isActive && steps[currentStep]?.id === 2;

  const navigateToJournal = () => {
    try {
      console.log('Navigating to journal page');
      navigate('/app/journal');
      
      // Show a success toast
      showToast(
        "Journal", 
        "Opening your journal space", 
        3000
      );
    } catch (error) {
      console.error("Navigation error:", error);
      
      // Show an error toast
      showToast(
        "Error", 
        "Could not navigate to journal. Please try again.", 
        5000
      );
    }
  };

  // Enhanced handling for button in tutorial mode
  useEffect(() => {
    if (!buttonRef.current) return;
    
    console.log('JournalNavigationButton - Tutorial state:', {
      isActive,
      currentStep,
      isInArrowTutorialStep,
      stepId: steps[currentStep]?.id
    });
    
    // Apply special styling only when in tutorial step 2
    if (isInArrowTutorialStep) {
      const buttonElement = buttonRef.current.querySelector('button');
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
      const glowDiv = buttonRef.current.querySelector('.bg-primary\\/30');
      if (glowDiv) {
        const glowElement = glowDiv as HTMLElement;
        glowElement.style.filter = "drop-shadow(0 0 25px var(--color-theme))";
        glowElement.style.opacity = "0.95";
      }
    } else {
      // Remove tutorial styling when not in step 2
      const buttonElement = buttonRef.current.querySelector('button');
      if (buttonElement) {
        buttonElement.classList.remove('tutorial-button-highlight');
        
        const buttonStyleEl = buttonElement as HTMLElement;
        buttonStyleEl.style.boxShadow = "";
        buttonStyleEl.style.animation = "";
        buttonStyleEl.style.border = "";
        buttonStyleEl.style.transform = "";
      }
      
      const glowDiv = buttonRef.current.querySelector('.bg-primary\\/30');
      if (glowDiv) {
        const glowElement = glowDiv as HTMLElement;
        glowElement.style.filter = "";
        glowElement.style.opacity = "";
      }
    }
  }, [isInArrowTutorialStep, isActive, currentStep, steps]);

  return (
    <div 
      className="journal-arrow-button"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: isInArrowTutorialStep ? 9999 : 40,
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
