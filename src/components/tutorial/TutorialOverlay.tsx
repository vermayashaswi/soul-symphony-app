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
    
    // Special handling for step 5 - ensure chat background is visible
    if (steps[currentStep]?.id === 5) {
      // Prepare the chat container for better visibility
      const chatContainers = document.querySelectorAll('.smart-chat-container, .mobile-chat-interface, .chat-messages-container');
      chatContainers.forEach(container => {
        if (container instanceof HTMLElement) {
          container.style.backgroundColor = '#000000';
          container.style.opacity = '0.9';
          container.style.visibility = 'visible';
        }
      });
      
      // Make sure EmptyChatState is visible
      const emptyChatState = document.querySelector('.flex.flex-col.items-center.justify-center.p-6.text-center.h-full');
      if (emptyChatState && emptyChatState instanceof HTMLElement) {
        emptyChatState.style.visibility = 'visible';
        emptyChatState.style.opacity = '1';
        emptyChatState.style.zIndex = '5000';
        emptyChatState.style.display = 'flex';
      }
      
      // Run another check after a short delay to catch dynamically loaded elements
      setTimeout(() => {
        if (steps[currentStep]?.id === 5) {
          const chatSuggestions = document.querySelectorAll('.empty-chat-suggestion, .chat-suggestion-button');
          chatSuggestions.forEach(suggestion => {
            if (suggestion instanceof HTMLElement) {
              suggestion.style.visibility = 'visible';
              suggestion.style.display = 'block';
              suggestion.style.opacity = '1';
              
              // Add tutorial classes for highlighting
              suggestion.classList.add('chat-question-highlight', 'tutorial-target');
            }
          });
        }
      }, 500);
    }
    
    // Clean up when tutorial is deactivated
    return () => {
      document.body.classList.remove('tutorial-active');
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.body.removeAttribute('data-current-step');
      
      // Restore scroll position
      window.scrollTo(0, scrollPos);
      console.log('Tutorial inactive, restored page scrolling');
      
      // Small delay to ensure chat interface re-renders properly
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        
        // Force chat interface to refresh
        if (location.pathname === '/app/chat') {
          console.log('Triggering chat refresh after tutorial');
          window.dispatchEvent(new CustomEvent('chatRefreshNeeded'));
        }
      }, 300);
    };
  }, [shouldShowTutorial, currentStep, steps, location.pathname]);

  // Step-specific element highlighting with chat step improvements
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
        }
      }
      // Improved Step 5 handling for better visibility
      else if (currentStepData?.id === 5) {
        console.log('Setting up highlight for chat question (step 5)');
        
        // Set black background for better visibility with opacity
        const chatContainers = document.querySelectorAll('.smart-chat-container, .mobile-chat-interface, .chat-messages-container');
        chatContainers.forEach(container => {
          if (container instanceof HTMLElement) {
            container.style.backgroundColor = '#000000';
            container.style.opacity = '0.9';
            container.style.visibility = 'visible';
          }
        });
        
        // Make sure EmptyChatState is visible
        const emptyChatState = document.querySelector('.flex.flex-col.items-center.justify-center.p-6.text-center.h-full');
        if (emptyChatState && emptyChatState instanceof HTMLElement) {
          emptyChatState.style.visibility = 'visible';
          emptyChatState.style.opacity = '1';
          emptyChatState.style.zIndex = '5000';
          emptyChatState.style.display = 'flex';
        }
        
        // Log all potential targets for debugging
        logPotentialTutorialElements();
        
        // First try to highlight existing chat suggestions in EmptyChatState
        const emptyChatSuggestions = document.querySelectorAll('.empty-chat-suggestion, .chat-suggestion-button');
        if (emptyChatSuggestions.length > 0) {
          console.log(`Found ${emptyChatSuggestions.length} chat suggestions in EmptyChatState`);
          emptyChatSuggestions.forEach((element, index) => {
            if (index === 0) { // Only highlight the first one
              element.classList.add('chat-question-highlight', 'tutorial-target');
              
              // Apply enhanced visibility
              if (element instanceof HTMLElement) {
                element.style.display = 'block';
                element.style.visibility = 'visible';
                element.style.opacity = '1';
                element.style.zIndex = '20000';
                element.style.position = 'relative';
                element.style.boxShadow = '0 0 40px 25px var(--color-theme)';
                element.style.animation = 'ultra-strong-pulse 1.5s infinite alternate';
                element.style.border = '2px solid white';
                element.style.transform = 'scale(1.1)';
              }
              
              console.log('Applied highlighting to first chat suggestion in EmptyChatState');
            }
          });
        } else {
          // Try to find and highlight using our helper function
          const found = findAndHighlightElement(CHAT_QUESTION_SELECTORS, 'chat-question-highlight');
          
          if (!found) {
            console.warn('Failed to find chat question element with any selector');
            
            // Create a fallback chat suggestion if none exists
            const emptyChatState = document.querySelector('.flex.flex-col.items-center.justify-center.p-6.text-center.h-full');
            if (emptyChatState && emptyChatState instanceof HTMLElement) {
              console.log('Creating fallback chat suggestions');
              
              // Check if suggestions container already exists
              let suggestionsContainer = emptyChatState.querySelector('.mt-8.space-y-3.w-full.max-w-md');
              
              if (!suggestionsContainer) {
                suggestionsContainer = document.createElement('div');
                suggestionsContainer.className = 'mt-8 space-y-3 w-full max-w-md';
                emptyChatState.appendChild(suggestionsContainer);
              }
              
              if (suggestionsContainer && suggestionsContainer instanceof HTMLElement) {
                // If we already have buttons in the container, don't add more
                const existingButtons = suggestionsContainer.querySelectorAll('button');
                if (existingButtons.length === 0) {
                  const suggestionButton = document.createElement('button');
                  suggestionButton.className = 'w-full justify-start px-4 py-3 h-auto bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md chat-question-highlight tutorial-target empty-chat-suggestion';
                  suggestionButton.textContent = 'How am I feeling today based on my journal entries?';
                  suggestionButton.style.display = 'block';
                  suggestionButton.style.visibility = 'visible';
                  suggestionButton.style.opacity = '1';
                  
                  suggestionsContainer.appendChild(suggestionButton);
                  applyTutorialHighlight(suggestionButton, 'chat-question-highlight');
                } else {
                  // Apply highlighting to the first existing button
                  const firstButton = existingButtons[0];
                  firstButton.classList.add('chat-question-highlight', 'tutorial-target', 'empty-chat-suggestion');
                  
                  if (firstButton instanceof HTMLElement) {
                    firstButton.style.display = 'block';
                    firstButton.style.visibility = 'visible';
                    firstButton.style.opacity = '1';
                    firstButton.style.zIndex = '20000';
                    applyTutorialHighlight(firstButton, 'chat-question-highlight');
                  }
                }
              }
            }
          }
        }
        
        // Try one more time after a short delay
        setTimeout(() => {
          const chatSuggestions = document.querySelectorAll('.empty-chat-suggestion, .chat-suggestion-button');
          if (chatSuggestions.length > 0 && currentStepData?.id === 5) {
            console.log('Found chat suggestions after delay, highlighting first one');
            const firstSuggestion = chatSuggestions[0];
            firstSuggestion.classList.add('chat-question-highlight', 'tutorial-target');
            
            if (firstSuggestion instanceof HTMLElement) {
              firstSuggestion.style.display = 'block';
              firstSuggestion.style.visibility = 'visible';
              firstSuggestion.style.opacity = '1';
            }
          }
        }, 800);
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
