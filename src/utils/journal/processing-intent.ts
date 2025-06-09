
import { processingStateManager } from './processing-state-manager';
import { immediateProcessingStateSync } from './processing-state-sync';

/**
 * Set processing intent immediately when audio processing starts
 * This ensures loading cards appear before the actual processing state propagates
 */
export const setProcessingIntent = (intent: boolean) => {
  console.log(`[ProcessingIntent] Setting processing intent: ${intent}`);
  
  // Use immediate sync for critical state changes
  immediateProcessingStateSync(() => {
    // Set flag in processing state manager
    processingStateManager.setProcessingIntent(intent);
    
    // Dispatch immediate events for UI components
    if (intent) {
      window.dispatchEvent(new CustomEvent('immediateProcessingStarted', {
        detail: { 
          tempId: 'intent-started',
          timestamp: Date.now(),
          immediate: true 
        }
      }));
      
      window.dispatchEvent(new CustomEvent('processingIntent', {
        detail: { 
          intent: true, 
          timestamp: Date.now(),
          immediate: true 
        }
      }));
    } else {
      window.dispatchEvent(new CustomEvent('processingIntent', {
        detail: { 
          intent: false, 
          timestamp: Date.now(),
          immediate: true 
        }
      }));
    }
  });
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
  setProcessingIntent(false);
};

/**
 * Get current processing intent state with additional context
 */
export const getProcessingIntentState = () => {
  const hasIntent = hasProcessingIntent();
  const timestamp = Date.now();
  
  return {
    hasIntent,
    timestamp,
    isActive: hasIntent
  };
};
