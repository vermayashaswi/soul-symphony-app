
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialStep from './TutorialStep';
import { useNavigate, useLocation } from 'react-router-dom';

// Define possible selectors at the component level so they are available throughout
const RECORD_ENTRY_SELECTORS = [
  '[data-value="record"]',
  '.record-entry-tab',
  '.tutorial-record-entry-button',
  'button[data-tutorial-target="record-entry"]',
  '.record-entry-button',
  '#new-entry-button'  // Adding ID selector for more reliable targeting
];

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
  const location = useLocation();
  const [elementForStep3Found, setElementForStep3Found] = useState(false);

  // Enhanced scrolling prevention when tutorial is active
  useEffect(() => {
    if (!isActive) return;
    
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
  }, [isActive]);

  // Handle navigation if specified in tutorial step
  useEffect(() => {
    if (!isActive) return;
    
    // Debug the current state
    console.log('TutorialOverlay - Current state:', {
      isActive,
      currentStep,
      currentPath: location.pathname,
      currentStepData: steps[currentStep]
    });
    
    handleStepNavigation();
  }, [isActive, currentStep, steps, navigate, location.pathname]);

  // Separated navigation handling logic with improved logging
  const handleStepNavigation = () => {
    const currentTutorialStep = steps[currentStep];
    if (currentTutorialStep?.navigateTo && location.pathname !== currentTutorialStep.navigateTo) {
      console.log(`TutorialOverlay - Navigating to ${currentTutorialStep.navigateTo} for tutorial step ${currentTutorialStep.id}`);
      navigate(currentTutorialStep.navigateTo);
    }
  };

  // Enhanced handling for different tutorial steps with better detection for step 3
  useEffect(() => {
    if (!isActive) return;
    
    const currentTutorialStep = steps[currentStep];
    if (!currentTutorialStep) return;
    
    console.log(`TutorialOverlay - Setting up step ${currentTutorialStep.id} on path ${location.pathname}`);
    
    // Apply highlighting based on step ID
    let cleanup: (() => void) | undefined;
    
    switch (currentTutorialStep.id) {
      case 1:
        cleanup = handleJournalHeaderVisibility();
        break;
      case 2:
        cleanup = handleArrowButtonVisibility();
        break;
      case 3:
        console.log('TutorialOverlay - Step 3 detected, current path:', location.pathname);
        // Ensure we're on the journal page for step 3
        if (location.pathname === '/app/journal') {
          cleanup = handleRecordEntryVisibility();
        } else {
          console.log('TutorialOverlay - Not on journal page yet. Will navigate there soon.');
          navigate('/app/journal');
        }
        break;
    }
    
    // Return combined cleanup function
    return cleanup;
  }, [isActive, currentStep, steps, location.pathname, navigate]);

  // Handle step 1 - journal header visibility
  const handleJournalHeaderVisibility = () => {
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
  };

  // Handle step 2 - arrow button visibility
  const handleArrowButtonVisibility = () => {
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
  };

  // Handle step 3 - Record Entry tab/button visibility with improved debugging
  const handleRecordEntryVisibility = () => {
    console.log('TutorialOverlay - Setting up Record Entry visibility for step 3');
    setElementForStep3Found(false);
    
    // Use a series of attempts with increasing delays to find the element
    const attempts = [100, 300, 500, 1000, 2000];
    const timeouts: NodeJS.Timeout[] = [];
    
    attempts.forEach((delay, index) => {
      const timeout = setTimeout(() => {
        console.log(`TutorialOverlay - Attempt ${index + 1} to find Record Entry element`);
        
        // Log all available elements in the DOM for debugging
        console.log('Checking all possible Record Entry elements:');
        RECORD_ENTRY_SELECTORS.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          console.log(`  - ${selector}: ${elements.length} elements found`);
          elements.forEach((el, i) => {
            console.log(`    Element ${i}:`, el);
          });
        });
        
        const found = applyStep3Highlighting();
        
        if (found) {
          console.log(`TutorialOverlay - Found element on attempt ${index + 1}`);
          setElementForStep3Found(true);
          
          // Clear remaining timeouts
          timeouts.forEach((t, i) => {
            if (i > index) clearTimeout(t);
          });
        } else if (index === attempts.length - 1) {
          console.warn('TutorialOverlay - All attempts to find Record Entry element failed');
          
          // Force showing the tutorial step even if the element wasn't found
          // This ensures users can progress through the tutorial
          setElementForStep3Found(true);
          console.log('TutorialOverlay - Forcing step 3 to show anyway');
        }
      }, delay);
      
      timeouts.push(timeout);
    });
    
    // Clean up when step changes
    return () => {
      console.log("Cleaning up Record Entry element styles");
      timeouts.forEach(t => clearTimeout(t));
      
      // Remove classes from all possible elements
      RECORD_ENTRY_SELECTORS.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.classList.remove('tutorial-target', 'record-entry-tab', 'tutorial-highlight');
          (element as HTMLElement).style.visibility = '';
          (element as HTMLElement).style.opacity = '';
          (element as HTMLElement).style.pointerEvents = '';
          (element as HTMLElement).style.position = '';
          (element as HTMLElement).style.zIndex = '';
        });
      });
    };
  };
  
  // Function to apply highlighting to step 3 elements with better debugging
  const applyStep3Highlighting = (): boolean => {
    let recordEntryElement = null;
    
    // Try each selector until we find a match
    for (const selector of RECORD_ENTRY_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        recordEntryElement = elements[0];
        console.log(`Found Record Entry element with selector: ${selector}`, recordEntryElement);
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
      
      return true;
    } else {
      console.warn("Could not find Record Entry element for tutorial step 3 with any selector");
      return false;
    }
  };

  if (!isActive) return null;

  const currentTutorialStep = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  // For step 3, we'll show the UI regardless of whether the element is found 
  // This ensures users can progress even if there are targeting issues
  const shouldRenderStepUI = !(currentTutorialStep?.id === 3 && !elementForStep3Found && location.pathname === '/app/journal' && location.pathname !== '/app/journal');

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
        {shouldRenderStepUI && (
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
        )}
      </AnimatePresence>
    </div>
  );
};

export default TutorialOverlay;
