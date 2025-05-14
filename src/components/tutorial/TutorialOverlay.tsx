
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialStep from './TutorialStep';
import { useLocation } from 'react-router-dom';
import { isAppRoute } from '@/routes/RouteHelpers';

// Define possible selectors for different tutorial steps
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
    tutorialCompleted,
    navigationState
  } = useTutorial();
  
  const location = useLocation();
  
  // Only render tutorial on app routes
  const isAppRouteCurrent = isAppRoute(location.pathname);
  const shouldShowTutorial = isActive && isAppRouteCurrent && !tutorialCompleted;
  
  // Log important state changes
  useEffect(() => {
    console.log('TutorialOverlay state:', {
      isActive,
      currentStep,
      currentStepId: steps[currentStep]?.id,
      navigationState,
      shouldShowTutorial
    });
  }, [isActive, currentStep, steps, navigationState, shouldShowTutorial]);
  
  // Enhanced scrolling prevention
  useEffect(() => {
    if (!shouldShowTutorial) return;
    
    console.log('Tutorial active, disabling page scrolling');
    
    // Save current scroll position
    const scrollPos = window.scrollY;
    
    // Add classes to the body to prevent scrolling
    document.body.classList.add('tutorial-active');
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    
    // Clean up when tutorial is deactivated
    return () => {
      document.body.classList.remove('tutorial-active');
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      
      // Restore scroll position
      window.scrollTo(0, scrollPos);
      console.log('Tutorial inactive, restored page scrolling');
    };
  }, [shouldShowTutorial]);

  // Step-specific element highlighting
  useEffect(() => {
    if (!shouldShowTutorial || navigationState.inProgress) return;
    
    const currentStepData = steps[currentStep];
    console.log(`Setting up highlighting for step ${currentStepData?.id}`);
    
    // Remove any existing highlight classes first
    const existingHighlights = document.querySelectorAll('.tutorial-target, .record-entry-tab, .entries-tab');
    existingHighlights.forEach(el => {
      el.classList.remove('tutorial-target', 'record-entry-tab', 'entries-tab');
    });
    
    // Apply the appropriate highlighting based on step ID
    const highlightTimeout = setTimeout(() => {
      if (currentStepData?.id === 1) {
        // Step 1: Journal Header
        const journalHeader = document.querySelector('.journal-header-container');
        if (journalHeader) {
          journalHeader.classList.add('tutorial-target');
          console.log('Applied highlighting to journal header');
        } else {
          console.warn('Journal header element not found');
        }
      } 
      else if (currentStepData?.id === 2) {
        // Step 2: Arrow Button
        const arrowButton = document.querySelector('.journal-arrow-button');
        if (arrowButton) {
          arrowButton.classList.add('tutorial-target');
          
          // Also highlight the button element
          const buttonElement = arrowButton.querySelector('button');
          if (buttonElement) {
            buttonElement.classList.add('tutorial-button-highlight');
          }
          
          console.log('Applied highlighting to arrow button');
        } else {
          console.warn('Arrow button not found');
        }
      }
      else if (currentStepData?.id === 3) {
        // Step 3: Record Entry Tab
        let foundElement = false;
        
        for (const selector of RECORD_ENTRY_SELECTORS) {
          const element = document.querySelector(selector);
          if (element) {
            element.classList.add('tutorial-target', 'record-entry-tab');
            foundElement = true;
            console.log(`Applied highlighting to record entry element using selector: ${selector}`);
            break;
          }
        }
        
        if (!foundElement) {
          console.warn('Record entry element not found with any selector');
        }
      }
      else if (currentStepData?.id === 4) {
        // Step 4: Past Entries Tab
        let foundElement = false;
        
        for (const selector of ENTRIES_TAB_SELECTORS) {
          const element = document.querySelector(selector);
          if (element) {
            element.classList.add('tutorial-target', 'entries-tab');
            foundElement = true;
            console.log(`Applied highlighting to entries tab using selector: ${selector}`);
            break;
          }
        }
        
        if (!foundElement) {
          console.warn('Entries tab element not found with any selector');
        }
      }
    }, 300);
    
    // Clean up highlighting when step changes
    return () => {
      clearTimeout(highlightTimeout);
    };
  }, [shouldShowTutorial, currentStep, steps, navigationState.inProgress]);

  // If tutorial should not be shown, don't render anything
  if (!shouldShowTutorial) {
    return null;
  }

  const currentTutorialStep = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[9997] pointer-events-auto">
      {/* Semi-transparent overlay */}
      <motion.div
        className="tutorial-overlay absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.75 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={(e) => e.stopPropagation()} // Prevent clicks from reaching elements behind
      />

      {/* Tutorial step */}
      <AnimatePresence mode="wait">
        {currentTutorialStep && !navigationState.inProgress && (
          <TutorialStep
            key={`step-${currentStep}-${currentTutorialStep.id}`}
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
