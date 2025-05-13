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

const CHAT_QUESTION_SELECTORS = [
  '.chat-question-suggestion',
  '.chat-suggestion-item',
  '.tutorial-chat-question'
];

const CHAT_RESPONSE_SELECTORS = [
  '.chat-ai-response',
  '.chat-response-content',
  '.tutorial-chat-response'
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
  const [elementForStep5Found, setElementForStep5Found] = useState(false);
  const [elementForStep6Found, setElementForStep6Found] = useState(false);
  const [attempts, setAttempts] = useState(0);
  
  // Only render tutorial on app routes - strict checking
  const currentPath = location.pathname;
  const isAppRouteCurrent = isAppRoute(currentPath);
  const shouldShowTutorial = isActive && isAppRouteCurrent;
  
  // Log whenever the component is rendered and what the decision is
  useEffect(() => {
    console.log('TutorialOverlay render check:', {
      isActive,
      currentPath,
      isAppRouteCurrent,
      shouldShowTutorial
    });
  }, [isActive, currentPath, isAppRouteCurrent, shouldShowTutorial]);
  
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
      case 5:
        console.log('TutorialOverlay - Step 5 detected, current path:', location.pathname);
        setAttempts(0);
        setElementForStep5Found(false);
        
        if (location.pathname === '/app/chat') {
          cleanup = handleChatQuestionVisibility();
        } else {
          console.log('TutorialOverlay - Not on chat page yet, will navigate there');
          navigate('/app/chat');
        }
        break;
      case 6:
        console.log('TutorialOverlay - Step 6 detected, current path:', location.pathname);
        setAttempts(0);
        setElementForStep6Found(false);
        
        if (location.pathname === '/app/chat') {
          cleanup = handleChatResponseVisibility();
        } else {
          console.log('TutorialOverlay - Not on chat page yet, will navigate there');
          navigate('/app/chat');
        }
        break;
    }
    
    // Return combined cleanup function
    return cleanup;
  }, [shouldShowTutorial, currentStep, steps, location.pathname, navigate, attempts]);

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

  // Handle step 5 - Chat question suggestion visibility
  const handleChatQuestionVisibility = () => {
    console.log('TutorialOverlay - Setting up Chat Question Suggestion visibility for step 5');
    
    // Inject a temporary suggestion if it doesn't exist yet
    const injectTempSuggestionTimeout = setTimeout(() => {
      const existingSuggestion = document.querySelector('.chat-question-suggestion');
      
      if (!existingSuggestion) {
        console.log('Creating temporary chat question suggestion element');
        const chatContent = document.querySelector('.chat-interface, .smart-chat-container');
        
        if (chatContent) {
          const tempSuggestion = document.createElement('div');
          tempSuggestion.className = 'chat-question-suggestion tutorial-chat-question mb-4 p-3 bg-primary/10 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors';
          tempSuggestion.setAttribute('data-tutorial-highlight', 'true');
          tempSuggestion.innerHTML = '<p class="font-medium">What were my top emotions last week?</p>';
          tempSuggestion.style.position = 'relative';
          tempSuggestion.style.zIndex = '10000';
          tempSuggestion.style.visibility = 'visible';
          tempSuggestion.style.opacity = '1';
          
          // Find the chat input area or empty state to inject before
          const chatInputContainer = document.querySelector('.chat-input-container, .mobile-chat-input-container');
          const emptyState = document.querySelector('.flex.flex-col.items-center.justify-center.p-6.text-center.h-full');
          
          if (emptyState) {
            emptyState.prepend(tempSuggestion);
          } else if (chatContent.firstChild) {
            chatContent.insertBefore(tempSuggestion, chatContent.firstChild);
          } else {
            chatContent.appendChild(tempSuggestion);
          }
          
          console.log('Temporary chat suggestion element created and added to DOM');
        }
      }
      
      // Now search for the element and highlight it
      const searchTimeout = setTimeout(() => {
        console.log('Checking all possible Chat Question elements:');
        CHAT_QUESTION_SELECTORS.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          console.log(`  - ${selector}: ${elements.length} elements found`);
          elements.forEach((el, i) => {
            const rect = (el as HTMLElement).getBoundingClientRect();
            console.log(`    Element ${i} rect:`, rect);
          });
        });
        
        const found = applyChatQuestionHighlighting();
        
        if (found) {
          console.log(`TutorialOverlay - Found Chat Question element on attempt ${attempts + 1}`);
          setElementForStep5Found(true);
        } else {
          // Retry logic
          if (attempts < 5) {
            console.log(`Retrying Chat Question element search (attempt ${attempts + 1} of 5)`);
            setAttempts(prev => prev + 1);
            setTimeout(() => handleChatQuestionVisibility(), 500);
          } else {
            console.warn('TutorialOverlay - Maximum attempts reached to find Chat Question element');
            setElementForStep5Found(true);
            console.log('TutorialOverlay - Forcing step 5 to show anyway');
          }
        }
      }, 300);
    }, 500);
    
    // Clean up when step changes
    return () => {
      clearTimeout(injectTempSuggestionTimeout);
      console.log("Cleaning up Chat Question element styles");
      
      // Remove any temporary elements we created
      const tempElements = document.querySelectorAll('[data-tutorial-highlight="true"]');
      tempElements.forEach(el => {
        el.remove();
      });
      
      // Remove classes from all possible elements
      CHAT_QUESTION_SELECTORS.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.classList.remove('tutorial-target', 'tutorial-highlight');
          
          const el = element as HTMLElement;
          if (el) {
            el.style.visibility = '';
            el.style.opacity = '';
            el.style.pointerEvents = '';
            el.style.position = '';
            el.style.zIndex = '';
            el.style.boxShadow = '';
            el.style.border = '';
          }
        });
      });
    };
  };
  
  // Function to apply highlighting to step 5 chat question elements
  const applyChatQuestionHighlighting = (): boolean => {
    let chatQuestionElement = null;
    
    // Try each selector until we find a match
    for (const selector of CHAT_QUESTION_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        chatQuestionElement = elements[0];
        console.log(`Found Chat Question element with selector: ${selector}`, chatQuestionElement);
        break;
      }
    }
    
    if (chatQuestionElement) {
      console.log("Enhancing Chat Question element visibility for tutorial step 5", chatQuestionElement);
      
      // Add tutorial target class to make the element visible through overlay
      chatQuestionElement.classList.add('tutorial-target');
      chatQuestionElement.classList.add('tutorial-highlight');
      
      // Force the element to be visible with inline styles
      const elementStyle = chatQuestionElement as HTMLElement;
      elementStyle.style.visibility = 'visible';
      elementStyle.style.opacity = '1';
      elementStyle.style.pointerEvents = 'auto';
      elementStyle.style.position = 'relative';
      elementStyle.style.zIndex = '10000';
      elementStyle.style.boxShadow = '0 0 20px 10px var(--color-theme)';
      elementStyle.style.border = '2px solid var(--color-theme)';
      
      console.log("Added classes and styles to Chat Question element");
      
      return true;
    } else {
      console.warn("Could not find Chat Question element for tutorial step 5 with any selector");
      return false;
    }
  };

  // Handle step 6 - Chat AI response visibility
  const handleChatResponseVisibility = () => {
    console.log('TutorialOverlay - Setting up Chat Response visibility for step 6');
    
    // Inject a temporary AI response if it doesn't exist yet
    const injectTempResponseTimeout = setTimeout(() => {
      const existingResponse = document.querySelector('.chat-ai-response, .chat-response-content');
      
      if (!existingResponse) {
        console.log('Creating temporary chat AI response element');
        const chatContent = document.querySelector('.chat-content, .smart-chat-container');
        
        if (chatContent) {
          // Create the container
          const responseContainer = document.createElement('div');
          responseContainer.className = 'chat-ai-response tutorial-chat-response mb-4 p-4 bg-white rounded-lg shadow-md';
          responseContainer.setAttribute('data-tutorial-highlight', 'true');
          
          // Create the avatar
          const avatarDiv = document.createElement('div');
          avatarDiv.className = 'flex items-start mb-2';
          
          const avatar = document.createElement('div');
          avatar.className = 'w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mr-2';
          avatar.innerHTML = '<span className="text-primary font-bold">Rūḥ</span>';
          
          avatarDiv.appendChild(avatar);
          
          // Create the content
          const contentDiv = document.createElement('div');
          contentDiv.className = 'chat-response-content mt-2';
          contentDiv.innerHTML = `
            <p class="mb-2">Based on your journal entries, your top emotions last week were:</p>
            <div class="mb-3 p-2 bg-gray-50 rounded">
              <div class="flex justify-between items-center mb-1">
                <span>Joy</span>
                <span class="font-medium">35%</span>
              </div>
              <div class="w-full bg-gray-200 h-2 rounded-full">
                <div class="bg-green-500 h-2 rounded-full" style="width: 35%"></div>
              </div>
            </div>
            <div class="mb-3 p-2 bg-gray-50 rounded">
              <div class="flex justify-between items-center mb-1">
                <span>Gratitude</span>
                <span class="font-medium">28%</span>
              </div>
              <div class="w-full bg-gray-200 h-2 rounded-full">
                <div class="bg-blue-500 h-2 rounded-full" style="width: 28%"></div>
              </div>
            </div>
            <div class="p-2 bg-gray-50 rounded">
              <div class="flex justify-between items-center mb-1">
                <span>Calm</span>
                <span class="font-medium">20%</span>
              </div>
              <div class="w-full bg-gray-200 h-2 rounded-full">
                <div class="bg-purple-500 h-2 rounded-full" style="width: 20%"></div>
              </div>
            </div>
          `;
          
          // Add to the response container
          responseContainer.appendChild(avatarDiv);
          responseContainer.appendChild(contentDiv);
          
          // Apply tutorial styling
          responseContainer.style.position = 'relative';
          responseContainer.style.zIndex = '10000';
          responseContainer.style.visibility = 'visible';
          responseContainer.style.opacity = '1';
          
          // Add to the chat content
          const chatMessages = document.querySelector('.chat-messages-container');
          
          if (chatMessages) {
            chatMessages.appendChild(responseContainer);
          } else if (chatContent) {
            const emptyState = chatContent.querySelector('.flex.flex-col.items-center.justify-center');
            if (emptyState) {
              // Replace empty state with our response
              emptyState.style.display = 'none';
              chatContent.appendChild(responseContainer);
            } else {
              chatContent.appendChild(responseContainer);
            }
          }
          
          console.log('Temporary chat response element created and added to DOM');
        }
      }
      
      // Now search for the element and highlight it
      const searchTimeout = setTimeout(() => {
        console.log('Checking all possible Chat Response elements:');
        CHAT_RESPONSE_SELECTORS.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          console.log(`  - ${selector}: ${elements.length} elements found`);
          elements.forEach((el, i) => {
            const rect = (el as HTMLElement).getBoundingClientRect();
            console.log(`    Element ${i} rect:`, rect);
          });
        });
        
        const found = applyChatResponseHighlighting();
        
        if (found) {
          console.log(`TutorialOverlay - Found Chat Response element on attempt ${attempts + 1}`);
          setElementForStep6Found(true);
        } else {
          // Retry logic
          if (attempts < 5) {
            console.log(`Retrying Chat Response element search (attempt ${attempts + 1} of 5)`);
            setAttempts(prev => prev + 1);
            setTimeout(() => handleChatResponseVisibility(), 500);
          } else {
            console.warn('TutorialOverlay - Maximum attempts reached to find Chat Response element');
            setElementForStep6Found(true);
            console.log('TutorialOverlay - Forcing step 6 to show anyway');
          }
        }
      }, 300);
    }, 500);
    
    // Clean up when step changes
    return () => {
      clearTimeout(injectTempResponseTimeout);
      console.log("Cleaning up Chat Response element styles");
      
      // Remove any temporary elements we created
      const tempElements = document.querySelectorAll('[data-tutorial-highlight="true"]');
      tempElements.forEach(el => {
        el.remove();
      });
      
      // Remove classes from all possible elements
      CHAT_RESPONSE_SELECTORS.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.classList.remove('tutorial-target', 'tutorial-highlight');
          
          const el = element as HTMLElement;
          if (el) {
            el.style.visibility = '';
            el.style.opacity = '';
            el.style.pointerEvents = '';
            el.style.position = '';
            el.style.zIndex = '';
            el.style.boxShadow = '';
            el.style.border = '';
          }
        });
      });
    };
  };
  
  // Function to apply highlighting to step 6 chat response elements
  const applyChatResponseHighlighting = (): boolean => {
    let chatResponseElement = null;
    
    // Try each selector until we find a match
    for (const selector of CHAT_RESPONSE_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        chatResponseElement = elements[0];
        console.log(`Found Chat Response element with selector: ${selector}`, chatResponseElement);
        break;
      }
    }
    
    if (chatResponseElement) {
      console.log("Enhancing Chat Response element visibility for tutorial step 6", chatResponseElement);
      
      // Add tutorial target class to make the element visible through overlay
      chatResponseElement.classList.add('tutorial-target');
      chatResponseElement.classList.add('tutorial-highlight');
      
      // Force the element to be visible with inline styles
      const elementStyle = chatResponseElement as HTMLElement;
      elementStyle.style.visibility = 'visible';
      elementStyle.style.opacity = '1';
      elementStyle.style.pointerEvents = 'auto';
      elementStyle.style.position = 'relative';
      elementStyle.style.zIndex = '10000';
      elementStyle.style.boxShadow = '0 0 20px 10px var(--color-theme)';
      elementStyle.style.border = '2px solid var(--color-theme)';
      
      console.log("Added classes and styles to Chat Response element");
      
      return true;
    } else {
      console.warn("Could not find Chat Response element for tutorial step 6 with any selector");
      return false;
    }
  };

  // If not an app route or tutorial not active, don't render anything
  if (!shouldShowTutorial) {
    console.log('TutorialOverlay not shown: isActive=', isActive, 'isAppRoute=', isAppRouteCurrent);
    return null;
  }

  const currentTutorialStep = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  // For steps with specific UI elements, only show if we found the element or are on attempt 5+
  const shouldShowStepUI = 
    (currentTutorialStep?.id !== 3 || (elementForStep3Found || attempts >= 5)) && 
    (currentTutorialStep?.id !== 5 || (elementForStep5Found || attempts >= 5)) &&
    (currentTutorialStep?.id !== 6 || (elementForStep6Found || attempts >= 5));

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
        {shouldShowStepUI && (
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
