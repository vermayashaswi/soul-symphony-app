
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
        console.log("Enhancing arrow button visibility for tutorial step 2");
        
        // Add special highlighting class and ensure visibility
        arrowButton.classList.add('tutorial-target');
        
        // Make the button element more prominent with glow effect
        const buttonElement = arrowButton.querySelector('button');
        if (buttonElement) {
          buttonElement.classList.add('tutorial-button-glow');
          console.log("Added glow effect to button element");
        }
        
        // Clean up when step changes
        return () => {
          console.log("Cleaning up arrow button styles");
          arrowButton.classList.remove('tutorial-target');
          
          if (buttonElement) {
            buttonElement.classList.remove('tutorial-button-glow');
          }
        };
      } else {
        console.warn("Could not find journal-arrow-button element for tutorial step 2");
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
        className="tutorial-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.75 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />

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
