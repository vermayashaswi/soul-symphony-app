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
  
  const isAppRouteCurrent = isAppRoute(location.pathname);
  const shouldShowTutorial = isActive && isAppRouteCurrent && !tutorialCompleted && !navigationState.inProgress;
  
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
    
    const scrollPos = window.scrollY;
    
    document.body.classList.add('tutorial-active');
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    
    document.body.setAttribute('data-current-step', String(steps[currentStep]?.id || ''));
    
    // Special handling for step 5 - chat background styling
    if (steps[currentStep]?.id === 5) {
      const chatContainers = document.querySelectorAll('.smart-chat-container, .mobile-chat-interface, .chat-messages-container');
      chatContainers.forEach(container => {
        if (container instanceof HTMLElement) {
          container.style.backgroundColor = '#1A1F2C';
          container.style.backgroundImage = 'linear-gradient(to bottom, #1A1F2C, #2D243A)';
          container.style.boxShadow = 'inset 0 0 25px rgba(155, 135, 245, 0.15)';
          container.style.opacity = '1';
          container.style.visibility = 'visible';
        }
      });
      
      const emptyChatState = document.querySelector('.flex.flex-col.items-center.justify-center.p-6.text-center.h-full');
      if (emptyChatState && emptyChatState instanceof HTMLElement) {
        emptyChatState.style.visibility = 'visible';
        emptyChatState.style.opacity = '1';
        emptyChatState.style.zIndex = '5000';
        emptyChatState.style.display = 'flex';
      }
      
      setTimeout(() => {
        if (steps[currentStep]?.id === 5) {
          const chatSuggestions = document.querySelectorAll('.empty-chat-suggestion, .chat-suggestion-button');
          chatSuggestions.forEach(suggestion => {
            if (suggestion instanceof HTMLElement) {
              suggestion.style.visibility = 'visible';
              suggestion.style.display = 'block';
              suggestion.style.opacity = '1';
              suggestion.classList.add('chat-question-highlight', 'tutorial-target');
            }
          });
        }
      }, 500);
    }
    
    return () => {
      console.log('[TutorialOverlay] Cleaning up tutorial styles');
      
      document.body.classList.remove('tutorial-active');
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.removeAttribute('data-current-step');
      
      window.scrollTo(0, scrollPos);
      console.log('[TutorialOverlay] Tutorial inactive, restored page scrolling');
      
      performStaggeredCleanup();
      
      // Reset arrow button specifically
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
      
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        
        if (location.pathname === '/app/chat') {
          console.log('[TutorialOverlay] Triggering chat refresh after tutorial');
          window.dispatchEvent(new CustomEvent('chatRefreshNeeded'));
        }
      }, 300);
    };
  }, [shouldShowTutorial, currentStep, steps, location.pathname]);

  // Simplified step-specific element highlighting
  useEffect(() => {
    if (!shouldShowTutorial) return;
    
    const currentStepData = steps[currentStep];
    console.log(`[TutorialOverlay] Setting up highlighting for step ${currentStepData?.id}`);
    
    performStaggeredCleanup();
    
    const highlightTimeout = setTimeout(() => {
      if (currentStepData?.id === 1) {
        const journalHeader = document.querySelector('.journal-header-container');
        if (journalHeader) {
          journalHeader.classList.add('tutorial-target');
          console.log('[TutorialOverlay] Applied highlighting to journal header');
        }
      } 
      else if (currentStepData?.id === 2) {
        console.log('[TutorialOverlay] Step 2: ButtonStateManager will handle arrow button highlighting');
      }
      else if (currentStepData?.id === 3) {
        console.log('[TutorialOverlay] Step 3: Applying enhanced highlighting to Record Entry button');
        
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
            const elementText = element.textContent?.toLowerCase().trim();
            const isRecordEntry = elementText?.includes('record') || elementText?.includes('new') || elementText?.includes('entry');
            const isPastEntries = elementText?.includes('past') || elementText?.includes('entries') || elementText?.includes('history');
            
            if (isRecordEntry && !isPastEntries) {
              element.classList.add('tutorial-target', 'record-entry-tab');
              foundElement = true;
              console.log(`[TutorialOverlay] Applied enhanced highlighting to Record Entry button using selector: ${selector}, text: "${elementText}"`);
              break;
            }
          }
        }
        
        if (!foundElement) {
          console.warn('[TutorialOverlay] Record entry element not found with any selector for step 3');
        }
      }
      else if (currentStepData?.id === 4) {
        console.log('[TutorialOverlay] Step 4: Applying minimal highlighting to Past Entries button (no glow)');
        
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
            const elementText = element.textContent?.toLowerCase().trim();
            const isPastEntries = elementText?.includes('past') || elementText?.includes('entries') || elementText?.includes('history') || selector.includes('entries');
            const isRecordEntry = elementText?.includes('record') || elementText?.includes('new');
            
            if (isPastEntries && !isRecordEntry) {
              element.classList.add('tutorial-target', 'entries-tab');
              foundElement = true;
              console.log(`[TutorialOverlay] Applied minimal highlighting to Past Entries button using selector: ${selector}, text: "${elementText}"`);
              break;
            }
          }
        }
        
        if (!foundElement) {
          console.warn('[TutorialOverlay] Past Entries tab element not found with any selector for step 4');
        }
      }
      // ... keep existing code (steps 5-9 remain the same for chat and insights highlighting)
      else if (currentStepData?.id === 5) {
        console.log('[TutorialOverlay] Setting up highlight for chat question (step 5)');
        
        const chatContainers = document.querySelectorAll('.smart-chat-container, .mobile-chat-interface, .chat-messages-container');
        chatContainers.forEach(container => {
          if (container instanceof HTMLElement) {
            container.style.backgroundColor = '#1A1F2C';
            container.style.backgroundImage = 'linear-gradient(to bottom, #1A1F2C, #2D243A)';
            container.style.boxShadow = 'inset 0 0 25px rgba(155, 135, 245, 0.15)';
            container.style.opacity = '1';
            container.style.visibility = 'visible';
            container.style.borderRadius = '10px';
          }
        });
        
        const emptyChatState = document.querySelector('.flex.flex-col.items-center.justify-center.p-6.text-center.h-full');
        if (emptyChatState && emptyChatState instanceof HTMLElement) {
          emptyChatState.style.visibility = 'visible';
          emptyChatState.style.opacity = '1';
          emptyChatState.style.zIndex = '5000';
          emptyChatState.style.display = 'flex';
        }
        
        logPotentialTutorialElements();
        
        const emptyChatSuggestions = document.querySelectorAll('.empty-chat-suggestion, .chat-suggestion-button');
        if (emptyChatSuggestions.length > 0) {
          console.log(`[TutorialOverlay] Found ${emptyChatSuggestions.length} chat suggestions in EmptyChatState`);
          emptyChatSuggestions.forEach((element, index) => {
            if (index === 0) {
              element.classList.add('chat-question-highlight', 'tutorial-target');
              
              if (element instanceof HTMLElement) {
                element.style.display = 'block';
                element.style.visibility = 'visible';
                element.style.opacity = '1';
                element.style.zIndex = '8000';
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
          const found = findAndHighlightElement(CHAT_QUESTION_SELECTORS, 'chat-question-highlight');
          
          if (!found) {
            console.warn('[TutorialOverlay] Failed to find chat question element with any selector');
            
            const emptyChatState = document.querySelector('.flex.flex-col.items-center.justify-center.p-6.text-center.h-full');
            if (emptyChatState && emptyChatState instanceof HTMLElement) {
              console.log('[TutorialOverlay] Creating fallback chat suggestions');
              
              let suggestionsContainer = emptyChatState.querySelector('.mt-8.space-y-3.w-full.max-w-md');
              
              if (!suggestionsContainer) {
                suggestionsContainer = document.createElement('div');
                suggestionsContainer.className = 'mt-8 space-y-3 w-full max-w-md';
                emptyChatState.appendChild(suggestionsContainer);
              }
              
              if (suggestionsContainer && suggestionsContainer instanceof HTMLElement) {
                const existingButtons = suggestionsContainer.querySelectorAll('button');
                if (existingButtons.length === 0) {
                  const suggestionButton = document.createElement('button');
                  suggestionButton.className = 'w-full justify-start px-4 py-3 h-auto bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md chat-question-highlight tutorial-target empty-chat-suggestion';
                  suggestionButton.textContent = 'How am I feeling today based on my journal entries?';
                  suggestionButton.style.display = 'block';
                  suggestionButton.style.visibility = 'visible';
                  suggestionButton.style.opacity = '1';
                  suggestionButton.style.zIndex = '8000';
                  
                  suggestionsContainer.appendChild(suggestionButton);
                  applyTutorialHighlight(suggestionButton, 'chat-question-highlight');
                } else {
                  const firstButton = existingButtons[0];
                  firstButton.classList.add('chat-question-highlight', 'tutorial-target', 'empty-chat-suggestion');
                  
                  if (firstButton instanceof HTMLElement) {
                    firstButton.style.display = 'block';
                    firstButton.style.visibility = 'visible';
                    firstButton.style.opacity = '1';
                    firstButton.style.zIndex = '8000';
                    applyTutorialHighlight(firstButton, 'chat-question-highlight');
                  }
                }
              }
            }
          }
        }
        
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
              firstSuggestion.style.zIndex = '8000';
            }
          }
        }, 800);
      }
      else if (currentStepData?.id === 6) {
        console.log('[TutorialOverlay] Setting up highlight for insights header (step 6)');
        const found = findAndHighlightElement(INSIGHTS_HEADER_SELECTORS, 'insights-header-highlight');
        
        if (!found) {
          console.warn('[TutorialOverlay] Failed to find insights header with any selector');
        }
      }
      else if (currentStepData?.id === 7) {
        console.log('[TutorialOverlay] Setting up highlight for emotion chart (step 7)');
        const found = findAndHighlightElement(EMOTION_CHART_SELECTORS, 'emotion-chart-highlight');
        
        if (!found) {
          console.warn('[TutorialOverlay] Failed to find emotion chart with any selector');
        }
      }
      else if (currentStepData?.id === 8) {
        console.log('[TutorialOverlay] Setting up highlight for mood calendar (step 8)');
        const found = findAndHighlightElement(MOOD_CALENDAR_SELECTORS, 'mood-calendar-highlight');
        
        if (!found) {
          console.warn('[TutorialOverlay] Failed to find mood calendar with any selector');
        }
      }
      else if (currentStepData?.id === 9) {
        console.log('[TutorialOverlay] Setting up highlight for soul-net visualization (step 9)');
        
        const found = findAndHighlightElement(SOULNET_SELECTORS, 'soul-net-highlight');
        
        if (!found) {
          console.warn('[TutorialOverlay] Failed to find soul-net visualization with any selector');
        } else {
          console.log('[TutorialOverlay] Successfully highlighted Soul-Net visualization for step 9');
        }
        
        setTimeout(() => {
          console.log('[TutorialOverlay] Step 9: Debugging Soul-Net label visibility');
          
          const soulnetContainer = document.querySelector('[class*="soul-net"], [class*="soulnet"], .bg-background.rounded-xl.shadow-sm.border.w-full');
          if (soulnetContainer) {
            console.log('[TutorialOverlay] Found Soul-Net container:', soulnetContainer);
            
            const canvas = soulnetContainer.querySelector('canvas');
            if (canvas) {
              console.log('[TutorialOverlay] Found Soul-Net canvas:', canvas.style);
              
              canvas.style.display = 'block';
              canvas.style.visibility = 'visible';
              canvas.style.opacity = '1';
              canvas.style.width = '100%';
              canvas.style.height = '500px';
              
              window.dispatchEvent(new Event('resize'));
              
              console.log('[TutorialOverlay] Applied visibility fixes to Soul-Net canvas');
            } else {
              console.warn('[TutorialOverlay] No canvas found in Soul-Net container');
            }
          } else {
            console.warn('[TutorialOverlay] No Soul-Net container found for step 9');
          }
          
          console.log('[TutorialOverlay] Checking for Three.js text rendering in Soul-Net');
          
          window.dispatchEvent(new CustomEvent('tutorial-soul-net-debug', {
            detail: { step: 9, forceShowLabels: true }
          }));
          
        }, 1000);
      }
    }, 300);
    
    return () => {
      clearTimeout(highlightTimeout);
      console.log('[TutorialOverlay] Effect cleanup - removing highlighting');
      performStaggeredCleanup();
    };
  }, [shouldShowTutorial, currentStep, steps]);

  if (!shouldShowTutorial) {
    return null;
  }

  const currentTutorialStep = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[50000] pointer-events-auto">
      <motion.div
        className="tutorial-overlay absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.75 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
      />

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
