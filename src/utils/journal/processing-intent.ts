
import { processingStateManager } from './processing-state-manager';

/**
 * Set processing intent immediately when audio processing starts
 * This ensures loading cards appear before the actual processing state propagates
 */
export const setProcessingIntent = (intent: boolean) => {
  console.log(`[ProcessingIntent] Setting processing intent: ${intent}`);
  
  // Set flag in processing state manager
  processingStateManager.setProcessingIntent(intent);
  
  // Dispatch immediate event for UI components
  window.dispatchEvent(new CustomEvent('processingIntent', {
    detail: { 
      intent, 
      timestamp: Date.now(),
      immediate: true 
    }
  }));
  
  // Also dispatch immediate processing started event if setting intent to true
  if (intent) {
    window.dispatchEvent(new CustomEvent('immediateProcessingStarted', {
      detail: { 
        tempId: 'intent-started',
        timestamp: Date.now(),
        immediate: true 
      }
    }));
  }
};

/**
 * Check if there's currently processing intent
 */
export const hasProcessingIntent = (): boolean => {
  return processingStateManager.hasProcessingIntent();
};

/**
 * Clear processing intent (usually called when real processing state takes over)
 */
export const clearProcessingIntent = () => {
  console.log('[ProcessingIntent] Clearing processing intent');
  processingStateManager.setProcessingIntent(false);
};
