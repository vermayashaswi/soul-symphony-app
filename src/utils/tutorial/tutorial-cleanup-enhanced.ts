
// Enhanced tutorial cleanup utilities for comprehensive state management

export const TUTORIAL_CLASSES = [
  'tutorial-target', 
  'tutorial-button-highlight', 
  'record-entry-tab', 
  'entries-tab',
  'chat-question-highlight', 
  'insights-header-highlight', 
  'emotion-chart-highlight',
  'mood-calendar-highlight', 
   
  'empty-chat-suggestion',
  'tutorial-record-entry-button' // Added new class
];

// Styles that can be safely reset without affecting essential positioning
export const VISUAL_ONLY_STYLES = [
  'boxShadow', 'animation', 'border', 'backgroundColor', 
  'color', 'textShadow', 'outline', 'backdropFilter', 'filter', 'cursor'
];

// Positioning styles that should NEVER be reset for critical elements (arrow button, energy animation)
export const POSITIONING_STYLES = [
  'position', 'top', 'left', 'right', 'bottom', 'transform', 'margin', 'padding'
];

// All tutorial styles for non-critical elements
export const TUTORIAL_STYLE_PROPERTIES = [
  ...VISUAL_ONLY_STYLES,
  ...POSITIONING_STYLES,
  'zIndex', 'visibility', 'opacity', 'display', 'backgroundImage', 'borderRadius', 'pointerEvents'
];

export const performComprehensiveCleanup = (currentStepId?: number) => {
  console.log('[TutorialCleanup] Starting comprehensive cleanup', { currentStepId });
  
  try {
    // Phase 1: Remove all tutorial classes from any element
    const allTutorialElements = document.querySelectorAll(
      TUTORIAL_CLASSES.map(cls => `.${cls}`).join(', ') + 
      ', [class*="tutorial-"], [data-tutorial-target]'
    );
    
    console.log(`[TutorialCleanup] Found ${allTutorialElements.length} elements with tutorial classes`);
    
    allTutorialElements.forEach(el => {
      if (el instanceof HTMLElement) {
        // Remove all tutorial classes
        TUTORIAL_CLASSES.forEach(className => {
          el.classList.remove(className);
        });
        
        // Check if this is a critical element that needs positioning preservation
        const isCriticalElement = el.closest('.journal-arrow-button') || 
                                 el.classList.contains('journal-arrow-button') ||
                                 el.closest('[class*="energy-animation"]') ||
                                 el.classList.contains('energy-animation');
        
        // Reset styles - preserve positioning for critical elements
        const stylesToReset = isCriticalElement ? VISUAL_ONLY_STYLES : TUTORIAL_STYLE_PROPERTIES;
        stylesToReset.forEach(style => {
          try {
            el.style[style as any] = '';
          } catch (error) {
            console.warn(`[TutorialCleanup] Could not reset style ${style}:`, error);
          }
        });
        
        if (isCriticalElement) {
          console.log('[TutorialCleanup] Preserved positioning for critical element:', el.className);
        }
        
        // Clean child elements
        const children = el.querySelectorAll('*');
        children.forEach(child => {
          if (child instanceof HTMLElement) {
            TUTORIAL_CLASSES.forEach(className => {
              child.classList.remove(className);
            });
            // Check if child is part of critical element
            const isChildOfCriticalElement = child.closest('.journal-arrow-button') || 
                                           child.closest('[class*="energy-animation"]');
            
            const childStylesToReset = isChildOfCriticalElement ? VISUAL_ONLY_STYLES : TUTORIAL_STYLE_PROPERTIES;
            childStylesToReset.forEach(style => {
              try {
                child.style[style as any] = '';
              } catch (error) {
                // Silently ignore style reset errors for child elements
              }
            });
          }
        });
      }
    });
    
    // Phase 2: Reset CSS custom properties
    const rootElement = document.documentElement;
    rootElement.style.removeProperty('--tutorial-highlight-color');
    rootElement.style.removeProperty('--tutorial-shadow');
    rootElement.style.removeProperty('--tutorial-animation');
    
    // Phase 3: Specific cleanup for known problematic elements
    cleanupSpecificElements(currentStepId);
    
    // Phase 4: Reset body classes and attributes
    cleanupBodyElement();
    
  } catch (error) {
    console.error('[TutorialCleanup] Error during comprehensive cleanup:', error);
  }
};

const cleanupBodyElement = () => {
  console.log('[TutorialCleanup] Cleaning up body element');
  
  try {
    // Remove tutorial classes from body
    document.body.classList.remove('tutorial-active');
    document.body.removeAttribute('data-current-step');
    
    // Reset body styles with defensive programming
    const bodyStylesToReset = ['overflow', 'touchAction', 'position', 'width', 'height', 'top', 'left'];
    bodyStylesToReset.forEach(style => {
      try {
        document.body.style[style as any] = '';
      } catch (error) {
        console.warn(`[TutorialCleanup] Could not reset body style ${style}:`, error);
      }
    });
  } catch (error) {
    console.error('[TutorialCleanup] Error cleaning up body element:', error);
  }
};

  const cleanupSpecificElements = (currentStepId?: number) => {
  console.log('[TutorialCleanup] Running specific element cleanup', { currentStepId });
  
  try {
    // Clean up arrow button - NEVER touch positioning, only visual effects
    const arrowButton = document.querySelector('.journal-arrow-button');
    if (arrowButton instanceof HTMLElement) {
      console.log('[TutorialCleanup] Cleaning arrow button tutorial styles while PRESERVING ALL POSITIONING');
      
      // Remove tutorial classes from arrow button container
      TUTORIAL_CLASSES.forEach(className => {
        arrowButton.classList.remove(className);
      });
      
      // Only clean visual effects from button element, NEVER positioning
      const buttonElement = arrowButton.querySelector('button');
      if (buttonElement instanceof HTMLElement) {
        VISUAL_ONLY_STYLES.forEach(style => {
          try {
            buttonElement.style[style as any] = '';
          } catch (error) {
            // Silently ignore errors for button element cleanup
          }
        });
      }
      
      // Clean any child elements but preserve positioning
      const childElements = arrowButton.querySelectorAll('*');
      childElements.forEach(child => {
        if (child instanceof HTMLElement) {
          TUTORIAL_CLASSES.forEach(className => {
            child.classList.remove(className);
          });
          VISUAL_ONLY_STYLES.forEach(style => {
            try {
              child.style[style as any] = '';
            } catch (error) {
              // Silently ignore errors
            }
          });
        }
      });
    }
    
    // Clean up energy animation containers - preserve ALL styles
    const energyAnimations = document.querySelectorAll('[class*="energy-animation"], .energy-animation');
    energyAnimations.forEach(el => {
      if (el instanceof HTMLElement) {
        console.log('[TutorialCleanup] Preserving ALL styles for energy animation');
        // Only remove tutorial classes, preserve ALL styles for energy animation
        TUTORIAL_CLASSES.forEach(className => {
          el.classList.remove(className);
        });
      }
    });
    
    // Clean up tab buttons with improved selector targeting
    const tabSelectors = [
      'button[role="tab"]', 
      '[data-value="record"]', 
      '[data-value="entries"]',
      '.record-entry-tab',
      '.entries-tab',
      '.tutorial-record-entry-button' // Added new selector
    ];
    
    tabSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(button => {
          if (button instanceof HTMLElement) {
            TUTORIAL_CLASSES.forEach(className => {
              button.classList.remove(className);
            });
            TUTORIAL_STYLE_PROPERTIES.forEach(style => {
              try {
                button.style[style as any] = '';
              } catch (error) {
                // Silently ignore style reset errors
              }
            });
          }
        });
      } catch (error) {
        console.warn(`[TutorialCleanup] Error cleaning selector ${selector}:`, error);
      }
    });
    
    // Enhanced chat elements cleanup with defensive programming
    const chatSelectors = [
      '.empty-chat-suggestion', 
      '.chat-suggestion-button',
      '.smart-chat-container',
      '.mobile-chat-interface',
      '.chat-messages-container',
      '.chat-input-container'
    ];
    
    chatSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (element instanceof HTMLElement) {
            TUTORIAL_CLASSES.forEach(className => {
              element.classList.remove(className);
            });
            TUTORIAL_STYLE_PROPERTIES.forEach(style => {
              try {
                element.style[style as any] = '';
              } catch (error) {
                // Silently ignore style reset errors
              }
            });
          }
        });
      } catch (error) {
        console.warn(`[TutorialCleanup] Error cleaning chat selector ${selector}:`, error);
      }
    });
    
  } catch (error) {
    console.error('[TutorialCleanup] Error in specific element cleanup:', error);
  }
};

// NEW: Gentle cleanup for step 1 - preserves energy animation positioning
const performGentleCleanup = () => {
  console.log('[TutorialCleanup] Performing gentle cleanup for step 1');
  
  try {
    // Only remove tutorial classes without affecting positioning or animations
    const tutorialElements = document.querySelectorAll(
      TUTORIAL_CLASSES.map(cls => `.${cls}`).join(', ')
    );
    
    tutorialElements.forEach(el => {
      if (el instanceof HTMLElement) {
        // Remove only tutorial classes, preserve all positioning
        TUTORIAL_CLASSES.forEach(className => {
          el.classList.remove(className);
        });
        
        // Only reset non-positioning styles to preserve energy animation
        const gentleStyleReset = ['boxShadow', 'animation', 'border', 'backgroundColor', 'color', 'textShadow', 'outline'];
        gentleStyleReset.forEach(style => {
          try {
            el.style[style as any] = '';
          } catch (error) {
            // Silently ignore errors
          }
        });
      }
    });
    
    // Clean body classes but preserve scroll position
    document.body.classList.remove('tutorial-active');
    document.body.removeAttribute('data-current-step');
    
  } catch (error) {
    console.error('[TutorialCleanup] Error during gentle cleanup:', error);
  }
};

export const performStaggeredCleanup = (currentStepId?: number) => {
  console.log('[TutorialCleanup] Starting staggered cleanup process', { currentStepId });
  
  // Stage 1: Immediate cleanup with step-specific considerations
  performComprehensiveCleanup(currentStepId);
  
  // Stage 2: Short delay cleanup
  setTimeout(() => {
    console.log('[TutorialCleanup] Stage 2 cleanup');
    performComprehensiveCleanup(currentStepId);
  }, 50);
  
  // Stage 3: Medium delay cleanup - skip if exiting from step 1 to preserve energy animation
  if (currentStepId !== 1) {
    setTimeout(() => {
      console.log('[TutorialCleanup] Stage 3 cleanup');
      performComprehensiveCleanup(currentStepId);
    }, 150);
  } else {
    console.log('[TutorialCleanup] Skipping stage 3 cleanup for step 1 to preserve energy animation');
  }
  
  // Stage 4: Final cleanup - gentle cleanup for step 1
  setTimeout(() => {
    console.log('[TutorialCleanup] Final cleanup stage');
    if (currentStepId === 1) {
      // Gentle cleanup for step 1 - only remove tutorial classes, preserve positioning
      performGentleCleanup();
    } else {
      performComprehensiveCleanup(currentStepId);
    }
  }, 300);
};

// ENHANCED: Selective cleanup function for navigation transitions that preserves highlighting
export const performNavigationCleanup = (preserveStep?: number) => {
  console.log(`[TutorialCleanup] Performing navigation-specific cleanup, preserving step ${preserveStep}`);
  
  try {
    // Only remove classes that might interfere with navigation, but preserve step-specific highlights
    const navigationInterferers = document.querySelectorAll(
      '.tutorial-target, .tutorial-button-highlight'
    );
    
    navigationInterferers.forEach(el => {
      if (el instanceof HTMLElement) {
        // Check if this element should be preserved based on current step
        const shouldPreserve = preserveStep && (
          (preserveStep === 3 && (el.classList.contains('record-entry-tab') || el.classList.contains('tutorial-record-entry-button'))) ||
          (preserveStep === 4 && el.classList.contains('entries-tab'))
        );
        
        if (!shouldPreserve) {
          // Only remove classes from elements that are not part of the current step
          const classesToRemove = ['tutorial-target', 'tutorial-button-highlight'];
          classesToRemove.forEach(className => {
            el.classList.remove(className);
          });
          
          // Reset only critical styles that affect layout/visibility
          const criticalStyles = ['position', 'zIndex', 'transform', 'opacity', 'visibility'];
          criticalStyles.forEach(style => {
            try {
              el.style[style as any] = '';
            } catch (error) {
              // Ignore errors during navigation cleanup
            }
          });
        } else {
          console.log(`[TutorialCleanup] Preserving highlighting for step ${preserveStep} element`);
        }
      }
    });
    
  } catch (error) {
    console.error('[TutorialCleanup] Error during navigation cleanup:', error);
  }
};

// NEW: Special cleanup for step 1 exit - preserves energy animation and arrow button positioning
export const performStep1ExitCleanup = () => {
  console.log('[TutorialCleanup] Performing special step 1 exit cleanup - preserving energy animation');
  
  try {
    // Only remove tutorial modal overlay and tutorial-specific classes
    const tutorialOverlay = document.querySelector('[data-tutorial-overlay]');
    if (tutorialOverlay) {
      tutorialOverlay.remove();
    }
    
    // Remove tutorial classes but preserve ALL positioning and animation styles
    const tutorialElements = document.querySelectorAll(
      TUTORIAL_CLASSES.map(cls => `.${cls}`).join(', ')
    );
    
    tutorialElements.forEach(el => {
      if (el instanceof HTMLElement) {
        // Remove only tutorial classes, preserve ALL other styles
        TUTORIAL_CLASSES.forEach(className => {
          el.classList.remove(className);
        });
      }
    });
    
    // Clean body classes but preserve scroll and positioning
    document.body.classList.remove('tutorial-active');
    document.body.removeAttribute('data-current-step');
    
    // Do NOT reset any positioning styles - preserve energy animation state
    console.log('[TutorialCleanup] Step 1 exit cleanup complete - energy animation preserved');
    
  } catch (error) {
    console.error('[TutorialCleanup] Error during step 1 exit cleanup:', error);
  }
};

// NEW: Selective cleanup that preserves specific step highlighting
export const performSelectiveCleanup = (preserveSteps: number[] = []) => {
  console.log(`[TutorialCleanup] Performing selective cleanup, preserving steps: ${preserveSteps.join(', ')}`);
  
  try {
    const allTutorialElements = document.querySelectorAll(
      TUTORIAL_CLASSES.map(cls => `.${cls}`).join(', ')
    );
    
    allTutorialElements.forEach(el => {
      if (el instanceof HTMLElement) {
        let shouldPreserve = false;
        
        // Check if this element should be preserved for any of the specified steps
        preserveSteps.forEach(step => {
          if (
            (step === 3 && (el.classList.contains('record-entry-tab') || el.classList.contains('tutorial-record-entry-button'))) ||
            (step === 4 && el.classList.contains('entries-tab')) ||
            (step === 5 && el.classList.contains('chat-question-highlight'))
          ) {
            shouldPreserve = true;
          }
        });
        
        if (!shouldPreserve) {
          // Remove tutorial classes
          TUTORIAL_CLASSES.forEach(className => {
            el.classList.remove(className);
          });
          
          // Reset styles
          TUTORIAL_STYLE_PROPERTIES.forEach(style => {
            try {
              el.style[style as any] = '';
            } catch (error) {
              // Silently ignore errors
            }
          });
        }
      }
    });
    
  } catch (error) {
    console.error('[TutorialCleanup] Error during selective cleanup:', error);
  }
};
