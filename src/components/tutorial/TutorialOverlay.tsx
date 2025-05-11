
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialStep from './TutorialStep';

const TutorialOverlay: React.FC = () => {
  const { 
    isActive, 
    currentStep, 
    totalSteps,
    steps, 
    nextStep, 
    prevStep, 
    skipTutorial
  } = useTutorial();

  // Special handling for the arrow button in step 2
  useEffect(() => {
    if (isActive && steps[currentStep]?.id === 2) {
      const arrowButton = document.querySelector('.journal-arrow-button');
      
      if (arrowButton) {
        // Add special highlighting class and raise z-index
        arrowButton.classList.add('tutorial-target', 'tutorial-highlight');
        
        // Force arrow button to be visible during tutorial
        (arrowButton as HTMLElement).style.zIndex = '9998';
        (arrowButton as HTMLElement).style.position = 'relative';
        (arrowButton as HTMLElement).style.pointerEvents = 'auto';
        (arrowButton as HTMLElement).style.visibility = 'visible';
        (arrowButton as HTMLElement).style.opacity = '1';
        
        // Add an extra glow effect
        const buttonElement = arrowButton.querySelector('button');
        if (buttonElement) {
          buttonElement.classList.add('tutorial-button-glow');
        }
        
        // Clean up when step changes
        return () => {
          arrowButton.classList.remove('tutorial-target', 'tutorial-highlight');
          // Reset the inline styles
          (arrowButton as HTMLElement).style.removeProperty('z-index');
          (arrowButton as HTMLElement).style.removeProperty('position');
          (arrowButton as HTMLElement).style.removeProperty('pointer-events');
          (arrowButton as HTMLElement).style.removeProperty('visibility');
          (arrowButton as HTMLElement).style.removeProperty('opacity');
          
          if (buttonElement) {
            buttonElement.classList.remove('tutorial-button-glow');
          }
        };
      }
    }
  }, [isActive, currentStep, steps]);

  if (!isActive) return null;

  const currentTutorialStep = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[9997] pointer-events-auto">
      {/* Semi-transparent overlay */}
      <motion.div
        className="absolute inset-0 bg-black pointer-events-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.75 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={() => {}}
        style={{ 
          touchAction: 'none', 
          opacity: 0.75 // Fixed 75% opacity
        }}
      />

      {/* Apply special styles to target element */}
      <style dangerouslySetInnerHTML={{
        __html: `
          ${currentTutorialStep.targetElement} {
            position: relative;
            z-index: 9998;
            filter: none;
            pointer-events: auto;
          }
          ${currentTutorialStep.targetElement}::before {
            content: '';
            position: absolute;
            inset: -8px;
            background: radial-gradient(
              circle at center,
              rgba(var(--primary-h), var(--primary-s), var(--primary-l), 0.2) 0%,
              transparent 70%
            );
            border-radius: inherit;
            z-index: -1;
          }
          
          /* Specific styles for the journal arrow button */
          .journal-arrow-button {
            z-index: 9998 !important;
            position: relative !important;
            pointer-events: auto !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          
          /* Highlight effect for tutorial targets */
          .tutorial-target {
            animation: pulse-highlight 2s infinite;
          }
          
          /* Extra glow for tutorial button */
          .tutorial-button-glow {
            box-shadow: 0 0 15px 5px var(--color-theme) !important;
            animation: button-pulse 1.5s infinite alternate !important;
          }
          
          @keyframes button-pulse {
            0% { box-shadow: 0 0 15px 5px var(--color-theme); }
            100% { box-shadow: 0 0 25px 8px var(--color-theme); }
          }
          
          @keyframes pulse-highlight {
            0% { box-shadow: 0 0 0 0 rgba(var(--primary-h), var(--primary-s), var(--primary-l), 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(var(--primary-h), var(--primary-s), var(--primary-l), 0); }
            100% { box-shadow: 0 0 0 0 rgba(var(--primary-h), var(--primary-s), var(--primary-l), 0); }
          }
        `
      }} />

      {/* Tutorial step */}
      <AnimatePresence mode="wait">
        <TutorialStep
          key={currentStep}
          step={currentTutorialStep}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTutorial}
          isFirst={isFirstStep}
          isLast={isLastStep}
          stepNumber={currentStep + 1}
          totalSteps={totalSteps}
        />
      </AnimatePresence>
    </div>
  );
};

export default TutorialOverlay;
