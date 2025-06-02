
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
  'soul-net-highlight', 
  'empty-chat-suggestion'
];

export const TUTORIAL_STYLE_PROPERTIES = [
  'boxShadow', 'animation', 'border', 'transform', 'zIndex', 
  'position', 'visibility', 'opacity', 'backgroundColor', 
  'color', 'textShadow', 'top', 'left', 'right', 'bottom', 
  'margin', 'padding', 'display', 'backgroundImage', 'borderRadius',
  'outline', 'backdropFilter', 'filter', 'cursor', 'pointerEvents'
];

export const performComprehensiveCleanup = () => {
  console.log('[TutorialCleanup] Starting comprehensive cleanup');
  
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
    cleanupSpecificElements();
    
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

const cleanupSpecificElements = () => {
  console.log('[TutorialCleanup] Running specific element cleanup');
  
  try {
    // Clean up arrow button specifically with defensive checks
    const arrowButton = document.querySelector('.journal-arrow-button');
    if (arrowButton instanceof HTMLElement) {
      console.log('[TutorialCleanup] Resetting arrow button');
      
      // Reset to default centered position
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
    
    // Clean up tab buttons with improved selector targeting
    const tabSelectors = [
      'button[role="tab"]', 
      '[data-value="record"]', 
      '[data-value="entries"]',
      '.record-entry-tab',
      '.entries-tab'
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

export const performStaggeredCleanup = () => {
  console.log('[TutorialCleanup] Starting staggered cleanup process');
  
  // Stage 1: Immediate cleanup
  performComprehensiveCleanup();
  
  // Stage 2: Short delay cleanup
  setTimeout(() => {
    console.log('[TutorialCleanup] Stage 2 cleanup');
    performComprehensiveCleanup();
  }, 50);
  
  // Stage 3: Medium delay cleanup
  setTimeout(() => {
    console.log('[TutorialCleanup] Stage 3 cleanup');
    performComprehensiveCleanup();
  }, 150);
  
  // Stage 4: Final cleanup
  setTimeout(() => {
    console.log('[TutorialCleanup] Final cleanup stage');
    performComprehensiveCleanup();
  }, 300);
};

// NEW: Cleanup function specifically for navigation transitions
export const performNavigationCleanup = () => {
  console.log('[TutorialCleanup] Performing navigation-specific cleanup');
  
  try {
    // Remove tutorial classes that might interfere with navigation
    const navigationInterferers = document.querySelectorAll(
      '.tutorial-target, .tutorial-button-highlight, .record-entry-tab, .entries-tab'
    );
    
    navigationInterferers.forEach(el => {
      if (el instanceof HTMLElement) {
        TUTORIAL_CLASSES.forEach(className => {
          el.classList.remove(className);
        });
        
        // Reset only styles that affect layout/visibility
        const criticalStyles = ['position', 'zIndex', 'transform', 'opacity', 'visibility'];
        criticalStyles.forEach(style => {
          try {
            el.style[style as any] = '';
          } catch (error) {
            // Ignore errors during navigation cleanup
          }
        });
      }
    });
    
  } catch (error) {
    console.error('[TutorialCleanup] Error during navigation cleanup:', error);
  }
};
