
/**
 * Main audio processing module
 * Orchestrates the audio recording and transcription process
 */
import { clearAllToasts, ensureAllToastsCleared } from '@/services/notificationService';
import { 
  setProcessingLock, 
  setIsEntryBeingProcessed,
  updateProcessingEntries,
  isProcessingEntry,
  resetProcessingState,
  getProcessingEntries,
  removeProcessingEntryById as removeProcessingEntryFromState
} from './audio/processing-state';
import { validateInitialState, setupProcessingTimeout } from './audio/recording-validation';
import { processRecordingInBackground } from './audio/background-processor';
import { blobToBase64 } from './audio/blob-utils';
import { supabase } from '@/integrations/supabase/client';

// To track correlation between tempIds and final entryIds
const processingToEntryIdMap = new Map<string, number>();
// Set to track deleted processing entries
const deletedProcessingIds = new Set<string>();
// Set to track deleted entry IDs
const deletedEntryIds = new Set<number>();
// Map to track which processing entries have been completed
const completedProcessingEntries = new Map<string, boolean>();
// Track timestamps of processing start
const processingStartTimes = new Map<string, number>();

/**
 * Check if a processing entry or actual entry has been deleted
 * @param tempId The processing ID to check
 * @param entryId The entry ID to check
 * @returns True if either ID has been marked as deleted
 */
export function isEntryDeleted(tempId?: string, entryId?: number): boolean {
  if (tempId && deletedProcessingIds.has(tempId)) {
    return true;
  }
  
  if (entryId && deletedEntryIds.has(entryId)) {
    return true;
  }
  
  return false;
}

/**
 * Get the mapping between a temporary processing ID and the final entry ID
 * @param tempId The temporary processing ID
 * @returns The corresponding entry ID if found, or undefined
 */
export function getEntryIdForProcessingId(tempId: string): number | undefined {
  try {
    // Extract base tempId without timestamp
    const baseTempId = tempId.split('-')[0];
    
    // Check if this processing ID was deleted
    if (deletedProcessingIds.has(baseTempId) || isEntryDeleted(baseTempId)) {
      return undefined;
    }
    
    // First check the in-memory map with base ID
    const memoryResult = processingToEntryIdMap.get(baseTempId);
    if (memoryResult) {
      // Check if the entry ID was deleted
      if (deletedEntryIds.has(memoryResult)) {
        return undefined;
      }
      return memoryResult;
    }
    
    // Check with full tempId
    const fullMemoryResult = processingToEntryIdMap.get(tempId);
    if (fullMemoryResult) {
      if (deletedEntryIds.has(fullMemoryResult)) {
        return undefined;
      }
      return fullMemoryResult;
    }
    
    // Then check localStorage as fallback - critical for persistence across navigations
    const processingToEntryMap = localStorage.getItem('processingToEntryMap');
    if (!processingToEntryMap) return undefined;
    
    const map = JSON.parse(processingToEntryMap);
    
    // Try both the full tempId and the base tempId
    let result = map[tempId] || map[baseTempId];
    
    // Check if the entry ID was deleted
    if (result && deletedEntryIds.has(Number(result))) {
      return undefined;
    }
    
    return result ? Number(result) : undefined;
  } catch (error) {
    console.error('[Audio Processing] Error getting entry ID for processing ID:', error);
    return undefined;
  }
}

/**
 * Store a mapping between a temporary processing ID and its final entry ID
 * @param tempId The temporary processing ID
 * @param entryId The final database entry ID
 */
export function setEntryIdForProcessingId(tempId: string, entryId: number): void {
  // Extract base tempId without timestamp if it has one
  const baseTempId = tempId.includes('-') ? tempId.split('-')[0] : tempId;
  
  // Skip if either ID is in the deleted sets
  if (deletedProcessingIds.has(baseTempId) || deletedEntryIds.has(entryId) || isEntryDeleted(baseTempId)) {
    console.log(`[Audio Processing] Skipping mapping of deleted entry: ${tempId} -> ${entryId}`);
    return;
  }

  // Store in memory map - store both the full ID and the base ID
  processingToEntryIdMap.set(tempId, entryId);
  processingToEntryIdMap.set(baseTempId, entryId);
  
  // Calculate processing time
  const startTime = processingStartTimes.get(tempId) || processingStartTimes.get(baseTempId);
  const processingDuration = startTime ? Date.now() - startTime : 0;
  
  console.log(`[Audio Processing] Entry processed in ${processingDuration}ms: ${tempId} -> ${entryId}`);
  
  // IMPORTANT: DO NOT mark as completed immediately - need to show UI first
  // Delayed completion marking happens below
  
  // Also persist to localStorage for cross-page survival - this is crucial for iOS
  try {
    const processingToEntryMap = localStorage.getItem('processingToEntryMap');
    const map = processingToEntryMap ? JSON.parse(processingToEntryMap) : {};
    map[tempId] = entryId;
    map[baseTempId] = entryId;
    localStorage.setItem('processingToEntryMap', JSON.stringify(map));
    
    // Also update session storage as an additional persistence layer for iOS
    sessionStorage.setItem(`processing_${tempId}`, String(entryId));
    sessionStorage.setItem(`processing_${baseTempId}`, String(entryId));
  } catch (error) {
    console.error('[Audio Processing] Error setting entry ID for processing ID:', error);
  }
  
  // IMPROVED: Ensure cards are visible for at least 4 seconds
  // First tell the UI that content is ready but don't remove cards yet
  const minVisibleTime = 4000; // ms
  const processingTime = processingDuration;
  const timeToWait = Math.max(0, minVisibleTime - processingTime);
  
  console.log(`[Audio Processing] Ensuring card visibility for ${timeToWait}ms more after ${processingTime}ms of processing`);
  
  // First dispatch an event to indicate content is ready (this triggers UI transition)
  window.dispatchEvent(new CustomEvent('entryContentReady', {
    detail: { tempId, entryId, timestamp: Date.now() }
  }));
  
  // After ensuring minimum visibility, mark as complete and clean up
  setTimeout(() => {
    console.log(`[Audio Processing] Now marking entry as completed after minimum visibility: ${tempId} -> ${entryId}`);
    
    // Now mark as completed AFTER minimum display time
    completedProcessingEntries.set(tempId, true);
    completedProcessingEntries.set(baseTempId, true);
    
    // Dispatch completion events
    window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
      detail: { tempId, entryId, timestamp: Date.now() }
    }));
    
    // Trigger fetch refresh
    window.dispatchEvent(new CustomEvent('journalEntriesNeedRefresh', {
      detail: { tempId, entryId, timestamp: Date.now() }
    }));
  
    // After a bit more time, force removal of any processing cards
    setTimeout(() => {
      console.log(`[Audio Processing] Now forcing removal of processing cards: ${tempId}`);
      
      window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
        detail: { tempId, entryId, timestamp: Date.now(), forceCleanup: true }
      }));
      
      // IMPORTANT: Explicitly remove the processing entry to update UI
      removeProcessingEntryById(tempId);
    }, 500);
  }, timeToWait);
}

/**
 * Clears the processing to entry ID mapping
 */
export function clearProcessingToEntryIdMap(): void {
  processingToEntryIdMap.clear();
  completedProcessingEntries.clear();
  processingStartTimes.clear();
  localStorage.removeItem('processingToEntryMap');
  
  // Clear session storage entries too
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('processing_')) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => sessionStorage.removeItem(key));
}

/**
 * Processes an audio recording for transcription and analysis
 * Returns immediately with a temporary ID while processing continues in background
 */
export async function processRecording(audioBlob: Blob | null, userId: string | undefined): Promise<{
  success: boolean;
  tempId?: string;
  error?: string;
}> {
  console.log('[AudioProcessing] Starting processing with blob:', audioBlob?.size, audioBlob?.type);
  
  // Clear all toasts to ensure UI is clean before processing
  await ensureAllToastsCleared();
  
  // Validate the audio blob
  if (!audioBlob) {
    return { 
      success: false, 
      error: 'No audio data to process' 
    };
  }
  
  // Check if the audio blob has duration
  if (!('duration' in audioBlob) || (audioBlob as any).duration <= 0) {
    console.warn('[AudioProcessing] Audio blob has no duration property or duration is 0');
  } else {
    console.log('[AudioProcessing] Audio duration:', (audioBlob as any).duration);
  }
  
  // Test base64 conversion before proceeding
  try {
    const base64Test = await blobToBase64(audioBlob);
    console.log('[AudioProcessing] Base64 test conversion successful, length:', base64Test.length);
    
    // Make sure we have reasonable data
    if (base64Test.length < 50) {
      return {
        success: false,
        error: 'Audio data appears too short or invalid'
      };
    }
  } catch (error) {
    console.error('[AudioProcessing] Base64 test conversion failed:', error);
    return {
      success: false,
      error: 'Error preparing audio data for processing'
    };
  }
  
  // Validate initial state and get tempId
  const validationResult = await validateInitialState(audioBlob, userId);
  if (!validationResult.success) {
    console.error('[AudioProcessing] Initial validation failed:', validationResult.error);
    return validationResult;
  }
  
  const tempId = validationResult.tempId!;
  console.log('[AudioProcessing] Generated temporary ID:', tempId);
  
  try {
    // Record the start time for this processing task
    processingStartTimes.set(tempId, Date.now());
    
    // Set processing lock to prevent multiple simultaneous processing
    setProcessingLock(true);
    setIsEntryBeingProcessed(true);
    console.log('[AudioProcessing] Set processing locks');
    
    // Setup timeout to prevent deadlocks
    setupProcessingTimeout();
    console.log('[AudioProcessing] Setup processing timeout');
    
    // Add this entry to localStorage to persist across navigations - CRITICAL for iOS
    const updatedEntries = updateProcessingEntries(tempId, 'add');
    
    // Also store in sessionStorage for additional iOS reliability
    const existingEntries = sessionStorage.getItem('processingEntries');
    const sessionEntries = existingEntries ? JSON.parse(existingEntries) : [];
    if (!sessionEntries.includes(tempId)) {
      sessionEntries.push(tempId);
      sessionStorage.setItem('processingEntries', JSON.stringify(sessionEntries));
    }
    
    console.log('[AudioProcessing] Updated processing entries in localStorage:', updatedEntries);
    
    // Log the audio details
    console.log('[AudioProcessing] Processing audio:', {
      size: audioBlob?.size || 0,
      type: audioBlob?.type || 'unknown',
      userId: userId || 'anonymous',
      audioDuration: (audioBlob as any).duration || 'unknown'
    });
    
    // Before dispatching, clean up any existing processing entries that might be duplicates
    const cleanedEntries = updatedEntries.filter((id, index, self) => 
      self.indexOf(id) === index && !isProcessingEntryCompleted(id)
    );

    // Force multiple custom event dispatches immediately to ensure loading state appears
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { entries: cleanedEntries, lastUpdate: Date.now(), forceUpdate: true }
    }));
    
    // Also dispatch after a small delay - iOS needs this redundancy
    setTimeout(() => {
      const currentEntries = getProcessingEntries().filter(id => !isProcessingEntryCompleted(id));
      window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
        detail: { entries: currentEntries, lastUpdate: Date.now() + 1, forceUpdate: true }
      }));
    }, 50);
    
    // And repeat a few more times to ensure iOS sees it
    [100, 300, 600, 1000].forEach(delay => {
      setTimeout(() => {
        const currentEntries = getProcessingEntries().filter(id => !isProcessingEntryCompleted(id));
        window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
          detail: { entries: currentEntries, lastUpdate: Date.now() + delay, forceUpdate: true }
        }));
      }, delay);
    });
    
    // Launch the processing without awaiting it
    console.log('[AudioProcessing] Launching background processing');
    processRecordingInBackground(audioBlob, userId, tempId)
      .then(result => {
        console.log('[AudioProcessing] Background processing completed:', result);
        
        // If we have an entryId in the result, store the mapping
        if (result.entryId) {
          setEntryIdForProcessingId(tempId, result.entryId);
          console.log(`[AudioProcessing] Mapped tempId ${tempId} to entryId ${result.entryId}`);
        }
      })
      .catch(err => {
        console.error('[AudioProcessing] Background processing error:', err);
        setIsEntryBeingProcessed(false);
        setProcessingLock(false);
        
        updateProcessingEntries(tempId, 'remove');
        
        // Dispatch a failure event
        window.dispatchEvent(new CustomEvent('processingEntryFailed', {
          detail: { tempId, error: err.message, timestamp: Date.now() }
        }));
      });
    
    // Return immediately with the temp ID
    console.log('[AudioProcessing] Returning success with tempId:', tempId);
    
    return { success: true, tempId };
  } catch (error: any) {
    console.error('[AudioProcessing] Error initiating recording process:', error);
    setIsEntryBeingProcessed(false);
    setProcessingLock(false);
    
    return { success: false, error: error.message || 'Unknown error' };
  }
}

// Re-export useful functions from child modules
export { 
  isProcessingEntry, 
  resetProcessingState, 
  getProcessingEntries
} from './audio/processing-state';

/**
 * Check if a processing entry is completed (mapped to a real entry)
 * @param tempId The temporary processing ID
 * @returns True if the processing is completed, false otherwise
 */
export function isProcessingEntryCompleted(tempId: string): boolean {
  // IMPORTANT: Modified to prevent premature completion detection
  
  // Extract base tempId without timestamp if it has one
  const baseTempId = tempId.includes('-') ? tempId.split('-')[0] : tempId;
  
  // Check if it's marked as completed in memory
  if (completedProcessingEntries.has(tempId) || completedProcessingEntries.has(baseTempId)) {
    return true;
  }
  
  // Check if it has a mapped entry ID
  const entryId = getEntryIdForProcessingId(tempId);
  if (entryId !== undefined) {
    // CRITICAL: Do not mark as immediately completed even if mapped
    // This allows the UI time to show the processing state
    
    // Calculate how long it's been processing
    const startTime = processingStartTimes.get(tempId) || processingStartTimes.get(baseTempId);
    if (startTime) {
      const processingDuration = Date.now() - startTime;
      
      // If it's been processing for at least 3 seconds, we can consider it done
      if (processingDuration > 3000) {
        return true;
      } else {
        console.log(`[Audio Processing] Entry mapped but only processed for ${processingDuration}ms, keeping visible`);
        return false;
      }
    }
    
    return true;
  }
  
  return false;
}

/**
 * Remove a processing entry by ID, cleaning up both processing state and mapping
 */
export function removeProcessingEntryById(entryId: number | string): void {
  console.log(`[Audio Processing] Removing processing entry by ID: ${entryId}`);
  
  // First, remove from the processing state
  removeProcessingEntryFromState(entryId);
  
  // Track this deleted entry
  if (typeof entryId === 'number') {
    deletedEntryIds.add(entryId);
    console.log(`[Audio Processing] Added entry ID ${entryId} to deleted entries set`);
  } else {
    // Extract base tempId without timestamp if it has one
    const baseTempId = entryId.includes('-') ? entryId.split('-')[0] : entryId;
    deletedProcessingIds.add(baseTempId);
    console.log(`[Audio Processing] Added processing ID ${baseTempId} to deleted processing set`);
    
    // Also mark as completed to prevent reappearance
    completedProcessingEntries.set(baseTempId, true);
  }
  
  // Trigger UI cleanup by dispatching relevant events
  window.dispatchEvent(new CustomEvent('entryContentReady', {
    detail: { 
      tempId: typeof entryId === 'string' ? entryId : undefined, 
      entryId: typeof entryId === 'number' ? entryId : undefined,
      timestamp: Date.now() 
    }
  }));

  // Force removal of any processing cards
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
      detail: { 
        tempId: typeof entryId === 'string' ? entryId : undefined,
        entryId: typeof entryId === 'number' ? entryId : undefined,
        timestamp: Date.now(),
        forceCleanup: true
      }
    }));
  }, 10);
  
  // Clean up the map storage
  try {
    const processingToEntryMap = localStorage.getItem('processingToEntryMap');
    if (processingToEntryMap) {
      const map = JSON.parse(processingToEntryMap);
      let hasChanges = false;
      
      Object.keys(map).forEach(tempId => {
        const baseTempId = tempId.includes('-') ? tempId.split('-')[0] : tempId;
        
        if (String(map[tempId]) === String(entryId)) {
          delete map[tempId];
          hasChanges = true;
          processingToEntryIdMap.delete(tempId);
          processingToEntryIdMap.delete(baseTempId);
          completedProcessingEntries.set(tempId, true);
          completedProcessingEntries.set(baseTempId, true);
          deletedProcessingIds.add(baseTempId);
        }
      });
      
      if (hasChanges) {
        localStorage.setItem('processingToEntryMap', JSON.stringify(map));
        
        // Get current entries from processing state, filtered by deletion status
        const currentEntries = getProcessingEntries().filter(id => {
          const baseTempId = id.includes('-') ? id.split('-')[0] : id;
          return !deletedProcessingIds.has(baseTempId) && !isEntryDeleted(baseTempId);
        });
        
        // Dispatch events to notify components
        window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
          detail: { 
            entries: currentEntries,
            lastUpdate: Date.now(),
            removedId: String(entryId),
            forceUpdate: true 
          }
        }));
        
        window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
          detail: { 
            tempId: typeof entryId === 'string' ? entryId : undefined, 
            timestamp: Date.now() 
          }
        }));
      }
    }
  } catch (error) {
    console.error('[Audio Processing] Error removing entry from processing map:', error);
  }
  
  // Also dispatch an entryDeleted event
  window.dispatchEvent(new CustomEvent('entryDeleted', {
    detail: { entryId }
  }));
}

/**
 * Get all deleted entry IDs (both processing IDs and real entry IDs)
 * @returns An object containing sets of deleted IDs
 */
export function getDeletedEntryIds(): { 
  processingIds: Set<string>, 
  entryIds: Set<number> 
} {
  // Merge deleted IDs from session storage too (for iOS persistence)
  try {
    const deletedIds = sessionStorage.getItem('deletedProcessingIds');
    if (deletedIds) {
      const sessionDeletedIds = new Set(JSON.parse(deletedIds));
      sessionDeletedIds.forEach(id => {
        deletedProcessingIds.add(id as string);
      });
    }
  } catch (error) {
    console.error('[Audio Processing] Error merging session storage deleted IDs:', error);
  }
  
  return {
    processingIds: new Set(deletedProcessingIds),
    entryIds: new Set(deletedEntryIds)
  };
}

// Add a debug publisher function to help track voice recording process
export function publishDebugEvent(category: string, action: string, details: string) {
  try {
    // Create and dispatch a custom event for debugging
    const event = new CustomEvent('voiceRecorderDebug', {
      detail: {
        category,
        action,
        details,
        timestamp: Date.now()
      }
    });
    
    window.dispatchEvent(event);
    console.log(`[Debug] ${category}: ${action} - ${details}`);
  } catch (error) {
    // Fail silently
    console.error('Error publishing debug event:', error);
  }
}
