
/**
 * Processing intent utility for immediate UI feedback
 */

let processingIntentActive = false;
let processingIntentTimeout: NodeJS.Timeout | null = null;

/**
 * Set processing intent to provide immediate UI feedback
 */
export function setProcessingIntent(active: boolean, duration = 3000): void {
  console.log(`[ProcessingIntent] Setting processing intent: ${active}`);
  
  processingIntentActive = active;
  
  if (processingIntentTimeout) {
    clearTimeout(processingIntentTimeout);
    processingIntentTimeout = null;
  }
  
  if (active) {
    // Dispatch intent event
    window.dispatchEvent(new CustomEvent('processingIntent', {
      detail: { active: true, timestamp: Date.now() }
    }));
    
    // Auto-clear after duration
    processingIntentTimeout = setTimeout(() => {
      if (processingIntentActive) {
        processingIntentActive = false;
        console.log('[ProcessingIntent] Auto-cleared processing intent');
        
        window.dispatchEvent(new CustomEvent('processingIntent', {
          detail: { active: false, timestamp: Date.now() }
        }));
      }
    }, duration);
  } else {
    // Dispatch clear event
    window.dispatchEvent(new CustomEvent('processingIntent', {
      detail: { active: false, timestamp: Date.now() }
    }));
  }
}

/**
 * Check if processing intent is active
 */
export function hasProcessingIntent(): boolean {
  return processingIntentActive;
}

/**
 * Clear processing intent
 */
export function clearProcessingIntent(): void {
  setProcessingIntent(false);
}
