
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialStep from './TutorialStep';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

  // Enhanced scrolling prevention when tutorial is active
  useEffect(() => {
    if (isActive) {
      // Save current scroll position
      const scrollPos = window.scrollY;
      
      // Add classes to the body to prevent scrolling
      document.body.classList.add('tutorial-active');
      document.body.style.top = `-${scrollPos}px`;
      
      // Clean up when tutorial is deactivated
      return () => {
        document.body.classList.remove('tutorial-active');
        document.body.style.top = '';
        // Restore scroll position
        window.scrollTo(0, scrollPos);
      };
    }
  }, [isActive]);

  // Handle navigation if specified in tutorial step
  useEffect(() => {
    if (!isActive) return;
    
    const currentTutorialStep = steps[currentStep];
    if (currentTutorialStep?.navigateTo) {
      console.log(`Navigating to ${currentTutorialStep.navigateTo} for tutorial step ${currentTutorialStep.id}`);
      navigate(currentTutorialStep.navigateTo);
    }
  }, [isActive, currentStep, steps, navigate]);

  // Enhanced handling for different tutorial steps
  useEffect(() => {
    if (!isActive) return;
    
    // Handle step 1 - journal header visibility
    if (steps[currentStep]?.id === 1) {
      const journalHeader = document.querySelector('.journal-header-container');
      
      if (journalHeader) {
        console.log("Enhancing journal header visibility for tutorial step 1");
        journalHeader.classList.add('tutorial-target');
        
        // Clean up when step changes
        return () => {
          console.log("Cleaning up journal header styles");
          journalHeader.classList.remove('tutorial-target');
        };
      }
    }
    // Handle step 2 - arrow button visibility
    else if (steps[currentStep]?.id === 2) {
      const arrowButton = document.querySelector('.journal-arrow-button');
      
      if (arrowButton) {
        console.log("Enhancing arrow button visibility for tutorial step 2");
        
        // Add special highlighting class and ensure visibility
        arrowButton.classList.add('tutorial-target');
        
        // Make the button element more prominent with enhanced glow effect
        const buttonElement = arrowButton.querySelector('button');
        if (buttonElement) {
          buttonElement.classList.add('tutorial-button-highlight');
          console.log("Added enhanced highlighting effect to button element");
        }
        
        // Clean up when step changes
        return () => {
          console.log("Cleaning up arrow button styles");
          arrowButton.classList.remove('tutorial-target');
          
          if (buttonElement) {
            buttonElement.classList.remove('tutorial-button-highlight');
          }
        };
      } else {
        console.warn("Could not find journal-arrow-button element for tutorial step 2");
      }
    }
    // Handle step 3 - Record Entry tab visibility
    else if (steps[currentStep]?.id === 3) {
      const recordEntryTab = document.querySelector('[data-value="record"]');
      
      if (recordEntryTab) {
        console.log("Enhancing Record Entry tab visibility for tutorial step 3");
        
        // Add tutorial target class to make the tab visible through overlay
        recordEntryTab.classList.add('tutorial-target');
        recordEntryTab.classList.add('record-entry-tab');
        
        // Add enhanced highlighting for better visibility
        recordEntryTab.classList.add('tutorial-highlight');
        
        // Clean up when step changes
        return () => {
          console.log("Cleaning up Record Entry tab styles");
          recordEntryTab.classList.remove('tutorial-target');
          recordEntryTab.classList.remove('tutorial-highlight');
          recordEntryTab.classList.remove('record-entry-tab');
        };
      } else {
        console.warn("Could not find Record Entry tab for tutorial step 3");
      }
    }
  }, [isActive, currentStep, steps]);

  if (!isActive) return null;

  const currentTutorialStep = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[9997] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
      {/* Semi-transparent overlay with improved interaction blocking */}
      <motion.div
        className="tutorial-overlay absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.75 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={(e) => e.stopPropagation()} // Prevent clicks from reaching elements behind
      />

      {/* Tutorial step with enhanced z-index and pointer events */}
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
