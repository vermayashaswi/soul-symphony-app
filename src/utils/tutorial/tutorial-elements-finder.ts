
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
    '#past-entries-button'
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
};
