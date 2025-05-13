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
  '#new-entry-button',
  '.record-entry-button'
];

const ENTRIES_TAB_SELECTORS = [
  '[value="entries"]',
  '.entries-tab',
  'button[data-tutorial-target="past-entries"]',
  '#past-entries-button'
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
  const [attempts, setAttempts] = useState(0);

  // Enhanced scrolling prevention when tutorial is active
  useEffect(() => {
    if (!isActive) return;
    
    console.log('Tutorial active, disabling page scrolling');
    
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
      console.log('Tutorial inactive, restored page scrolling');
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
    
    const currentTutorialStep = steps[currentStep];
    if (currentTutorialStep?.navigateTo && location.pathname !== currentTutorialStep.navigateTo) {
      console.log(`TutorialOverlay - Navigating to ${currentTutorialStep.navigateTo} for tutorial step ${currentTutorialStep.id}`);
      navigate(currentTutorialStep.navigateTo);
    }
  }, [isActive, currentStep, steps, navigate, location.pathname]);

  // Enhanced handling for different tutorial steps with better detection
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
        // Reset attempt counter for new detection cycle
        setAttempts(0);
        setElementForStep3Found(false);
        
        // Ensure we're on the journal page for step 3
        if (location.pathname === '/app/journal') {
          cleanup = handleRecordEntryVisibility();
        } else {
          console.log('TutorialOverlay - Not on journal page yet, will navigate there');
          navigate('/app/journal');
        }
        break;
      case 4:
        console.log('TutorialOverlay - Step 4 detected, current path:', location.pathname);
        if (location.pathname === '/app/journal') {
          cleanup = handleEntriesTabVisibility();
        } else {
          console.log('TutorialOverlay - Not on journal page yet, will navigate there');
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
      
      // Log positioning for debugging
      const rect = journalHeader.getBoundingClientRect();
      console.log('Journal header position:', rect);
      
      // Clean up when step changes
      return () => {
        console.log("Cleaning up journal header styles");
        journalHeader.classList.remove('tutorial-target');
      };
    }
    
    return () => {};
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
        
        // Log positioning
        const rect = buttonElement.getBoundingClientRect();
        console.log('Button element position:', rect);
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
    
    return () => {};
  };

  // Handle step 3 - Record Entry tab/button visibility with improved debugging and retry logic
  const handleRecordEntryVisibility = () => {
    console.log('TutorialOverlay - Setting up Record Entry visibility for step 3');
    
    // Delay searching for elements to ensure they've loaded
    const searchTimeout = setTimeout(() => {
      // Log all possible elements in the DOM for debugging
      console.log('Checking all possible Record Entry elements:');
      RECORD_ENTRY_SELECTORS.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        console.log(`  - ${selector}: ${elements.length} elements found`);
        elements.forEach((el, i) => {
          const rect = (el as HTMLElement).getBoundingClientRect();
          console.log(`    Element ${i} rect:`, rect);
        });
      });
      
      const found = applyStep3Highlighting();
      
      if (found) {
        console.log(`TutorialOverlay - Found Record Entry element on attempt ${attempts + 1}`);
        setElementForStep3Found(true);
      } else {
        // Retry logic - attempt to find the element again if we haven't reached 5 attempts
        if (attempts < 5) {
          console.log(`Retrying element search (attempt ${attempts + 1} of 5)`);
          setAttempts(prev => prev + 1);
          // Schedule another attempt
          setTimeout(() => handleRecordEntryVisibility(), 500);
        } else {
          console.warn('TutorialOverlay - Maximum attempts reached to find Record Entry element');
          // Force showing the tutorial step even if the element wasn't found
          setElementForStep3Found(true);
          console.log('TutorialOverlay - Forcing step 3 to show anyway');
        }
      }
    }, 500);
    
    // Clean up when step changes
    return () => {
      clearTimeout(searchTimeout);
      console.log("Cleaning up Record Entry element styles");
      
      // Remove classes from all possible elements
      RECORD_ENTRY_SELECTORS.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.classList.remove('tutorial-target', 'record-entry-tab', 'tutorial-highlight');
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
      const elementStyle = recordEntryElement as HTMLElement;
      elementStyle.style.visibility = 'visible';
      elementStyle.style.opacity = '1';
      elementStyle.style.pointerEvents = 'auto';
      elementStyle.style.position = 'relative';
      elementStyle.style.zIndex = '10000';
      
      console.log("Added classes and styles to Record Entry element");
      
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

  // Handle step 4 - Past Entries tab visibility - Enhanced to match step 3's behavior
  const handleEntriesTabVisibility = () => {
    console.log('TutorialOverlay - Setting up Past Entries tab visibility for step 4');
    
    // Delay searching for elements to ensure they've loaded
    const searchTimeout = setTimeout(() => {
      // Log all possible elements in the DOM for debugging
      console.log('Checking for Past Entries tab elements:');
      ENTRIES_TAB_SELECTORS.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        console.log(`  - ${selector}: ${elements.length} elements found`);
        elements.forEach((el, i) => {
          const rect = (el as HTMLElement).getBoundingClientRect();
          console.log(`    Element ${i} rect:`, rect);
        });
      });
      
      let entriesTabElement = null;
      
      // Try each selector until we find a match
      for (const selector of ENTRIES_TAB_SELECTORS) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          entriesTabElement = elements[0];
          console.log(`Found Past Entries tab element with selector: ${selector}`, entriesTabElement);
          break;
        }
      }
      
      if (entriesTabElement) {
        console.log("Enhancing Past Entries tab visibility for tutorial step 4", entriesTabElement);
        
        // Add tutorial target class to make the element visible through overlay
        entriesTabElement.classList.add('tutorial-target');
        entriesTabElement.classList.add('entries-tab');
        
        // Add enhanced highlighting for better visibility - Match step 3's highlighting
        entriesTabElement.classList.add('tutorial-highlight');
        
        // Force the element to be visible with inline styles - Match step 3's styling
        const elementStyle = entriesTabElement as HTMLElement;
        elementStyle.style.visibility = 'visible';
        elementStyle.style.opacity = '1';
        elementStyle.style.pointerEvents = 'auto';
        elementStyle.style.position = 'relative';
        elementStyle.style.zIndex = '10000';
        
        console.log("Added classes and styles to Past Entries tab element");
        
        // Log computed styles to verify our styles are applied
        const computedStyle = window.getComputedStyle(entriesTabElement);
        console.log("Computed styles for Past Entries tab element:", {
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
          zIndex: computedStyle.zIndex,
          position: computedStyle.position
        });
      } else {
        console.warn("Could not find Past Entries tab element for tutorial step 4 with any selector");
      }
    }, 500);
    
    // Clean up when step changes
    return () => {
      clearTimeout(searchTimeout);
      console.log("Cleaning up Past Entries tab element styles");
      
      // Remove classes from all possible elements
      ENTRIES_TAB_SELECTORS.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.classList.remove('tutorial-target', 'entries-tab', 'tutorial-highlight');
        });
      });
    };
  };

  if (!isActive) return null;

  const currentTutorialStep = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  // For step 3, only show if we found the element or are on attempt 5+
  const shouldShowStep3UI = currentTutorialStep?.id !== 3 || 
                           (elementForStep3Found || attempts >= 5);

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
        {shouldShowStep3UI && (
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
