
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
  SOULNET_SELECTORS,
  findAndHighlightElement,
  logPotentialTutorialElements,
  applyTutorialHighlight
} from '@/utils/tutorial/tutorial-elements-finder';
import { performComprehensiveCleanup, performStaggeredCleanup } from '@/utils/tutorial/tutorial-cleanup-enhanced';

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
  
  // Enhanced route checking for tutorial display
  const isAppRouteCurrent = isAppRoute(location.pathname);
  const shouldShowTutorial = isActive && isAppRouteCurrent && !tutorialCompleted && !navigationState.inProgress;
  
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
      tutorialCompleted
    });
  }, [isActive, currentStep, steps, navigationState, shouldShowTutorial, location.pathname, isAppRouteCurrent, tutorialCompleted]);
  
  // Enhanced scrolling prevention with data attribute for current step
  useEffect(() => {
    if (!shouldShowTutorial) return;
    
    console.log('[TutorialOverlay] Tutorial active, disabling page scrolling');
    
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
      // Prepare the chat container for better visibility - Use purple background
      const chatContainers = document.querySelectorAll('.smart-chat-container, .mobile-chat-interface, .chat-messages-container');
      chatContainers.forEach(container => {
        if (container instanceof HTMLElement) {
          container.style.backgroundColor = '#1A1F2C'; // Dark purple background
          container.style.backgroundImage = 'linear-gradient(to bottom, #1A1F2C, #2D243A)'; // Gradient background
          container.style.boxShadow = 'inset 0 0 25px rgba(155, 135, 245, 0.15)'; // Inner purple glow
          container.style.opacity = '1';
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
      console.log('[TutorialOverlay] Cleaning up tutorial styles');
      
      // Enhanced cleanup for body element
      document.body.classList.remove('tutorial-active');
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.removeAttribute('data-current-step');
      
      // Restore scroll position
      window.scrollTo(0, scrollPos);
      console.log('[TutorialOverlay] Tutorial inactive, restored page scrolling');
      
      // Run enhanced staggered cleanup
      performStaggeredCleanup();
      
      // SPECIAL: Reset the arrow button specifically to ensure it's centered
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
          buttonElement.style.boxShadow = '';
          buttonElement.style.animation = '';
          buttonElement.style.border = '';
          buttonElement.style.transform = '';
          buttonElement.style.position = '';
          buttonElement.style.zIndex = '';
        }
      }
      
      // Small delay to ensure chat interface re-renders properly
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        
        // Force chat interface to refresh
        if (location.pathname === '/app/chat') {
          console.log('[TutorialOverlay] Triggering chat refresh after tutorial');
          window.dispatchEvent(new CustomEvent('chatRefreshNeeded'));
        }
      }, 300);
    };
  }, [shouldShowTutorial, currentStep, steps, location.pathname]);

  // Enhanced step-specific element highlighting with improved cleanup
  useEffect(() => {
    if (!shouldShowTutorial) return;
    
    const currentStepData = steps[currentStep];
    console.log(`[TutorialOverlay] Setting up highlighting for step ${currentStepData?.id}`);
    
    // Run comprehensive cleanup before applying new highlighting
    const performEnhancedCleanup = () => {
      console.log('[TutorialOverlay] Enhanced cleanup before highlighting');
      performStaggeredCleanup();
    };
    
    performEnhancedCleanup();
    
    // Apply highlighting after cleanup with improved timing
    const highlightTimeout = setTimeout(() => {
      if (currentStepData?.id === 1) {
        // Step 1: Journal Header
        const journalHeader = document.querySelector('.journal-header-container');
        if (journalHeader) {
          journalHeader.classList.add('tutorial-target');
          console.log('[TutorialOverlay] Applied highlighting to journal header');
        } else {
          console.warn('[TutorialOverlay] Journal header element not found');
        }
      } 
      else if (currentStepData?.id === 2) {
        // Step 2: Arrow Button - Let ButtonStateManager handle this
        console.log('[TutorialOverlay] Step 2: ButtonStateManager will handle arrow button highlighting');
      }
      else if (currentStepData?.id === 3) {
        // Step 3: Record Entry Tab - ONLY highlight this, never the Past Entries
        console.log('[TutorialOverlay] Step 3: Applying highlighting ONLY to Record Entry button');
        
        ENTRIES_TAB_SELECTORS.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              if (el instanceof HTMLElement) {
                performComprehensiveCleanup();
              }
            });
          } catch (error) {
            console.warn(`[TutorialOverlay] Error in Past Entries cleanup for selector ${selector}:`, error);
          }
        });
        
        let foundElement = false;
        
        for (const selector of RECORD_ENTRY_SELECTORS) {
          const element = document.querySelector(selector);
          if (element) {
            // Double-check this is NOT the Past Entries button
            const elementText = element.textContent?.toLowerCase().trim();
            const isRecordEntry = elementText?.includes('record') || elementText?.includes('new') || elementText?.includes('entry');
            const isPastEntries = elementText?.includes('past') || elementText?.includes('entries') || elementText?.includes('history');
            
            if (isRecordEntry && !isPastEntries) {
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
              console.log(`[TutorialOverlay] Applied highlighting to Record Entry button using selector: ${selector}, text: "${elementText}"`);
              break;
            }
          }
        }
        
        if (!foundElement) {
          console.warn('[TutorialOverlay] Record entry element not found with any selector for step 3');
        }
      }
      else if (currentStepData?.id === 4) {
        // Step 4: Past Entries Tab - Enhanced with identical styling as record entry
        console.log('[TutorialOverlay] Step 4: Applying highlighting ONLY to Past Entries button');
        
        RECORD_ENTRY_SELECTORS.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              if (el instanceof HTMLElement) {
                performComprehensiveCleanup();
              }
            });
          } catch (error) {
            console.warn(`[TutorialOverlay] Error in Record Entry cleanup for selector ${selector}:`, error);
          }
        });
        
        let foundElement = false;
        
        for (const selector of ENTRIES_TAB_SELECTORS) {
          const element = document.querySelector(selector);
          if (element) {
            // Double-check this is the Past Entries button and NOT Record Entry
            const elementText = element.textContent?.toLowerCase().trim();
            const isPastEntries = elementText?.includes('past') || elementText?.includes('entries') || elementText?.includes('history') || selector.includes('entries');
            const isRecordEntry = elementText?.includes('record') || elementText?.includes('new');
            
            if (isPastEntries && !isRecordEntry) {
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
                
                // Explicit white background
                element.style.backgroundColor = "white";
                
                // Fix text color for light mode
                const isDarkMode = document.body.classList.contains('dark');
                if (!isDarkMode) {
                  element.style.color = "#000";
                  
                  // Also apply to child elements
                  const textElements = element.querySelectorAll('span, div');
                  textElements.forEach(textEl => {
                    if (textEl instanceof HTMLElement) {
                      textEl.style.color = "#000";
                      textEl.style.textShadow = "none";
                      textEl.style.backgroundColor = "white";
                    }
                  });
                }
              }
              
              foundElement = true;
              console.log(`[TutorialOverlay] Applied highlighting to Past Entries button using selector: ${selector}, text: "${elementText}"`);
              break;
            }
          }
        }
        
        if (!foundElement) {
          console.warn('[TutorialOverlay] Past Entries tab element not found with any selector for step 4');
        }
      }
      // ... keep existing code (steps 5-9 remain the same)
      else if (currentStepData?.id === 5) {
        console.log('[TutorialOverlay] Setting up highlight for chat question (step 5)');
        
        // Set purple background for better visibility with opacity
        const chatContainers = document.querySelectorAll('.smart-chat-container, .mobile-chat-interface, .chat-messages-container');
        chatContainers.forEach(container => {
          if (container instanceof HTMLElement) {
            container.style.backgroundColor = '#1A1F2C'; // Dark purple background
            container.style.backgroundImage = 'linear-gradient(to bottom, #1A1F2C, #2D243A)'; // Gradient background
            container.style.boxShadow = 'inset 0 0 25px rgba(155, 135, 245, 0.15)'; // Inner purple glow
            container.style.opacity = '1';
            container.style.visibility = 'visible';
            container.style.borderRadius = '10px'; // Rounded corners
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
            
            // Create a fallback chat suggestion if none exists
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
          }
        }
        
        // Try one more time after a short delay
        setTimeout(() => {
          const chatSuggestions = document.querySelectorAll('.empty-chat-suggestion, .chat-suggestion-button');
          if (chatSuggestions.length > 0 && currentStepData?.id === 5) {
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
      }
      // NEW: Step 6 - Insights Header Highlight
      else if (currentStepData?.id === 6) {
        console.log('[TutorialOverlay] Setting up highlight for insights header (step 6)');
        const found = findAndHighlightElement(INSIGHTS_HEADER_SELECTORS, 'insights-header-highlight');
        
        if (!found) {
          console.warn('[TutorialOverlay] Failed to find insights header with any selector');
        }
      }
      // NEW: Step 7 - Emotion Chart Highlight
      else if (currentStepData?.id === 7) {
        console.log('[TutorialOverlay] Setting up highlight for emotion chart (step 7)');
        const found = findAndHighlightElement(EMOTION_CHART_SELECTORS, 'emotion-chart-highlight');
        
        if (!found) {
          console.warn('[TutorialOverlay] Failed to find emotion chart with any selector');
        }
      }
      // NEW: Step 8 - Mood Calendar Highlight
      else if (currentStepData?.id === 8) {
        console.log('[TutorialOverlay] Setting up highlight for mood calendar (step 8)');
        const found = findAndHighlightElement(MOOD_CALENDAR_SELECTORS, 'mood-calendar-highlight');
        
        if (!found) {
          console.warn('[TutorialOverlay] Failed to find mood calendar with any selector');
        }
      }
      // NEW: Step 9 - Soul-Net Highlight
      else if (currentStepData?.id === 9) {
        console.log('[TutorialOverlay] Setting up highlight for soul-net visualization (step 9)');
        const found = findAndHighlightElement(SOULNET_SELECTORS, 'soul-net-highlight');
        
        if (!found) {
          console.warn('[TutorialOverlay] Failed to find soul-net visualization with any selector');
        }
      }
    }, 300); // Increased timeout for better cleanup
    
    // Enhanced cleanup when effect unmounts
    return () => {
      clearTimeout(highlightTimeout);
      console.log('[TutorialOverlay] Effect cleanup - removing highlighting');
      performStaggeredCleanup();
    };
  }, [shouldShowTutorial, currentStep, steps]);

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
