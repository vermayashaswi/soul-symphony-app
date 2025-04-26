
/**
 * Audio processing state management
 * Handles processing locks and operational state
 */

// Flag to track if an entry is being processed to prevent duplicate notifications
let isEntryBeingProcessed = false;
let processingLock = false;
let processingTimeoutId: NodeJS.Timeout | null = null;
let lastStateChangeTime = 0;
const DEBOUNCE_THRESHOLD = 200; // Reduced from 500ms to 200ms to be more responsive

// Store processing entries in localStorage to persist across navigations
export const updateProcessingEntries = (tempId: string, action: 'add' | 'remove') => {
  try {
    // Prevent rapid toggling by implementing a simple debounce
    const now = Date.now();
    if (now - lastStateChangeTime < DEBOUNCE_THRESHOLD) {
      console.log('[Audio.ProcessingState] Debouncing rapid state change');
      return getProcessingEntries(); // Return current state without changes
    }
    lastStateChangeTime = now;
    
    const storedEntries = localStorage.getItem('processingEntries');
    let entries: string[] = storedEntries ? JSON.parse(storedEntries) : [];
    
    if (action === 'add' && !entries.includes(tempId)) {
      entries.push(tempId);
      console.log(`[Audio.ProcessingState] Added entry ${tempId} to processing list. Now tracking ${entries.length} entries.`);
    } else if (action === 'remove') {
      entries = entries.filter(id => id !== tempId);
      console.log(`[Audio.ProcessingState] Removed entry ${tempId} from processing list. Now tracking ${entries.length} entries.`);
      
      // Add explicit cleanup here to ensure completed entries are properly marked
      window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
        detail: { tempId, timestamp: now }
      }));
    }
    
    localStorage.setItem('processingEntries', JSON.stringify(entries));
    
    // Dispatch an event so other components can react to the change
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { entries, lastUpdate: now, forceUpdate: true }
    }));
    
    // Send a second event to ensure iOS devices catch it
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
        detail: { entries, lastUpdate: now + 1, forceUpdate: true }
      }));
    }, 50);
    
    return entries;
  } catch (error) {
    console.error('[Audio.ProcessingState] Error updating processing entries in storage:', error);
    return [];
  }
};

// Get the current processing entries from localStorage
export const getProcessingEntries = (): string[] => {
  try {
    const storedEntries = localStorage.getItem('processingEntries');
    let entries = storedEntries ? JSON.parse(storedEntries) : [];
    
    console.log(`[Audio.ProcessingState] Retrieved ${entries.length} processing entries from storage.`);
    return entries;
  } catch (error) {
    console.error('[Audio.ProcessingState] Error retrieving processing entries from storage:', error);
    return [];
  }
};

// Remove processing entry by ID (useful when an entry is completed)
export const removeProcessingEntryById = (entryId: number | string): void => {
  try {
    // Prevent rapid toggling with debounce
    const now = Date.now();
    if (now - lastStateChangeTime < DEBOUNCE_THRESHOLD) {
      console.log('[Audio.ProcessingState] Debouncing rapid removal request');
      return;
    }
    lastStateChangeTime = now;
    
    const idStr = String(entryId);
    const storedEntries = localStorage.getItem('processingEntries');
    let entries: string[] = storedEntries ? JSON.parse(storedEntries) : [];
    
    const updatedEntries = entries.filter(tempId => {
      return tempId !== idStr && !tempId.includes(idStr);
    });
    
    if (updatedEntries.length !== entries.length) {
      localStorage.setItem('processingEntries', JSON.stringify(updatedEntries));
      
      // Dispatch an event so other components can react to the change
      window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
        detail: { entries: updatedEntries, lastUpdate: now, removedId: idStr, forceUpdate: true }
      }));
      
      // Add explicit "entry completed" event
      window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
        detail: { tempId: idStr, timestamp: now }
      }));
      
      console.log(`[Audio.ProcessingState] Removed processing entry with ID ${idStr}`);
    }
  } catch (error) {
    console.error('[Audio.ProcessingState] Error removing processing entry from storage:', error);
  }
};

// Check if a journal entry is currently being processed
export function isProcessingEntry(): boolean {
  return isEntryBeingProcessed;
}

// Release all locks and reset processing state (useful for recovery)
export function resetProcessingState(): void {
  console.log('[Audio.ProcessingState] Manually resetting processing state');
  isEntryBeingProcessed = false;
  processingLock = false;
  
  // Clear all processing entries from localStorage
  localStorage.setItem('processingEntries', JSON.stringify([]));
  
  if (processingTimeoutId) {
    clearTimeout(processingTimeoutId);
    processingTimeoutId = null;
  }
  
  // Clear all toasts to ensure UI is clean
  import('@/services/notificationService').then(({ clearAllToasts }) => {
    clearAllToasts();
  });
  
  // Dispatch a reset event
  window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
    detail: { entries: [], reset: true, lastUpdate: Date.now(), forceUpdate: true }
  }));
}

// Internal setters used by the main processing module
export function setProcessingLock(value: boolean): void {
  processingLock = value;
}

export function getProcessingLock(): boolean {
  return processingLock;
}

export function setProcessingTimeoutId(id: NodeJS.Timeout | null): void {
  processingTimeoutId = id;
}

export function getProcessingTimeoutId(): NodeJS.Timeout | null {
  return processingTimeoutId;
}

export function setIsEntryBeingProcessed(value: boolean): void {
  isEntryBeingProcessed = value;
}

// Variable to check if user has previous entries
export let hasPreviousEntries = false;
export function setHasPreviousEntries(value: boolean): void {
  hasPreviousEntries = value;
}
