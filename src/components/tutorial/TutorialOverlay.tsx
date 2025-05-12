
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
    // Handle step 3 - Record Entry tab/button visibility
    else if (steps[currentStep]?.id === 3) {
      // First attempt at finding elements after a short delay
      const initialDelay = setTimeout(() => {
        applyStep3Highlighting();
      }, 500);
      
      // Try again with longer delays to ensure elements are loaded
      const secondAttempt = setTimeout(() => {
        console.log("Second attempt at highlighting Record Entry elements");
        applyStep3Highlighting();
      }, 1000);
      
      const thirdAttempt = setTimeout(() => {
        console.log("Third attempt at highlighting Record Entry elements");
        applyStep3Highlighting();
      }, 2000);
      
      // Function to apply highlighting to step 3 elements
      const applyStep3Highlighting = () => {
        // Try multiple selectors to find the target
        const possibleSelectors = [
          '[data-value="record"]',
          '.record-entry-tab',
          '.tutorial-record-entry-button',
          'button[data-tutorial-target="record-entry"]',
          '.record-entry-button'
        ];
        
        let recordEntryElement = null;
        
        // Try each selector until we find a match
        for (const selector of possibleSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            recordEntryElement = element;
            console.log(`Found Record Entry element with selector: ${selector}`, element);
            break;
          }
        }
        
        if (recordEntryElement) {
          console.log("Enhancing Record Entry element visibility for tutorial step 3", recordEntryElement);
          
          // Add tutorial target class to make the element visible through overlay
          recordEntryElement.classList.add('tutorial-target');
          recordEntryElement.classList.add('record-entry-tab');
          
          // Add enhanced highlighting for better visibility
          recordEntryElement.classList.add('tutorial-highlight');
          
          // Force the element to be visible with inline styles
          (recordEntryElement as HTMLElement).style.visibility = 'visible';
          (recordEntryElement as HTMLElement).style.opacity = '1';
          (recordEntryElement as HTMLElement).style.pointerEvents = 'auto';
          (recordEntryElement as HTMLElement).style.position = 'relative';
          (recordEntryElement as HTMLElement).style.zIndex = '10000';
          
          console.log("Added classes and styles to Record Entry element:", recordEntryElement);
          
          // Log computed styles to verify our styles are applied
          const computedStyle = window.getComputedStyle(recordEntryElement);
          console.log("Computed styles for Record Entry element:", {
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
            zIndex: computedStyle.zIndex,
            position: computedStyle.position
          });
        } else {
          console.warn("Could not find Record Entry element for tutorial step 3 with any selector");
        }
      };
      
      // Clean up when step changes
      return () => {
        console.log("Cleaning up Record Entry element styles");
        clearTimeout(initialDelay);
        clearTimeout(secondAttempt);
        clearTimeout(thirdAttempt);
        
        // Remove classes from all possible elements
        possibleSelectors.forEach(selector => {
          const element = document.querySelector(selector);
          if (element) {
            element.classList.remove('tutorial-target', 'record-entry-tab', 'tutorial-highlight');
            (element as HTMLElement).style.visibility = '';
            (element as HTMLElement).style.opacity = '';
            (element as HTMLElement).style.pointerEvents = '';
            (element as HTMLElement).style.position = '';
            (element as HTMLElement).style.zIndex = '';
          }
        });
      };
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
