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
  INSIGHTS_HEADER_SELECTORS,
  EMOTION_CHART_SELECTORS,
  MOOD_CALENDAR_SELECTORS,
  findAndHighlightElement,
  logPotentialTutorialElements,
  applyTutorialHighlight
} from '@/utils/tutorial/tutorial-elements-finder';
import { performComprehensiveCleanup, performStaggeredCleanup, performSelectiveCleanup } from '@/utils/tutorial/tutorial-cleanup-enhanced';
import { navigationManager } from '@/utils/tutorial/navigation-state-manager';
import { highlightingManager } from '@/utils/tutorial/tutorial-highlighting-manager';

const TutorialOverlay: React.FC = () => {
  const tutorialContext = useTutorial();
  
  // FIXED: Don't return early if context is not initialized - let it render and handle gracefully
  if (!tutorialContext || !tutorialContext.isInitialized) {
    console.log('[TutorialOverlay] Context not yet initialized, waiting...');
    // Return empty div instead of null to maintain component lifecycle
    return <div style={{ display: 'none' }} />;
  }
  
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
  } = tutorialContext;
  
  const location = useLocation();
  
  // FIXED: Simplified tutorial display logic - show when active and on app route
  const isAppRouteCurrent = isAppRoute(location.pathname);
  const shouldShowTutorial = isActive && isAppRouteCurrent && !tutorialCompleted;
  
  // Log important state changes
  useEffect(() => {
    console.log('[TutorialOverlay] State update:', {
      isActive,
      currentStep,
      currentStepId: steps[currentStep]?.id,
      navigationState,
      shouldShowTutorial,
      pathname: location.pathname,
      isAppRoute: isAppRouteCurrent,
      tutorialCompleted,
      transitionProtected: navigationManager.isStepTransitionProtected(),
      highlightingState: highlightingManager.getState(),
      tutorialInitialized: tutorialContext.isInitialized
    });
  }, [isActive, currentStep, steps, navigationState, shouldShowTutorial, location.pathname, isAppRouteCurrent, tutorialCompleted, tutorialContext.isInitialized]);
  
  // Enhanced scrolling prevention with data attribute for current step
  useEffect(() => {
    if (!shouldShowTutorial) return;
    
    console.log('[TutorialOverlay] Tutorial active, disabling page scrolling');
    
    try {
      // Save current scroll position
      const scrollPos = window.scrollY;
      
      // Add classes to the body to prevent scrolling
      document.body.classList.add('tutorial-active');
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      
      // Add data attribute for current step to enable more specific CSS targeting
      document.body.setAttribute('data-current-step', String(steps[currentStep]?.id || ''));
      
      // Special handling for step 5 - ensure chat background is visible with proper styling
      if (steps[currentStep]?.id === 5) {
        setupChatVisibilityForStep5();
      }
      
      // Clean up when tutorial is deactivated
      return () => {
        console.log('[TutorialOverlay] Cleaning up tutorial styles');
        
        try {
          // Enhanced cleanup for body element
          document.body.classList.remove('tutorial-active');
          document.body.style.overflow = '';
          document.body.style.touchAction = '';
          document.body.style.position = '';
          document.body.style.width = '';
          document.body.style.height = '';
          document.body.removeAttribute('data-current-step');
          
          // Reset highlighting manager
          highlightingManager.reset();
          
          // Restore scroll position
          window.scrollTo(0, scrollPos);
          console.log('[TutorialOverlay] Tutorial inactive, restored page scrolling');
          
          // Run enhanced staggered cleanup
          performStaggeredCleanup();
          
          // SPECIAL: Reset the arrow button specifically to ensure it's centered
          resetArrowButtonPosition();
          
          // Small delay to ensure chat interface re-renders properly
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
            
            // Force chat interface to refresh
            if (location.pathname === '/app/chat') {
              console.log('[TutorialOverlay] Triggering chat refresh after tutorial');
              window.dispatchEvent(new CustomEvent('chatRefreshNeeded'));
            }
          }, 300);
        } catch (error) {
          console.error('[TutorialOverlay] Error during cleanup:', error);
        }
      };
    } catch (error) {
      console.error('[TutorialOverlay] Error setting up tutorial scrolling prevention:', error);
      return () => {}; // Return empty cleanup function on error
    }
  }, [shouldShowTutorial, currentStep, steps, location.pathname]);

  // ENHANCED: Step-specific element highlighting with new highlighting manager
  useEffect(() => {
    if (!shouldShowTutorial) return;
    
    const currentStepData = steps[currentStep];
    console.log(`[TutorialOverlay] Setting up enhanced highlighting for step ${currentStepData?.id}`);
    
    try {
      // Start step transition protection with extended duration
      navigationManager.startStepTransition(currentStepData?.id);
      
      // Perform selective cleanup that preserves current step
      const stepsToPreserve = [currentStepData?.id].filter(Boolean);
      performSelectiveCleanup(stepsToPreserve);
      
      // Apply highlighting using new manager with longer delay for DOM readiness
      const highlightTimeout = setTimeout(() => {
        try {
          applyEnhancedStepHighlighting(currentStepData);
        } catch (error) {
          console.error(`[TutorialOverlay] Error applying enhanced highlighting for step ${currentStepData?.id}:`, error);
        }
      }, 250); // Increased delay for better DOM readiness
      
      // Enhanced cleanup when effect unmounts
      return () => {
        clearTimeout(highlightTimeout);
        console.log('[TutorialOverlay] Effect cleanup - clearing step transition protection');
        // Don't immediately clear transition protection, let it timeout naturally for better persistence
      };
    } catch (error) {
      console.error('[TutorialOverlay] Error in enhanced highlighting effect setup:', error);
      return () => {
        navigationManager.clearStepTransition();
      };
    }
  }, [shouldShowTutorial, currentStep, steps]);

  // Helper function to setup chat visibility for step 5 - UPDATED to use transparent backgrounds
  const setupChatVisibilityForStep5 = () => {
    try {
      console.log('[TutorialOverlay] Setting up transparent chat visibility for step 5');
      
      // Use TRANSPARENT backgrounds instead of solid colors
      const chatContainers = document.querySelectorAll('.smart-chat-container, .mobile-chat-interface, .chat-messages-container');
      chatContainers.forEach(container => {
        if (container instanceof HTMLElement) {
          container.style.backgroundColor = 'transparent'; // Changed from solid color to transparent
          container.style.backgroundImage = 'none'; // Remove any background gradients
          container.style.boxShadow = 'none'; // Remove shadows that might create visual artifacts
          container.style.opacity = '1';
          container.style.visibility = 'visible';
        }
      });
      
      // Make sure EmptyChatState is visible with transparent background
      const emptyChatState = document.querySelector('.flex.flex-col.items-center.justify-center.p-6.text-center.h-full');
      if (emptyChatState && emptyChatState instanceof HTMLElement) {
        emptyChatState.style.visibility = 'visible';
        emptyChatState.style.opacity = '1';
        emptyChatState.style.zIndex = '5000';
        emptyChatState.style.display = 'flex';
        emptyChatState.style.backgroundColor = 'transparent'; // Ensure transparent background
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
    } catch (error) {
      console.error('[TutorialOverlay] Error setting up transparent chat visibility for step 5:', error);
    }
  };

  // Helper function to reset arrow button position
  const resetArrowButtonPosition = () => {
    try {
      const arrowButton = document.querySelector('.journal-arrow-button');
      if (arrowButton instanceof HTMLElement) {
        console.log('[TutorialOverlay] Resetting arrow button position after tutorial cleanup');
        arrowButton.style.position = 'fixed';
        arrowButton.style.top = '50%';
        arrowButton.style.left = '50%';
        arrowButton.style.transform = 'translate(-50%, -50%)';
        arrowButton.style.zIndex = '40';
        arrowButton.style.margin = '0';
        arrowButton.style.padding = '0';
        
        // Also reset the button element inside
        const buttonElement = arrowButton.querySelector('button');
        if (buttonElement instanceof HTMLElement) {
          const stylesToReset = ['boxShadow', 'animation', 'border', 'transform', 'position', 'zIndex'];
          stylesToReset.forEach(style => {
            try {
              buttonElement.style[style as any] = '';
            } catch (styleError) {
              console.warn(`[TutorialOverlay] Could not reset button style ${style}:`, styleError);
            }
          });
        }
      }
    } catch (error) {
      console.error('[TutorialOverlay] Error resetting arrow button position:', error);
    }
  };

  // ENHANCED: Step highlighting function using new highlighting manager
  const applyEnhancedStepHighlighting = (currentStepData: any) => {
    if (!currentStepData) return;

    try {
      console.log(`[TutorialOverlay] Applying enhanced highlighting for step ${currentStepData.id}`);
      
      if (currentStepData.id === 1) {
        // Step 1: Journal Header
        const journalHeader = document.querySelector('.journal-header-container');
        if (journalHeader) {
          journalHeader.classList.add('tutorial-target');
          console.log('[TutorialOverlay] Applied highlighting to journal header');
        } else {
          console.warn('[TutorialOverlay] Journal header element not found');
        }
      } 
      else if (currentStepData.id === 2) {
        // Step 2: Arrow Button - Let ButtonStateManager handle this
        console.log('[TutorialOverlay] Step 2: ButtonStateManager will handle arrow button highlighting');
      }
      else if (currentStepData.id === 3) {
        // Step 3: Record Entry Tab - Use new highlighting manager
        console.log('[TutorialOverlay] Step 3: Using enhanced highlighting manager for Record Entry button');
        highlightingManager.applyStaggeredHighlighting(
          RECORD_ENTRY_SELECTORS,
          ['tutorial-target', 'record-entry-tab', 'tutorial-record-entry-button'],
          3
        );
      }
      else if (currentStepData.id === 4) {
        // Step 4: Past Entries Tab - Use new highlighting manager
        console.log('[TutorialOverlay] Step 4: Using enhanced highlighting manager for Past Entries tab');
        highlightingManager.applyStaggeredHighlighting(
          ENTRIES_TAB_SELECTORS,
          ['tutorial-target', 'entries-tab'],
          4
        );
      }
      else if (currentStepData.id === 5) {
        // Step 5: Chat Question
        applyChatQuestionHighlighting();
      }
      else if (currentStepData.id === 6) {
        // Step 6: Insights Header
        const found = findAndHighlightElement(INSIGHTS_HEADER_SELECTORS, 'insights-header-highlight');
        if (!found) {
          console.warn('[TutorialOverlay] Failed to find insights header with any selector');
        }
      }
      else if (currentStepData.id === 7) {
        // Step 7: Emotion Chart
        const found = findAndHighlightElement(EMOTION_CHART_SELECTORS, 'emotion-chart-highlight');
        if (!found) {
          console.warn('[TutorialOverlay] Failed to find emotion chart with any selector');
        }
      }
      else if (currentStepData.id === 8) {
        // Step 8: Mood Calendar
        const found = findAndHighlightElement(MOOD_CALENDAR_SELECTORS, 'mood-calendar-highlight');
        if (!found) {
          console.warn('[TutorialOverlay] Failed to find mood calendar with any selector');
        }
      }
    } catch (error) {
      console.error(`[TutorialOverlay] Error in applyEnhancedStepHighlighting for step ${currentStepData.id}:`, error);
    }
  };

  // Helper function for chat question highlighting with error handling
  const applyChatQuestionHighlighting = () => {
    try {
      console.log('[TutorialOverlay] Setting up highlight for chat question (step 5)');
      
      // Set transparent background for better visibility (UPDATED)
      setupChatVisibilityForStep5();
      
      // Log all potential targets for debugging
      logPotentialTutorialElements();
      
      // First try to highlight existing chat suggestions in EmptyChatState
      const emptyChatSuggestions = document.querySelectorAll('.empty-chat-suggestion, .chat-suggestion-button');
      if (emptyChatSuggestions.length > 0) {
        console.log(`[TutorialOverlay] Found ${emptyChatSuggestions.length} chat suggestions in EmptyChatState`);
        emptyChatSuggestions.forEach((element, index) => {
          if (index === 0) { // Only highlight the first one
            element.classList.add('chat-question-highlight', 'tutorial-target');
            
            // Apply enhanced visibility with LOWER z-index to stay behind modal
            if (element instanceof HTMLElement) {
              element.style.display = 'block';
              element.style.visibility = 'visible';
              element.style.opacity = '1';
              element.style.zIndex = '8000'; // Lower than tutorial modal
              element.style.position = 'relative';
              element.style.boxShadow = '0 0 40px 25px var(--color-theme)';
              element.style.animation = 'ultra-strong-pulse 1.5s infinite alternate';
              element.style.border = '2px solid white';
              element.style.transform = 'scale(1.1)';
            }
            
            console.log('[TutorialOverlay] Applied highlighting to first chat suggestion in EmptyChatState');
          }
        });
      } else {
        // Try to find and highlight using our helper function
        const found = findAndHighlightElement(CHAT_QUESTION_SELECTORS, 'chat-question-highlight');
        
        if (!found) {
          console.warn('[TutorialOverlay] Failed to find chat question element with any selector');
          createFallbackChatSuggestion();
        }
      }
      
      // Try one more time after a short delay
      setTimeout(() => {
        const chatSuggestions = document.querySelectorAll('.empty-chat-suggestion, .chat-suggestion-button');
        if (chatSuggestions.length > 0 && steps[currentStep]?.id === 5) {
          console.log('[TutorialOverlay] Found chat suggestions after delay, highlighting first one');
          const firstSuggestion = chatSuggestions[0];
          firstSuggestion.classList.add('chat-question-highlight', 'tutorial-target');
          
          if (firstSuggestion instanceof HTMLElement) {
            firstSuggestion.style.display = 'block';
            firstSuggestion.style.visibility = 'visible';
            firstSuggestion.style.opacity = '1';
            firstSuggestion.style.zIndex = '8000'; // Lower than tutorial modal
          }
        }
      }, 800);
    } catch (error) {
      console.error('[TutorialOverlay] Error in applyChatQuestionHighlighting:', error);
    }
  };

  // Helper function to create fallback chat suggestion
  const createFallbackChatSuggestion = () => {
    try {
      const emptyChatState = document.querySelector('.flex.flex-col.items-center.justify-center.p-6.text-center.h-full');
      if (emptyChatState && emptyChatState instanceof HTMLElement) {
        console.log('[TutorialOverlay] Creating fallback chat suggestions');
        
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
            suggestionButton.style.zIndex = '8000'; // Lower than tutorial modal
            
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
              firstButton.style.zIndex = '8000'; // Lower than tutorial modal
              applyTutorialHighlight(firstButton, 'chat-question-highlight');
            }
          }
        }
      }
    } catch (error) {
      console.error('[TutorialOverlay] Error creating fallback chat suggestion:', error);
    }
  };


  // If tutorial should not be shown, don't render anything
  if (!shouldShowTutorial) {
    return null;
  }

  const currentTutorialStep = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[50000] pointer-events-auto">
      {/* Semi-transparent overlay */}
      <motion.div
        className="tutorial-overlay absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.75 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Tutorial step */}
      <AnimatePresence mode="wait">
        {currentTutorialStep && (
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
