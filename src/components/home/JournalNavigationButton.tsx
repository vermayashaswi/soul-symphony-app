
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTutorial } from '@/contexts/TutorialContext';

const JournalNavigationButton: React.FC = () => {
  const navigate = useNavigate();
  const { isActive, currentStep, steps } = useTutorial();
  const buttonRef = useRef<HTMLDivElement>(null);
  
  // Check if we're in tutorial step 2
  const isInArrowTutorialStep = isActive && steps[currentStep]?.id === 2;

  const navigateToJournal = () => {
    try {
      navigate('/app/journal');
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  // Enhanced handling for button highlighting in tutorial mode
  useEffect(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      console.log('Journal arrow button position:', rect);
      console.log('Journal arrow button center:', {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
      
      // Apply special styles when in tutorial step 2
      if (isInArrowTutorialStep) {
        console.log('Applying enhanced glow effect for tutorial step 2');
        
        // Apply tutorial-target class
        buttonRef.current.classList.add('tutorial-target');
        
        // Apply enhanced styles to the button directly
        const buttonElement = buttonRef.current.querySelector('button');
        if (buttonElement) {
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
          glowDiv.classList.add('tutorial-button-outer-glow');
          
          // Add stronger glow for better visibility
          const glowElement = glowDiv as HTMLElement;
          glowElement.style.filter = "drop-shadow(0 0 25px var(--color-theme))";
          glowElement.style.opacity = "0.95";
        }
        
        // Check after a short delay if styles were applied correctly
        setTimeout(() => {
          const hasTargetClass = buttonRef.current?.classList.contains('tutorial-target');
          const buttonElement = buttonRef.current?.querySelector('button');
          const hasHighlightClass = buttonElement?.classList.contains('tutorial-button-highlight');
          
          console.log('Has tutorial-target class:', hasTargetClass);
          console.log('Button has highlight class:', hasHighlightClass);
          
          // Reapply if needed
          if (!hasTargetClass) {
            console.log('Reapplying tutorial-target class');
            buttonRef.current?.classList.add('tutorial-target');
          }
          
          if (!hasHighlightClass && buttonElement) {
            console.log('Reapplying tutorial-button-highlight class');
            buttonElement.classList.add('tutorial-button-highlight');
            
            // Force stronger glow effect with inline styles again
            const buttonStyleEl = buttonElement as HTMLElement;
            buttonStyleEl.style.boxShadow = "0 0 35px 20px var(--color-theme)";
            buttonStyleEl.style.animation = "button-pulse 1.5s infinite alternate";
            buttonStyleEl.style.border = "2px solid white";
            buttonStyleEl.style.transform = "scale(1.05)";
          }
        }, 200);
      } else {
        // Clean up tutorial styles when not in step 2
        buttonRef.current.classList.remove('tutorial-target');
        
        const buttonElement = buttonRef.current.querySelector('button');
        if (buttonElement) {
          buttonElement.classList.remove('tutorial-button-highlight');
          
          // Remove inline styles
          const buttonStyleEl = buttonElement as HTMLElement;
          buttonStyleEl.style.boxShadow = "";
          buttonStyleEl.style.animation = "";
          buttonStyleEl.style.border = "";
          buttonStyleEl.style.transform = "";
        }
        
        const glowDiv = buttonRef.current.querySelector('.bg-primary\\/30');
        if (glowDiv) {
          glowDiv.classList.remove('tutorial-button-outer-glow');
          
          // Remove inline styles
          const glowElement = glowDiv as HTMLElement;
          glowElement.style.filter = "";
          glowElement.style.opacity = "";
        }
      }
    }
  }, [isInArrowTutorialStep]);

  return (
    <div 
      className={`journal-arrow-button ${isInArrowTutorialStep ? 'tutorial-target' : ''}`}
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: isInArrowTutorialStep ? 9990 : 40, // Lower than popup but higher than normal
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
        className={`absolute inset-0 rounded-full bg-primary/30 blur-md z-0 ${
          isInArrowTutorialStep ? 'tutorial-button-outer-glow' : ''
        }`}
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
          filter: isInArrowTutorialStep ? "drop-shadow(0 0 25px var(--color-theme))" : "none",
        }}
      />
      <motion.button
        onClick={navigateToJournal}
        className={`w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg relative z-20 ${
          isInArrowTutorialStep ? 'tutorial-button-highlight' : ''
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{
          boxShadow: isInArrowTutorialStep ? "0 0 35px 20px var(--color-theme)" : "",
          border: isInArrowTutorialStep ? "2px solid white" : "",
        }}
      >
        <ArrowRight className="text-primary-foreground h-8 w-8" />
      </motion.button>
    </div>
  );
};

export default JournalNavigationButton;
