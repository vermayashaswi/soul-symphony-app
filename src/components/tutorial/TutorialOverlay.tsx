import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '@/contexts/TutorialContext';
import TutorialStep from './TutorialStep';
import TutorialChatInterface from './TutorialChatInterface';
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
  
  // Check if we're in step 5 (chat interface step)
  const isStep5 = shouldShowTutorial && steps[currentStep]?.id === 5;
  
  // Log important state changes
  useEffect(() => {
    console.log('TutorialOverlay state:', {
      isActive,
      currentStep,
      currentStepId: steps[currentStep]?.id,
      navigationState,
      shouldShowTutorial,
      isStep5,
      pathname: location.pathname,
      isAppRoute: isAppRouteCurrent
    });
  }, [isActive, currentStep, steps, navigationState, shouldShowTutorial, isStep5, location.pathname, isAppRouteCurrent]);
  
  // Enhanced function to completely clean up ALL tutorial highlighting
  const cleanupAllTutorialHighlighting = () => {
    console.log('Running comprehensive tutorial cleanup');
    
    // Get ALL elements that might have tutorial classes
    const allTutorialElements = document.querySelectorAll(
      '.tutorial-target, .tutorial-button-highlight, .record-entry-tab, .entries-tab, ' +
      '.chat-question-highlight, .insights-header-highlight, .emotion-chart-highlight, ' +
      '.mood-calendar-highlight, .soul-net-highlight, .empty-chat-suggestion, ' +
      '[class*="tutorial-"], [data-tutorial-target]'
    );
    
    console.log(`Found ${allTutorialElements.length} elements to clean up`);
    
    allTutorialElements.forEach(el => {
      if (el instanceof HTMLElement) {
        // Remove ALL tutorial-related classes
        el.classList.remove(
          'tutorial-target', 'tutorial-button-highlight', 'record-entry-tab', 'entries-tab',
          'chat-question-highlight', 'insights-header-highlight', 'emotion-chart-highlight',
          'mood-calendar-highlight', 'soul-net-highlight', 'empty-chat-suggestion'
        );
        
        // Reset ALL inline styles that might have been applied by tutorial
        el.style.boxShadow = '';
        el.style.animation = '';
        el.style.border = '';
        el.style.transform = '';
        el.style.zIndex = '';
        el.style.position = '';
        el.style.visibility = '';
        el.style.opacity = '';
        el.style.backgroundColor = '';
        el.style.color = '';
        el.style.textShadow = '';
        el.style.top = '';
        el.style.left = '';
        el.style.right = '';
        el.style.bottom = '';
        el.style.margin = '';
        el.style.padding = '';
        el.style.display = '';
        el.style.backgroundImage = '';
        el.style.borderRadius = '';
      }
    });
    
    // Also specifically target common button selectors that might be highlighted
    const commonButtonSelectors = [
      '[data-value="record"]', '[data-value="entries"]', '[value="record"]', '[value="entries"]',
      '.record-entry-button', '.entries-tab-button', 'button[role="tab"]'
    ];
    
    commonButtonSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el instanceof HTMLElement) {
          el.classList.remove(
            'tutorial-target', 'tutorial-button-highlight', 'record-entry-tab', 'entries-tab',
            'chat-question-highlight', 'insights-header-highlight', 'emotion-chart-highlight',
            'mood-calendar-highlight', 'soul-net-highlight'
          );
          
          // Reset styles
          el.style.boxShadow = '';
          el.style.animation = '';
          el.style.border = '';
          el.style.transform = '';
          el.style.zIndex = '';
          el.style.backgroundColor = '';
          el.style.color = '';
        }
      });
    });
  };
  
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
      console.log('Cleaning up tutorial styles');
      
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
      console.log('Tutorial inactive, restored page scrolling');
      
      // Run comprehensive cleanup
      cleanupAllTutorialHighlighting();
      
      // SPECIAL: Reset the arrow button specifically to ensure it's centered
      const arrowButton = document.querySelector('.journal-arrow-button');
      if (arrowButton instanceof HTMLElement) {
        console.log('Resetting arrow button position after tutorial cleanup');
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
          console.log('Triggering chat refresh after tutorial');
          window.dispatchEvent(new CustomEvent('chatRefreshNeeded'));
        }
      }, 300);
    };
  }, [shouldShowTutorial, currentStep, steps, location.pathname]);

  // Enhanced step-specific element highlighting with improved cleanup
  useEffect(() => {
    if (!shouldShowTutorial || navigationState.inProgress) return;
    
    const currentStepData = steps[currentStep];
    console.log(`Setting up highlighting for step ${currentStepData?.id}`);
    
    // CRITICAL: Always clean up ALL tutorial highlighting first before applying new highlighting
    cleanupAllTutorialHighlighting();
    
    // Apply the appropriate highlighting based on step ID ONLY after cleanup
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
        // Step 3: Record Entry Tab - ONLY highlight this, never the Past Entries
        console.log('Step 3: Applying highlighting ONLY to Record Entry button');
        
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
              console.log(`Applied highlighting to Record Entry button using selector: ${selector}, text: "${elementText}"`);
              break;
            }
          }
        }
        
        if (!foundElement) {
          console.warn('Record entry element not found with any selector for step 3');
        }
      }
      else if (currentStepData?.id === 4) {
        // Step 4: Past Entries Tab - Enhanced with identical styling as record entry
        console.log('Step 4: Applying highlighting ONLY to Past Entries button');
        
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
              console.log(`Applied highlighting to Past Entries button using selector: ${selector}, text: "${elementText}"`);
              break;
            }
          }
        }
        
        if (!foundElement) {
          console.warn('Past Entries tab element not found with any selector for step 4');
        }
      }
      else if (currentStepData?.id === 5) {
        // Step 5: Chat question highlighting - focus on the tutorial chat interface
        console.log('Setting up highlight for chat question (step 5) with real chat interface');
        
        // Wait for the tutorial chat interface to render, then highlight suggestion buttons
        setTimeout(() => {
          const suggestionButtons = document.querySelectorAll('.tutorial-chat-interface .empty-chat-suggestion, .tutorial-chat-interface button');
          
          if (suggestionButtons.length > 0) {
            // Highlight the first suggestion button
            const firstButton = suggestionButtons[0];
            if (firstButton) {
              firstButton.classList.add('chat-question-highlight', 'tutorial-target');
              
              if (firstButton instanceof HTMLElement) {
                firstButton.style.boxShadow = '0 0 40px 25px var(--color-theme)';
                firstButton.style.animation = 'ultra-strong-pulse 1.5s infinite alternate';
                firstButton.style.border = '2px solid white';
                firstButton.style.transform = 'scale(1.1)';
                firstButton.style.zIndex = '20000';
                firstButton.style.pointerEvents = 'none'; // Prevent clicks in tutorial
              }
              
              console.log('Applied highlighting to first chat suggestion in tutorial interface');
            }
          }
        }, 500);
      }
      // ... keep existing code (steps 6-9 remain the same)
      else if (currentStepData?.id === 6) {
        console.log('Setting up highlight for insights header (step 6)');
        const found = findAndHighlightElement(INSIGHTS_HEADER_SELECTORS, 'insights-header-highlight');
        
        if (!found) {
          console.warn('Failed to find insights header with any selector');
        }
      }
      else if (currentStepData?.id === 7) {
        console.log('Setting up highlight for emotion chart (step 7)');
        const found = findAndHighlightElement(EMOTION_CHART_SELECTORS, 'emotion-chart-highlight');
        
        if (!found) {
          console.warn('Failed to find emotion chart with any selector');
        }
      }
      else if (currentStepData?.id === 8) {
        console.log('Setting up highlight for mood calendar (step 8)');
        const found = findAndHighlightElement(MOOD_CALENDAR_SELECTORS, 'mood-calendar-highlight');
        
        if (!found) {
          console.warn('Failed to find mood calendar with any selector');
        }
      }
      else if (currentStepData?.id === 9) {
        console.log('Setting up highlight for soul-net visualization (step 9)');
        const found = findAndHighlightElement(SOULNET_SELECTORS, 'soul-net-highlight');
        
        if (!found) {
          console.warn('Failed to find soul-net visualization with any selector');
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
      {/* Render actual chat interface for step 5 */}
      {isStep5 && <TutorialChatInterface />}
      
      {/* Semi-transparent overlay */}
      <motion.div
        className="tutorial-overlay absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: isStep5 ? 0.3 : 0.75 }} // Less opacity for step 5 to show chat interface
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
