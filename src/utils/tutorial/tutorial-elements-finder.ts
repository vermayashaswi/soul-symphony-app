
// Enhanced tutorial elements finder with improved selectors and highlighting

import { highlightingManager } from './tutorial-highlighting-manager';

// ENHANCED: More comprehensive selector lists with better targeting
export const RECORD_ENTRY_SELECTORS = [
  '.tutorial-record-entry-button',
  'button[data-tutorial-target="record-entry"]',
  'button:has(.lucide-plus)',
  'button[id="new-entry-button"]',
  '.record-entry-button',
  'button:contains("New entry")',
  'button:contains("Record")',
  'button:contains("+")',
  '[data-value="record"] button',
  'button[role="tab"][data-value="record"]',
  '.journal-entries-header button'
];

export const ENTRIES_TAB_SELECTORS = [
  'button[role="tab"][data-value="entries"]',
  '[data-value="entries"]',
  'button[data-tutorial-tab="entries"]',
  '.entries-tab',
  'button:contains("Past entries")',
  'button:contains("Entries")',
  'button:contains("History")',
  '[role="tablist"] button:nth-child(2)',
  '.journal-tabs button:nth-child(2)'
];

export const CHAT_QUESTION_SELECTORS = [
  '.empty-chat-suggestion',
  '.chat-suggestion-button',
  'button:contains("How am I feeling")',
  'button:contains("What are my")',
  'button:contains("Tell me about")',
  '.chat-suggestions button',
  '.empty-state button',
  '.chat-questions button'
];

export const INSIGHTS_HEADER_SELECTORS = [
  '.insights-container h1',
  'h1:contains("Insights")',
  '.insights-header',
  'main h1',
  '[class*="insights"] h1'
];

export const EMOTION_CHART_SELECTORS = [
  '.recharts-responsive-container',
  '.emotion-chart',
  '.chart-container',
  '[class*="chart"]',
  'svg[class*="recharts"]'
];

export const MOOD_CALENDAR_SELECTORS = [
  '[class*="MoodCalendar"]',
  '.mood-calendar',
  '.calendar-grid',
  '[class*="calendar"]',
  '.mood-visualization'
];


// ENHANCED: Improved highlighting function with new manager
export const findAndHighlightElement = (
  selectors: string[],
  highlightClass: string
): boolean => {
  console.log(`[ElementFinder] Finding and highlighting element with class "${highlightClass}"`);
  
  // Determine step ID from highlight class
  let stepId = 0;
  if (highlightClass.includes('record-entry')) stepId = 3;
  else if (highlightClass.includes('entries')) stepId = 4;
  else if (highlightClass.includes('chat-question')) stepId = 5;
  else if (highlightClass.includes('insights-header')) stepId = 6;
  else if (highlightClass.includes('emotion-chart')) stepId = 7;
  else if (highlightClass.includes('mood-calendar')) stepId = 8;
  
  
  const classesToApply = ['tutorial-target', highlightClass];
  
  // Use the new highlighting manager for staggered application
  highlightingManager.applyStaggeredHighlighting(selectors, classesToApply, stepId);
  
  // Return true to indicate attempt was made (actual success is handled asynchronously)
  return true;
};

// ENHANCED: Apply tutorial highlight with comprehensive styling
export const applyTutorialHighlight = (element: HTMLElement, highlightClass: string): void => {
  console.log(`[ElementFinder] Applying tutorial highlight with class "${highlightClass}"`);
  
  try {
    // Add the highlight class
    element.classList.add('tutorial-target', highlightClass);
    
    // Apply step-specific styling based on highlight class
    if (highlightClass.includes('record-entry') || highlightClass.includes('entries')) {
      // Tab-specific styling
      const tabStyles = {
        zIndex: '30000',
        position: 'relative',
        boxShadow: '0 0 50px 30px var(--color-theme)',
        animation: 'ultra-bright-pulse 1.5s infinite alternate',
        outline: '3px solid white',
        opacity: '1',
        transform: 'translateZ(0) scale(1.05)',
        border: '3px solid white',
        backgroundColor: 'rgba(26, 31, 44, 0.98)',
        backdropFilter: 'brightness(1.3)',
        borderRadius: '8px',
        visibility: 'visible',
        pointerEvents: 'auto',
        color: 'white',
        textShadow: '0 0 4px rgba(0,0,0,0.8)'
      };
      
      Object.entries(tabStyles).forEach(([prop, value]) => {
        try {
          element.style[prop as any] = value;
        } catch (error) {
          console.warn(`[ElementFinder] Could not set tab style ${prop}:`, error);
        }
      });
      
      // Apply text color to child elements
      const children = element.querySelectorAll('*');
      children.forEach(child => {
        if (child instanceof HTMLElement) {
          child.style.color = 'white';
          child.style.textShadow = '0 0 4px rgba(0,0,0,0.8)';
        }
      });
    } else if (highlightClass.includes('chat-question')) {
      // Chat question specific styling
      const chatStyles = {
        zIndex: '8000', // Lower than tutorial modal
        position: 'relative',
        boxShadow: '0 0 40px 25px var(--color-theme)',
        animation: 'ultra-strong-pulse 1.5s infinite alternate',
        outline: '2px solid white',
        opacity: '1',
        visibility: 'visible',
        transform: 'translateZ(0) scale(1.05)',
        border: '2px solid white',
        pointerEvents: 'auto',
        cursor: 'pointer',
        display: 'block',
        maxHeight: 'none',
        overflow: 'visible'
      };
      
      Object.entries(chatStyles).forEach(([prop, value]) => {
        try {
          element.style[prop as any] = value;
        } catch (error) {
          console.warn(`[ElementFinder] Could not set chat style ${prop}:`, error);
        }
      });
    } else {
      // General highlighting for other elements
      const generalStyles = {
        zIndex: '10000',
        position: 'relative',
        boxShadow: '0 0 35px 20px var(--color-theme)',
        animation: 'strong-tab-pulse 1.5s infinite alternate',
        outline: '2px solid white',
        opacity: '1',
        transform: 'translateZ(0) scale(1.01)',
        border: '2px solid white',
        visibility: 'visible'
      };
      
      Object.entries(generalStyles).forEach(([prop, value]) => {
        try {
          element.style[prop as any] = value;
        } catch (error) {
          console.warn(`[ElementFinder] Could not set general style ${prop}:`, error);
        }
      });
    }
    
    console.log(`[ElementFinder] Successfully applied highlight "${highlightClass}" to element`);
  } catch (error) {
    console.error(`[ElementFinder] Error applying tutorial highlight:`, error);
  }
};

// ENHANCED: Logging function with more detailed DOM information
export const logPotentialTutorialElements = (): void => {
  console.group('[ElementFinder] Potential tutorial elements in DOM:');
  
  try {
    // Check for tab elements
    const tabs = document.querySelectorAll('button[role="tab"], [data-value], .tab');
    console.log('Tab elements found:', tabs.length);
    tabs.forEach((tab, index) => {
      const text = tab.textContent?.trim() || '';
      const dataValue = tab.getAttribute('data-value') || '';
      const classes = Array.from(tab.classList);
      console.log(`Tab ${index + 1}:`, { element: tab, text, dataValue, classes });
    });
    
    // Check for button elements
    const buttons = document.querySelectorAll('button');
    console.log('Button elements found:', buttons.length);
    buttons.forEach((button, index) => {
      if (index < 10) { // Limit to first 10 to avoid spam
        const text = button.textContent?.trim() || '';
        const id = button.id || '';
        const classes = Array.from(button.classList);
        console.log(`Button ${index + 1}:`, { element: button, text, id, classes });
      }
    });
    
    // Check for chat elements
    const chatElements = document.querySelectorAll('[class*="chat"], [class*="suggestion"], [class*="empty"]');
    console.log('Chat-related elements found:', chatElements.length);
    chatElements.forEach((element, index) => {
      const text = element.textContent?.trim().substring(0, 50) || '';
      const classes = Array.from(element.classList);
      console.log(`Chat element ${index + 1}:`, { element, text, classes });
    });
    
    // Check for insights elements
    const insightsElements = document.querySelectorAll('h1, .recharts-responsive-container, canvas, [class*="calendar"]');
    console.log('Insights-related elements found:', insightsElements.length);
    insightsElements.forEach((element, index) => {
      const tag = element.tagName.toLowerCase();
      const text = element.textContent?.trim().substring(0, 30) || '';
      const classes = Array.from(element.classList);
      console.log(`Insights element ${index + 1}:`, { tag, element, text, classes });
    });
    
  } catch (error) {
    console.error('[ElementFinder] Error logging potential elements:', error);
  }
  
  console.groupEnd();
};
