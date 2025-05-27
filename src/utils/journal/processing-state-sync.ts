
import { debounce } from '@/lib/utils';

/**
 * Debounced function to sync processing state across components
 * This helps prevent rapid state changes from causing UI flickering
 */
export const debouncedProcessingStateSync = debounce((callback: () => void) => {
  callback();
}, 50);

/**
 * Immediate processing state sync for critical operations
 * Use this when you need instant UI feedback
 */
export const immediateProcessingStateSync = (callback: () => void) => {
  // Execute immediately
  callback();
  
  // Also dispatch a custom event for components that need to react
  window.dispatchEvent(new CustomEvent('processingStateSynced', {
    detail: { 
      timestamp: Date.now(),
      immediate: true 
    }
  }));
};

/**
 * Check if any component is currently indicating processing state
 */
export const isAnyComponentProcessing = (): boolean => {
  // Check for processing indicators in the DOM
  const processingCards = document.querySelectorAll('[data-processing-cards-container="true"]');
  const hasVisibleProcessingCards = Array.from(processingCards).some(card => 
    card.children.length > 0 && 
    !card.classList.contains('hidden')
  );
  
  const savingIndicators = document.querySelectorAll('[data-saving="true"]');
  const hasSavingIndicators = savingIndicators.length > 0;
  
  return hasVisibleProcessingCards || hasSavingIndicators;
};
