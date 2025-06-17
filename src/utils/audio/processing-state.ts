
/**
 * Simplified audio processing state management
 * Handles processing locks and operational state without complex debouncing
 */

// Simple flags to track processing state
let isEntryBeingProcessed = false;
let processingLock = false;
let processingTimeoutId: NodeJS.Timeout | null = null;

// Store processing entries in localStorage
export const updateProcessingEntries = (tempId: string, action: 'add' | 'remove') => {
  try {
    const storedEntries = localStorage.getItem('processingEntries');
    let entries: string[] = storedEntries ? JSON.parse(storedEntries) : [];
    
    if (action === 'add' && !entries.includes(tempId)) {
      entries.push(tempId);
      console.log(`[ProcessingState] Added entry ${tempId} to processing list. Total: ${entries.length}`);
    } else if (action === 'remove') {
      entries = entries.filter(id => id !== tempId);
      console.log(`[ProcessingState] Removed entry ${tempId} from processing list. Total: ${entries.length}`);
    }
    
    localStorage.setItem('processingEntries', JSON.stringify(entries));
    
    // Dispatch simple event for components to react
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { entries, action, tempId }
    }));
    
    return entries;
  } catch (error) {
    console.error('[ProcessingState] Error updating processing entries:', error);
    return [];
  }
};

// Get current processing entries
export const getProcessingEntries = (): string[] => {
  try {
    const storedEntries = localStorage.getItem('processingEntries');
    return storedEntries ? JSON.parse(storedEntries) : [];
  } catch (error) {
    console.error('[ProcessingState] Error retrieving processing entries:', error);
    return [];
  }
};

// Remove processing entry by ID
export const removeProcessingEntryById = (entryId: number | string): void => {
  try {
    const idStr = String(entryId);
    const storedEntries = localStorage.getItem('processingEntries');
    let entries: string[] = storedEntries ? JSON.parse(storedEntries) : [];
    
    const updatedEntries = entries.filter(tempId => tempId !== idStr && !tempId.includes(idStr));
    
    if (updatedEntries.length !== entries.length) {
      localStorage.setItem('processingEntries', JSON.stringify(updatedEntries));
      
      // Fire completion event
      window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
        detail: { tempId: idStr, entryId }
      }));
      
      console.log(`[ProcessingState] Removed processing entry with ID ${idStr}`);
    }
  } catch (error) {
    console.error('[ProcessingState] Error removing processing entry:', error);
  }
};

// Clear all processing entries
export const clearAllProcessingEntries = (): void => {
  try {
    localStorage.removeItem('processingEntries');
    setProcessingLock(false);
    setIsEntryBeingProcessed(false);
    
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { entries: [], action: 'clear' }
    }));
    
    console.log('[ProcessingState] Cleared all processing entries');
  } catch (error) {
    console.error('[ProcessingState] Error clearing processing entries:', error);
  }
};

// Simple processing lock management
export const setProcessingLock = (value: boolean): void => {
  processingLock = value;
  console.log(`[ProcessingState] Processing lock set to: ${value}`);
};

export const getProcessingLock = (): boolean => {
  return processingLock;
};

export const setIsEntryBeingProcessed = (value: boolean): void => {
  isEntryBeingProcessed = value;
  console.log(`[ProcessingState] Entry being processed set to: ${value}`);
};

export const getIsEntryBeingProcessed = (): boolean => {
  return isEntryBeingProcessed;
};

export const setProcessingTimeoutId = (timeoutId: NodeJS.Timeout | null): void => {
  if (processingTimeoutId) {
    clearTimeout(processingTimeoutId);
  }
  processingTimeoutId = timeoutId;
};

export const getProcessingTimeoutId = (): NodeJS.Timeout | null => {
  return processingTimeoutId;
};
