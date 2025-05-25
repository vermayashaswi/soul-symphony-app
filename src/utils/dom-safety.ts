
// Utility functions for safe DOM manipulation
export function safeQuerySelector(
  element: Element | Document | null, 
  selector: string
): Element | null {
  if (!element || !selector) return null;
  
  try {
    return element.querySelector(selector);
  } catch (error) {
    console.warn('Safe query selector failed:', error);
    return null;
  }
}

export function safeRemoveChild(parent: Element | null, child: Element | null): boolean {
  if (!parent || !child) return false;
  
  try {
    if (parent.contains(child)) {
      parent.removeChild(child);
      return true;
    }
  } catch (error) {
    console.warn('Safe remove child failed:', error);
  }
  
  return false;
}

export function safeAppendChild(parent: Element | null, child: Element | null): boolean {
  if (!parent || !child) return false;
  
  try {
    parent.appendChild(child);
    return true;
  } catch (error) {
    console.warn('Safe append child failed:', error);
  }
  
  return false;
}

export function safeAddEventListener(
  element: Element | Document | Window | null,
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions
): () => void {
  if (!element || !event || !handler) {
    return () => {}; // Return no-op cleanup function
  }
  
  try {
    element.addEventListener(event, handler, options);
    
    // Return cleanup function
    return () => {
      try {
        element.removeEventListener(event, handler, options);
      } catch (error) {
        console.warn('Safe remove event listener failed:', error);
      }
    };
  } catch (error) {
    console.warn('Safe add event listener failed:', error);
    return () => {};
  }
}

export function isElementInDOM(element: Element | null): boolean {
  if (!element) return false;
  
  try {
    return document.contains(element);
  } catch (error) {
    console.warn('DOM check failed:', error);
    return false;
  }
}

// Component mount state tracker
const componentMountStates = new Map<string, boolean>();

export function setComponentMounted(componentId: string, mounted: boolean): void {
  componentMountStates.set(componentId, mounted);
}

export function isComponentMounted(componentId: string): boolean {
  return componentMountStates.get(componentId) ?? false;
}

export function cleanupComponentState(componentId: string): void {
  componentMountStates.delete(componentId);
}
