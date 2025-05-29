
/**
 * Helper functions to find, debug and highlight tutorial elements in the DOM
 */

// All potential selectors for the record entry tab
export const RECORD_ENTRY_SELECTORS = [
  '[data-value="record"]',
  '.record-entry-tab',
  '.tutorial-record-entry-button',
  'button[data-tutorial-target="record-entry"]',
  '#new-entry-button',
  '.record-entry-button',
  '[role="tab"][value="record"]'
];

// All potential selectors for the entries tab
export const ENTRIES_TAB_SELECTORS = [
  '[value="entries"]',
  '.entries-tab',
  'button[data-tutorial-target="past-entries"]',
  '#past-entries-button',
  '[role="tab"][value="entries"]'
];

// All potential selectors for theme strips
export const THEME_STRIPS_SELECTORS = [
  '.floating-theme-strips',
  '.theme-strip',
  '[data-tutorial-target="theme-strips"]',
  '.journal-summary-card .floating-theme-strips',
  '.h-full.w-full .floating-theme-strips'
];

// All potential selectors for chat question suggestion elements
export const CHAT_QUESTION_SELECTORS = [
  '.chat-suggestion-button:first-child',
  '.suggestion-button:first-child',
  '.empty-chat-suggestion:first-child',
  '[data-tutorial-target="chat-suggestion"]:first-child',
  '.suggestion-question:first-child',
  '.chat-example-button:first-child',
  '.question-button:first-child',
  '.chat-question-suggestion:first-child',
  // Generic non-first-child selectors as fallbacks
  '.chat-suggestion-button',
  '.suggestion-button',
  '.empty-chat-suggestion',
  '[data-tutorial-target="chat-suggestion"]',
  '.suggestion-question',
  '.chat-example-button',
  '.question-button',
  '.chat-question-suggestion'
];

// Selectors for Insights page elements
export const INSIGHTS_HEADER_SELECTORS = [
  '.insights-page-content h1',
  '.insights-container h1',
  '.insights-sticky-header'
];

export const EMOTION_CHART_SELECTORS = [
  '.insights-container .recharts-responsive-container',
  '.bg-background:has(.recharts-responsive-container)',
  '.insights-container .EmotionChart',
  'div:has(>.recharts-wrapper)'
];

export const MOOD_CALENDAR_SELECTORS = [
  '.insights-container [class*="MoodCalendar"]',
  '.insights-container div:has(.mood-calendar-grid)',
  '.insights-container div:has(.calendar-day)'
];

export const SOULNET_SELECTORS = [
  '.insights-container canvas',
  '.insights-container [class*="SoulNet"]',
  '.insights-container div:has(canvas)'
];

/**
 * Apply tutorial highlight styling to an HTML element
 * @param element The element to apply highlighting to
 * @param className Additional class name to add
 */
export const applyTutorialHighlight = (
  element: HTMLElement, 
  className: string = 'tutorial-button-highlight'
): void => {
  // Add CSS classes
  element.classList.add('tutorial-target', className);
  
  // Apply direct styles for maximum compatibility
  element.style.boxShadow = "0 0 35px 20px var(--color-theme)";
  element.style.animation = "button-pulse 1.5s infinite alternate";
  element.style.border = "2px solid white";
  element.style.transform = "scale(1.05)";
  element.style.zIndex = "10000";
  element.style.position = "relative";
  element.style.opacity = "1";
  element.style.visibility = "visible";
};

/**
 * Find an element using multiple selectors and apply tutorial highlighting
 * @param selectors Array of CSS selectors to try
 * @param className Additional class name to add
 * @returns Whether an element was found and highlighted
 */
export const findAndHighlightElement = (
  selectors: string[],
  className: string
): boolean => {
  // Special handling for theme strips to ensure animation continues
  if (className === 'theme-strips-highlight') {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element instanceof HTMLElement) {
        // For theme strips, apply a subtle highlight that doesn't interfere with animation
        element.classList.add('tutorial-target', className);
        element.style.border = "3px solid var(--color-theme)";
        element.style.borderRadius = "12px";
        element.style.boxShadow = "0 0 25px 10px rgba(var(--primary-h), var(--primary-s), var(--primary-l), 0.3)";
        element.style.zIndex = "9999";
        element.style.position = "relative";
        
        console.log(`Applied theme strips highlighting to element using selector: ${selector}`);
        return true;
      }
    }
  }
  
  // If this is for chat questions, try to find all elements and select the first one
  if (className === 'chat-question-highlight') {
    // Try to find all chat question elements
    const allElements: HTMLElement[] = [];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach(el => {
          if (el instanceof HTMLElement) {
            allElements.push(el);
          }
        });
      }
    }
    
    // If we found any elements, highlight the first one
    if (allElements.length > 0) {
      console.log(`Found ${allElements.length} potential chat questions, highlighting the first one`);
      const firstElement = allElements[0];
      applyTutorialHighlight(firstElement, className);
      console.log(`Applied chat question highlighting to element:`, {
        text: firstElement.textContent?.trim(),
        classes: firstElement.className,
        tag: firstElement.tagName
      });
      return true;
    }
  }
  
  // Default behavior for other elements
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      applyTutorialHighlight(element, className);
      console.log(`Applied tutorial highlighting to element using selector: ${selector}`);
      return true;
    }
  }
  
  console.warn('No elements found with any of the provided selectors');
  return false;
};

/**
 * Debug function to log all potential tutorial targets in the DOM
 */
export const logPotentialTutorialElements = (): void => {
  console.log('Searching for potential tutorial elements...');
  
  // Common elements that might be tutorial targets
  const selectors = [
    'button', 
    '[role="tab"]', 
    '[data-value]',
    '.record-entry-tab',
    '.entries-tab',
    '#new-entry-button',
    '#past-entries-button',
    '.chat-suggestion-button',
    '.suggestion-button',
    '.empty-chat-suggestion',
    '.floating-theme-strips',
    '.theme-strip'
  ];
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`Found ${elements.length} elements matching "${selector}":`);
    
    elements.forEach((el, i) => {
      console.log(`${i + 1}. Element:`, {
        tagName: el.tagName,
        classes: el.className,
        id: (el as HTMLElement).id,
        attributes: Array.from(el.attributes)
          .map(attr => `${attr.name}="${attr.value}"`)
          .join(', '),
        text: el.textContent?.trim()
      });
    });
  });
  
  // Specifically log chat question elements for debugging
  console.log('Looking specifically for chat question elements:');
  document.querySelectorAll('.chat-suggestion-button, .suggestion-button, .empty-chat-suggestion, .question-button').forEach((el, i) => {
    console.log(`Chat question ${i + 1}:`, {
      text: el.textContent?.trim(),
      classes: el.className,
      visible: el.getBoundingClientRect().height > 0,
      position: el.getBoundingClientRect()
    });
  });
};
