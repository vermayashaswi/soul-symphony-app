
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
  'margin', 'padding', 'display', 'backgroundImage', 'borderRadius'
];

export const performComprehensiveCleanup = () => {
  console.log('[TutorialCleanup] Starting comprehensive cleanup');
  
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
      
      // Reset all inline styles
      TUTORIAL_STYLE_PROPERTIES.forEach(style => {
        el.style[style as any] = '';
      });
      
      // Clean child elements
      const children = el.querySelectorAll('*');
      children.forEach(child => {
        if (child instanceof HTMLElement) {
          TUTORIAL_CLASSES.forEach(className => {
            child.classList.remove(className);
          });
          TUTORIAL_STYLE_PROPERTIES.forEach(style => {
            child.style[style as any] = '';
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
};

const cleanupSpecificElements = () => {
  console.log('[TutorialCleanup] Running specific element cleanup');
  
  // Clean up arrow button specifically
  const arrowButton = document.querySelector('.journal-arrow-button');
  if (arrowButton instanceof HTMLElement) {
    console.log('[TutorialCleanup] Resetting arrow button');
    arrowButton.style.position = 'fixed';
    arrowButton.style.top = '50%';
    arrowButton.style.left = '50%';
    arrowButton.style.transform = 'translate(-50%, -50%)';
    arrowButton.style.zIndex = '40';
    arrowButton.style.margin = '0';
    arrowButton.style.padding = '0';
    
    const buttonElement = arrowButton.querySelector('button');
    if (buttonElement instanceof HTMLElement) {
      TUTORIAL_STYLE_PROPERTIES.forEach(style => {
        buttonElement.style[style as any] = '';
      });
    }
  }
  
  // Clean up tab buttons
  const tabButtons = document.querySelectorAll('button[role="tab"], [data-value="record"], [data-value="entries"]');
  tabButtons.forEach(button => {
    if (button instanceof HTMLElement) {
      TUTORIAL_CLASSES.forEach(className => {
        button.classList.remove(className);
      });
      TUTORIAL_STYLE_PROPERTIES.forEach(style => {
        button.style[style as any] = '';
      });
    }
  });
  
  // Clean up chat elements with proper z-index reset
  const chatElements = document.querySelectorAll('.empty-chat-suggestion, .chat-suggestion-button');
  chatElements.forEach(element => {
    if (element instanceof HTMLElement) {
      TUTORIAL_CLASSES.forEach(className => {
        element.classList.remove(className);
      });
      TUTORIAL_STYLE_PROPERTIES.forEach(style => {
        element.style[style as any] = '';
      });
      
      // Specifically reset z-index for chat elements to prevent modal overlap
      element.style.zIndex = '';
    }
  });
  
  // Reset all chat containers z-index
  const chatContainers = document.querySelectorAll('.smart-chat-container, .mobile-chat-interface, .chat-messages-container');
  chatContainers.forEach(container => {
    if (container instanceof HTMLElement) {
      container.style.zIndex = '';
    }
  });
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
