import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialStep from './TutorialStep';
import { useNavigate, useLocation } from 'react-router-dom';
import { isAppRoute } from '@/routes/RouteHelpers';

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
    skipTutorial,
    tutorialCompleted
  } = useTutorial();
  const navigate = useNavigate();
  const location = useLocation();
  const [elementForStep3Found, setElementForStep3Found] = useState(false);
  const [attempts, setAttempts] = useState(0);
  
  // Only render tutorial on app routes - strict checking
  const currentPath = location.pathname;
  const isAppRouteCurrent = isAppRoute(currentPath);
  const shouldShowTutorial = isActive && isAppRouteCurrent && !tutorialCompleted;
  
  // Log whenever the component is rendered and what the decision is
  useEffect(() => {
    console.log('TutorialOverlay render check:', {
      isActive,
      currentPath,
      isAppRouteCurrent,
      shouldShowTutorial,
      tutorialCompleted
    });
    
    // Add class to document body when tutorial is completed
    if (tutorialCompleted) {
      document.body.classList.add('tutorial-completed');
    } else {
      document.body.classList.remove('tutorial-completed');
    }
    
    // Cleanup function
    return () => {
      // Remove class when component unmounts
      if (tutorialCompleted) {
        document.body.classList.add('tutorial-completed');
      }
    };
  }, [isActive, currentPath, isAppRouteCurrent, shouldShowTutorial, tutorialCompleted]);
  
  // Enhanced scrolling prevention when tutorial is active
  useEffect(() => {
    if (!shouldShowTutorial) return;
    
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
  }, [shouldShowTutorial]);

  // Handle navigation if specified in tutorial step
  useEffect(() => {
    if (!shouldShowTutorial) return;
    
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
  }, [shouldShowTutorial, currentStep, steps, navigate, location.pathname]);

  // Enhanced handling for different tutorial steps with better detection
  useEffect(() => {
    if (!shouldShowTutorial) return;
    
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
  }, [shouldShowTutorial, currentStep, steps, location.pathname, navigate, attempts]);

  // Handle step 1 - journal header visibility with enhanced positioning
  const handleJournalHeaderVisibility = () => {
    const journalHeader = document.querySelector('.journal-header-container');
    
    if (journalHeader) {
      console.log("Enhancing journal header visibility for tutorial step 1");
      journalHeader.classList.add('tutorial-target');
      
      // Log positioning for debugging
      const rect = journalHeader.getBoundingClientRect();
      console.log('Journal header position:', rect);
      
      // On smaller screens, make sure the tutorial will be visible 
      if (window.innerWidth < 480) {
        console.log('Small screen detected for step 1, applying special styling');
        setTimeout(() => {
          // Force any existing tutorial popup to be properly positioned
          const tutorialPopup = document.querySelector('.tutorial-step-container[data-step="1"]');
          if (tutorialPopup && tutorialPopup instanceof HTMLElement) {
            tutorialPopup.style.position = 'fixed';
            tutorialPopup.style.top = '50%';
            tutorialPopup.style.left = '50%';
            tutorialPopup.style.transform = 'translate(-50%, -50%)';
            tutorialPopup.style.maxWidth = '90%';
            tutorialPopup.style.width = '90%';
            tutorialPopup.style.zIndex = '20000';
            console.log('Fixed position for step 1 tutorial popup on small screen');
          }
        }, 100);
      }
      
      // Clean up when step changes
      return () => {
        console.log("Cleaning up journal header styles");
        journalHeader.classList.remove('tutorial-target');
      };
    }
    
    return () => {};
  };

  // Handle step 2 - arrow button visibility with enhanced glow effect
  const handleArrowButtonVisibility = () => {
    const arrowButton = document.querySelector('.journal-arrow-button');
    
    if (arrowButton) {
      console.log("Enhancing arrow button visibility for tutorial step 2");
      
      // Add special highlighting class and ensure visibility with stronger inline styles
      arrowButton.classList.add('tutorial-target');
      
      // Force visibility with inline styles
      const arrowButtonElement = arrowButton as HTMLElement;
      arrowButtonElement.style.zIndex = "9990";
      arrowButtonElement.style.visibility = "visible";
      arrowButtonElement.style.opacity = "1";
      arrowButtonElement.style.pointerEvents = "auto";
      
      // Make the button element more prominent with enhanced glow effect
      const buttonElement = arrowButton.querySelector('button');
      if (buttonElement) {
        buttonElement.classList.add('tutorial-button-highlight');
        console.log("Added enhanced highlighting effect to button element");
        
        // Force stronger glow effect with inline styles - important for visibility
        const buttonStyleEl = buttonElement as HTMLElement;
        buttonStyleEl.style.boxShadow = "0 0 35px 20px var(--color-theme)";
        buttonStyleEl.style.animation = "button-pulse 1.5s infinite alternate";
        buttonStyleEl.style.border = "2px solid white";
        buttonStyleEl.style.transform = "scale(1.05)";
        
        // Log positioning
        const rect = buttonElement.getBoundingClientRect();
        console.log('Button element position:', rect);
      }
      
      // Also highlight the button's outer glow div if it exists
      const outerGlowDiv = arrowButton.querySelector('.bg-primary\\/30');
      if (outerGlowDiv) {
        outerGlowDiv.classList.add('tutorial-button-outer-glow');
        
        // Add stronger glow for better visibility
        const glowElement = outerGlowDiv as HTMLElement;
        glowElement.style.filter = "drop-shadow(0 0 25px var(--color-theme))";
        glowElement.style.opacity = "0.95";
        
        console.log("Added enhanced outer glow effect");
      }
      
      // Clean up when step changes
      return () => {
        console.log("Cleaning up arrow button styles");
        arrowButton.classList.remove('tutorial-target');
        
        if (arrowButtonElement) {
          arrowButtonElement.style.zIndex = "";
          arrowButtonElement.style.visibility = "";
          arrowButtonElement.style.opacity = "";
          arrowButtonElement.style.pointerEvents = "";
        }
        
        if (buttonElement) {
          buttonElement.classList.remove('tutorial-button-highlight');
          const buttonStyleEl = buttonElement as HTMLElement;
          if (buttonStyleEl) {
            buttonStyleEl.style.boxShadow = "";
            buttonStyleEl.style.animation = "";
            buttonStyleEl.style.border = "";
            buttonStyleEl.style.transform = "";
          }
        }
        
        if (outerGlowDiv) {
          outerGlowDiv.classList.remove('tutorial-button-outer-glow');
          const glowElement = outerGlowDiv as HTMLElement;
          glowElement.style.filter = "";
          glowElement.style.opacity = "";
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
    
    // Always set element found to true for Step 3 to force the popup to show
    setElementForStep3Found(true);
    
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
      
      // Try to find and highlight the record entry button
      let recordEntryElement = null;
      for (const selector of RECORD_ENTRY_SELECTORS) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          recordEntryElement = elements[0];
          console.log(`Found Record Entry element with selector: ${selector}`, recordEntryElement);
          break;
        }
      }
      
      if (recordEntryElement) {
        console.log("Enhancing Record Entry element visibility for step 3", recordEntryElement);
        
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
        elementStyle.style.boxShadow = '0 0 20px 10px var(--color-theme)';
        
        console.log("Added classes and styles to Record Entry element");
        
        // Log computed styles to verify our styles are applied
        const computedStyle = window.getComputedStyle(recordEntryElement);
        console.log("Computed styles for Record Entry element:", {
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
          zIndex: computedStyle.zIndex,
          position: computedStyle.position
        });
      } else {
        console.warn("Could not find Record Entry element for step 3 with any selector");
      }
      
      // Create and force styling of Step 3 tutorial popup container for guaranteed visibility
      setTimeout(() => {
        const step3Popup = document.querySelector('.tutorial-step-container[data-step="3"]');
        if (step3Popup && step3Popup instanceof HTMLElement) {
          step3Popup.style.position = 'fixed';
          step3Popup.style.top = '50%';
          step3Popup.style.left = '50%';
          step3Popup.style.transform = 'translate(-50%, -50%)';
          step3Popup.style.zIndex = '30000';
          step3Popup.style.maxWidth = '300px';
          step3Popup.style.width = 'calc(100% - 40px)';
          step3Popup.style.border = '3px solid var(--color-theme)';
          step3Popup.style.backgroundColor = '#1A1F2C'; // Solid dark background
          step3Popup.style.color = 'white';             // White text
          step3Popup.style.boxShadow = '0 0 30px rgba(0, 0, 0, 0.8)'; // Stronger shadow
          console.log('Forced styling for Step 3 popup applied with opaque background');
        }
      }, 200);
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
          
          // Also remove inline styles
          const el = element as HTMLElement;
          if (el) {
            el.style.visibility = '';
            el.style.opacity = '';
            el.style.pointerEvents = '';
            el.style.position = '';
            el.style.zIndex = '';
          }
        });
      });
    };
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
        elementStyle.style.boxShadow = '0 0 20px 10px var(--color-theme)';
        
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
        console.warn("Could not find Past Entries tab element for step 4 with any selector");
      }
      
      // Create and force styling of Step 4 tutorial popup container for guaranteed visibility
      setTimeout(() => {
        const step4Popup = document.querySelector('.tutorial-step-container[data-step="4"]');
        if (step4Popup && step4Popup instanceof HTMLElement) {
          step4Popup.style.position = 'fixed';
          step4Popup.style.top = '50%';
          step4Popup.style.left = '50%';
          step4Popup.style.transform = 'translate(-50%, -50%)';
          step4Popup.style.zIndex = '30000';
          step4Popup.style.maxWidth = '300px';
          step4Popup.style.width = 'calc(100% - 40px)';
          step4Popup.style.border = '3px solid var(--color-theme)';
          step4Popup.style.backgroundColor = '#1A1F2C'; // Solid dark background
          step4Popup.style.color = 'white';             // White text
          step4Popup.style.boxShadow = '0 0 30px rgba(0, 0, 0, 0.8)'; // Stronger shadow
          console.log('Forced styling for Step 4 popup applied with opaque background');
        }
      }, 200);
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
          
          // Also clean up inline styles
          const el = element as HTMLElement;
          if (el) {
            el.style.visibility = '';
            el.style.opacity = '';
            el.style.pointerEvents = '';
            el.style.position = '';
            el.style.zIndex = '';
            el.style.boxShadow = '';
          }
        });
      });
    };
  };

  // If not an app route or tutorial not active, don't render anything
  if (!shouldShowTutorial) {
    console.log('TutorialOverlay not shown: isActive=', isActive, 'isAppRouteCurrent=', isAppRouteCurrent, 'tutorialCompleted=', tutorialCompleted);
    return null;
  }

  const currentTutorialStep = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  // For step 3, always show the UI since we're now centering it on screen
  const shouldShowStep3UI = true;

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
