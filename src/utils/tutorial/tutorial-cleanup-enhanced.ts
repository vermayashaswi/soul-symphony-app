
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

export const TUTORIAL_STYLE_PROPERTIES = [
  'boxShadow', 'animation', 'border', 'transform', 'zIndex', 
  'position', 'visibility', 'opacity', 'backgroundColor', 
  'color', 'textShadow', 'top', 'left', 'right', 'bottom', 
  'margin', 'padding', 'display', 'backgroundImage', 'borderRadius',
  'outline', 'backdropFilter', 'filter', 'cursor', 'pointerEvents'
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
        
        // Reset all inline styles - with error handling
        TUTORIAL_STYLE_PROPERTIES.forEach(style => {
          try {
            el.style[style as any] = '';
          } catch (error) {
            console.warn(`[TutorialCleanup] Could not reset style ${style}:`, error);
          }
        });
        
        // Clean child elements
        const children = el.querySelectorAll('*');
        children.forEach(child => {
          if (child instanceof HTMLElement) {
            TUTORIAL_CLASSES.forEach(className => {
              child.classList.remove(className);
            });
            TUTORIAL_STYLE_PROPERTIES.forEach(style => {
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
    // Clean up arrow button specifically with defensive checks
    // IMPORTANT: Skip arrow button position reset if we're coming from step 1 to preserve energy animation
    const arrowButton = document.querySelector('.journal-arrow-button');
    if (arrowButton instanceof HTMLElement) {
      if (currentStepId === 1) {
        console.log('[TutorialCleanup] Skipping arrow button position reset for step 1 to preserve energy animation');
        
        // Only clean tutorial-specific styles, preserve positioning for energy animation
        const buttonElement = arrowButton.querySelector('button');
        if (buttonElement instanceof HTMLElement) {
          const gentleStylesReset = ['boxShadow', 'animation', 'border', 'backgroundColor', 'color', 'textShadow', 'outline'];
          gentleStylesReset.forEach(style => {
            try {
              buttonElement.style[style as any] = '';
            } catch (error) {
              // Silently ignore errors for button element cleanup
            }
          });
        }
      } else {
        console.log('[TutorialCleanup] Resetting arrow button position (not step 1)');
        
        // Reset to default centered position for other steps
        const arrowStyles = {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: '40',
          margin: '0',
          padding: '0'
        };
        
        Object.entries(arrowStyles).forEach(([prop, value]) => {
          try {
            arrowButton.style[prop as any] = value;
          } catch (error) {
            console.warn(`[TutorialCleanup] Could not set arrow button style ${prop}:`, error);
          }
        });
        
        const buttonElement = arrowButton.querySelector('button');
        if (buttonElement instanceof HTMLElement) {
          TUTORIAL_STYLE_PROPERTIES.forEach(style => {
            try {
              buttonElement.style[style as any] = '';
            } catch (error) {
              // Silently ignore errors for button element cleanup
            }
          });
        }
      }
    }
    
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

// NEW: Enhanced staggered cleanup with better step transition handling
export const performStaggeredCleanup = (currentStepId?: number) => {
  console.log(`[TutorialCleanup] Starting enhanced staggered cleanup for step ${currentStepId}`);
  
  try {
    // Phase 1: Immediate cleanup of critical elements
    setTimeout(() => {
      performComprehensiveCleanup(currentStepId);
    }, 50);
    
    // Phase 2: Body and global cleanup
    setTimeout(() => {
      cleanupBodyElement();
    }, 150);
    
    // Phase 3: Specific elements cleanup with improved positioning reset
    setTimeout(() => {
      cleanupSpecificElements(currentStepId);
      
      // Enhanced step-specific cleanup logic
      if (currentStepId === 1) {
        console.log('[TutorialCleanup] Step 1 detected, performing gentle cleanup to preserve energy animation');
        setTimeout(() => {
          performGentleCleanup();
        }, 100);
      } else if (currentStepId === 2) {
        console.log('[TutorialCleanup] Step 2 detected, ensuring proper positioning reset');
        // Reset any conflicting positioning for step 2
        const elements = document.querySelectorAll('[style*="transform"], [style*="position"]');
        elements.forEach(el => {
          if (el instanceof HTMLElement && el.classList.contains('tutorial-highlighted')) {
            // Remove only tutorial-related positioning, preserve energy animation
            el.style.removeProperty('z-index');
            el.style.removeProperty('position');
            if (el.style.transform && !el.style.transform.includes('translate')) {
              el.style.removeProperty('transform');
            }
          }
        });
      }
    }, 250);
    
    console.log('[TutorialCleanup] Enhanced staggered cleanup sequence initiated');
    
  } catch (error) {
    console.error('[TutorialCleanup] Error during enhanced staggered cleanup:', error);
  }
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

// NEW: Pre-tutorial cleanup for fresh start (fixes restart disorientation)
export const performPreTutorialCleanup = () => {
  console.log('[TutorialCleanup] Performing pre-tutorial cleanup for fresh start');
  
  try {
    // Remove any existing tutorial overlays
    const existingOverlays = document.querySelectorAll('[data-tutorial-overlay]');
    existingOverlays.forEach(overlay => overlay.remove());
    
    // Clean up all tutorial classes from all elements
    const allTutorialElements = document.querySelectorAll('*');
    allTutorialElements.forEach(el => {
      if (el instanceof HTMLElement) {
        TUTORIAL_CLASSES.forEach(className => {
          el.classList.remove(className);
        });
        
        // Reset tutorial-specific inline styles that might interfere
        TUTORIAL_STYLE_PROPERTIES.forEach(property => {
          if (el.style.getPropertyValue(property)) {
            el.style.removeProperty(property);
          }
        });
      }
    });
    
    // Clean body element thoroughly
    document.body.classList.remove('tutorial-active');
    document.body.removeAttribute('data-current-step');
    
    // Reset scroll behavior
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('position');
    
    console.log('[TutorialCleanup] Pre-tutorial cleanup complete');
    
  } catch (error) {
    console.error('[TutorialCleanup] Error during pre-tutorial cleanup:', error);
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
