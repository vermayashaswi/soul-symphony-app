
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialStep from './TutorialStep';
import { useLocation } from 'react-router-dom';
import { isAppRoute } from '@/routes/RouteHelpers';
import { 
  RECORD_ENTRY_SELECTORS, 
  ENTRIES_TAB_SELECTORS,
  CHAT_QUESTION_SELECTORS,
  findAndHighlightElement,
  logPotentialTutorialElements,
  applyTutorialHighlight
} from '@/utils/tutorial/tutorial-elements-finder';

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
  
  // Enhanced scrolling prevention with data attribute for current step
  useEffect(() => {
    if (!shouldShowTutorial) return;
    
    console.log('Tutorial active, disabling page scrolling');
    
    // Save current scroll position
    const scrollPos = window.scrollY;
    
    // Add classes to the body to prevent scrolling
    document.body.classList.add('tutorial-active');
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    
    // Add data attribute for current step to enable more specific CSS targeting
    document.body.setAttribute('data-current-step', String(steps[currentStep]?.id || ''));
    
    // Clean up when tutorial is deactivated
    return () => {
      document.body.classList.remove('tutorial-active');
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.body.removeAttribute('data-current-step');
      
      // Restore scroll position
      window.scrollTo(0, scrollPos);
      console.log('Tutorial inactive, restored page scrolling');
    };
  }, [shouldShowTutorial, currentStep, steps]);

  // Step-specific element highlighting
  useEffect(() => {
    if (!shouldShowTutorial || navigationState.inProgress) return;
    
    const currentStepData = steps[currentStep];
    console.log(`Setting up highlighting for step ${currentStepData?.id}`);
    
    // Remove any existing highlight classes first
    const existingHighlights = document.querySelectorAll('.tutorial-target, .tutorial-button-highlight, .record-entry-tab, .entries-tab, .chat-question-highlight');
    existingHighlights.forEach(el => {
      el.classList.remove('tutorial-target', 'tutorial-button-highlight', 'record-entry-tab', 'entries-tab', 'chat-question-highlight');
      
      // Clear any inline styles that might have been applied
      if (el instanceof HTMLElement) {
        el.style.boxShadow = '';
        el.style.animation = '';
        el.style.border = '';
        el.style.transform = '';
        el.style.zIndex = '';
      }
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
            element.classList.add('tutorial-target', 'record-entry-tab', 'tutorial-button-highlight');
            
            // Apply enhanced styling
            if (element instanceof HTMLElement) {
              element.style.boxShadow = "0 0 35px 20px var(--color-theme)";
              element.style.animation = "button-pulse 1.5s infinite alternate";
              element.style.border = "2px solid white";
              element.style.transform = "scale(1.05)";
              element.style.zIndex = "10000";
            }
            
            foundElement = true;
            console.log(`Applied enhanced highlighting to record entry element using selector: ${selector}`);
            break;
          }
        }
        
        if (!foundElement) {
          console.warn('Record entry element not found with any selector');
        }
      }
      else if (currentStepData?.id === 4) {
        // Step 4: Past Entries Tab - Enhanced with identical styling as record entry
        let foundElement = false;
        
        for (const selector of ENTRIES_TAB_SELECTORS) {
          const element = document.querySelector(selector);
          if (element) {
            element.classList.add('tutorial-target', 'entries-tab', 'tutorial-button-highlight');
            
            // Apply identical styling to record entry button
            if (element instanceof HTMLElement) {
              element.style.boxShadow = "0 0 35px 20px var(--color-theme)";
              element.style.animation = "button-pulse 1.5s infinite alternate";
              element.style.border = "2px solid white";
              element.style.transform = "scale(1.05)";
              element.style.zIndex = "10000";
              
              // Make sure it's fully visible with high opacity
              element.style.opacity = "1";
              element.style.visibility = "visible";
              element.style.position = "relative";
            }
            
            foundElement = true;
            console.log(`Applied enhanced highlighting to entries tab using selector: ${selector}`);
            break;
          }
        }
        
        if (!foundElement) {
          console.warn('Entries tab element not found with any selector');
          
          // Additional debugging to find the element
          console.log('Available elements in DOM:');
          document.querySelectorAll('button, [role="tab"]').forEach(el => {
            console.log(`Element: ${el.tagName}, classes: ${el.className}, attributes:`, 
              Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '));
          });
        }
      }
      else if (currentStepData?.id === 5) {
        // Step 5: Chat Question - Enhanced with more robust element finding
        console.log('Setting up highlight for chat question (step 5)');
        
        // Log all potential targets for debugging
        logPotentialTutorialElements();
        
        // Try to find and highlight using our helper function
        const found = findAndHighlightElement(CHAT_QUESTION_SELECTORS, 'chat-question-highlight');
        
        if (!found) {
          console.warn('Failed to find chat question element with any selector');
          
          // Last resort - try to find any button that might be a suggestion
          const buttons = document.querySelectorAll('button');
          let suggestionsFound = false;
          
          buttons.forEach((button, index) => {
            if (button instanceof HTMLElement && 
                button.textContent && 
                (button.textContent.includes('emotion') || 
                 button.textContent.includes('feel') || 
                 button.textContent.includes('mood'))) {
              
              console.log(`Found potential chat suggestion (button ${index}):`, button.textContent);
              
              if (!suggestionsFound) {
                console.log('Applying highlighting to first matching suggestion button');
                applyTutorialHighlight(button, 'chat-question-highlight');
                suggestionsFound = true;
              }
            }
          });
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
