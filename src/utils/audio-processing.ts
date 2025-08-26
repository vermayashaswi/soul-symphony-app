/**
 * Main audio processing module
 * Orchestrates the audio recording and transcription process
 */
import { clearAllToasts, ensureAllToastsCleared } from '@/services/unifiedNotificationService';
import { blobToBase64 } from './audio/blob-utils';
import { supabase } from '@/integrations/supabase/client';
import { processingStateManager, EntryProcessingState } from './journal/processing-state-manager';

// Refactored from original processing-state.ts to simplify
let processingLock = false;
let processingTimeoutId: NodeJS.Timeout | null = null;

// Map to track temporary IDs to entry IDs
const processingToEntryMap = new Map<string, number>();

/**
 * Process and validate the audio blob
 */
function validateAudioBlob(audioBlob: Blob | null): boolean {
  if (!audioBlob) {
    console.error('[AudioProcessing] No audio data to process');
    return false;
  }
  
  // Check if the audio blob has duration
  if (!('duration' in audioBlob) || (audioBlob as any).duration <= 0) {
    console.warn('[AudioProcessing] Audio blob has no duration property or duration is 0');
  }
  
  return true;
}

/**
 * Set up a timeout to release the processing lock if it gets stuck
 */
function setupProcessingTimeout(): NodeJS.Timeout {
  if (processingTimeoutId) {
    clearTimeout(processingTimeoutId);
  }
  
  return setTimeout(() => {
    console.log('[AudioProcessing] Processing timeout triggered');
    processingLock = false;
  }, 60000); // 60 second timeout
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
  if (!validateAudioBlob(audioBlob)) {
    return { 
      success: false, 
      error: 'No audio data to process' 
    };
  }
  
  // Test base64 conversion before proceeding
  try {
    const base64Test = await blobToBase64(audioBlob!);
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
  
  // Generate a unique temporary ID for this processing task
  const timestamp = Date.now();
  const tempId = `entry-${timestamp}-${Math.floor(Math.random() * 1000)}`;
  
  try {
    // Set processing lock to prevent multiple simultaneous processing
    processingLock = true;
    console.log('[AudioProcessing] Set processing lock');
    
    // Setup timeout to prevent deadlocks
    processingTimeoutId = setupProcessingTimeout();
    console.log('[AudioProcessing] Setup processing timeout');
    
    // Register this entry with our processing state manager
    processingStateManager.startProcessing(tempId);
    
    // Log the audio details
    console.log('[AudioProcessing] Processing audio:', {
      size: audioBlob?.size || 0,
      type: audioBlob?.type || 'unknown',
      userId: userId || 'anonymous',
      audioDuration: (audioBlob as any).duration || 'unknown'
    });
    
    // Launch the processing without awaiting it
    console.log('[AudioProcessing] Launching background processing');
    processRecordingInBackground(audioBlob!, userId, tempId)
      .then(result => {
        console.log('[AudioProcessing] Background processing completed:', result);
        
        // If we have an entryId in the result, store the mapping
        if (result.entryId) {
          processingStateManager.setEntryId(tempId, result.entryId);
          processingStateManager.updateEntryState(tempId, EntryProcessingState.COMPLETED);
          console.log(`[AudioProcessing] Mapped tempId ${tempId} to entryId ${result.entryId}`);
          
          // Also store in our local map
          setEntryIdForProcessingId(tempId, result.entryId);
        }
      })
      .catch(err => {
        console.error('[AudioProcessing] Background processing error:', err);
        processingLock = false;
        
        // Mark as error in the state manager
        processingStateManager.updateEntryState(tempId, EntryProcessingState.ERROR, err.message);
        
        // Dispatch a failure event
        window.dispatchEvent(new CustomEvent('processingEntryFailed', {
          detail: { tempId, error: err.message, timestamp: Date.now() }
        }));
      })
      .finally(() => {
        // Always release the lock when done
        processingLock = false;
        if (processingTimeoutId) {
          clearTimeout(processingTimeoutId);
          processingTimeoutId = null;
        }
      });
    
    // Return immediately with the temp ID
    console.log('[AudioProcessing] Returning success with tempId:', tempId);
    
    return { success: true, tempId };
  } catch (error: any) {
    console.error('[AudioProcessing] Error initiating recording process:', error);
    processingLock = false;
    
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Process recording in a separate function that can be executed async
 * This is the part that makes the API call and waits for the response
 */
async function processRecordingInBackground(
  audioBlob: Blob,
  userId: string | undefined,
  tempId: string
): Promise<{ success: boolean; entryId?: number; error?: string }> {
  try {
    console.log(`[AudioProcessing] Background processing started for ${tempId}`);
    
    // Convert the blob to base64
    const base64Audio = await blobToBase64(audioBlob);
    
    // Get the duration of the audio
    let recordingTime = 0;
    if ('duration' in audioBlob) {
      recordingTime = Math.round((audioBlob as any).duration * 1000);
    }
    
    // Prepare the payload
    const payload = {
      audio: base64Audio,
      userId,
      recordingTime,
      highQuality: true
    };
    
    console.log(`[AudioProcessing] Calling transcribe-audio Edge Function for ${tempId}`);
    
    // Call the Supabase Edge Function to transcribe the audio
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: payload
    });
    
    if (error) {
      console.error(`[AudioProcessing] Edge function error for ${tempId}:`, error);
      processingStateManager.updateEntryState(tempId, EntryProcessingState.ERROR, 
        `Server error: ${error.message || 'Unknown error'}`);
        
      return { success: false, error: error.message };
    }
    
    if (!data) {
      console.error(`[AudioProcessing] No data returned from edge function for ${tempId}`);
      processingStateManager.updateEntryState(tempId, EntryProcessingState.ERROR, 
        'No data returned from server');
        
      return { success: false, error: 'No data returned from server' };
    }
    
    console.log(`[AudioProcessing] Edge function success for ${tempId}:`, data);
    
    // Update the state manager with the entry ID
    if (data.entryId) {
      processingStateManager.setEntryId(tempId, data.entryId);
      processingStateManager.updateEntryState(tempId, EntryProcessingState.COMPLETED);
      
      // Also store in our local map
      setEntryIdForProcessingId(tempId, data.entryId);
    }
    
    // Notify anyone who cares that processing is complete
    window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
      detail: { 
        tempId, 
        entryId: data.entryId, 
        timestamp: Date.now() 
      }
    }));
    
    // Also dispatch a data-ready event for any components that need the actual content
    window.dispatchEvent(new CustomEvent('entryContentReady', {
      detail: { 
        tempId, 
        entryId: data.entryId, 
        content: data.refinedText || data.transcription, 
        timestamp: Date.now() 
      }
    }));
    
    // Also trigger a refresh of any components that show entries
    window.dispatchEvent(new CustomEvent('journalEntriesNeedRefresh', {
      detail: { 
        tempId, 
        entryId: data.entryId, 
        timestamp: Date.now() 
      }
    }));
    
    return { 
      success: true, 
      entryId: data.entryId 
    };
  } catch (error: any) {
    console.error(`[AudioProcessing] Error in background processing for ${tempId}:`, error);
    processingStateManager.updateEntryState(tempId, EntryProcessingState.ERROR, 
      error.message || 'Unknown error');
      
    return { 
      success: false, 
      error: error.message || 'Unknown error' 
    };
  }
}

/**
 * Set entry ID for a processing ID (temp ID)
 */
export function setEntryIdForProcessingId(tempId: string, entryId: number): void {
  processingToEntryMap.set(tempId, entryId);
  
  // Also notify the state manager
  processingStateManager.setEntryId(tempId, entryId);
  processingStateManager.updateEntryState(tempId, EntryProcessingState.COMPLETED);
  
  // Also add to localStorage for persistence across page loads
  try {
    const mapStr = localStorage.getItem('processingToEntryMap') || '{}';
    const map = JSON.parse(mapStr);
    map[tempId] = entryId;
    localStorage.setItem('processingToEntryMap', JSON.stringify(map));
    console.log(`[AudioProcessing] Stored tempId -> entryId mapping in localStorage: ${tempId} -> ${entryId}`);
    
    // Dispatch a global event to notify all components
    window.dispatchEvent(new CustomEvent('processingEntryMapped', {
      detail: { 
        tempId, 
        entryId, 
        timestamp: Date.now(),
        forceNotify: true 
      }
    }));
  } catch (error) {
    console.error('[AudioProcessing] Error storing mapping in localStorage:', error);
  }
}

/**
 * Get entry ID for a processing ID (temp ID)
 */
export function getEntryIdForProcessingId(tempId: string): number | undefined {
  // First check with the state manager
  const entryFromManager = processingStateManager.getEntryId(tempId);
  if (entryFromManager) {
    return entryFromManager;
  }
  
  // Next check our in-memory map
  if (processingToEntryMap.has(tempId)) {
    return processingToEntryMap.get(tempId);
  }
  
  // Try to get from localStorage as fallback
  try {
    const mapStr = localStorage.getItem('processingToEntryMap') || '{}';
    const map = JSON.parse(mapStr);
    const entryId = map[tempId];
    
    // If found, also add to in-memory map for faster access next time
    if (entryId) {
      processingToEntryMap.set(tempId, Number(entryId));
      // Also update the state manager
      processingStateManager.setEntryId(tempId, Number(entryId));
      return Number(entryId);
    }
  } catch (error) {
    console.error('[AudioProcessing] Error getting mapping from localStorage:', error);
  }
  
  return undefined;
}

/**
 * Check if processing is currently in progress
 */
export function isProcessingEntry(): boolean {
  return processingLock;
}

/**
 * Reset processing state (useful for recovery)
 */
export function resetProcessingState(): void {
  console.log('[AudioProcessing] Manually resetting processing state');
  processingLock = false;
  
  if (processingTimeoutId) {
    clearTimeout(processingTimeoutId);
    processingTimeoutId = null;
  }
  
  processingStateManager.clearAll();
}

/**
 * Remove a processing entry by ID
 */
export function removeProcessingEntryById(entryId: number | string): void {
  // First notify the state manager
  const entryIdString = entryId.toString(); // Convert to string for consistent handling
  processingStateManager.removeEntry(entryIdString);
  
  // If it's a number (real entry ID), also clean up any mappings
  if (typeof entryId === 'number') {
    // Find all tempIds that map to this entryId
    for (const [tempId, mappedId] of processingToEntryMap.entries()) {
      if (mappedId === entryId) {
        processingToEntryMap.delete(tempId);
        console.log(`[AudioProcessing] Removed mapping for tempId ${tempId} -> entryId ${entryId}`);
      }
    }
    
    // Also clean up localStorage
    try {
      const mapStr = localStorage.getItem('processingToEntryMap') || '{}';
      const map = JSON.parse(mapStr);
      let modified = false;
      
      Object.entries(map).forEach(([tempId, mappedId]) => {
        if (Number(mappedId) === entryId) {
          delete map[tempId];
          modified = true;
        }
      });
      
      if (modified) {
        localStorage.setItem('processingToEntryMap', JSON.stringify(map));
        console.log(`[AudioProcessing] Cleaned up localStorage mappings for entryId ${entryId}`);
      }
    } catch (error) {
      console.error('[AudioProcessing] Error cleaning up localStorage mappings:', error);
    }
  }
  
  // Dispatch an event to notify all components
  window.dispatchEvent(new CustomEvent('processingEntryRemoved', {
    detail: {
      id: entryId,
      timestamp: Date.now()
    }
  }));
}

/**
 * Debug publisher for voice recording process
 */
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
