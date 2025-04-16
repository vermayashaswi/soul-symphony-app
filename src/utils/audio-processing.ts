
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
  removeProcessingEntryById as removeProcessingEntryFromState,
  isEntryDeleted as isEntryDeletedFromState
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

/**
 * Check if a processing entry or actual entry has been deleted
 * @param tempId The processing ID to check
 * @param entryId The entry ID to check
 * @returns True if either ID has been marked as deleted
 */
export function isEntryDeleted(tempId?: string, entryId?: number): boolean {
  if (tempId && (deletedProcessingIds.has(tempId) || isEntryDeletedFromState(tempId))) {
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
    
    // Then check localStorage as fallback
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
  
  // Mark this processing entry as completed
  completedProcessingEntries.set(tempId, true);
  completedProcessingEntries.set(baseTempId, true);
  
  // Also persist to localStorage for cross-page survival
  try {
    const processingToEntryMap = localStorage.getItem('processingToEntryMap');
    const map = processingToEntryMap ? JSON.parse(processingToEntryMap) : {};
    map[tempId] = entryId;
    map[baseTempId] = entryId;
    localStorage.setItem('processingToEntryMap', JSON.stringify(map));
  } catch (error) {
    console.error('[Audio Processing] Error setting entry ID for processing ID:', error);
  }
  
  // Dispatch an event to notify components of the correlation
  window.dispatchEvent(new CustomEvent('processingEntryMapped', {
    detail: { tempId, entryId, timestamp: Date.now() }
  }));
}

/**
 * Clears the processing to entry ID mapping
 */
export function clearProcessingToEntryIdMap(): void {
  processingToEntryIdMap.clear();
  completedProcessingEntries.clear();
  localStorage.removeItem('processingToEntryMap');
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
  clearAllToasts();
  
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
    // Set processing lock to prevent multiple simultaneous processing
    setProcessingLock(true);
    setIsEntryBeingProcessed(true);
    console.log('[AudioProcessing] Set processing locks');
    
    // Setup timeout to prevent deadlocks
    setupProcessingTimeout();
    console.log('[AudioProcessing] Setup processing timeout');
    
    // Add this entry to localStorage to persist across navigations
    const updatedEntries = updateProcessingEntries(tempId, 'add');
    console.log('[AudioProcessing] Updated processing entries in localStorage:', updatedEntries);
    
    // Log the audio details
    console.log('[AudioProcessing] Processing audio:', {
      size: audioBlob?.size || 0,
      type: audioBlob?.type || 'unknown',
      userId: userId || 'anonymous',
      audioDuration: (audioBlob as any).duration || 'unknown'
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
      });
    
    // Return immediately with the temp ID
    console.log('[AudioProcessing] Returning success with tempId:', tempId);
    
    // Force a custom event dispatch to ensure UI updates
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { entries: updatedEntries, lastUpdate: Date.now(), forceUpdate: true }
    }));
    
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
  // Extract base tempId without timestamp if it has one
  const baseTempId = tempId.includes('-') ? tempId.split('-')[0] : tempId;
  
  // Check if it's marked as completed in memory
  if (completedProcessingEntries.has(tempId) || completedProcessingEntries.has(baseTempId)) {
    return true;
  }
  
  // Check if it has a mapped entry ID
  const entryId = getEntryIdForProcessingId(tempId);
  return entryId !== undefined;
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
  }
  
  // Then, clean up the map storage
  try {
    const processingToEntryMap = localStorage.getItem('processingToEntryMap');
    if (processingToEntryMap) {
      const map = JSON.parse(processingToEntryMap);
      const idStr = String(entryId);
      
      // Find and remove any entry with this ID
      let hasChanges = false;
      Object.keys(map).forEach(tempId => {
        // Extract base tempId without timestamp if it has one
        const baseTempId = tempId.includes('-') ? tempId.split('-')[0] : tempId;
        
        if (String(map[tempId]) === idStr) {
          delete map[tempId];
          hasChanges = true;
          // Also remove from memory map
          processingToEntryIdMap.delete(tempId);
          processingToEntryIdMap.delete(baseTempId);
          // Mark as completed (technically deleted, but this prevents it from showing again)
          completedProcessingEntries.set(tempId, true);
          completedProcessingEntries.set(baseTempId, true);
          // And mark as deleted
          deletedProcessingIds.add(baseTempId);
          console.log(`[Audio Processing] Removed mapping for tempId ${tempId} -> ${idStr}`);
        }
      });
      
      // If this is a temp ID itself, mark it as deleted
      if (typeof entryId === 'string') {
        // Extract base tempId without timestamp if it has one
        const baseTempId = entryId.includes('-') ? entryId.split('-')[0] : entryId;
        deletedProcessingIds.add(baseTempId);
        completedProcessingEntries.set(baseTempId, true);
        
        if (map[entryId] || map[baseTempId]) {
          const mappedEntryId = Number(map[entryId] || map[baseTempId]);
          if (!isNaN(mappedEntryId)) {
            deletedEntryIds.add(mappedEntryId);
            console.log(`[Audio Processing] Added mapped entry ID ${mappedEntryId} to deleted entries set`);
          }
          delete map[entryId];
          delete map[baseTempId];
          hasChanges = true;
        }
      }
      
      // Update storage if changes were made
      if (hasChanges) {
        localStorage.setItem('processingToEntryMap', JSON.stringify(map));
        
        // Dispatch an event to notify other components
        window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
          detail: { 
            entries: getProcessingEntries().filter(id => {
              const baseTempId = id.includes('-') ? id.split('-')[0] : id;
              return !deletedProcessingIds.has(baseTempId) && !isEntryDeleted(baseTempId);
            }),
            lastUpdate: Date.now(),
            removedId: idStr,
            forceUpdate: true 
          }
        }));
      }
    }
  } catch (error) {
    console.error('[Audio Processing] Error removing entry from processing map:', error);
  }
  
  // Also, ensure we update the UI by dispatching an additional event
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
  return {
    processingIds: new Set(deletedProcessingIds),
    entryIds: new Set(deletedEntryIds)
  };
}
