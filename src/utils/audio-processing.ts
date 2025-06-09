
/**
 * Main audio processing module
 * Orchestrates the audio recording and transcription process
 */
import { clearAllToasts, ensureAllToastsCleared } from '@/services/notificationService';
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
  
  // Check minimum size (at least 100 bytes for a valid audio file)
  if (audioBlob.size < 100) {
    console.error('[AudioProcessing] Audio blob too small:', audioBlob.size, 'bytes');
    return false;
  }
  
  // Check maximum size (25MB limit)
  const maxSize = 25 * 1024 * 1024; // 25MB
  if (audioBlob.size > maxSize) {
    console.error('[AudioProcessing] Audio blob too large:', audioBlob.size, 'bytes');
    return false;
  }
  
  // Check if the audio blob has duration
  if (!('duration' in audioBlob) || (audioBlob as any).duration <= 0) {
    console.warn('[AudioProcessing] Audio blob has no duration property or duration is 0');
  }
  
  console.log('[AudioProcessing] Audio blob validation passed:', {
    size: audioBlob.size,
    type: audioBlob.type,
    duration: (audioBlob as any).duration || 'unknown'
  });
  
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
  
  // Validate inputs
  if (!userId) {
    console.error('[AudioProcessing] No user ID provided');
    return { 
      success: false, 
      error: 'User authentication required' 
    };
  }
  
  // Validate the audio blob
  if (!validateAudioBlob(audioBlob)) {
    return { 
      success: false, 
      error: 'Invalid audio data - please try recording again' 
    };
  }
  
  // Test base64 conversion before proceeding
  try {
    const base64Test = await blobToBase64(audioBlob!);
    console.log('[AudioProcessing] Base64 test conversion successful, length:', base64Test.length);
    
    // Make sure we have reasonable data
    if (base64Test.length < 100) {
      return {
        success: false,
        error: 'Audio data appears too short or invalid'
      };
    }
    
    // Validate base64 format
    const base64Data = base64Test.replace(/^data:audio\/[^;]+;base64,/, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
      return {
        success: false,
        error: 'Audio data format is invalid'
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
  userId: string,
  tempId: string
): Promise<{ success: boolean; entryId?: number; error?: string }> {
  try {
    console.log(`[AudioProcessing] Background processing started for ${tempId}`);
    
    // Convert the blob to base64
    const base64Audio = await blobToBase64(audioBlob);
    console.log(`[AudioProcessing] Base64 conversion complete, length: ${base64Audio.length}`);
    
    // Get the duration of the audio
    let recordingTime = 0;
    if ('duration' in audioBlob) {
      recordingTime = Math.round((audioBlob as any).duration * 1000);
    }
    
    // Get the current session for authorization
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error(`[AudioProcessing] Session error for ${tempId}:`, sessionError);
      throw new Error(`Authentication error: ${sessionError.message}`);
    }
    
    const accessToken = session?.access_token;
    
    if (!accessToken) {
      console.error(`[AudioProcessing] No access token found for ${tempId}`);
      throw new Error('No valid session found - please log in again');
    }
    
    // Prepare the payload with validation
    const payload = {
      audio: base64Audio,
      userId,
      recordingTime,
      highQuality: true
    };
    
    // Validate payload before sending
    if (!payload.audio || payload.audio.length < 100) {
      throw new Error('Invalid audio data in payload');
    }
    
    if (!payload.userId) {
      throw new Error('Missing userId in payload');
    }
    
    console.log(`[AudioProcessing] Calling transcribe-audio Edge Function for ${tempId}`, {
      audioLength: payload.audio.length,
      userId: payload.userId,
      recordingTime: payload.recordingTime
    });
    
    // Call the Supabase Edge Function with proper headers and error handling
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: payload,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (error) {
      console.error(`[AudioProcessing] Edge function error for ${tempId}:`, error);
      
      // Provide more specific error messages
      let errorMessage = `Server error: ${error.message || 'Unknown error'}`;
      
      if (error.message?.includes('JSON') || error.message?.includes('empty')) {
        errorMessage = 'Audio data format error - please try recording again';
      } else if (error.message?.includes('auth')) {
        errorMessage = 'Authentication failed - please log in again';
      } else if (error.message?.includes('size') || error.message?.includes('large')) {
        errorMessage = 'Audio file too large - please record a shorter message';
      } else if (error.message?.includes('Invalid request data')) {
        errorMessage = 'Invalid audio data - please try recording again';
      }
      
      processingStateManager.updateEntryState(tempId, EntryProcessingState.ERROR, errorMessage);
      return { success: false, error: errorMessage };
    }
    
    if (!data) {
      console.error(`[AudioProcessing] No data returned from edge function for ${tempId}`);
      const errorMessage = 'No response from server - please try again';
      processingStateManager.updateEntryState(tempId, EntryProcessingState.ERROR, errorMessage);
      return { success: false, error: errorMessage };
    }
    
    console.log(`[AudioProcessing] Edge function success for ${tempId}:`, {
      entryId: data.entryId,
      transcriptionLength: data.transcription?.length || 0,
      hasRefinedText: !!data.refinedText,
      processingTime: data.processingTime
    });
    
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
    
    // Provide user-friendly error messages
    let userFriendlyError = 'Processing failed - please try again';
    
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      userFriendlyError = 'Network error - please check your connection';
    } else if (error.message?.includes('auth') || error.message?.includes('session')) {
      userFriendlyError = 'Session expired - please log in again';
    } else if (error.message?.includes('audio') || error.message?.includes('base64')) {
      userFriendlyError = 'Audio format error - please try recording again';
    }
    
    processingStateManager.updateEntryState(tempId, EntryProcessingState.ERROR, userFriendlyError);
    
    return { 
      success: false, 
      error: userFriendlyError 
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
